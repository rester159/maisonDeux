/**
 * @file content-script.js
 * @description Injected into supported product pages. Detects the current
 * platform, runs the appropriate extractor, and notifies the background
 * service worker with the product data.
 *
 * Because content scripts cannot use ES module imports, extractors are
 * loaded dynamically via chrome.runtime.getURL and importScripts won't
 * work in MV3 content scripts. Instead we inline a small dispatcher that
 * maps hostnames to extractor functions and import them at build time
 * or via dynamic <script> tags. For the scaffolding phase we keep a
 * simple switch-based approach.
 */

/* global chrome */

(async function maisonDeuxContentScript() {
  'use strict';

  const host = window.location.hostname.replace('www.', '');
  const path = window.location.pathname;

  // Vestiaire matches all paths — filter to product pages here.
  if (host.includes('vestiairecollective.com')) {
    // Vestiaire product URLs typically contain a numeric ID segment.
    if (!/\/\d+\.shtml/.test(path) && !/\/[a-z-]+-\d+/.test(path)) {
      return; // Not a product page.
    }
  }

  // Give the page a moment to finish rendering dynamic content.
  await new Promise((r) => setTimeout(r, 1500));

  const product = extractProduct(host);
  if (!product) return;

  chrome.runtime.sendMessage({
    type: 'PRODUCT_DETECTED',
    payload: product,
  });

  /**
   * Dispatch to the correct extraction logic based on hostname.
   * @param {string} hostname
   * @returns {Object|null}
   */
  function extractProduct(hostname) {
    const q = (sel) => document.querySelector(sel)?.textContent?.trim() || '';
    const price = (sel) => {
      const text = q(sel);
      return parseFloat(text.replace(/[^0-9.]/g, '')) || 0;
    };

    if (hostname.includes('therealreal.com')) {
      return {
        brand: q('[data-testid="designer-name"], .designer-name'),
        title: q('[data-testid="product-title"], h1'),
        category: q('.breadcrumb a:nth-child(2), .product-category'),
        condition: q('.item-condition, [data-testid="condition"]'),
        price: price('[data-testid="product-price"], .product-price'),
        currency: 'USD',
        url: window.location.href,
        platform: 'therealreal',
      };
    }

    if (hostname.includes('ebay.com')) {
      const title = q('h1.x-item-title__mainTitle span, h1[itemprop="name"]');
      return {
        brand: inferBrand(title),
        title,
        category: q('.seo-breadcrumb-text a:last-child'),
        condition: q('.x-item-condition-text span, #vi-itm-cond'),
        price: price('.x-price-primary span, [itemprop="price"]'),
        currency: document.querySelector('[itemprop="priceCurrency"]')?.getAttribute('content') || 'USD',
        url: window.location.href,
        platform: 'ebay',
      };
    }

    if (hostname.includes('poshmark.com')) {
      return {
        brand: q('[data-test="listing-brand"], .listing-brand a'),
        title: q('[data-test="listing-title"], .listing-title h1'),
        category: q('[data-test="listing-category"], .listing-category a:last-child'),
        condition: q('[data-test="listing-condition"], .listing-condition'),
        price: price('[data-test="listing-price"], .listing-price'),
        currency: 'USD',
        url: window.location.href,
        platform: 'poshmark',
      };
    }

    if (hostname.includes('vestiairecollective.com')) {
      const priceText = q('[data-testid="product-price"], .product-price');
      const currencyMatch = priceText.match(/(€|£|\$)/);
      let currency = 'EUR';
      if (currencyMatch) {
        currency = currencyMatch[1] === '$' ? 'USD' : currencyMatch[1] === '£' ? 'GBP' : 'EUR';
      }
      return {
        brand: q('[data-testid="product-brand"], .product-brand a'),
        title: q('[data-testid="product-title"], .product-title h1'),
        category: q('.breadcrumb a:last-child, .product-category'),
        condition: q('[data-testid="product-condition"], .product-condition'),
        price: price('[data-testid="product-price"], .product-price'),
        currency,
        url: window.location.href,
        platform: 'vestiaire',
      };
    }

    if (hostname.includes('grailed.com')) {
      return {
        brand: q('[class*="DesignerName"], a[class*="designer"]'),
        title: q('[class*="ListingTitle"], h1[class*="title"]'),
        category: q('[class*="Category"], [class*="category"]'),
        condition: q('[class*="Condition"], [class*="condition"]'),
        price: price('[class*="Price"], span[class*="price"]'),
        currency: 'USD',
        url: window.location.href,
        platform: 'grailed',
      };
    }

    if (hostname.includes('mercari.com')) {
      return {
        brand: q('[data-testid="item-brand"], [class*="Brand"] a'),
        title: q('[data-testid="item-name"], h1[class*="ItemName"]'),
        category: q('[data-testid="item-category"], .breadcrumb a:last-child'),
        condition: q('[data-testid="item-condition"], [class*="Condition"]'),
        price: price('[data-testid="item-price"], [class*="ItemPrice"]'),
        currency: 'USD',
        url: window.location.href,
        platform: 'mercari',
      };
    }

    if (hostname.includes('shopgoodwill.com')) {
      const title = q('.lot-title h1, .item-title');
      return {
        brand: inferBrand(title),
        title,
        category: q('.breadcrumb a:last-child, .category-name'),
        condition: q('.item-condition, .condition'),
        price: price('.current-bid, .item-price, .price'),
        currency: 'USD',
        url: window.location.href,
        platform: 'shopgoodwill',
      };
    }

    return null;
  }

  function inferBrand(title) {
    const m = title.match(/^([A-Za-z\s&]+?)\s*[-–—|]/);
    return m ? m[1].trim() : '';
  }
})();
