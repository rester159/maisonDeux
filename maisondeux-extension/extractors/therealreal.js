/**
 * @file extractors/therealreal.js
 * @description DOM extractor for TheRealReal product and search pages.
 * Targets: therealreal.com/products/*
 */

const PLATFORM = 'therealreal';

/**
 * Try an ordered list of CSS selectors on `doc`, returning the first
 * non-empty text content or null.
 * @param {Document} doc
 * @param {string[]} selectors
 * @param {string}   fieldName - For debug logging.
 * @returns {string|null}
 */
function tryText(doc, selectors, fieldName) {
  for (const sel of selectors) {
    try {
      const el = doc.querySelector(sel);
      const text = el?.textContent?.trim();
      if (text) {
        console.debug(`[MaisonDeux][${PLATFORM}] ${fieldName} matched: ${sel}`);
        return text;
      }
    } catch { /* skip invalid selector */ }
  }
  console.debug(`[MaisonDeux][${PLATFORM}] ${fieldName} — no selector matched`);
  return null;
}

/**
 * Try an ordered list of selectors to extract an image URL.
 * Resolves relative URLs to absolute.
 * @param {Document} doc
 * @param {string[]} selectors
 * @param {string}   fieldName
 * @returns {string|null}
 */
function tryImage(doc, selectors, fieldName) {
  for (const sel of selectors) {
    try {
      const el = doc.querySelector(sel);
      const url = el?.src || el?.getAttribute('content') || el?.getAttribute('href');
      if (url) {
        console.debug(`[MaisonDeux][${PLATFORM}] ${fieldName} matched: ${sel}`);
        try { return new URL(url, doc.baseURI).href; } catch { return url; }
      }
    } catch { /* skip */ }
  }
  console.debug(`[MaisonDeux][${PLATFORM}] ${fieldName} — no selector matched`);
  return null;
}

/**
 * Extract product data from a TheRealReal product detail page.
 * @param {Document} doc
 * @returns {{brand:string|null, productName:string|null, price:string|null,
 *            imageUrl:string|null, description:string|null, conditionText:string|null,
 *            categoryText:string|null, platformText:string|null, source:string}}
 */
export function extractProductPage(doc) {
  const brand = tryText(doc, [
    '[data-testid="designer-name"]',
    '.product-details__designer',
    '.pdp-designer-name',
    'h2 a[href*="/designers/"]',
  ], 'brand');

  const productName = tryText(doc, [
    '[data-testid="product-name"]',
    '.product-details__name',
    'h1',
    '.pdp-product-name',
  ], 'productName');

  const price = tryText(doc, [
    '[data-testid="price"]',
    '.product-details__price',
    '.pdp-price',
    '[itemprop="price"]',
  ], 'price');

  const imageUrl = tryImage(doc, [
    '.pdp-image img',
    '[data-testid="product-image"] img',
    '.product-media img',
    'meta[property="og:image"]',
  ], 'imageUrl');

  const description = tryText(doc, [
    '.product-details__description',
    '[data-testid="product-description"]',
    '.pdp-description',
    '[itemprop="description"]',
  ], 'description');

  const conditionText = tryText(doc, [
    '.product-details__condition',
    '[data-testid="condition"]',
    '.pdp-condition',
  ], 'conditionText');

  // Fallback: scan for "Condition:" label in the page.
  let condition = conditionText;
  if (!condition) {
    try {
      const labels = doc.querySelectorAll('.product-details dt, .pdp-label, th, strong');
      for (const label of labels) {
        if (/condition/i.test(label.textContent)) {
          const next = label.nextElementSibling;
          condition = next?.textContent?.trim() || null;
          if (condition) break;
        }
      }
    } catch { /* skip */ }
  }

  const categoryText = tryText(doc, [
    '[data-testid="breadcrumb"]',
    '.breadcrumbs',
    'nav[aria-label="breadcrumb"]',
    '.product-details__category',
  ], 'categoryText');

  return {
    brand,
    productName,
    price,
    imageUrl,
    description,
    conditionText: condition,
    categoryText,
    platformText: null,
    source: PLATFORM,
  };
}

/**
 * Extract search result listings from a TheRealReal search page.
 * @param {Document} doc
 * @returns {Array<{title:string|null, price:string|null, img:string|null,
 *                  link:string|null, condition:string|null}>}
 */
export function extractSearchResults(doc) {
  const containerSelectors = [
    '[data-testid="product-card"]',
    '.product-card',
    '.SearchResults__item',
    'article',
  ];

  let cards = [];
  for (const sel of containerSelectors) {
    cards = [...doc.querySelectorAll(sel)];
    if (cards.length) {
      console.debug(`[MaisonDeux][${PLATFORM}] search container matched: ${sel} (${cards.length})`);
      break;
    }
  }

  return cards.slice(0, 10).map((card) => ({
    title: card.querySelector('a[data-testid="product-name"], .product-card__name, h3, h4')?.textContent?.trim() || null,
    price: card.querySelector('[data-testid="price"], .product-card__price, .price')?.textContent?.trim() || null,
    img: resolveUrl(doc, card.querySelector('img')?.src),
    link: resolveUrl(doc, card.querySelector('a')?.href),
    condition: null,
  }));
}

/**
 * Resolve a potentially relative URL to absolute.
 * @param {Document} doc
 * @param {string|undefined} url
 * @returns {string|null}
 */
function resolveUrl(doc, url) {
  if (!url) return null;
  try { return new URL(url, doc.baseURI).href; } catch { return url; }
}
