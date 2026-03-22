/**
 * @file background.js
 * @description Service worker for MaisonDeux. Self-contained — no ES module
 * imports to avoid Chrome service worker module loading issues.
 *
 * Orchestrates: product detection → API search → scoring → side panel display.
 */

/* global chrome */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const tabProducts = new Map();
const tabResults = new Map(); // Store search results per tab
let isActive = true;

const ALL_PLATFORMS = ['therealreal', 'ebay', 'poshmark', 'vestiaire', 'grailed', 'mercari', 'shopgoodwill'];

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

chrome.storage.local.get('maisondeux_active', (data) => {
  isActive = data.maisondeux_active !== false;
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

console.log('[MaisonDeux][bg] Service worker started');

// ---------------------------------------------------------------------------
// Message router
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message;
  console.log(`[MaisonDeux][bg] Message: ${type}`);

  switch (type) {
    case 'PRODUCT_DETECTED':
      handleProductDetected(payload, sender.tab);
      break;

    case 'GET_CURRENT_PRODUCT': {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id;
        const product = tabProducts.get(tabId) || null;
        const results = tabResults.get(tabId) || [];
        sendResponse({ product, results, searchComplete: true });
      });
      return true;
    }

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
// Product detected → search pipeline
// ---------------------------------------------------------------------------

async function handleProductDetected(product, tab) {
  if (!isActive || !tab?.id) return;

  const tabId = tab.id;
  console.log(`[MaisonDeux][bg] Product: ${product.brand || ''} ${product.productName || product.title || ''}`);

  // Load credentials.
  const creds = await loadCredentials();
  const hasAI = !!creds.anthropicKey;
  console.log(`[MaisonDeux][bg] AI: ${hasAI}, eBay: ${!!creds.ebay?.appId}`);

  // Step 1: Classify source product (AI if available, else heuristic).
  let classifiedProduct = product;
  if (hasAI) {
    try {
      console.log('[MaisonDeux][bg] Classifying source product with AI...');
      const aiAttrs = await classifyProductAI(product, creds.anthropicKey);
      classifiedProduct = { ...product, ...aiAttrs, _aiClassified: true };
      console.log('[MaisonDeux][bg] AI classification:', JSON.stringify(aiAttrs));

      // Auto-learn: save new terms discovered by AI.
      learnFromAI(aiAttrs);
    } catch (err) {
      console.warn('[MaisonDeux][bg] AI classification failed:', err.message);
    }
  }

  // Store product for this tab.
  tabProducts.set(tabId, classifiedProduct);

  // Notify side panel.
  broadcast({ type: 'PRODUCT_DETECTED', payload: classifiedProduct });

  // Search ALL platforms including the current one.
  const platforms = [...ALL_PLATFORMS];
  broadcast({ type: 'SEARCH_STARTED', payload: { platformCount: platforms.length } });

  // Build search query from classified attributes.
  const query = [
    classifiedProduct.brand,
    classifiedProduct.model,
    classifiedProduct.productName || classifiedProduct.title,
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, 120);

  console.log(`[MaisonDeux][bg] Query: "${query}"`);

  // Search all platforms in parallel.
  const allResults = [];

  const searches = platforms.map(async (platform) => {
    try {
      const results = await searchPlatform(platform, query, creds);
      console.log(`[MaisonDeux][bg] ${platform}: ${results.length} results`);

      if (results.length) {
        // Score results against source.
        const scored = results.map((r) => scoreResult(r, classifiedProduct));
        allResults.push(...scored);
        broadcast({
          type: 'DEAL_RESULTS',
          payload: { listings: scored, platform, complete: false },
        });
      }
    } catch (err) {
      console.warn(`[MaisonDeux][bg] ${platform} error:`, err.message);
    }
  });

  await Promise.allSettled(searches);

  // Step 2: If AI available, batch-classify top results for better scoring.
  if (hasAI && allResults.length > 0) {
    try {
      console.log(`[MaisonDeux][bg] Batch classifying ${Math.min(allResults.length, 10)} results with AI...`);
      const topResults = allResults.slice(0, 10);
      const aiClassified = await classifyBatchAI(topResults, creds.anthropicKey);

      // Merge AI attributes back and re-score.
      for (let i = 0; i < aiClassified.length && i < topResults.length; i++) {
        Object.assign(allResults[i], aiClassified[i]);
        const rescore = scoreResult(allResults[i], classifiedProduct);
        allResults[i].relevanceScore = rescore.relevanceScore;
        allResults[i].relevanceLabel = rescore.relevanceLabel;
      }
    } catch (err) {
      console.warn('[MaisonDeux][bg] Batch classification failed:', err.message);
    }
  }

  // Final results — sort by relevance.
  allResults.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  console.log(`[MaisonDeux][bg] Total: ${allResults.length} results`);

  // Store for late-opening side panel.
  tabResults.set(tabId, allResults);

  broadcast({
    type: 'DEAL_RESULTS',
    payload: { listings: allResults, complete: true },
  });

  broadcast({
    type: 'DEALS_COUNT',
    payload: { count: allResults.length },
  });

  if (allResults.length > 0) {
    chrome.action.setBadgeText({ text: String(allResults.length) });
    chrome.action.setBadgeBackgroundColor({ color: '#2e7d32' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// ---------------------------------------------------------------------------
// Platform search dispatcher
// ---------------------------------------------------------------------------

async function searchPlatform(platform, query, creds) {
  switch (platform) {
    case 'ebay':         return searchEbay(query, creds.ebay);
    case 'therealreal':  return searchViaFetch(platform, query, creds.therealreal);
    case 'poshmark':     return searchViaFetch(platform, query, creds.poshmark);
    case 'vestiaire':    return searchViaFetch(platform, query, creds.vestiaire);
    case 'grailed':      return searchViaFetch(platform, query, creds.grailed);
    case 'mercari':      return searchViaFetch(platform, query, creds.mercari);
    case 'shopgoodwill': return searchShopGoodwill(query, creds.shopgoodwill);
    default:             return [];
  }
}

// ---------------------------------------------------------------------------
// eBay Browse API
// ---------------------------------------------------------------------------

let ebayToken = null;
let ebayTokenExpiry = 0;

async function searchEbay(query, creds) {
  if (!creds?.appId || !creds?.certId) {
    console.log('[MaisonDeux][bg] eBay: no credentials, skipping API search');
    // Fallback: try web search
    return searchEbayWeb(query);
  }

  try {
    // Get OAuth token.
    if (!ebayToken || Date.now() >= ebayTokenExpiry) {
      const basicAuth = btoa(`${creds.appId}:${creds.certId}`);
      const tokenRes = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
      });

      if (!tokenRes.ok) {
        console.warn(`[MaisonDeux][bg] eBay OAuth failed: ${tokenRes.status}`);
        return searchEbayWeb(query);
      }

      const tokenData = await tokenRes.json();
      ebayToken = tokenData.access_token;
      ebayTokenExpiry = Date.now() + (tokenData.expires_in - 60) * 1000;
      console.log('[MaisonDeux][bg] eBay OAuth token obtained');
    }

    // Search Browse API.
    const params = new URLSearchParams({
      q: query,
      limit: '10',
    });

    const res = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`, {
      headers: {
        'Authorization': `Bearer ${ebayToken}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
      },
    });

    if (!res.ok) {
      console.warn(`[MaisonDeux][bg] eBay Browse API: ${res.status}`);
      return searchEbayWeb(query);
    }

    const data = await res.json();
    return (data.itemSummaries || []).map((item) => ({
      title: item.title || '',
      price: item.price ? `$${item.price.value}` : '',
      priceValue: item.price ? parseFloat(item.price.value) : 0,
      currency: item.price?.currency || 'USD',
      img: item.thumbnailImages?.[0]?.imageUrl || item.image?.imageUrl || '',
      link: item.itemWebUrl || '',
      condition: item.condition || '',
      platform: 'ebay',
      source: 'api',
    }));
  } catch (err) {
    console.warn('[MaisonDeux][bg] eBay API error:', err.message);
    return searchEbayWeb(query);
  }
}

async function searchEbayWeb(query) {
  try {
    const res = await fetch(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&_sacat=0&LH_BIN=1&rt=nc`, {
      headers: { 'Accept': 'text/html' },
    });
    if (!res.ok) return [];
    // Can't reliably parse eBay HTML from service worker.
    return [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Platform search via HTML fetch + embedded JSON extraction
// ---------------------------------------------------------------------------

const PLATFORM_SEARCH_URLS = {
  therealreal: (q) => `https://www.therealreal.com/shop?search=${encodeURIComponent(q)}`,
  poshmark:    (q) => `https://poshmark.com/search?query=${encodeURIComponent(q)}&type=listings`,
  vestiaire:   (q) => `https://www.vestiairecollective.com/search/?q=${encodeURIComponent(q)}`,
  grailed:     (q) => `https://www.grailed.com/shop?query=${encodeURIComponent(q)}`,
  mercari:     (q) => `https://www.mercari.com/search/?keyword=${encodeURIComponent(q)}`,
  shopgoodwill:(q) => `https://shopgoodwill.com/search?query=${encodeURIComponent(q)}`,
};

async function searchViaFetch(platform, query, _creds = {}) {
  try {
    const urlBuilder = PLATFORM_SEARCH_URLS[platform];
    if (!urlBuilder) return [];

    const url = urlBuilder(query);
    console.log(`[MaisonDeux][bg] ${platform} fetching: ${url}`);

    const res = await fetch(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) {
      console.log(`[MaisonDeux][bg] ${platform} HTTP ${res.status}`);
      return [];
    }

    const html = await res.text();
    console.log(`[MaisonDeux][bg] ${platform} HTML length: ${html.length}`);

    // Try to extract embedded JSON data from the page.
    return extractFromHtml(platform, html, url);
  } catch (err) {
    console.log(`[MaisonDeux][bg] ${platform} error: ${err.message}`);
    return [];
  }
}

/**
 * Extract listing data from HTML by finding embedded JSON
 * (__NEXT_DATA__, window.__data, ld+json, etc.)
 */
function extractFromHtml(platform, html, baseUrl) {
  const results = [];

  // Strategy 1: __NEXT_DATA__ (used by Poshmark, Mercari, Grailed, Vestiaire)
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      const items = findItemsInObject(nextData, 0, 3);
      console.log(`[MaisonDeux][bg] ${platform} __NEXT_DATA__ items: ${items.length}`);
      for (const item of items.slice(0, 10)) {
        const parsed = parseGenericItem(item, platform);
        if (parsed) results.push(parsed);
      }
      if (results.length) return results;
    } catch (e) {
      console.log(`[MaisonDeux][bg] ${platform} __NEXT_DATA__ parse error: ${e.message}`);
    }
  }

  // Strategy 2: window.__data or similar global JSON
  const windowDataPatterns = [
    /window\.__data\s*=\s*({[\s\S]*?});\s*<\/script>/,
    /window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?});\s*<\/script>/,
    /window\.serverData\s*=\s*({[\s\S]*?});\s*<\/script>/,
    /__remixContext\s*=\s*({[\s\S]*?});\s*<\/script>/,
  ];

  for (const pattern of windowDataPatterns) {
    const match = html.match(pattern);
    if (match) {
      try {
        const data = JSON.parse(match[1]);
        const items = findItemsInObject(data, 0, 3);
        console.log(`[MaisonDeux][bg] ${platform} window data items: ${items.length}`);
        for (const item of items.slice(0, 10)) {
          const parsed = parseGenericItem(item, platform);
          if (parsed) results.push(parsed);
        }
        if (results.length) return results;
      } catch { /* skip */ }
    }
  }

  // Strategy 3: JSON-LD structured data
  const ldJsonMatches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
  for (const match of ldJsonMatches) {
    try {
      const ld = JSON.parse(match[1]);
      if (ld['@type'] === 'ItemList' && ld.itemListElement) {
        for (const elem of ld.itemListElement.slice(0, 10)) {
          const item = elem.item || elem;
          results.push({
            title: item.name || '',
            price: item.offers?.price ? `$${item.offers.price}` : '',
            priceValue: parseFloat(item.offers?.price || 0),
            currency: item.offers?.priceCurrency || 'USD',
            img: item.image || '',
            link: item.url || '',
            condition: '',
            platform,
            source: 'ld-json',
          });
        }
        if (results.length) return results;
      }
    } catch { /* skip */ }
  }

  // Strategy 4: Regex-based extraction from raw HTML.
  // Look for product-like patterns: title + price + link in repeated HTML blocks.
  const linkPattern = platform === 'therealreal' ? /href="(\/products\/[^"]+)"/g
    : platform === 'poshmark' ? /href="(\/listing\/[^"]+)"/g
    : platform === 'grailed' ? /href="(\/listings\/\d+[^"]*)"/g
    : platform === 'mercari' ? /href="(\/item\/[^"]+)"/g
    : platform === 'vestiaire' ? /href="(\/[^"]*-\d+\.shtml)"/g
    : platform === 'shopgoodwill' ? /href="(\/item\/\d+)"/g
    : null;

  if (linkPattern) {
    const domains = {
      therealreal: 'https://www.therealreal.com',
      poshmark: 'https://poshmark.com',
      grailed: 'https://www.grailed.com',
      mercari: 'https://www.mercari.com',
      vestiaire: 'https://www.vestiairecollective.com',
      shopgoodwill: 'https://shopgoodwill.com',
    };

    const seen = new Set();
    let match;
    while ((match = linkPattern.exec(html)) !== null) {
      const path = match[1];
      if (seen.has(path)) continue;
      seen.add(path);

      const fullLink = domains[platform] + path;

      // Try to extract a title near this link.
      const idx = match.index;
      const surroundingHtml = html.substring(Math.max(0, idx - 500), Math.min(html.length, idx + 1000));

      // Extract title from nearby text.
      const titleMatch = surroundingHtml.match(/(?:title|alt|aria-label)="([^"]{10,120})"/i)
        || surroundingHtml.match(/>([A-Z][^<]{10,100})</);
      const title = titleMatch ? titleMatch[1].trim() : '';

      // Extract price — try multiple patterns.
      const priceMatch = surroundingHtml.match(/\$\s*[\d,]+(?:\.\d{2})?/)
        || surroundingHtml.match(/[\$€£]\s*[\d,]+(?:\.\d{2})?/)
        || surroundingHtml.match(/"price"\s*:\s*"?\$?([\d,.]+)"?/)
        || surroundingHtml.match(/"amount"\s*:\s*"?([\d,.]+)"?/)
        || surroundingHtml.match(/"value"\s*:\s*"?([\d,.]+)"?/)
        || surroundingHtml.match(/data-price="([\d,.]+)"/)
        || surroundingHtml.match(/(\d{2,6}(?:\.\d{2})?)\s*(?:USD|EUR|GBP)/);
      let priceText = priceMatch ? (priceMatch[1] || priceMatch[0]) : '';
      // Ensure it has a $ prefix for display.
      if (priceText && !priceText.startsWith('$') && !priceText.startsWith('€') && !priceText.startsWith('£')) {
        priceText = '$' + priceText;
      }
      const priceValue = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;

      // Extract image.
      const imgMatch = surroundingHtml.match(/(?:src|data-src)="(https?:\/\/[^"]+(?:\.jpg|\.jpeg|\.png|\.webp)[^"]*)"/i);
      const img = imgMatch ? imgMatch[1] : '';

      if (title || priceValue > 0) {
        results.push({
          title: title || path.split('/').pop().replace(/-/g, ' '),
          price: priceText || (priceValue > 0 ? `$${priceValue}` : ''),
          priceValue,
          currency: 'USD',
          img,
          link: fullLink,
          condition: '',
          platform,
          source: 'html-regex',
        });
      }

      if (results.length >= 10) break;
    }

    if (results.length) {
      console.log(`[MaisonDeux][bg] ${platform} regex extracted: ${results.length}`);
      return results;
    }
  }

  console.log(`[MaisonDeux][bg] ${platform} no data found`);
  return results;
}

/**
 * Recursively search a nested object for arrays that look like product listings.
 * Returns the first array of 3+ objects that have title/name/price-like fields.
 */
function findItemsInObject(obj, depth, maxDepth) {
  if (depth > maxDepth || !obj || typeof obj !== 'object') return [];

  if (Array.isArray(obj)) {
    if (obj.length >= 2 && typeof obj[0] === 'object' && obj[0] !== null) {
      const first = obj[0];
      const hasProductFields = first.title || first.name || first.product_name ||
                                first.price || first.sale_price || first.currentPrice ||
                                first.designer_name || first.brand;
      if (hasProductFields) return obj;
    }
    // Search within array elements.
    for (const item of obj.slice(0, 5)) {
      const found = findItemsInObject(item, depth + 1, maxDepth);
      if (found.length) return found;
    }
    return [];
  }

  // Search object values.
  for (const val of Object.values(obj)) {
    const found = findItemsInObject(val, depth + 1, maxDepth);
    if (found.length) return found;
  }
  return [];
}

/**
 * Parse a generic item object into our normalized listing format.
 */
function parseGenericItem(item, platform) {
  if (!item || typeof item !== 'object') return null;

  const title = item.title || item.name || item.product_name ||
    [item.designer_name || item.brand_name || item.brand?.name, item.name || item.product_name].filter(Boolean).join(' ') || '';

  if (!title) return null;

  const priceRaw = item.price || item.sale_price || item.current_price || item.currentPrice ||
    item.display_price || item.price_amount || '';
  const priceNum = typeof priceRaw === 'number' ? priceRaw :
    parseFloat(String(priceRaw).replace(/[^0-9.]/g, '')) || 0;

  const img = item.image_url || item.primary_image || item.picture_url ||
    item.cover_photo?.url || item.cover_shot?.url || item.photo ||
    item.thumbnails?.[0] || item.imageUrl || item.imageURL || item.thumbnail ||
    item.image || '';

  let link = item.url || item.link || item.itemWebUrl || item.product_link ||
    item.canonical_url || item.href || '';

  if (item.id && !link) {
    const linkMap = {
      therealreal: `https://www.therealreal.com/products/${item.id}`,
      poshmark: `https://poshmark.com/listing/${item.id}`,
      grailed: `https://www.grailed.com/listings/${item.id}`,
      mercari: `https://www.mercari.com/item/${item.id}/`,
      shopgoodwill: `https://shopgoodwill.com/item/${item.id}`,
    };
    link = linkMap[platform] || '';
  }

  // Make relative URLs absolute.
  if (link && !link.startsWith('http')) {
    const domains = {
      therealreal: 'https://www.therealreal.com',
      poshmark: 'https://poshmark.com',
      vestiaire: 'https://www.vestiairecollective.com',
      grailed: 'https://www.grailed.com',
      mercari: 'https://www.mercari.com',
    };
    link = (domains[platform] || '') + link;
  }

  return {
    title,
    price: priceNum > 0 ? `$${priceNum}` : String(priceRaw),
    priceValue: priceNum,
    currency: item.currency || 'USD',
    img,
    link,
    condition: item.condition?.label || item.condition?.name || item.condition || '',
    platform,
    source: 'html-parse',
  };
}

// ---------------------------------------------------------------------------
// ShopGoodwill API
// ---------------------------------------------------------------------------

async function searchShopGoodwill(query, _creds = {}) {
  // ShopGoodwill: try the buyer API first, fallback to HTML search.
  try {
    const res = await fetch('https://buyerapi.shopgoodwill.com/api/Search/ItemListing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
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

    if (!res.ok) {
      console.log(`[MaisonDeux][bg] shopgoodwill: ${res.status}`);
      return [];
    }

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
    console.log(`[MaisonDeux][bg] shopgoodwill API error: ${err.message}, trying HTML`);
    // Fallback to HTML search.
    return searchViaFetch('shopgoodwill', query);
  }
}

// ---------------------------------------------------------------------------
// Credentials loader
// ---------------------------------------------------------------------------

function loadCredentials() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(null, (settings) => {
      resolve({
        ebay: {
          appId: settings.ebay_app_id || '',
          certId: settings.ebay_cert_id || '',
        },
        therealreal: { apiKey: settings.therealreal_api_key || '' },
        vestiaire: { apiKey: settings.vestiaire_api_key || '' },
        shopgoodwill: { accessToken: settings.shopgoodwill_access_token || '' },
        poshmark: {},
        grailed: {},
        mercari: {},
        serpApiKey: settings.serpapi_key || '',
        anthropicKey: settings.anthropic_key || '',
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

// ---------------------------------------------------------------------------
// AI Classification (Anthropic Claude API)
// ---------------------------------------------------------------------------

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

const SOURCE_SYSTEM_PROMPT = `You are a luxury goods authentication and classification expert working for MaisonDeux, a second-hand marketplace aggregator. Analyze the product listing and extract every identifiable attribute into a standardized schema.

Return ONLY valid JSON. No markdown fences, no backticks, no explanation.

Classify into this schema:
{
  "brand": "string or null",
  "model": "string or null",
  "category": "Handbags | Jewelry | Watches | Shoes | Clothing | Accessories | null",
  "color": "string or null",
  "colorFamily": "Neutral | Warm | Cool | Metallic | null",
  "material": "string or null",
  "hardware": "Gold | Silver | Ruthenium | Palladium | Rose Gold | null",
  "size": "string or null",
  "condition": "New | Excellent | Very Good | Good | Fair | null",
  "authenticated": true or false,
  "listedPrice": number or null,
  "currency": "USD | EUR | GBP",
  "estimatedRetail": number or null,
  "_confidence": 0.0 to 1.0
}

Rules:
- Normalize colors to English: "Noir" → "Black", "GHW" → hardware: "Gold"
- Be specific on models: "Classic Double Flap" not "Flap Bag"
- Distinguish material subtypes: Lambskin vs Caviar vs Calfskin
- Map conditions: NWT=New, Like New/Mint=Excellent, Pre-Owned=Good`;

const BATCH_SYSTEM_PROMPT = `You are a luxury goods classifier for MaisonDeux. Classify EACH listing into structured attributes.

Return ONLY a JSON array. No markdown, no explanation. Each element:
{
  "brand": "string or null",
  "model": "string or null",
  "category": "Handbags | Jewelry | Watches | Shoes | Clothing | Accessories | null",
  "color": "string or null",
  "material": "string or null",
  "hardware": "Gold | Silver | Ruthenium | Palladium | Rose Gold | null",
  "condition": "New | Excellent | Very Good | Good | Fair | null",
  "listedPrice": number or null,
  "_confidence": 0.0 to 1.0
}

Rules:
- Normalize all colors to English. Decode abbreviations: GHW=Gold Hardware, SHW=Silver, NWT=New With Tags.
- Each listing is independent.
- Text-only confidence typically 0.5–0.8.`;

/**
 * Classify a source product using Claude Vision.
 */
async function classifyProductAI(product, apiKey) {
  const content = [];

  // Include image if available.
  if (product.imageUrl) {
    content.push({
      type: 'image',
      source: { type: 'url', url: product.imageUrl },
    });
  }

  content.push({
    type: 'text',
    text: [
      `Platform: ${product.platform || product.source || 'Unknown'}`,
      `Title: ${product.productName || product.title || 'Unknown'}`,
      product.brand ? `Brand (from page): ${product.brand}` : null,
      `Listed Price: ${product.price || 'Unknown'}`,
      product.conditionText ? `Condition (from page): ${product.conditionText}` : null,
      product.categoryText || product.category ? `Category (from page): ${product.categoryText || product.category}` : null,
      product.description ? `Description: ${product.description.slice(0, 1500)}` : null,
    ].filter(Boolean).join('\n\n'),
  });

  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 1000,
      system: SOURCE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  return parseAIJSON(text);
}

/**
 * Batch-classify search results using Claude.
 */
async function classifyBatchAI(listings, apiKey) {
  const listingText = listings.slice(0, 10).map((l, i) =>
    `Listing ${i + 1}:\nTitle: ${l.title || ''}\nPrice: ${l.price || ''}\nCondition: ${l.condition || ''}\nPlatform: ${l.platform || ''}`
  ).join('\n\n');

  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20241022',
      max_tokens: 2000,
      system: BATCH_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: listingText }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  const parsed = parseAIJSON(text);
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * Parse JSON from Claude response, stripping markdown fences.
 */
function parseAIJSON(text) {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  return JSON.parse(cleaned);
}

// ---------------------------------------------------------------------------
// Inline relevance scoring
// ---------------------------------------------------------------------------

/**
 * Score a candidate result against the source product.
 * Adds relevanceScore, relevanceLabel, color, material, category, condition
 * fields parsed from the title text.
 */
function scoreResult(candidate, source) {
  // Extract attributes from the candidate title.
  const titleLower = (candidate.title || '').toLowerCase();

  // Simple keyword extraction for attributes.
  const color = extractAttr(titleLower, COLOR_KEYWORDS) || null;
  const material = extractAttr(titleLower, MATERIAL_KEYWORDS) || null;
  const category = extractAttr(titleLower, CATEGORY_KEYWORDS) || null;
  const condition = candidate.condition || null;

  // Infer brand from title.
  const brand = extractBrand(titleLower) || null;

  // Score components.
  let score = 0;
  let maxScore = 0;

  // Brand match (30 points).
  const srcBrand = (source.brand || '').toLowerCase();
  if (srcBrand) {
    maxScore += 30;
    if (brand && brand === srcBrand) score += 30;
    else if (brand && titleLower.includes(srcBrand)) score += 30;
    else if (titleLower.includes(srcBrand)) score += 25;
  }

  // Title word overlap (25 points).
  const srcTitle = (source.productName || source.title || '').toLowerCase();
  if (srcTitle) {
    maxScore += 25;
    const srcWords = srcTitle.split(/\W+/).filter(w => w.length > 2);
    const candWords = titleLower.split(/\W+/).filter(w => w.length > 2);
    if (srcWords.length) {
      const matches = srcWords.filter(w => candWords.includes(w)).length;
      score += Math.round((matches / srcWords.length) * 25);
    }
  }

  // Category match (10 points).
  const srcCategory = (source.category || source.categoryText || '').toLowerCase();
  if (srcCategory && category) {
    maxScore += 10;
    if (srcCategory.includes(category) || category.includes(srcCategory)) score += 10;
  }

  // Color match (10 points).
  if (color) {
    maxScore += 10;
    const srcColor = (source.color || '').toLowerCase();
    if (srcColor && srcColor === color) score += 10;
    else if (!srcColor) score += 5; // Benefit of the doubt.
  }

  // Material match (10 points).
  if (material) {
    maxScore += 10;
    const srcMaterial = (source.material || '').toLowerCase();
    if (srcMaterial && srcMaterial === material) score += 10;
    else if (!srcMaterial) score += 5;
  }

  const relevanceScore = maxScore > 0 ? Math.round((score / maxScore) * 100) / 100 : 0.5;
  const relevanceLabel = relevanceScore >= 0.85 ? 'Exact Match'
    : relevanceScore >= 0.7 ? 'Very Similar'
    : relevanceScore >= 0.5 ? 'Similar'
    : relevanceScore >= 0.3 ? 'Related'
    : 'Weak Match';

  // Compute price delta.
  const srcPrice = parseFloat(String(source.price || '').replace(/[^0-9.]/g, '')) || 0;
  const candPrice = candidate.priceValue || parseFloat(String(candidate.price || '').replace(/[^0-9.]/g, '')) || 0;
  let priceDelta = null;
  if (srcPrice > 0 && candPrice > 0) {
    const diff = srcPrice - candPrice;
    const pct = Math.round((Math.abs(diff) / srcPrice) * 100);
    priceDelta = { absolute: diff, percentage: pct, isCheaper: diff > 0 };
  }

  return {
    ...candidate,
    brand,
    color,
    material,
    category,
    condition,
    relevanceScore,
    relevanceLabel,
    priceDelta,
  };
}

function extractAttr(text, keywords) {
  for (const [canonical, aliases] of Object.entries(keywords)) {
    for (const alias of aliases) {
      if (text.includes(alias)) return canonical;
    }
  }
  return null;
}

function extractBrand(text) {
  for (const [canonical, aliases] of Object.entries(BRAND_KEYWORDS)) {
    for (const alias of aliases) {
      if (text.includes(alias)) return canonical;
    }
  }
  return null;
}

// Minimal inline keyword dictionaries for scoring.
const COLOR_KEYWORDS = {
  black: ['black', 'noir', 'nero'],
  white: ['white', 'blanc', 'ivory', 'cream'],
  beige: ['beige', 'tan', 'nude', 'camel'],
  brown: ['brown', 'chocolate', 'cognac', 'mocha', 'tobacco'],
  red: ['red', 'burgundy', 'crimson', 'wine', 'bordeaux'],
  pink: ['pink', 'rose', 'blush', 'coral', 'fuchsia'],
  blue: ['blue', 'navy', 'cobalt', 'teal', 'denim'],
  green: ['green', 'olive', 'emerald', 'sage', 'forest'],
  grey: ['grey', 'gray', 'charcoal', 'slate'],
  gold: ['gold', 'champagne', 'golden'],
  silver: ['silver'],
  orange: ['orange', 'rust', 'terracotta'],
  yellow: ['yellow', 'mustard'],
  purple: ['purple', 'violet', 'plum', 'lavender'],
};

const MATERIAL_KEYWORDS = {
  leather: ['leather', 'lambskin', 'calfskin', 'caviar', 'patent'],
  canvas: ['canvas', 'monogram canvas', 'coated canvas', 'damier'],
  suede: ['suede', 'nubuck'],
  silk: ['silk', 'satin'],
  denim: ['denim', 'jean'],
  tweed: ['tweed', 'boucle'],
  nylon: ['nylon', 'tessuto'],
  exotic: ['python', 'crocodile', 'ostrich', 'lizard'],
};

const CATEGORY_KEYWORDS = {
  handbag: ['bag', 'handbag', 'tote', 'clutch', 'purse', 'crossbody', 'satchel', 'flap', 'bucket'],
  wallet: ['wallet', 'card holder', 'card case', 'coin purse', 'woc', 'wallet on chain'],
  shoes: ['shoe', 'heel', 'boot', 'sneaker', 'loafer', 'sandal', 'pump', 'flat', 'mule'],
  jewelry: ['ring', 'necklace', 'bracelet', 'earring', 'pendant', 'brooch'],
  watch: ['watch', 'timepiece'],
  clothing: ['dress', 'jacket', 'coat', 'blazer', 'shirt', 'pants', 'sweater', 'top'],
  accessories: ['scarf', 'belt', 'sunglasses', 'hat', 'tie', 'keychain'],
};

const BRAND_KEYWORDS = {
  chanel: ['chanel'],
  'louis vuitton': ['louis vuitton', 'vuitton', ' lv '],
  gucci: ['gucci'],
  hermes: ['hermes', 'hermès'],
  dior: ['dior', 'christian dior'],
  prada: ['prada'],
  fendi: ['fendi'],
  bottega: ['bottega veneta', 'bottega'],
  balenciaga: ['balenciaga'],
  'saint laurent': ['saint laurent', 'ysl', 'yves saint laurent'],
  celine: ['celine', 'céline'],
  loewe: ['loewe'],
  valentino: ['valentino'],
  burberry: ['burberry'],
  versace: ['versace'],
  cartier: ['cartier'],
  rolex: ['rolex'],
  omega: ['omega'],
  tiffany: ['tiffany'],
  givenchy: ['givenchy'],
  'miu miu': ['miu miu'],
  ferragamo: ['ferragamo'],
  coach: ['coach'],
  'michael kors': ['michael kors'],
  'kate spade': ['kate spade'],
  'tory burch': ['tory burch'],
};
