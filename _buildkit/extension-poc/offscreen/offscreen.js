// ============================================================
// MaisonDeux — Offscreen Document Script
// Loads platform search pages in iframes, extracts listing data
// from the rendered DOM. No HTTP scraping — just reading what
// a real browser renders with the user's own session.
// ============================================================

const container = document.getElementById("iframe-container");

// Listen for search commands from the background service worker
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "SEARCH_PLATFORMS") {
    searchPlatforms(message.data);
  }
});

async function searchPlatforms({ platforms, searchQuery, sourceProduct }) {
  const allResults = [];

  // Search platforms sequentially with human-like delays
  // (not in parallel — parallel requests for 5 sites at once would look bot-like)
  for (const platform of platforms) {
    try {
      const results = await loadAndExtract(platform, searchQuery);
      allResults.push({
        platform: platform.name,
        platformKey: platform.key,
        logo: platform.logo,
        url: platform.url,
        listings: results,
      });

      // Send incremental results so UI updates as each platform loads
      chrome.runtime.sendMessage({
        type: "IFRAME_RESULTS",
        data: {
          platform: platform.name,
          platformKey: platform.key,
          logo: platform.logo,
          searchUrl: platform.url,
          listings: results,
          sourceProduct,
          complete: false,
        },
      });
    } catch (err) {
      console.warn(`[MaisonDeux] Failed to load ${platform.name}:`, err.message);
    }

    // Human-like delay between platform searches (1.5-3.5 seconds)
    await sleep(1500 + Math.random() * 2000);
  }

  // Signal completion
  const totalDeals = allResults.reduce((sum, r) => sum + r.listings.length, 0);
  chrome.runtime.sendMessage({ type: "DEALS_COUNT", count: totalDeals });
  chrome.runtime.sendMessage({
    type: "IFRAME_RESULTS",
    data: {
      allResults,
      sourceProduct,
      complete: true,
    },
  });
}

function loadAndExtract(platform, searchQuery) {
  return new Promise((resolve, reject) => {
    // Clean up any existing iframe
    const existing = container.querySelector("iframe");
    if (existing) existing.remove();

    const iframe = document.createElement("iframe");
    iframe.style.width = "1400px";
    iframe.style.height = "900px";
    iframe.style.border = "none";

    // Timeout after 12 seconds
    const timeout = setTimeout(() => {
      iframe.remove();
      resolve([]); // Fail gracefully — return empty rather than error
    }, 12000);

    iframe.addEventListener("load", () => {
      clearTimeout(timeout);

      // Wait for dynamic content to render (SPAs, lazy loading)
      setTimeout(() => {
        try {
          const listings = extractListingsFromIframe(iframe, platform.key);
          iframe.remove();
          resolve(listings);
        } catch (err) {
          // Cross-origin frame — can't read DOM directly
          // Fall back to content script injection approach
          iframe.remove();
          resolve([]);
        }
      }, 2500); // 2.5s for JS-rendered content to populate
    });

    iframe.addEventListener("error", () => {
      clearTimeout(timeout);
      iframe.remove();
      resolve([]);
    });

    iframe.src = platform.url;
    container.appendChild(iframe);
  });
}

// ---- Platform-specific DOM extractors ----
// Each function reads the rendered DOM of the search results page
// This is the same as a human looking at the page — just automated

function extractListingsFromIframe(iframe, platformKey) {
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return [];

  const extractors = {
    therealreal: extractTheRealReal,
    ebay: extractEbay,
    poshmark: extractPoshmark,
    vestiaire: extractVestiaire,
    grailed: extractGrailed,
    mercari: extractMercari,
  };

  const extractor = extractors[platformKey];
  if (!extractor) return [];

  try {
    return extractor(doc);
  } catch (err) {
    console.warn(`[MaisonDeux] Extraction error for ${platformKey}:`, err);
    return [];
  }
}

function extractTheRealReal(doc) {
  const items = doc.querySelectorAll('[data-testid="product-card"], .product-card, .SearchResults__item');
  return Array.from(items)
    .slice(0, 10)
    .map((el) => {
      const title = el.querySelector("h3, .product-card__name, [data-testid='product-name']")?.textContent?.trim();
      const price = el.querySelector(".product-card__price, [data-testid='price'], .price")?.textContent?.trim();
      const img = el.querySelector("img")?.src;
      const link = el.querySelector("a")?.href;
      return { title, price, img, link, condition: "Authenticated" };
    })
    .filter((item) => item.title && item.price);
}

function extractEbay(doc) {
  const items = doc.querySelectorAll(".s-item, .srp-results .s-item__wrapper");
  return Array.from(items)
    .slice(0, 10)
    .map((el) => {
      const title = el.querySelector(".s-item__title, .s-item__title span")?.textContent?.trim();
      const price = el.querySelector(".s-item__price")?.textContent?.trim();
      const img = el.querySelector(".s-item__image img")?.src;
      const link = el.querySelector("a.s-item__link")?.href;
      const condition = el.querySelector(".SECONDARY_INFO")?.textContent?.trim();
      return { title, price, img, link, condition };
    })
    .filter((item) => item.title && item.price && !item.title.includes("Shop on eBay"));
}

function extractPoshmark(doc) {
  const items = doc.querySelectorAll('[data-testid="listing-card"], .card--small, .tile');
  return Array.from(items)
    .slice(0, 10)
    .map((el) => {
      const title = el.querySelector(".tile__title, [data-testid='listing-title'], a")?.textContent?.trim();
      const price = el.querySelector(".price, [data-testid='listing-price']")?.textContent?.trim();
      const img = el.querySelector("img")?.src;
      const link = el.querySelector("a")?.href;
      return { title, price, img, link, condition: "Pre-owned" };
    })
    .filter((item) => item.title && item.price);
}

function extractVestiaire(doc) {
  const items = doc.querySelectorAll('[data-testid="product-card"], .productCard, .catalog__product');
  return Array.from(items)
    .slice(0, 10)
    .map((el) => {
      const title = el.querySelector(".productCard__name, [data-testid='product-name'], h2")?.textContent?.trim();
      const price = el.querySelector(".productCard__price, [data-testid='product-price'], .price")?.textContent?.trim();
      const img = el.querySelector("img")?.src;
      const link = el.querySelector("a")?.href;
      return { title, price, img, link, condition: "Verified" };
    })
    .filter((item) => item.title && item.price);
}

function extractGrailed(doc) {
  const items = doc.querySelectorAll(".feed-item, .FeedItem, [data-testid='listing-card']");
  return Array.from(items)
    .slice(0, 10)
    .map((el) => {
      const title = el.querySelector(".listing-item-title, .FeedItem__title, h3")?.textContent?.trim();
      const price = el.querySelector(".listing-item-price, .FeedItem__price, [data-testid='price']")?.textContent?.trim();
      const img = el.querySelector("img")?.src;
      const link = el.querySelector("a")?.href;
      return { title, price, img, link, condition: "Pre-owned" };
    })
    .filter((item) => item.title && item.price);
}

function extractMercari(doc) {
  const items = doc.querySelectorAll('[data-testid="SearchResults"] [data-testid="ItemCell"], .SearchResultItem');
  return Array.from(items)
    .slice(0, 10)
    .map((el) => {
      const title = el.querySelector('[data-testid="ItemName"], .ItemName, p')?.textContent?.trim();
      const price = el.querySelector('[data-testid="ItemPrice"], .ItemPrice, span')?.textContent?.trim();
      const img = el.querySelector("img")?.src;
      const link = el.querySelector("a")?.href;
      return { title, price, img, link, condition: "Pre-owned" };
    })
    .filter((item) => item.title && item.price);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
