/**
 * @file extractors/mercari.js
 * @description DOM extractor for Mercari item and search pages.
 * Targets: mercari.com/item/*
 */

const PLATFORM = 'mercari';

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
 * Extract product data from a Mercari item page.
 * @param {Document} doc
 * @returns {{brand:string|null, productName:string|null, price:string|null,
 *            imageUrl:string|null, description:string|null, conditionText:string|null,
 *            categoryText:string|null, platformText:string|null, source:string}}
 */
export function extractProductPage(doc) {
  const brand = tryText(doc, [
    '[data-testid="BrandName"]',
    '.BrandName',
    'a[href*="/brand/"]',
    '[class*="Brand"] a',
  ], 'brand');

  const productName = tryText(doc, [
    '[data-testid="ItemName"]',
    'h1',
    '.ItemName',
    'h1[class*="ItemName"]',
  ], 'productName');

  const price = tryText(doc, [
    '[data-testid="ItemPrice"]',
    '.ItemPrice',
    '.price',
    '[class*="ItemPrice"]',
  ], 'price');

  const imageUrl = tryImage(doc, [
    '[data-testid="ItemImage"] img',
    '.ItemImage img',
    '.item-photo img',
    'meta[property="og:image"]',
  ], 'imageUrl');

  const description = tryText(doc, [
    '[data-testid="ItemDescription"]',
    '.ItemDescription',
    '.item-description',
    '[class*="Description"]',
  ], 'description');

  const conditionText = tryText(doc, [
    '[data-testid="item-condition"]',
    '[class*="Condition"]',
    '.item-condition',
    '.condition',
  ], 'conditionText');

  const categoryText = tryText(doc, [
    '[data-testid="item-category"]',
    '.breadcrumb a:last-child',
    '[class*="Category"]',
    '.item-category',
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
 * Extract search result listings from a Mercari search page.
 * @param {Document} doc
 * @returns {Array<{title:string|null, price:string|null, img:string|null,
 *                  link:string|null, condition:string|null}>}
 */
export function extractSearchResults(doc) {
  const containerSelectors = [
    '[data-testid="SearchResults"] [data-testid="ItemCell"]',
    '[data-testid="ItemCell"]',
    '.SearchResultItem',
    '[class*="SearchResult"] [class*="Item"]',
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
    title: card.querySelector('[data-testid="ItemName"], [class*="ItemName"], h3, p')?.textContent?.trim() || null,
    price: card.querySelector('[data-testid="ItemPrice"], [class*="ItemPrice"], .price')?.textContent?.trim() || null,
    img: resolveUrl(doc, card.querySelector('img')?.src),
    link: resolveUrl(doc, card.querySelector('a')?.href),
    condition: card.querySelector('[class*="Condition"]')?.textContent?.trim() || null,
  }));
}
