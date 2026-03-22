/**
 * @file search/platform-fetch.js
 * @description Direct fetch adapters for platforms that expose JSON search
 * endpoints. Uses public or authenticated endpoints depending on credentials.
 */

/**
 * Search TheRealReal.
 * Their search returns JSON when you hit the API endpoint.
 * @param {string} query
 * @param {Object} [credentials] - { apiKey } or { cookie }
 * @returns {Promise<Object[]>}
 */
export async function searchTheRealReal(query, credentials = {}) {
  try {
    const url = `https://www.therealreal.com/api/search?q=${encodeURIComponent(query)}&per_page=10`;
    const headers = { 'Accept': 'application/json' };
    if (credentials.cookie) headers['Cookie'] = credentials.cookie;
    if (credentials.apiKey) headers['Authorization'] = `Bearer ${credentials.apiKey}`;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      // Fallback: try the public web search endpoint
      return await searchTheRealRealWeb(query);
    }

    const data = await res.json();
    const items = data.products || data.results || data.data || [];

    return items.slice(0, 10).map((item) => ({
      title: [item.designer_name, item.name].filter(Boolean).join(' ') || item.title || '',
      price: item.price ? `$${item.price}` : item.display_price || '',
      priceValue: parseFloat(item.price || item.sale_price || 0),
      currency: 'USD',
      img: item.image_url || item.primary_image || '',
      link: item.url ? `https://www.therealreal.com${item.url}` : '',
      condition: item.condition || '',
      platform: 'therealreal',
      source: 'api',
    }));
  } catch (err) {
    console.warn('[MaisonDeux][therealreal] API search failed:', err.message);
    return await searchTheRealRealWeb(query);
  }
}

async function searchTheRealRealWeb(query) {
  try {
    const res = await fetch(`https://www.therealreal.com/shop?search=${encodeURIComponent(query)}`, {
      headers: { 'Accept': 'text/html' },
    });
    if (!res.ok) return [];
    const html = await res.text();

    // Try to extract JSON data from the page's embedded script tags.
    const match = html.match(/__NEXT_DATA__.*?<\/script>/s) || html.match(/window\.__data\s*=\s*({.*?});/s);
    if (!match) return [];

    // Parse limited results from embedded data.
    return [];
  } catch {
    return [];
  }
}

/**
 * Search Poshmark.
 * Poshmark has a public API endpoint for search.
 * @param {string} query
 * @param {Object} [credentials] - { cookie }
 * @returns {Promise<Object[]>}
 */
export async function searchPoshmark(query, credentials = {}) {
  try {
    const url = `https://poshmark.com/api/search?query=${encodeURIComponent(query)}&type=listings&count=10`;
    const headers = { 'Accept': 'application/json' };
    if (credentials.cookie) headers['Cookie'] = credentials.cookie;

    const res = await fetch(url, { headers });
    if (!res.ok) return [];

    const data = await res.json();
    const items = data.data || data.listings || [];

    return items.slice(0, 10).map((item) => ({
      title: [item.brand, item.title].filter(Boolean).join(' '),
      price: item.price ? `$${item.price}` : '',
      priceValue: parseFloat(item.price || 0),
      currency: 'USD',
      img: item.picture_url || item.cover_shot?.url || '',
      link: item.id ? `https://poshmark.com/listing/${item.id}` : '',
      condition: item.condition || '',
      platform: 'poshmark',
      source: 'api',
    }));
  } catch (err) {
    console.warn('[MaisonDeux][poshmark] Search failed:', err.message);
    return [];
  }
}

/**
 * Search Vestiaire Collective.
 * @param {string} query
 * @param {Object} [credentials] - { cookie, apiKey }
 * @returns {Promise<Object[]>}
 */
export async function searchVestiaire(query, credentials = {}) {
  try {
    const url = `https://www.vestiairecollective.com/api/search?q=${encodeURIComponent(query)}&per_page=10`;
    const headers = { 'Accept': 'application/json' };
    if (credentials.cookie) headers['Cookie'] = credentials.cookie;
    if (credentials.apiKey) headers['Authorization'] = `Bearer ${credentials.apiKey}`;

    const res = await fetch(url, { headers });
    if (!res.ok) return [];

    const data = await res.json();
    const items = data.items || data.products || data.results || [];

    return items.slice(0, 10).map((item) => ({
      title: [item.brand?.name, item.name].filter(Boolean).join(' ') || item.title || '',
      price: item.price ? `€${item.price}` : item.display_price || '',
      priceValue: parseFloat(item.price || 0),
      currency: 'EUR',
      img: item.picture?.url || item.image_url || '',
      link: item.link || item.url || '',
      condition: item.condition?.label || item.condition || '',
      platform: 'vestiaire',
      source: 'api',
    }));
  } catch (err) {
    console.warn('[MaisonDeux][vestiaire] Search failed:', err.message);
    return [];
  }
}

/**
 * Search Grailed.
 * Grailed exposes a public GraphQL-like search endpoint.
 * @param {string} query
 * @param {Object} [credentials] - { cookie }
 * @returns {Promise<Object[]>}
 */
export async function searchGrailed(query, credentials = {}) {
  try {
    const url = `https://www.grailed.com/api/merchandise/search`;
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    if (credentials.cookie) headers['Cookie'] = credentials.cookie;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        per_page: 10,
        page: 0,
      }),
    });

    if (!res.ok) {
      // Fallback: try Algolia-powered public search
      return await searchGrailedPublic(query);
    }

    const data = await res.json();
    const items = data.data || data.hits || [];

    return items.slice(0, 10).map((item) => ({
      title: [item.designer_names, item.title].filter(Boolean).join(' '),
      price: item.price ? `$${item.price}` : '',
      priceValue: parseFloat(item.price || 0),
      currency: 'USD',
      img: item.cover_photo?.url || '',
      link: item.id ? `https://www.grailed.com/listings/${item.id}` : '',
      condition: item.condition || '',
      platform: 'grailed',
      source: 'api',
    }));
  } catch (err) {
    console.warn('[MaisonDeux][grailed] Search failed:', err.message);
    return await searchGrailedPublic(query);
  }
}

async function searchGrailedPublic(query) {
  try {
    const res = await fetch(`https://www.grailed.com/shop?query=${encodeURIComponent(query)}`, {
      headers: { 'Accept': 'text/html' },
    });
    if (!res.ok) return [];
    // Can't reliably parse HTML results — return empty.
    return [];
  } catch {
    return [];
  }
}

/**
 * Search Mercari.
 * Mercari has a public search API.
 * @param {string} query
 * @param {Object} [credentials] - { cookie }
 * @returns {Promise<Object[]>}
 */
export async function searchMercari(query, credentials = {}) {
  try {
    const url = `https://www.mercari.com/v1/api?operationName=searchFacetQuery&variables=${encodeURIComponent(JSON.stringify({ keyword: query, limit: 10 }))}`;
    const headers = { 'Accept': 'application/json' };
    if (credentials.cookie) headers['Cookie'] = credentials.cookie;

    const res = await fetch(url, { headers });

    if (!res.ok) {
      // Fallback: simpler endpoint
      return await searchMercariSimple(query);
    }

    const data = await res.json();
    const items = data.data?.search?.itemsList || data.items || [];

    return items.slice(0, 10).map((item) => ({
      title: item.name || item.title || '',
      price: item.price ? `$${item.price}` : '',
      priceValue: parseFloat(item.price || 0),
      currency: 'USD',
      img: item.thumbnails?.[0] || item.imageUrl || '',
      link: item.id ? `https://www.mercari.com/item/${item.id}/` : '',
      condition: item.condition?.name || '',
      platform: 'mercari',
      source: 'api',
    }));
  } catch (err) {
    console.warn('[MaisonDeux][mercari] Search failed:', err.message);
    return await searchMercariSimple(query);
  }
}

async function searchMercariSimple(query) {
  try {
    const res = await fetch(`https://www.mercari.com/search/?keyword=${encodeURIComponent(query)}`, {
      headers: { 'Accept': 'text/html' },
    });
    if (!res.ok) return [];
    const html = await res.text();

    // Try extracting __NEXT_DATA__
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
    if (!match) return [];

    const nextData = JSON.parse(match[1]);
    const items = nextData?.props?.pageProps?.searchResults?.items || [];

    return items.slice(0, 10).map((item) => ({
      title: item.name || '',
      price: item.price ? `$${item.price / 100}` : '',
      priceValue: item.price ? item.price / 100 : 0,
      currency: 'USD',
      img: item.thumbnails?.[0] || '',
      link: item.id ? `https://www.mercari.com/item/${item.id}/` : '',
      condition: '',
      platform: 'mercari',
      source: 'html-parse',
    }));
  } catch {
    return [];
  }
}

/**
 * Search ShopGoodwill.
 * ShopGoodwill has a public search API.
 * @param {string} query
 * @param {Object} [credentials] - { accessToken, username, password }
 * @returns {Promise<Object[]>}
 */
export async function searchShopGoodwill(query, credentials = {}) {
  try {
    const url = 'https://buyerapi.shopgoodwill.com/api/Search/ItemListing';
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (credentials.accessToken) {
      headers['Authorization'] = `Bearer ${credentials.accessToken}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        searchText: query,
        searchOption: 0,
        page: 1,
        pageSize: 10,
        sortColumn: 0,
        sortOrder: 0,
        categoryLevelNo: 0,
        categoryLevel: 0,
        sellerIds: '',
        closedAuctions: false,
      }),
    });

    if (!res.ok) return [];

    const data = await res.json();
    const items = data.searchResults || data.items || [];

    return items.slice(0, 10).map((item) => ({
      title: item.title || item.name || '',
      price: item.currentPrice ? `$${item.currentPrice}` : '',
      priceValue: parseFloat(item.currentPrice || 0),
      currency: 'USD',
      img: item.imageUrl || item.imageURL || '',
      link: item.itemId ? `https://shopgoodwill.com/item/${item.itemId}` : '',
      condition: '',
      platform: 'shopgoodwill',
      source: 'api',
    }));
  } catch (err) {
    console.warn('[MaisonDeux][shopgoodwill] Search failed:', err.message);
    return [];
  }
}
