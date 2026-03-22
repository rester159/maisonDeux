// ============================================================
// MaisonDeux — Content Script
// Runs on supported marketplace pages.
// 1) Detects the product being viewed
// 2) Sends product data to background for cross-platform search
// 3) Renders a sleek slide-in panel with deal results
// ============================================================

(function () {
  "use strict";

  // Don't run on search/listing pages — only on product detail pages
  if (!isProductPage()) return;

  // Wait for page to fully render (SPAs may hydrate late)
  const observer = new MutationObserver(debounce(tryDetectProduct, 1000));
  observer.observe(document.body, { childList: true, subtree: true });

  // Also try immediately in case content is already rendered
  setTimeout(tryDetectProduct, 2000);

  // ---- Product detection ----

  function isProductPage() {
    const url = window.location.href;
    // Heuristics: product pages typically have /products/, /itm/, specific slug patterns
    if (url.includes("therealreal.com/products/")) return true;
    if (url.includes("ebay.com/itm/")) return true;
    if (url.includes("poshmark.com/listing/")) return true;
    if (url.includes("vestiairecollective.com") && url.match(/\/[\w-]+-\d+\.shtml/)) return true;
    if (url.includes("grailed.com/listings/")) return true;
    if (url.includes("mercari.com/item/")) return true;
    return false;
  }

  let hasDetected = false;

  function tryDetectProduct() {
    if (hasDetected) return;

    const product = detectProduct();
    if (product && product.productName) {
      hasDetected = true;
      observer.disconnect();

      // Notify the background script
      chrome.runtime.sendMessage(
        { type: "PRODUCT_DETECTED", data: product },
        (response) => {
          if (response?.status === "searching") {
            renderPanel(product, response.platforms);
          }
        }
      );
    }
  }

  function detectProduct() {
    const hostname = window.location.hostname;

    const detectors = {
      "www.therealreal.com": detectTheRealReal,
      "www.ebay.com": detectEbay,
      "poshmark.com": detectPoshmark,
      "www.vestiairecollective.com": detectVestiaire,
      "www.grailed.com": detectGrailed,
      "www.mercari.com": detectMercari,
    };

    const detect = detectors[hostname];
    return detect ? detect() : null;
  }

  function detectTheRealReal() {
    const brand = qs('[data-testid="designer-name"], .product-details__designer, .pdp-designer-name')?.textContent?.trim();
    const productName = qs('[data-testid="product-name"], .product-details__name, h1')?.textContent?.trim();
    const priceEl = qs('[data-testid="price"], .product-details__price, .pdp-price');
    const price = priceEl?.textContent?.trim();
    const img = qs('.pdp-image img, [data-testid="product-image"] img, .product-media img')?.src;
    const category = qs('[data-testid="breadcrumb"] a:nth-child(2), .breadcrumbs a:nth-child(2)')?.textContent?.trim();
    return { brand, productName, price, imageUrl: img, category, source: "The RealReal" };
  }

  function detectEbay() {
    const title = qs("h1.x-item-title__mainTitle span, h1[itemprop='name']")?.textContent?.trim();
    // Try to extract brand from title or item specifics
    const brand = qs('.x-item-specifics [data-testid="ux-labels-values"] .ux-textspans--BOLD')?.textContent?.trim() || extractBrandFromTitle(title);
    const price = qs(".x-price-primary span, [itemprop='price']")?.textContent?.trim();
    const img = qs("#icImg, .ux-image-carousel img, img[itemprop='image']")?.src;
    return { brand, productName: title, price, imageUrl: img, category: "Fashion", source: "eBay" };
  }

  function detectPoshmark() {
    const brand = qs("[data-testid='brand-name'], .listing__brand, .brand-name")?.textContent?.trim();
    const productName = qs("[data-testid='listing-title'], .listing__title, h1")?.textContent?.trim();
    const price = qs("[data-testid='listing-price'], .listing__price, .price")?.textContent?.trim();
    const img = qs("[data-testid='listing-image'] img, .listing__image img, .carousel img")?.src;
    return { brand, productName, price, imageUrl: img, category: "Fashion", source: "Poshmark" };
  }

  function detectVestiaire() {
    const brand = qs(".product__brand, [data-testid='designer-name'], .pdp-brand")?.textContent?.trim();
    const productName = qs(".product__name, [data-testid='product-title'], h1")?.textContent?.trim();
    const price = qs(".product__price, [data-testid='product-price'], .price-box")?.textContent?.trim();
    const img = qs(".product__image img, [data-testid='product-image'] img")?.src;
    return { brand, productName, price, imageUrl: img, category: "Fashion", source: "Vestiaire Collective" };
  }

  function detectGrailed() {
    const brand = qs(".listing-designer-info a, [data-testid='designer'], .Details-designerName")?.textContent?.trim();
    const productName = qs(".listing-title, [data-testid='listing-title'], h1")?.textContent?.trim();
    const price = qs(".listing-price, [data-testid='price'], .Price")?.textContent?.trim();
    const img = qs(".listing-photos img, [data-testid='listing-photo'] img")?.src;
    return { brand, productName, price, imageUrl: img, category: "Fashion", source: "Grailed" };
  }

  function detectMercari() {
    const title = qs('[data-testid="ItemName"], h1, .ItemName')?.textContent?.trim();
    const brand = qs('[data-testid="BrandName"], .BrandName')?.textContent?.trim() || extractBrandFromTitle(title);
    const price = qs('[data-testid="ItemPrice"], .ItemPrice, .price')?.textContent?.trim();
    const img = qs('[data-testid="ItemImage"] img, .ItemImage img')?.src;
    return { brand, productName: title, price, imageUrl: img, category: "Fashion", source: "Mercari" };
  }

  // ---- Common luxury brands for title extraction ----
  const LUXURY_BRANDS = [
    "Chanel", "Louis Vuitton", "Gucci", "Hermès", "Hermes", "Prada", "Dior",
    "Celine", "Céline", "Burberry", "Fendi", "Valentino", "Saint Laurent",
    "Balenciaga", "Bottega Veneta", "Loewe", "Cartier", "Tiffany", "Van Cleef",
    "Bulgari", "Rolex", "Omega", "Patek Philippe", "Audemars Piguet",
    "David Yurman", "John Hardy", "Mikimoto", "Chopard", "Bvlgari",
    "Givenchy", "Alexander McQueen", "Tom Ford", "Versace", "Dolce & Gabbana",
    "Miu Miu", "Off-White", "Fear of God", "Rick Owens", "Acne Studios",
    "Isabel Marant", "Zimmermann", "Jacquemus", "The Row",
  ];

  function extractBrandFromTitle(title) {
    if (!title) return null;
    const titleLower = title.toLowerCase();
    for (const brand of LUXURY_BRANDS) {
      if (titleLower.includes(brand.toLowerCase())) return brand;
    }
    return null;
  }

  // ---- UI: Slide-in results panel ----

  let panelEl = null;

  function renderPanel(product, searchingPlatforms) {
    if (panelEl) panelEl.remove();

    panelEl = document.createElement("div");
    panelEl.id = "maisondeux-panel";
    panelEl.innerHTML = `
      <div class="md-panel-inner">
        <div class="md-header">
          <div class="md-logo">
            <span class="md-logo-mark">M</span>
            <span class="md-logo-text">MaisonDeux</span>
          </div>
          <button class="md-close" id="md-close-btn" aria-label="Close">&times;</button>
        </div>
        <div class="md-product-context">
          <div class="md-product-source">Currently viewing on <strong>${product.source}</strong></div>
          <div class="md-product-name">${product.brand ? product.brand + " — " : ""}${product.productName || "Unknown Product"}</div>
          <div class="md-product-price">${product.price || ""}</div>
        </div>
        <div class="md-divider"></div>
        <div class="md-status" id="md-status">
          <div class="md-spinner"></div>
          <span>Searching ${searchingPlatforms.length} platforms…</span>
        </div>
        <div class="md-results" id="md-results"></div>
        <div class="md-footer">
          <a href="https://maisondeux.com" target="_blank" class="md-powered">Powered by MaisonDeux</a>
        </div>
      </div>
    `;

    document.body.appendChild(panelEl);

    // Animate in
    requestAnimationFrame(() => {
      panelEl.classList.add("md-panel-visible");
    });

    // Close button
    document.getElementById("md-close-btn").addEventListener("click", () => {
      panelEl.classList.remove("md-panel-visible");
      setTimeout(() => panelEl?.remove(), 300);
    });
  }

  // Listen for results from the background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "DEAL_RESULTS") {
      renderResults(message.data);
    }
  });

  function renderResults(data) {
    const resultsContainer = document.getElementById("md-results");
    const statusEl = document.getElementById("md-status");
    if (!resultsContainer) return;

    if (data.complete) {
      // All platforms done
      if (statusEl) statusEl.style.display = "none";
      if (resultsContainer.children.length === 0) {
        resultsContainer.innerHTML = `
          <div class="md-empty">No deals found across other platforms for this item. Try broadening the search.</div>
        `;
      }
      return;
    }

    // Incremental result from one platform
    if (data.listings && data.listings.length > 0) {
      const platformSection = document.createElement("div");
      platformSection.className = "md-platform-section";
      platformSection.innerHTML = `
        <div class="md-platform-header">
          <img src="${data.logo}" alt="${data.platform}" class="md-platform-logo" onerror="this.style.display='none'" />
          <span class="md-platform-name">${data.platform}</span>
          <span class="md-platform-count">${data.listings.length} found</span>
          <a href="${data.searchUrl}" target="_blank" class="md-view-all">View all →</a>
        </div>
        <div class="md-listings">
          ${data.listings
            .slice(0, 5)
            .map(
              (listing) => `
            <a href="${listing.link}" target="_blank" class="md-listing-card">
              <div class="md-listing-img-wrap">
                ${listing.img ? `<img src="${listing.img}" alt="${listing.title}" class="md-listing-img" onerror="this.style.display='none'" />` : '<div class="md-listing-img-placeholder">No image</div>'}
              </div>
              <div class="md-listing-info">
                <div class="md-listing-title">${truncate(listing.title, 60)}</div>
                <div class="md-listing-price">${listing.price}</div>
                ${listing.condition ? `<div class="md-listing-condition">${listing.condition}</div>` : ""}
              </div>
            </a>
          `
            )
            .join("")}
        </div>
      `;
      resultsContainer.appendChild(platformSection);

      // Update status
      if (statusEl) {
        const searched = resultsContainer.children.length;
        statusEl.querySelector("span").textContent = `Checked ${searched} platform${searched > 1 ? "s" : ""}, searching more…`;
      }
    }
  }

  // ---- Helpers ----

  function qs(selector) {
    return document.querySelector(selector);
  }

  function truncate(str, len) {
    if (!str) return "";
    return str.length > len ? str.substring(0, len) + "…" : str;
  }

  function debounce(fn, wait) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }
})();
