/**
 * @file search/index.js
 * @description Unified search dispatcher. Tries API-based search for each
 * platform, falls back to SerpAPI, aggregates all results.
 */

import { searchEbay } from './ebay-api.js';
import {
  searchTheRealReal,
  searchPoshmark,
  searchVestiaire,
  searchGrailed,
  searchMercari,
  searchShopGoodwill,
} from './platform-fetch.js';
import { searchSerpApi } from './serpapi.js';

/**
 * @typedef {Object} SearchCredentials
 * @property {Object} [ebay]         - { appId, certId }
 * @property {Object} [therealreal]  - { apiKey, cookie }
 * @property {Object} [poshmark]     - { cookie }
 * @property {Object} [vestiaire]    - { apiKey, cookie }
 * @property {Object} [grailed]      - { cookie }
 * @property {Object} [mercari]      - { cookie }
 * @property {Object} [shopgoodwill] - { accessToken }
 * @property {string} [serpApiKey]    - SerpAPI key
 */

/**
 * Search all platforms for a product. Runs platform APIs in parallel,
 * then fills gaps with SerpAPI.
 *
 * @param {Object} product         - Classified source product.
 * @param {string[]} platforms     - Platform keys to search.
 * @param {SearchCredentials} creds - API credentials.
 * @param {Function} onPlatformDone - Called with (platform, results) as each finishes.
 * @returns {Promise<Object[]>}     All results aggregated.
 */
export async function searchAllPlatforms(product, platforms, creds, onPlatformDone) {
  const query = buildQuery(product);
  const allResults = [];
  const failedPlatforms = [];

  // Run all platform searches in parallel.
  const searches = platforms.map(async (platform) => {
    let results = [];

    try {
      results = await searchPlatform(platform, query, creds);
    } catch (err) {
      console.warn(`[MaisonDeux][search] ${platform} failed:`, err.message);
    }

    if (results.length === 0) {
      failedPlatforms.push(platform);
    }

    allResults.push(...results);
    if (onPlatformDone) onPlatformDone(platform, results);
  });

  await Promise.allSettled(searches);

  // SerpAPI fallback for platforms that returned nothing.
  if (creds.serpApiKey && failedPlatforms.length > 0) {
    try {
      console.debug(`[MaisonDeux][search] SerpAPI fallback for: ${failedPlatforms.join(', ')}`);
      const serpResults = await searchSerpApi(query, creds.serpApiKey, { limit: 15 });
      allResults.push(...serpResults);
      if (onPlatformDone) onPlatformDone('serpapi', serpResults);
    } catch (err) {
      console.warn('[MaisonDeux][search] SerpAPI fallback failed:', err.message);
    }
  }

  return allResults;
}

/**
 * Search a single platform.
 * @param {string} platform
 * @param {string} query
 * @param {SearchCredentials} creds
 * @returns {Promise<Object[]>}
 */
async function searchPlatform(platform, query, creds) {
  switch (platform) {
    case 'ebay':
      return searchEbay(query, creds.ebay || {});
    case 'therealreal':
      return searchTheRealReal(query, creds.therealreal || {});
    case 'poshmark':
      return searchPoshmark(query, creds.poshmark || {});
    case 'vestiaire':
      return searchVestiaire(query, creds.vestiaire || {});
    case 'grailed':
      return searchGrailed(query, creds.grailed || {});
    case 'mercari':
      return searchMercari(query, creds.mercari || {});
    case 'shopgoodwill':
      return searchShopGoodwill(query, creds.shopgoodwill || {});
    default:
      return [];
  }
}

/**
 * Build a search query string from product attributes.
 * @param {Object} product
 * @returns {string}
 */
function buildQuery(product) {
  return [
    product.brand,
    product.model,
    product.productName || product.title,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}
