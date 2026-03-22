/**
 * @file content-script.js
 * @description Injected into supported product pages. Detects the current
 * platform, extracts product data, and sends PRODUCT_DETECTED to background.
 * Uses MutationObserver to wait for dynamic content to render.
 */

/* global chrome */

(function maisonDeuxContentScript() {
  'use strict';

  // Only detect once per page navigation.
  if (window.__maisonDeuxDetected) return;
  window.__maisonDeuxDetected = true;

  const host = window.location.hostname.replace('www.', '');
  const path = window.location.pathname;

  // Vestiaire matches all paths — filter to product pages here.
  if (host.includes('vestiairecollective.com')) {
    if (!/\/\d+\.shtml/.test(path) && !/\/[a-z-]+-\d+/.test(path)) return;
  }

  // Wait for DOM to settle via MutationObserver + initial delay.
  let debounceTimer = null;
  let settled = false;

  const observer = new MutationObserver(() => {
    if (settled) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      settled = true;
      observer.disconnect();
      detectProduct();
    }, 1000); // 1-second debounce after last mutation
  });

  // Start observing after a 2-second initial delay.
  setTimeout(() => {
    if (settled) return;
    observer.observe(document.body, { childList: true, subtree: true });
    // Also fire after 4 seconds regardless, in case no mutations happen.
    setTimeout(() => {
      if (!settled) {
        settled = true;
        observer.disconnect();
        detectProduct();
      }
    }, 2000);
  }, 2000);

  /**
   * Extract product data and notify the background service worker.
   */
  function detectProduct() {
    const product = extractProduct(host);
    if (!product) {
      console.debug('[MaisonDeux] No product data extracted');
      return;
    }

    console.debug('[MaisonDeux] Product detected:', product);

    chrome.runtime.sendMessage({
      type: 'PRODUCT_DETECTED',
      payload: product,
    });
  }

  /**
   * Dispatch to the correct extraction logic based on hostname.
   */
  function extractProduct(hostname) {
    const q = (sel) => document.querySelector(sel)?.textContent?.trim() || '';
    const qAll = (...sels) => {
      for (const sel of sels) {
        const text = q(sel);
        if (text) return text;
      }
      return '';
    };
    const price = (sel) => {
      const text = q(sel);
      return parseFloat(text.replace(/[^0-9.]/g, '')) || 0;
    };
    // Grab full description/details text from the page.
    const descriptionText = (...sels) => {
      for (const sel of sels) {
        try {
          const els = document.querySelectorAll(sel);
          if (els.length) {
            return [...els].map(el => el.textContent?.trim()).filter(Boolean).join(' ');
          }
        } catch {}
      }
      return '';
    };

    // Grab ALL text from multiple selectors, deduped, limited to 2000 chars.
    const grabAllText = (sels) => {
      const texts = new Set();
      for (const sel of sels) {
        try {
          const els = document.querySelectorAll(sel);
          for (const el of els) {
            const t = el.textContent?.trim();
            if (t && t.length > 3 && t.length < 500) texts.add(t);
          }
        } catch {}
      }
      return [...texts].join(' ').slice(0, 2000);
    };

    if (hostname.includes('therealreal.com')) {
      // Grab ALL visible text from the product page for description.
      const allPageText = grabAllText([
        'ul li', // Bullet point descriptions
        '.product-details', '[data-testid="product-description"]',
        '.pdp-description', '[itemprop="description"]',
        '.product-details__description', '.product-details__condition',
        'section', 'main',
      ]);

      return {
        brand: q('[data-testid="designer-name"], .product-details__designer, .pdp-designer-name, h2 a[href*="/designers/"]'),
        productName: q('[data-testid="product-name"], .product-details__name, h1, .pdp-product-name'),
        title: q('[data-testid="product-name"], .product-details__name, h1'),
        description: allPageText,
        category: q('[data-testid="breadcrumb"], .breadcrumbs, nav[aria-label="breadcrumb"]'),
        conditionText: q('.product-details__condition, [data-testid="condition"]'),
        price: price('[data-testid="price"], .product-details__price, .pdp-price, [itemprop="price"]'),
        currency: 'USD',
        url: window.location.href,
        platform: 'therealreal',
        imageUrl: document.querySelector('.pdp-image img, [data-testid="product-image"] img, .product-media img')?.src || document.querySelector('meta[property="og:image"]')?.content || '',
      };
    }

    if (hostname.includes('ebay.com')) {
      const title = q('h1.x-item-title__mainTitle span, h1[itemprop="name"], .it-ttl, h1');

      // Extract Item Specifics table into a structured object.
      const specifics = {};
      try {
        const rows = document.querySelectorAll('.x-item-specifics .ux-labels-values__labels-content, .ux-labels-values, .itemAttr tr');
        for (const row of rows) {
          const labelEl = row.querySelector('.ux-labels-values__labels, .ux-labels-values__labels-content, td:first-child, th, dt');
          const valueEl = row.querySelector('.ux-labels-values__values, .ux-labels-values__values-content, td:last-child, dd');
          if (labelEl && valueEl) {
            const label = labelEl.textContent.trim().toLowerCase().replace(/:$/, '');
            const value = valueEl.textContent.trim();
            if (label && value) specifics[label] = value;
          }
        }
      } catch {}

      // Build rich description from specifics.
      const specificsText = Object.entries(specifics).map(([k, v]) => `${k}: ${v}`).join('. ');
      const descText = descriptionText('.x-item-description', '#desc_div', '[itemprop="description"]');

      return {
        brand: specifics['brand'] || inferBrand(title),
        productName: title,
        title,
        model: specifics['model'] || specifics['style'] || null,
        color: specifics['color'] || null,
        material: specifics['material'] || specifics['fabric type'] || null,
        hardware: specifics['hardware material'] || specifics['hardware color'] || null,
        size: specifics['size'] || null,
        pattern: specifics['pattern'] || null,
        department: specifics['department'] || null,
        description: [specificsText, descText].filter(Boolean).join(' '),
        category: q('.breadcrumbs a:last-child, nav.breadcrumbs li:last-child'),
        conditionText: q('.x-item-condition span, .x-item-condition-text span, [data-testid="ux-icon-text"], .vi-cond'),
        price: price('.x-price-primary span, [itemprop="price"], .vi-price'),
        currency: document.querySelector('[itemprop="priceCurrency"]')?.getAttribute('content') || 'USD',
        url: window.location.href,
        platform: 'ebay',
        imageUrl: document.querySelector('#icImg, .ux-image-carousel img, img[itemprop="image"]')?.src || '',
      };
    }

    if (hostname.includes('poshmark.com')) {
      return {
        brand: q('[data-testid="brand-name"], .listing__brand, a[href*="/brand/"], .listing-brand a'),
        productName: q('[data-testid="listing-title"], .listing__title, h1'),
        title: q('[data-testid="listing-title"], .listing__title, h1'),
        description: descriptionText('[data-testid="listing-description"], .listing__description, .listing-description'),
        category: q('[data-testid="listing-category"], .listing__category'),
        conditionText: q('[data-testid="listing-condition"], .listing__condition'),
        price: price('[data-testid="listing-price"], .listing__price, .price'),
        currency: 'USD',
        url: window.location.href,
        platform: 'poshmark',
      };
    }

    if (hostname.includes('vestiairecollective.com')) {
      const priceText = q('.product__price, [data-testid="product-price"], .price-box');
      const currencyMatch = priceText.match(/(€|£|\$)/);
      let currency = 'EUR';
      if (currencyMatch) {
        currency = currencyMatch[1] === '$' ? 'USD' : currencyMatch[1] === '£' ? 'GBP' : 'EUR';
      }
      return {
        brand: q('.product__brand, [data-testid="designer-name"], .pdp-brand, a[href*="/designers/"]'),
        productName: q('.product__name, [data-testid="product-title"], h1'),
        title: q('.product__name, [data-testid="product-title"], h1'),
        description: descriptionText('.product__description, [data-testid="product-description"], .pdp-description, [itemprop="description"]'),
        category: q('.breadcrumb a:last-child, [data-testid="breadcrumb"]'),
        conditionText: q('.product__condition, [data-testid="product-condition"]'),
        price: price('.product__price, [data-testid="product-price"], .price-box'),
        currency,
        url: window.location.href,
        platform: 'vestiaire',
      };
    }

    if (hostname.includes('grailed.com')) {
      return {
        brand: q('.listing-designer-info a, [data-testid="designer"], .Details-designerName, [class*="DesignerName"]'),
        productName: q('.listing-title, [data-testid="listing-title"], h1, [class*="ListingTitle"]'),
        title: q('.listing-title, [data-testid="listing-title"], h1'),
        description: descriptionText('.listing-description, [data-testid="listing-description"], [class*="Description"]'),
        category: q('.listing-category, [data-testid="category"], [class*="Category"]'),
        conditionText: q('.listing-condition, [data-testid="condition"], [class*="Condition"]'),
        price: price('.listing-price, [data-testid="price"], .Price, [class*="Price"]'),
        currency: 'USD',
        url: window.location.href,
        platform: 'grailed',
      };
    }

    if (hostname.includes('mercari.com')) {
      return {
        brand: q('[data-testid="BrandName"], .BrandName, a[href*="/brand/"]'),
        productName: q('[data-testid="ItemName"], h1, .ItemName'),
        title: q('[data-testid="ItemName"], h1'),
        description: descriptionText('[data-testid="ItemDescription"], .ItemDescription, .item-description'),
        category: q('[data-testid="item-category"], .breadcrumb a:last-child'),
        conditionText: q('[data-testid="item-condition"], [class*="Condition"]'),
        price: price('[data-testid="ItemPrice"], .ItemPrice, .price'),
        currency: 'USD',
        url: window.location.href,
        platform: 'mercari',
      };
    }

    if (hostname.includes('shopgoodwill.com')) {
      const title = q('.lot-title h1, .item-title, h1');
      return {
        brand: inferBrand(title),
        productName: title,
        title,
        description: descriptionText('.lot-description, .item-description, .product-description, #description'),
        category: q('.breadcrumb a:last-child, .category-name'),
        conditionText: q('.item-condition, .condition'),
        price: price('.current-bid, .item-price, .price'),
        currency: 'USD',
        url: window.location.href,
        platform: 'shopgoodwill',
      };
    }

    return null;
  }

  function inferBrand(title) {
    // Try dash/pipe pattern first: "BRAND - description"
    const m = title.match(/^([A-Za-z\s&']+?)\s*[-–—|]/);
    if (m) return m[1].trim();

    // Try matching first word(s) against known luxury brands.
    const lower = (title || '').toLowerCase();
    const KNOWN_BRANDS = [
      'chanel', 'louis vuitton', 'gucci', 'hermes', 'hermès', 'dior', 'christian dior',
      'prada', 'fendi', 'bottega veneta', 'balenciaga', 'saint laurent', 'ysl',
      'celine', 'céline', 'loewe', 'valentino', 'burberry', 'versace', 'givenchy',
      'miu miu', 'coach', 'michael kors', 'kate spade', 'tory burch', 'cartier',
      'tiffany', 'rolex', 'omega', 'ferragamo', 'goyard', 'bulgari', 'jimmy choo',
      'alexander mcqueen', 'stella mccartney', 'marc jacobs', 'off-white', 'rick owens',
      'chrome hearts', 'dolce & gabbana', 'tod\'s', 'bottega', 'van cleef',
    ];
    for (const brand of KNOWN_BRANDS) {
      if (lower.startsWith(brand + ' ') || lower === brand) {
        return brand.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
    }
    return '';
  }
})();
