/**
 * @file extractors/ebay.js
 * @description DOM extractor for eBay item and search pages.
 * Targets: ebay.com/itm/*
 */

const PLATFORM = 'ebay';

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
 * Try to extract brand from the Item Specifics table.
 * @param {Document} doc
 * @returns {string|null}
 */
function extractBrandFromSpecifics(doc) {
  try {
    // eBay item specifics table: look for "Brand" row.
    const rows = doc.querySelectorAll(
      '.x-item-specifics .ux-labels-values, .itemAttr tr, .item-specifics tr'
    );
    for (const row of rows) {
      const label = row.querySelector('.ux-labels-values__labels, td:first-child, th');
      if (label && /brand/i.test(label.textContent)) {
        const value = row.querySelector('.ux-labels-values__values, td:last-child');
        const text = value?.textContent?.trim();
        if (text) return text;
      }
    }
  } catch { /* skip */ }
  return null;
}

/**
 * Infer brand from title using common "BRAND - description" pattern.
 * @param {string} title
 * @returns {string}
 */
function inferBrand(title) {
  const m = title.match(/^([A-Za-z\s&'.]+?)\s*[-–—|]/);
  return m ? m[1].trim() : '';
}

/**
 * Extract product data from an eBay item detail page.
 * @param {Document} doc
 * @returns {{brand:string|null, productName:string|null, price:string|null,
 *            imageUrl:string|null, description:string|null, conditionText:string|null,
 *            categoryText:string|null, platformText:string|null, source:string}}
 */
export function extractProductPage(doc) {
  const productName = tryText(doc, [
    'h1.x-item-title__mainTitle span',
    'h1[itemprop="name"]',
    '.it-ttl',
    'h1',
  ], 'productName');

  // Brand: item specifics → itemprop → title inference.
  let brand = extractBrandFromSpecifics(doc);
  if (!brand) {
    brand = tryText(doc, [
      '[itemprop="brand"]',
      '.x-item-specifics [data-testid="brand-value"]',
    ], 'brand');
  }
  if (!brand && productName) {
    brand = inferBrand(productName);
  }

  const price = tryText(doc, [
    '.x-price-primary span',
    '[itemprop="price"]',
    '.vi-price',
    '#prcIsum',
  ], 'price');

  const imageUrl = tryImage(doc, [
    '#icImg',
    '.ux-image-carousel img',
    'img[itemprop="image"]',
    'meta[property="og:image"]',
  ], 'imageUrl');

  const description = tryText(doc, [
    '.x-item-description',
    '#desc_div',
    '[itemprop="description"]',
    '.item-description',
  ], 'description');

  const conditionText = tryText(doc, [
    '.x-item-condition span',
    '.x-item-condition-text span',
    '[data-testid="ux-icon-text"]',
    '.vi-cond',
    '#vi-itm-cond',
  ], 'conditionText');

  const categoryText = tryText(doc, [
    '.breadcrumbs a:last-child',
    'nav.breadcrumbs li:last-child',
    '.seo-breadcrumb-text a:last-child',
    '[itemprop="itemListElement"]:last-child',
  ], 'categoryText');

  return {
    brand: brand || null,
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
 * Extract search result listings from an eBay search page.
 * Filters out promotional "Shop on eBay" items.
 * @param {Document} doc
 * @returns {Array<{title:string|null, price:string|null, img:string|null,
 *                  link:string|null, condition:string|null}>}
 */
export function extractSearchResults(doc) {
  const containerSelectors = [
    '.s-item',
    '.srp-results .s-item__wrapper',
    '[data-testid="search-results"] li',
  ];

  let cards = [];
  for (const sel of containerSelectors) {
    cards = [...doc.querySelectorAll(sel)];
    if (cards.length) {
      console.debug(`[MaisonDeux][${PLATFORM}] search container matched: ${sel} (${cards.length})`);
      break;
    }
  }

  return cards
    .filter((card) => {
      // Filter out "Shop on eBay" promo items.
      const title = card.querySelector('.s-item__title, h3')?.textContent || '';
      return !/shop on ebay/i.test(title);
    })
    .slice(0, 10)
    .map((card) => ({
      title: card.querySelector('.s-item__title span, .s-item__title, h3')?.textContent?.trim() || null,
      price: card.querySelector('.s-item__price, .s-item__detail--price')?.textContent?.trim() || null,
      img: resolveUrl(doc, card.querySelector('.s-item__image img, img')?.src),
      link: resolveUrl(doc, card.querySelector('.s-item__link, a')?.href),
      condition: card.querySelector('.SECONDARY_INFO, .s-item__subtitle')?.textContent?.trim() || null,
    }));
}
