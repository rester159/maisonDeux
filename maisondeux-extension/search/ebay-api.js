/**
 * @file search/ebay-api.js
 * @description eBay search via the Browse API (Finding API fallback).
 * Uses the App ID for client credentials OAuth token, then searches.
 */

const TOKEN_ENDPOINT = 'https://api.ebay.com/identity/v1/oauth2/token';
const BROWSE_ENDPOINT = 'https://api.ebay.com/buy/browse/v1/item_summary/search';

/** Cached OAuth token. */
let cachedToken = null;
let tokenExpiry = 0;

/**
 * Search eBay via the Browse API.
 * @param {string} query - Search query.
 * @param {Object} credentials - { appId, certId }
 * @param {Object} [options]
 * @param {number} [options.limit=10]
 * @returns {Promise<Object[]>} Normalized listing results.
 */
export async function searchEbay(query, credentials, options = {}) {
  const { appId, certId } = credentials;
  if (!appId || !certId) {
    console.warn('[MaisonDeux][ebay-api] Missing appId or certId');
    return [];
  }

  try {
    const token = await getOAuthToken(appId, certId);
    const limit = options.limit || 10;

    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
      filter: 'conditionIds:{1000|1500|2000|2500|3000}', // New to Good condition
    });

    const res = await fetch(`${BROWSE_ENDPOINT}?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      console.warn(`[MaisonDeux][ebay-api] Browse API ${res.status}`);
      return [];
    }

    const data = await res.json();
    const items = data.itemSummaries || [];

    return items.map((item) => ({
      title: item.title || '',
      price: item.price ? `${item.price.currency} ${item.price.value}` : '',
      priceValue: item.price ? parseFloat(item.price.value) : 0,
      currency: item.price?.currency || 'USD',
      img: item.thumbnailImages?.[0]?.imageUrl || item.image?.imageUrl || '',
      link: item.itemWebUrl || '',
      condition: item.condition || '',
      platform: 'ebay',
      source: 'ebay-api',
      sellerId: item.seller?.username || '',
      sellerRating: item.seller?.feedbackPercentage || '',
      itemId: item.itemId || '',
    }));
  } catch (err) {
    console.error('[MaisonDeux][ebay-api] Search failed:', err.message);
    return [];
  }
}

/**
 * Get an OAuth application token using client credentials grant.
 * @param {string} appId
 * @param {string} certId
 * @returns {Promise<string>}
 */
async function getOAuthToken(appId, certId) {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const basicAuth = btoa(`${appId}:${certId}`);

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
  });

  if (!res.ok) {
    throw new Error(`eBay OAuth failed: ${res.status}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // Refresh 60s early
  return cachedToken;
}
