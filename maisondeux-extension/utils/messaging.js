/**
 * @file messaging.js
 * @description Message type constants for inter-component communication within
 * the MaisonDeux extension. All messages sent via chrome.runtime.sendMessage
 * or chrome.tabs.sendMessage should use these constants as the `type` field.
 */

/** A product page was detected by a content script. */
export const PRODUCT_DETECTED = 'PRODUCT_DETECTED';

/** Request to search other platforms for a matching product. */
export const SEARCH_PLATFORMS = 'SEARCH_PLATFORMS';

/** Results scraped from an iframe search on another platform. */
export const IFRAME_RESULTS = 'IFRAME_RESULTS';

/** Aggregated deal comparison results ready for display. */
export const DEAL_RESULTS = 'DEAL_RESULTS';

/** Badge-update payload containing the number of deals found. */
export const DEALS_COUNT = 'DEALS_COUNT';

/** Popup requests the product data for the currently active tab. */
export const GET_CURRENT_PRODUCT = 'GET_CURRENT_PRODUCT';

/** User changed a setting — broadcast to all listeners. */
export const UPDATE_SETTINGS = 'UPDATE_SETTINGS';
