/**
 * @file search/serpapi.js
 * @description SerpAPI fallback — searches Google Shopping for luxury resale
 * listings when direct platform APIs fail or aren't available.
 */

const SERPAPI_ENDPOINT = 'https://serpapi.com/search.json';

/**
 * Search Google Shopping via SerpAPI for resale listings.
 * @param {string} query       - Search query (brand + product name).
 * @param {string} apiKey      - SerpAPI API key.
 * @param {Object} [options]
 * @param {number} [options.limit=10]
 * @returns {Promise<Object[]>} Normalized listing results.
 */
export async function searchSerpApi(query, apiKey, options = {}) {
  if (!apiKey) {
    console.warn('[MaisonDeux][serpapi] No API key');
    return [];
  }

  try {
    const limit = options.limit || 10;

    // Search Google Shopping for resale/pre-owned listings.
    const params = new URLSearchParams({
      engine: 'google_shopping',
      q: `${query} pre-owned OR used OR secondhand`,
      api_key: apiKey,
      num: String(limit),
      gl: 'us',
      hl: 'en',
    });

    const res = await fetch(`${SERPAPI_ENDPOINT}?${params}`);
    if (!res.ok) {
      console.warn(`[MaisonDeux][serpapi] ${res.status}`);
      return [];
    }

    const data = await res.json();
    const results = data.shopping_results || [];

    return results.slice(0, limit).map((item) => {
      // Try to identify which platform the listing is from.
      const platform = identifyPlatform(item.link || item.source || '');

      return {
        title: item.title || '',
        price: item.extracted_price ? `$${item.extracted_price}` : item.price || '',
        priceValue: item.extracted_price || parseFloat((item.price || '').replace(/[^0-9.]/g, '')) || 0,
        currency: 'USD',
        img: item.thumbnail || '',
        link: item.link || item.product_link || '',
        condition: item.extensions?.find((e) => /condition|pre-owned|used|new/i.test(e)) || '',
        platform: platform || 'google-shopping',
        source: 'serpapi',
        seller: item.source || '',
      };
    });
  } catch (err) {
    console.error('[MaisonDeux][serpapi] Search failed:', err.message);
    return [];
  }
}

/**
 * Try to identify which resale platform a URL belongs to.
 * @param {string} urlOrSource
 * @returns {string|null}
 */
function identifyPlatform(urlOrSource) {
  const s = urlOrSource.toLowerCase();
  if (s.includes('therealreal')) return 'therealreal';
  if (s.includes('ebay'))        return 'ebay';
  if (s.includes('poshmark'))    return 'poshmark';
  if (s.includes('vestiaire'))   return 'vestiaire';
  if (s.includes('grailed'))     return 'grailed';
  if (s.includes('mercari'))     return 'mercari';
  if (s.includes('shopgoodwill'))return 'shopgoodwill';
  if (s.includes('fashionphile'))return 'fashionphile';
  if (s.includes('rebag'))       return 'rebag';
  if (s.includes('1stdibs'))     return '1stdibs';
  return null;
}
