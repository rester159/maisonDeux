/**
 * @file extractors/poshmark.js
 * @description DOM extractor for Poshmark listing and search pages.
 * Targets: poshmark.com/listing/*
 */

const PLATFORM = 'poshmark';

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
 * Extract product data from a Poshmark listing page.
 * @param {Document} doc
 * @returns {{brand:string|null, productName:string|null, price:string|null,
 *            imageUrl:string|null, description:string|null, conditionText:string|null,
 *            categoryText:string|null, platformText:string|null, source:string}}
 */
export function extractProductPage(doc) {
  const brand = tryText(doc, [
    '[data-testid="brand-name"]',
    '.listing__brand',
    'a[href*="/brand/"]',
    '.listing-brand a',
  ], 'brand');

  const productName = tryText(doc, [
    '[data-testid="listing-title"]',
    '.listing__title',
    'h1',
    '.listing-title h1',
  ], 'productName');

  const price = tryText(doc, [
    '[data-testid="listing-price"]',
    '.listing__price',
    '.price',
    '.listing-price',
  ], 'price');

  const imageUrl = tryImage(doc, [
    '[data-testid="listing-image"] img',
    '.listing__image img',
    '.carousel img',
    'meta[property="og:image"]',
  ], 'imageUrl');

  const description = tryText(doc, [
    '[data-testid="listing-description"]',
    '.listing__description',
    '.listing-description',
    '.description',
  ], 'description');

  const conditionText = tryText(doc, [
    '[data-testid="listing-condition"]',
    '.listing__condition',
    '.listing-condition',
    '.condition',
  ], 'conditionText');

  const categoryText = tryText(doc, [
    '[data-testid="listing-category"]',
    '.listing__category',
    '.listing-category a:last-child',
    '.breadcrumb a:last-child',
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
 * Extract search result listings from a Poshmark search page.
 * @param {Document} doc
 * @returns {Array<{title:string|null, price:string|null, img:string|null,
 *                  link:string|null, condition:string|null}>}
 */
export function extractSearchResults(doc) {
  const containerSelectors = [
    '[data-testid="listing-card"]',
    '.card--small',
    '.tile',
    '[data-testid="closet-card"]',
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
    title: card.querySelector('[data-testid="title"], .card__title, .tile__title, h4')?.textContent?.trim() || null,
    price: card.querySelector('[data-testid="price"], .card__price, .tile__price, .price')?.textContent?.trim() || null,
    img: resolveUrl(doc, card.querySelector('img')?.src),
    link: resolveUrl(doc, card.querySelector('a')?.href),
    condition: null,
  }));
}
