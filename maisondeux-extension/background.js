/**
 * @file background.js
 * @description Service worker entry point for the MaisonDeux extension.
 * Coordinates message routing between content scripts, the popup, the
 * offscreen document, and cross-platform search iframes.
 */

import {
  PRODUCT_DETECTED,
  SEARCH_PLATFORMS,
  IFRAME_RESULTS,
  DEAL_RESULTS,
  DEALS_COUNT,
  GET_CURRENT_PRODUCT,
  UPDATE_SETTINGS,
} from './utils/messaging.js';
import logger from './utils/logger.js';
import cache from './utils/cache.js';
import { fetchRates } from './utils/currency.js';

/**
 * Per-tab state: the product extracted from the currently viewed page.
 * @type {Map<number, Object>}
 */
const tabProducts = new Map();

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

/** Prefetch exchange rates on startup. */
fetchRates().then(() => logger.info('Exchange rates loaded'));

// ---------------------------------------------------------------------------
// Message router
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message;
  logger.debug(`Message received: ${type}`, payload);

  switch (type) {
    case PRODUCT_DETECTED: {
      const tabId = sender.tab?.id;
      if (tabId != null) {
        tabProducts.set(tabId, payload);
        logger.info(`Product detected on tab ${tabId}`, payload);
      }
      break;
    }

    case GET_CURRENT_PRODUCT: {
      // The popup asks for the current tab's product.
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const product = tabProducts.get(tabs[0]?.id) || null;
        sendResponse({ product });
      });
      return true; // async sendResponse
    }

    case SEARCH_PLATFORMS:
      // TODO: orchestrate iframe-based cross-platform searches.
      logger.info('Search requested', payload);
      break;

    case IFRAME_RESULTS:
      // TODO: aggregate results and compute deals.
      logger.info('Iframe results received', payload);
      break;

    case UPDATE_SETTINGS:
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

// Clean up tab state when tabs close.
chrome.tabs.onRemoved.addListener((tabId) => {
  tabProducts.delete(tabId);
});
