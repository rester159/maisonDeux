/**
 * @file background.js
 * @description Service worker that orchestrates the MaisonDeux pipeline.
 * Uses API-based search (not iframes) for cross-platform deal finding.
 *
 * Flow:
 * 1. Content script sends PRODUCT_DETECTED
 * 2. Classify product heuristically
 * 3. Search all platforms via API adapters (parallel)
 * 4. Classify and score results
 * 5. Send DEAL_RESULTS to side panel
 * 6. Update badge
 */

import { classifyHeuristic } from './classifier.js';
import { normalizeAll } from './taxonomy.js';
import { filterAndRank } from './relevance.js';
import { searchAllPlatforms } from './search/index.js';
import cache from './utils/cache.js';
import logger from './utils/logger.js';
import { fetchRates } from './utils/currency.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const tabProducts = new Map();
let isActive = true;

const ALL_PLATFORMS = ['therealreal', 'ebay', 'poshmark', 'vestiaire', 'grailed', 'mercari', 'shopgoodwill'];

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

fetchRates().then(() => logger.info('Exchange rates loaded'));

chrome.storage.local.get('maisondeux_active', (data) => {
  isActive = data.maisondeux_active !== false;
});

// Open side panel on action click.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// ---------------------------------------------------------------------------
// Message router
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message;

  switch (type) {
    case 'PRODUCT_DETECTED':
      handleProductDetected(payload, sender.tab);
      break;

    case 'GET_CURRENT_PRODUCT':
      handleGetCurrentProduct(sendResponse);
      return true;

    case 'SET_ACTIVE':
      isActive = payload.active;
      chrome.storage.local.set({ maisondeux_active: isActive });
      if (!isActive) chrome.action.setBadgeText({ text: '' });
      break;

    case 'UPDATE_SETTINGS':
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id, message).catch(() => {});
        }
      });
      break;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => tabProducts.delete(tabId));

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleProductDetected(product, tab) {
  if (!isActive || !tab?.id) return;

  const tabId = tab.id;
  logger.info(`Product detected: ${product.brand} ${product.productName || product.title}`);

  // Classify source product.
  const classified = classifyHeuristic(product);
  const enrichedProduct = { ...product, attrs: classified, ...classified };
  tabProducts.set(tabId, enrichedProduct);

  // Notify side panel.
  broadcast({ type: 'PRODUCT_DETECTED', payload: enrichedProduct });

  // Determine platforms to search (exclude current).
  const currentPlatform = product.platform || product.source || '';
  const platforms = ALL_PLATFORMS.filter((p) => p !== currentPlatform);

  broadcast({ type: 'SEARCH_STARTED', payload: { platformCount: platforms.length } });

  // Check cache.
  const cacheKey = `search:${product.brand}:${product.productName || product.title}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    logger.info('Using cached results');
    broadcast({ type: 'DEAL_RESULTS', payload: { listings: cached, complete: true } });
    updateBadge(cached.length);
    return;
  }

  // Load credentials from storage.
  const creds = await loadCredentials();

  // Search all platforms via API.
  let allResults = [];

  try {
    allResults = await searchAllPlatforms(enrichedProduct, platforms, creds, (platform, results) => {
      // Classify and score each batch as it arrives.
      const scored = classifyAndScore(results, enrichedProduct);
      if (scored.length) {
        broadcast({
          type: 'DEAL_RESULTS',
          payload: { listings: scored, platform, complete: false },
        });
      }
      logger.info(`${platform}: ${results.length} raw → ${scored.length} scored`);
    });
  } catch (err) {
    logger.error(`Search failed: ${err.message}`);
  }

  // Final scoring of all results together.
  const finalResults = classifyAndScore(allResults, enrichedProduct);

  // Send final results.
  broadcast({
    type: 'DEAL_RESULTS',
    payload: { listings: finalResults, complete: true },
  });

  broadcast({
    type: 'DEALS_COUNT',
    payload: { count: finalResults.length },
  });

  updateBadge(finalResults.length);

  // Cache results.
  if (finalResults.length) {
    cache.set(cacheKey, finalResults).catch(() => {});
  }

  logger.info(`Search complete: ${finalResults.length} deals`);
}

function handleGetCurrentProduct(sendResponse) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const product = tabProducts.get(tabs[0]?.id) || null;
    sendResponse({ product });
  });
}

// ---------------------------------------------------------------------------
// Classification & scoring
// ---------------------------------------------------------------------------

function classifyAndScore(results, sourceProduct) {
  if (!results?.length) return [];

  const classified = results.map((listing) => {
    const text = [listing.title, listing.condition].filter(Boolean).join(' ');
    const attrs = normalizeAll(text);
    return {
      ...listing,
      attrs,
      brand: attrs.brands[0] || listing.brand || null,
      color: attrs.colors[0] || listing.color || null,
      material: attrs.materials[0] || listing.material || null,
      size: attrs.sizes[0] || listing.size || null,
      condition: attrs.conditions[0] || listing.condition || null,
      category: attrs.categories[0] || listing.category || null,
    };
  });

  return filterAndRank(sourceProduct, classified, { minScore: 0.1, maxResults: 50 });
}

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

async function loadCredentials() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(null, (settings) => {
      resolve({
        ebay: {
          appId: settings.ebay_app_id || '',
          certId: settings.ebay_cert_id || '',
        },
        therealreal: {
          apiKey: settings.therealreal_api_key || '',
        },
        vestiaire: {
          apiKey: settings.vestiaire_api_key || '',
        },
        shopgoodwill: {
          accessToken: settings.shopgoodwill_access_token || '',
        },
        poshmark: {},
        grailed: {},
        mercari: {},
        serpApiKey: settings.serpapi_key || '',
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function broadcast(message) {
  chrome.runtime.sendMessage(message).catch(() => {});
}

function updateBadge(count) {
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#2e7d32' });
}
