/**
 * @file background.js
 * @description Service worker that orchestrates the MaisonDeux pipeline:
 * 1. Receives PRODUCT_DETECTED from content script
 * 2. Classifies the source product (heuristic or AI)
 * 3. Creates offscreen document and sends SEARCH_PLATFORMS
 * 4. Receives IFRAME_RESULTS, classifies and scores them
 * 5. Sends DEAL_RESULTS to the side panel
 * 6. Updates extension badge with deal count
 */

import { classifyHeuristic } from './classifier.js';
import { normalizeAll } from './taxonomy.js';
import { filterAndRank } from './relevance.js';
import cache from './utils/cache.js';
import logger from './utils/logger.js';
import { fetchRates } from './utils/currency.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Per-tab product state. @type {Map<number, Object>} */
const tabProducts = new Map();

/** Whether the extension is active (user toggle). */
let isActive = true;

/** Offscreen document creation guard. */
let offscreenCreating = null;

/** All platforms we search across. */
const ALL_PLATFORMS = ['therealreal', 'ebay', 'poshmark', 'vestiaire', 'grailed', 'mercari', 'shopgoodwill'];

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

fetchRates().then(() => logger.info('Exchange rates loaded'));

// Load active state.
chrome.storage.local.get('maisondeux_active', (data) => {
  isActive = data.maisondeux_active !== false;
});

// Open side panel when extension icon is clicked.
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Enable side panel to open on action click.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// ---------------------------------------------------------------------------
// Message router
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message;
  logger.debug(`Message: ${type}`);

  switch (type) {
    case 'PRODUCT_DETECTED':
      handleProductDetected(payload, sender.tab);
      break;

    case 'GET_CURRENT_PRODUCT':
      handleGetCurrentProduct(sendResponse);
      return true; // async

    case 'SET_ACTIVE':
      isActive = payload.active;
      chrome.storage.local.set({ maisondeux_active: isActive });
      if (!isActive) {
        chrome.action.setBadgeText({ text: '' });
      }
      break;

    case 'IFRAME_RESULTS':
      handleIframeResults(payload);
      break;

    case 'DEALS_COUNT':
      if (payload.count > 0) {
        chrome.action.setBadgeText({ text: String(payload.count) });
        chrome.action.setBadgeBackgroundColor({ color: '#2e7d32' });
      }
      break;

    case 'UPDATE_SETTINGS':
      // Broadcast to all tabs.
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id, message).catch(() => {});
        }
      });
      break;

    default:
      logger.warn(`Unknown message type: ${type}`);
  }
});

// Clean up when tabs close.
chrome.tabs.onRemoved.addListener((tabId) => {
  tabProducts.delete(tabId);
});

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleProductDetected(product, tab) {
  if (!isActive || !tab?.id) return;

  const tabId = tab.id;
  logger.info(`Product detected on tab ${tabId}: ${product.brand} ${product.productName || product.title}`);

  // Classify the source product.
  const classified = classifyHeuristic(product);
  const enrichedProduct = { ...product, attrs: classified, ...classified };
  tabProducts.set(tabId, enrichedProduct);

  // Notify side panel.
  broadcastToExtension({
    type: 'PRODUCT_DETECTED',
    payload: enrichedProduct,
  });

  // Determine which platforms to search (exclude the current one).
  const currentPlatform = product.platform || product.source || '';
  const platforms = ALL_PLATFORMS.filter((p) => p !== currentPlatform);

  // Notify side panel that search is starting.
  broadcastToExtension({
    type: 'SEARCH_STARTED',
    payload: { platformCount: platforms.length },
  });

  // Check cache first.
  const cacheKey = `search:${product.brand}:${product.productName || product.title}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    logger.info('Using cached search results');
    broadcastToExtension({
      type: 'DEAL_RESULTS',
      payload: { listings: cached, complete: true },
    });
    chrome.action.setBadgeText({ text: String(cached.length) });
    chrome.action.setBadgeBackgroundColor({ color: '#2e7d32' });
    return;
  }

  // Create offscreen document and search.
  try {
    await ensureOffscreenDocument();
    chrome.runtime.sendMessage({
      type: 'SEARCH_PLATFORMS',
      payload: { product: enrichedProduct, platforms },
    });
  } catch (err) {
    logger.error(`Failed to start search: ${err.message}`);
  }
}

function handleGetCurrentProduct(sendResponse) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const product = tabProducts.get(tabs[0]?.id) || null;
    sendResponse({ product });
  });
}

async function handleIframeResults(payload) {
  const { source, listings, complete } = payload;

  if (!listings?.length && !complete) return;

  // Classify each listing heuristically.
  const classified = (listings || []).map((listing) => {
    const text = [listing.title, listing.condition].filter(Boolean).join(' ');
    const attrs = normalizeAll(text);
    return {
      ...listing,
      attrs,
      brand: attrs.brands[0] || null,
      color: attrs.colors[0] || null,
      material: attrs.materials[0] || null,
      size: attrs.sizes[0] || null,
      condition: attrs.conditions[0] || null,
      category: attrs.categories[0] || null,
    };
  });

  // Score and rank against source product.
  const activeTab = await getActiveTab();
  const sourceProduct = tabProducts.get(activeTab?.id);

  let rankedResults = classified;
  if (sourceProduct) {
    rankedResults = filterAndRank(sourceProduct, classified, { minScore: 0.1, maxResults: 50 });
  }

  // Send to side panel.
  broadcastToExtension({
    type: 'DEAL_RESULTS',
    payload: {
      listings: rankedResults,
      platform: payload.platform,
      complete: !!complete,
    },
  });

  // Cache complete results.
  if (complete && sourceProduct && rankedResults.length) {
    const cacheKey = `search:${sourceProduct.brand}:${sourceProduct.productName || sourceProduct.title}`;
    cache.set(cacheKey, rankedResults).catch(() => {});
  }

  // Update badge.
  if (complete) {
    const count = rankedResults.length;
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#2e7d32' });
  }
}

// ---------------------------------------------------------------------------
// Offscreen document lifecycle
// ---------------------------------------------------------------------------

async function ensureOffscreenDocument() {
  // Check if it already exists.
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });

  if (contexts.length > 0) return;

  // Prevent concurrent creation.
  if (offscreenCreating) {
    await offscreenCreating;
    return;
  }

  offscreenCreating = chrome.offscreen.createDocument({
    url: 'offscreen/offscreen.html',
    reasons: ['IFRAME_SCRIPTING'],
    justification: 'Search resale platforms via hidden iframes',
  });

  await offscreenCreating;
  offscreenCreating = null;
  logger.info('Offscreen document created');
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function broadcastToExtension(message) {
  chrome.runtime.sendMessage(message).catch(() => {
    // No listeners — side panel might not be open. That's fine.
  });
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}
