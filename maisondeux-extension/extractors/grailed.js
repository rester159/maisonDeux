/**
 * @file extractors/grailed.js
 * @description DOM extractor for Grailed listing and search pages.
 * Targets: grailed.com/listings/*
 */

const PLATFORM = 'grailed';

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
 * Extract product data from a Grailed listing page.
 * @param {Document} doc
 * @returns {{brand:string|null, productName:string|null, price:string|null,
 *            imageUrl:string|null, description:string|null, conditionText:string|null,
 *            categoryText:string|null, platformText:string|null, source:string}}
 */
export function extractProductPage(doc) {
  const brand = tryText(doc, [
    '.listing-designer-info a',
    '[data-testid="designer"]',
    '.Details-designerName',
    '[class*="DesignerName"]',
    'a[class*="designer"]',
  ], 'brand');

  const productName = tryText(doc, [
    '.listing-title',
    '[data-testid="listing-title"]',
    'h1',
    '[class*="ListingTitle"]',
    'h1[class*="title"]',
  ], 'productName');

  const price = tryText(doc, [
    '.listing-price',
    '[data-testid="price"]',
    '.Price',
    '[class*="Price"]',
    'span[class*="price"]',
  ], 'price');

  const imageUrl = tryImage(doc, [
    '.listing-photos img',
    '[data-testid="listing-photo"] img',
    '.ListingPhotos img',
    'meta[property="og:image"]',
  ], 'imageUrl');

  const description = tryText(doc, [
    '.listing-description',
    '[data-testid="listing-description"]',
    '.Details-description',
    '[class*="Description"]',
  ], 'description');

  const conditionText = tryText(doc, [
    '.listing-condition',
    '[data-testid="condition"]',
    '[class*="Condition"]',
    '.Details-condition',
  ], 'conditionText');

  const categoryText = tryText(doc, [
    '.listing-category',
    '[data-testid="category"]',
    '[class*="Category"]',
    '.Details-category',
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
 * Extract search result listings from a Grailed search/feed page.
 * @param {Document} doc
 * @returns {Array<{title:string|null, price:string|null, img:string|null,
 *                  link:string|null, condition:string|null}>}
 */
export function extractSearchResults(doc) {
  const containerSelectors = [
    '.feed-item',
    '.FeedItem',
    '[data-testid="listing-card"]',
    '[class*="FeedItem"]',
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
    title: card.querySelector('[class*="ListingTitle"], .feed-item-title, h4, p')?.textContent?.trim() || null,
    price: card.querySelector('[class*="Price"], .feed-item-price, .Price')?.textContent?.trim() || null,
    img: resolveUrl(doc, card.querySelector('img')?.src),
    link: resolveUrl(doc, card.querySelector('a')?.href),
    condition: null,
  }));
}
