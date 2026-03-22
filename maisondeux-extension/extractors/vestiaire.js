/**
 * @file extractors/vestiaire.js
 * @description DOM extractor for Vestiaire Collective product and search pages.
 * Targets: vestiairecollective.com/*
 */

const PLATFORM = 'vestiaire';

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
 * Extract product data from a Vestiaire Collective product page.
 * @param {Document} doc
 * @returns {{brand:string|null, productName:string|null, price:string|null,
 *            imageUrl:string|null, description:string|null, conditionText:string|null,
 *            categoryText:string|null, platformText:string|null, source:string}}
 */
export function extractProductPage(doc) {
  const brand = tryText(doc, [
    '.product__brand',
    '[data-testid="designer-name"]',
    '.pdp-brand',
    'a[href*="/designers/"]',
  ], 'brand');

  const productName = tryText(doc, [
    '.product__name',
    '[data-testid="product-title"]',
    'h1',
    '.product-title',
  ], 'productName');

  const price = tryText(doc, [
    '.product__price',
    '[data-testid="product-price"]',
    '.price-box',
    '.pdp-price',
  ], 'price');

  const imageUrl = tryImage(doc, [
    '.product__image img',
    '[data-testid="product-image"] img',
    '.pdp-gallery img',
    'meta[property="og:image"]',
  ], 'imageUrl');

  const description = tryText(doc, [
    '.product__description',
    '[data-testid="product-description"]',
    '.pdp-description',
    '[itemprop="description"]',
  ], 'description');

  const conditionText = tryText(doc, [
    '.product__condition',
    '[data-testid="product-condition"]',
    '.pdp-condition',
    '.condition-tag',
  ], 'conditionText');

  const categoryText = tryText(doc, [
    '.breadcrumb a:last-child',
    '[data-testid="breadcrumb"]',
    'nav[aria-label="breadcrumb"]',
    '.product__category',
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
 * Extract search result listings from a Vestiaire Collective search page.
 * @param {Document} doc
 * @returns {Array<{title:string|null, price:string|null, img:string|null,
 *                  link:string|null, condition:string|null}>}
 */
export function extractSearchResults(doc) {
  const containerSelectors = [
    '[data-testid="product-card"]',
    '.productCard',
    '.catalog__product',
    'article.product',
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
    title: card.querySelector('[data-testid="product-name"], .productCard__name, .product__name, h3')?.textContent?.trim() || null,
    price: card.querySelector('[data-testid="product-price"], .productCard__price, .product__price, .price')?.textContent?.trim() || null,
    img: resolveUrl(doc, card.querySelector('img')?.src),
    link: resolveUrl(doc, card.querySelector('a')?.href),
    condition: card.querySelector('.productCard__condition, .condition')?.textContent?.trim() || null,
  }));
}
