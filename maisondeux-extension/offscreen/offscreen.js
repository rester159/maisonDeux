/**
 * @file offscreen/offscreen.js
 * @description Runs inside the offscreen document. Sequentially creates hidden
 * iframes that load search-result pages on supported platforms, waits for
 * JS-rendered content, scrapes results via platform extractors, and sends
 * them back to the background service worker.
 *
 * Because offscreen documents can't use ES module imports, extractor logic
 * is inlined. Each platform's extractSearchResults function is duplicated
 * here from the extractor modules.
 */

/* global chrome */

const container = document.getElementById('iframe-container');

/** How long to wait for an iframe to fire its load event. */
const LOAD_TIMEOUT_MS = 12_000;

/** Extra delay after load for JS-rendered content to appear. */
const POST_LOAD_DELAY_MS = 2500;

// ---------------------------------------------------------------------------
// Message listener
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'SEARCH_PLATFORMS') return;

  const { product, platforms } = message.payload;
  searchAllPlatforms(product, platforms);

  sendResponse({ ack: true });
  return true;
});

/**
 * Sequentially search each platform, sending results back as they arrive.
 * @param {Object}   product   - The source product being compared.
 * @param {string[]} platforms - Platform keys to search.
 */
async function searchAllPlatforms(product, platforms) {
  const allListings = [];

  for (const platform of platforms) {
    try {
      const listings = await loadAndScrape(platform, product);

      if (listings.length) {
        // Send partial results immediately.
        chrome.runtime.sendMessage({
          type: 'IFRAME_RESULTS',
          payload: { source: product, listings, platform, complete: false },
        });
        allListings.push(...listings);
      }

      log('info', `${platform}: found ${listings.length} results`);
    } catch (err) {
      log('error', `${platform}: ${err.message || err}`);
    }

    // Random delay between platforms to avoid rapid-fire requests.
    await sleep(1500 + Math.random() * 2000);
  }

  // Final message: all platforms searched.
  chrome.runtime.sendMessage({
    type: 'IFRAME_RESULTS',
    payload: { source: product, listings: allListings, complete: true },
  });

  chrome.runtime.sendMessage({
    type: 'DEALS_COUNT',
    payload: { count: allListings.length },
  });

  log('info', `Search complete: ${allListings.length} total results across ${platforms.length} platforms`);
}

// ---------------------------------------------------------------------------
// Iframe lifecycle
// ---------------------------------------------------------------------------

/**
 * Load a search page in a hidden iframe, wait for content, and extract results.
 * @param {string} platform
 * @param {Object} product
 * @returns {Promise<Object[]>}
 */
function loadAndScrape(platform, product) {
  return new Promise((resolve) => {
    const url = buildSearchUrl(platform, product);
    if (!url) {
      log('warn', `${platform}: no search URL`);
      return resolve([]);
    }

    // Remove any existing iframe first.
    const existing = container.querySelector('iframe');
    if (existing) existing.remove();

    const iframe = document.createElement('iframe');
    iframe.style.width = '1400px';
    iframe.style.height = '900px';
    iframe.style.border = 'none';
    iframe.src = url;

    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      log('warn', `${platform}: iframe load timed out (${LOAD_TIMEOUT_MS}ms)`);
      cleanup();
      resolve([]);
    }, LOAD_TIMEOUT_MS);

    iframe.addEventListener('load', async () => {
      if (settled) return;

      // Wait for JS-rendered content.
      await sleep(POST_LOAD_DELAY_MS);

      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      try {
        const doc = iframe.contentDocument;
        if (!doc) {
          log('warn', `${platform}: contentDocument is null (cross-origin)`);
          cleanup();
          return resolve([]);
        }

        const results = extractSearchResults(platform, doc);
        log('info', `${platform}: extracted ${results.length} listings`);
        cleanup();
        resolve(results);
      } catch (err) {
        log('error', `${platform}: extraction error — ${err.message || err}`);
        cleanup();
        resolve([]);
      }
    });

    iframe.addEventListener('error', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      log('warn', `${platform}: iframe load error`);
      cleanup();
      resolve([]);
    });

    container.appendChild(iframe);

    function cleanup() {
      iframe.remove();
    }
  });
}

// ---------------------------------------------------------------------------
// Search URL builder
// ---------------------------------------------------------------------------

/**
 * Build a search URL for a given platform.
 * @param {string} platform
 * @param {Object} product
 * @returns {string|null}
 */
function buildSearchUrl(platform, product) {
  const queryParts = [product.brand, product.productName || product.title]
    .filter(Boolean)
    .join(' ')
    .slice(0, 120);
  const q = encodeURIComponent(queryParts);

  const urls = {
    therealreal:  `https://www.therealreal.com/shop?search=${q}`,
    ebay:         `https://www.ebay.com/sch/i.html?_nkw=${q}`,
    poshmark:     `https://poshmark.com/search?query=${q}`,
    vestiaire:    `https://www.vestiairecollective.com/search/?q=${q}`,
    grailed:      `https://www.grailed.com/shop?query=${q}`,
    mercari:      `https://www.mercari.com/search/?keyword=${q}`,
    shopgoodwill: `https://shopgoodwill.com/search?query=${q}`,
  };

  return urls[platform] || null;
}

// ---------------------------------------------------------------------------
// Search result extractors (inlined from extractors/*.js)
// ---------------------------------------------------------------------------

/**
 * Dispatch to the correct platform extractor.
 * @param {string}   platform
 * @param {Document} doc
 * @returns {Object[]}
 */
function extractSearchResults(platform, doc) {
  switch (platform) {
    case 'therealreal':  return extractTRR(doc);
    case 'ebay':         return extractEbay(doc);
    case 'poshmark':     return extractPoshmark(doc);
    case 'vestiaire':    return extractVestiaire(doc);
    case 'grailed':      return extractGrailed(doc);
    case 'mercari':      return extractMercari(doc);
    case 'shopgoodwill': return extractShopGoodwill(doc);
    default:             return [];
  }
}

/**
 * Find first non-empty text from a list of selectors.
 * @param {Element}  root
 * @param {string[]} sels
 * @returns {string|null}
 */
function txt(root, ...sels) {
  for (const s of sels) {
    try {
      const el = root.querySelector(s);
      const t = el?.textContent?.trim();
      if (t) return t;
    } catch { /* skip */ }
  }
  return null;
}

/**
 * Resolve a src/href to an absolute URL.
 * @param {Element}  root
 * @param {string[]} sels
 * @returns {string|null}
 */
function img(root, ...sels) {
  for (const s of sels) {
    try {
      const el = root.querySelector(s);
      const url = el?.src || el?.getAttribute('content');
      if (url) {
        try { return new URL(url, root.baseURI || root.ownerDocument?.baseURI).href; } catch { return url; }
      }
    } catch { /* skip */ }
  }
  return null;
}

function link(root, ...sels) {
  for (const s of sels) {
    try {
      const a = root.querySelector(s);
      if (a?.href) {
        try { return new URL(a.href, root.baseURI || root.ownerDocument?.baseURI).href; } catch { return a.href; }
      }
    } catch { /* skip */ }
  }
  return null;
}

/**
 * Generic card-picker: tries container selectors, returns up to 10 cards.
 * @param {Document} doc
 * @param {string[]} containerSels
 * @returns {Element[]}
 */
function pickCards(doc, ...containerSels) {
  for (const sel of containerSels) {
    const cards = [...doc.querySelectorAll(sel)];
    if (cards.length) return cards.slice(0, 10);
  }
  return [];
}

// ---- TheRealReal ----

function extractTRR(doc) {
  const cards = pickCards(doc, '[data-testid="product-card"]', '.product-card', '.SearchResults__item', 'article');
  return cards.map((c) => ({
    title: txt(c, 'a[data-testid="product-name"]', '.product-card__name', 'h3', 'h4'),
    price: txt(c, '[data-testid="price"]', '.product-card__price', '.price'),
    img:   img(c, 'img'),
    link:  link(c, 'a'),
    condition: null,
  }));
}

// ---- eBay ----

function extractEbay(doc) {
  let cards = pickCards(doc, '.s-item', '.srp-results .s-item__wrapper');
  // Filter "Shop on eBay" promo items.
  cards = cards.filter((c) => {
    const t = c.querySelector('.s-item__title, h3')?.textContent || '';
    return !/shop on ebay/i.test(t);
  });
  return cards.slice(0, 10).map((c) => ({
    title: txt(c, '.s-item__title span', '.s-item__title', 'h3'),
    price: txt(c, '.s-item__price', '.s-item__detail--price'),
    img:   img(c, '.s-item__image img', 'img'),
    link:  link(c, '.s-item__link', 'a'),
    condition: txt(c, '.SECONDARY_INFO', '.s-item__subtitle'),
  }));
}

// ---- Poshmark ----

function extractPoshmark(doc) {
  const cards = pickCards(doc, '[data-testid="listing-card"]', '.card--small', '.tile');
  return cards.map((c) => ({
    title: txt(c, '[data-testid="title"]', '.card__title', '.tile__title', 'h4'),
    price: txt(c, '[data-testid="price"]', '.card__price', '.tile__price', '.price'),
    img:   img(c, 'img'),
    link:  link(c, 'a'),
    condition: null,
  }));
}

// ---- Vestiaire ----

function extractVestiaire(doc) {
  const cards = pickCards(doc, '[data-testid="product-card"]', '.productCard', '.catalog__product', 'article.product');
  return cards.map((c) => ({
    title: txt(c, '[data-testid="product-name"]', '.productCard__name', '.product__name', 'h3'),
    price: txt(c, '[data-testid="product-price"]', '.productCard__price', '.product__price', '.price'),
    img:   img(c, 'img'),
    link:  link(c, 'a'),
    condition: txt(c, '.productCard__condition', '.condition'),
  }));
}

// ---- Grailed ----

function extractGrailed(doc) {
  const cards = pickCards(doc, '.feed-item', '.FeedItem', '[data-testid="listing-card"]');
  return cards.map((c) => ({
    title: txt(c, '[class*="ListingTitle"]', '.feed-item-title', 'h4', 'p'),
    price: txt(c, '[class*="Price"]', '.feed-item-price', '.Price'),
    img:   img(c, 'img'),
    link:  link(c, 'a'),
    condition: null,
  }));
}

// ---- Mercari ----

function extractMercari(doc) {
  const cards = pickCards(doc, '[data-testid="SearchResults"] [data-testid="ItemCell"]', '[data-testid="ItemCell"]', '.SearchResultItem');
  return cards.map((c) => ({
    title: txt(c, '[data-testid="ItemName"]', '[class*="ItemName"]', 'h3', 'p'),
    price: txt(c, '[data-testid="ItemPrice"]', '[class*="ItemPrice"]', '.price'),
    img:   img(c, 'img'),
    link:  link(c, 'a'),
    condition: txt(c, '[class*="Condition"]'),
  }));
}

// ---- ShopGoodwill ----

function extractShopGoodwill(doc) {
  const cards = pickCards(doc, '.search-results .item', '.product-list .product', '.lot-list .lot', '.search-result-item');
  return cards.map((c) => ({
    title: txt(c, '.item-title', '.lot-title', 'h3', 'h4', 'a'),
    price: txt(c, '.current-bid', '.item-price', '.price'),
    img:   img(c, 'img'),
    link:  link(c, 'a'),
    condition: null,
  }));
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function log(level, msg) {
  const tag = `[MaisonDeux][offscreen]`;
  if (level === 'error') console.error(`${tag} ${msg}`);
  else if (level === 'warn') console.warn(`${tag} ${msg}`);
  else console.debug(`${tag} ${msg}`);
}
