/**
 * @file extractors/shopgoodwill.js
 * @description DOM extractor for ShopGoodwill item and search pages.
 * Targets: shopgoodwill.com/item/*
 *
 * Note: ShopGoodwill is an auction site — "price" is typically the
 * current bid, not a fixed price.
 */

const PLATFORM = 'shopgoodwill';

function tryText(doc, selectors, fieldName) {
  for (const sel of selectors) {
    try {
      const el = doc.querySelector(sel);
      const text = el?.textContent?.trim();
      if (text) {
        console.debug(`[MaisonDeux][${PLATFORM}] ${fieldName} matched: ${sel}`);
        return text;
      }
    } catch { /* skip */ }
  }
  console.debug(`[MaisonDeux][${PLATFORM}] ${fieldName} — no selector matched`);
  return null;
}

function tryImage(doc, selectors, fieldName) {
  for (const sel of selectors) {
    try {
      const el = doc.querySelector(sel);
      const url = el?.src || el?.getAttribute('content') || el?.getAttribute('href');
      if (url) {
        console.debug(`[MaisonDeux][${PLATFORM}] ${fieldName} matched: ${sel}`);
        return resolveUrl(doc, url);
      }
    } catch { /* skip */ }
  }
  console.debug(`[MaisonDeux][${PLATFORM}] ${fieldName} — no selector matched`);
  return null;
}

function resolveUrl(doc, url) {
  if (!url) return null;
  try { return new URL(url, doc.baseURI).href; } catch { return url; }
}

/**
 * Infer brand from a ShopGoodwill title.
 * @param {string} title
 * @returns {string}
 */
function inferBrand(title) {
  const m = title.match(/^([A-Za-z\s&'.]+?)\s*[-–—|]/);
  return m ? m[1].trim() : '';
}

/**
 * Extract product data from a ShopGoodwill item page.
 * @param {Document} doc
 * @returns {{brand:string|null, productName:string|null, price:string|null,
 *            imageUrl:string|null, description:string|null, conditionText:string|null,
 *            categoryText:string|null, platformText:string|null, source:string}}
 */
export function extractProductPage(doc) {
  const productName = tryText(doc, [
    '.lot-title h1',
    '.item-title',
    'h1.product-title',
    'h1',
  ], 'productName');

  // ShopGoodwill rarely has a dedicated brand field — infer from title.
  const brand = inferBrand(productName || '') || null;

  const price = tryText(doc, [
    '.current-bid',
    '.item-price',
    '.price',
    '.bid-amount',
  ], 'price');

  const imageUrl = tryImage(doc, [
    '.lot-image img',
    '.item-image img',
    '.product-image img',
    'meta[property="og:image"]',
  ], 'imageUrl');

  const description = tryText(doc, [
    '.lot-description',
    '.item-description',
    '.product-description',
    '#description',
  ], 'description');

  const conditionText = tryText(doc, [
    '.item-condition',
    '.condition',
    '.lot-condition',
  ], 'conditionText');

  const categoryText = tryText(doc, [
    '.breadcrumb a:last-child',
    '.category-name',
    '.lot-category',
    'nav.breadcrumb li:last-child',
  ], 'categoryText');

  return {
    brand,
    productName,
    price,
    imageUrl,
    description,
    conditionText,
    categoryText,
    platformText: null,
    source: PLATFORM,
  };
}

/**
 * Extract search result listings from a ShopGoodwill search page.
 * @param {Document} doc
 * @returns {Array<{title:string|null, price:string|null, img:string|null,
 *                  link:string|null, condition:string|null}>}
 */
export function extractSearchResults(doc) {
  const containerSelectors = [
    '.search-results .item',
    '.product-list .product',
    '.lot-list .lot',
    '.search-result-item',
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
    title: card.querySelector('.item-title, .lot-title, h3, h4, a')?.textContent?.trim() || null,
    price: card.querySelector('.current-bid, .item-price, .price')?.textContent?.trim() || null,
    img: resolveUrl(doc, card.querySelector('img')?.src),
    link: resolveUrl(doc, card.querySelector('a')?.href),
    condition: null,
  }));
}
