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
    const price = (...sels) => {
      for (const sel of sels) {
        try {
          const el = document.querySelector(sel);
          const text = el?.textContent?.trim() || '';
          if (!text) continue;
          // Handle sale prices: "$5,000 $4,500.00" → take the last price.
          const prices = text.match(/\$[\d,]+(?:\.\d{2})?/g);
          if (prices && prices.length) {
            const last = prices[prices.length - 1]; // Sale price is usually last.
            return parseFloat(last.replace(/[^0-9.]/g, '')) || 0;
          }
          // Fallback: just parse any number.
          return parseFloat(text.replace(/[^0-9.]/g, '')) || 0;
        } catch {}
      }
      return 0;
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
      return universalExtract('therealreal');
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
        imageUrls: collectAllImages(),
      };
    }

    if (hostname.includes('poshmark.com')) {
      return universalExtract('poshmark');
    }

    if (hostname.includes('vestiairecollective.com')) {
      return universalExtract('vestiaire');
    }

    if (hostname.includes('grailed.com')) {
      return universalExtract('grailed');
    }

    if (hostname.includes('mercari.com')) {
      return universalExtract('mercari');
    }

    if (hostname.includes('shopgoodwill.com')) {
      return universalExtract('shopgoodwill');
    }

    return null;
  }

  /**
   * Universal extractor — works for any platform by grabbing all visible
   * text from the page and detecting attributes via keywords.
   */
  function universalExtract(platform) {
    // Get the page title (h1).
    const title = document.querySelector('h1')?.textContent?.trim() || document.title || '';

    // Get ALL text from the page. Collect text from individual elements
    // to ensure proper spacing (textContent smashes words together).
    const textParts = [];
    try {
      const els = document.querySelectorAll('h1, h2, h3, h4, p, li, span, td, dd, dt, a, label, div');
      for (const el of els) {
        // Skip elements with lots of children (navigation, wrappers).
        if (el.children.length > 5) continue;
        const t = el.textContent?.trim();
        if (t && t.length > 1 && t.length < 300) textParts.push(t);
        if (textParts.length > 200) break;
      }
    } catch {}
    const bodyText = textParts.join(' ').slice(0, 5000);

    // Detect brand from known brands list.
    const brand = inferBrand(title) || inferBrand(bodyText);

    // Detect price — find all price-like patterns.
    let detectedPrice = 0;
    let currency = 'USD';
    const pricePatterns = bodyText.match(/(?:[\$€£]|CHF|USD|EUR|GBP)\s*[\d,]+(?:\.\d{2})?/g)
      || bodyText.match(/[\d,]+(?:\.\d{2})?\s*(?:CHF|USD|EUR|GBP|€|£|\$)/g)
      || [];
    if (pricePatterns.length) {
      // Collect all valid prices, pick the second one if multiple (sale price).
      // If only one, use that.
      const validPrices = [];
      for (const p of pricePatterns) {
        const val = parseFloat(p.replace(/[^0-9.]/g, '')) || 0;
        if (val >= 50 && val < 500000) {
          let cur = 'USD';
          if (p.includes('€') || p.includes('EUR')) cur = 'EUR';
          else if (p.includes('£') || p.includes('GBP')) cur = 'GBP';
          else if (p.includes('CHF')) cur = 'CHF';
          validPrices.push({ val, cur });
        }
      }
      if (validPrices.length >= 2) {
        // Two prices usually means original + sale — take the lower one.
        const sorted = [...validPrices].sort((a, b) => a.val - b.val);
        detectedPrice = sorted[0].val;
        currency = sorted[0].cur;
      } else if (validPrices.length === 1) {
        detectedPrice = validPrices[0].val;
        currency = validPrices[0].cur;
      }
    }

    // Detect condition.
    const conditionPatterns = [
      /\b(new with tags|brand new|never worn)\b/i,
      /\b(like new|mint|pristine|excellent|nwot)\b/i,
      /\b(very good condition|very good)\b/i,
      /\b(good condition|gently used|pre-owned)\b/i,
      /\b(fair|well worn|used)\b/i,
    ];
    let conditionText = '';
    for (const pat of conditionPatterns) {
      const m = bodyText.match(pat);
      if (m) { conditionText = m[1]; break; }
    }

    // Detect image.
    const imageUrl = document.querySelector('meta[property="og:image"]')?.content
      || document.querySelector('img[src*="product"], img[src*="item"], img[class*="product"]')?.src
      || document.querySelector('img[src*="vestiairecollective.com"]')?.src
      || document.querySelector('img[src*="therealreal.com"]')?.src
      || document.querySelector('picture img')?.src
      || document.querySelector('main img, article img')?.src
      || '';

    return {
      brand,
      productName: title,
      title,
      description: bodyText.slice(0, 3000),
      category: document.querySelector('nav[aria-label="breadcrumb"] a:last-child, .breadcrumb a:last-child')?.textContent?.trim() || '',
      conditionText,
      price: detectedPrice,
      currency,
      url: window.location.href,
      platform,
      imageUrl,
      imageUrls: collectAllImages(),
    };
  }

  /** Collect all product images from the page (thumbnails, gallery, carousel). */
  function collectAllImages() {
    const seen = new Set();
    const results = [];

    // Platform-specific selectors for product galleries.
    const selectors = [
      // eBay
      '#vi_main_img_fs img', '.ux-image-carousel img', '.ux-image-grid img', '#icImg',
      // TheRealReal
      '[class*="ProductImage"] img', '[class*="product-image"] img', '[class*="gallery"] img',
      // Vestiaire
      '[class*="productGallery"] img', '[data-testid*="image"] img',
      'img[src*="vestiairecollective.com"]', 'img[src*="images.vestiaire"]',
      '[class*="Gallery"] img', '[class*="slider"] img', '[class*="Slider"] img',
      'picture source[srcset*="vestiaire"]', 'picture img',
      // Poshmark
      '[class*="listing-image"] img', '[class*="carousel"] img',
      // Grailed
      '[class*="listing-cover"] img', '[class*="listing-photo"] img',
      // Mercari
      '[class*="ItemPhoto"] img', '[data-testid*="photo"] img',
      // ShopGoodwill
      '.product-image img', '.carousel img',
      // Generic fallbacks
      'meta[property="og:image"]',
      '[itemprop="image"]',
      'main img[src*="product"], main img[src*="item"], main img[src*="listing"]',
    ];

    for (const sel of selectors) {
      try {
        for (const el of document.querySelectorAll(sel)) {
          let url = '';
          if (el.tagName === 'META') {
            url = el.content || '';
          } else if (el.tagName === 'IMG') {
            // Prefer data-src (lazy-loaded full-size) over src (thumbnail).
            url = el.dataset.zoom || el.dataset.src || el.dataset.original || el.src || '';
          } else {
            url = el.getAttribute('src') || el.getAttribute('content') || '';
          }

          // Clean up — want full-size images, skip tiny icons/svgs.
          if (!url || url.startsWith('data:') || url.endsWith('.svg')) continue;
          if (url.includes('sprite') || url.includes('icon') || url.includes('logo')) continue;

          // Normalize — upgrade to https, make absolute.
          if (url.startsWith('//')) url = 'https:' + url;
          else if (url.startsWith('/')) url = window.location.origin + url;

          // Try to get full-size version (eBay s-l64 → s-l1600, etc.)
          url = url.replace(/s-l\d+/g, 's-l1600');

          if (!seen.has(url)) {
            seen.add(url);
            results.push(url);
          }
        }
      } catch {}
    }

    // Cap at 10 images to avoid huge payloads.
    return results.slice(0, 10);
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
