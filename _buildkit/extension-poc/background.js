// ============================================================
// MaisonDeux — Background Service Worker
// Coordinates product detection → offscreen search → results
// ============================================================

const OFFSCREEN_URL = "offscreen/offscreen.html";

// Platform configurations: how to build search URLs
const PLATFORMS = {
  therealreal: {
    name: "The RealReal",
    searchUrl: (q) => `https://www.therealreal.com/search?q=${encodeURIComponent(q)}`,
    logo: "https://logo.clearbit.com/therealreal.com",
  },
  ebay: {
    name: "eBay",
    searchUrl: (q) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}&_sacat=11450`,
    logo: "https://logo.clearbit.com/ebay.com",
  },
  poshmark: {
    name: "Poshmark",
    searchUrl: (q) => `https://poshmark.com/search?query=${encodeURIComponent(q)}&type=listings`,
    logo: "https://logo.clearbit.com/poshmark.com",
  },
  vestiaire: {
    name: "Vestiaire Collective",
    searchUrl: (q) => `https://www.vestiairecollective.com/search/?q=${encodeURIComponent(q)}`,
    logo: "https://logo.clearbit.com/vestiairecollective.com",
  },
  grailed: {
    name: "Grailed",
    searchUrl: (q) => `https://www.grailed.com/shop?query=${encodeURIComponent(q)}`,
    logo: "https://logo.clearbit.com/grailed.com",
  },
  mercari: {
    name: "Mercari",
    searchUrl: (q) => `https://www.mercari.com/search/?keyword=${encodeURIComponent(q)}`,
    logo: "https://logo.clearbit.com/mercari.com",
  },
};

// Detect which platform the user is currently on (so we search the OTHERS)
function detectCurrentPlatform(url) {
  if (url.includes("therealreal.com")) return "therealreal";
  if (url.includes("ebay.com")) return "ebay";
  if (url.includes("poshmark.com")) return "poshmark";
  if (url.includes("vestiairecollective.com")) return "vestiaire";
  if (url.includes("grailed.com")) return "grailed";
  if (url.includes("mercari.com")) return "mercari";
  return null;
}

// ---- Offscreen document lifecycle ----
let creatingOffscreen = null;

async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
  });
  if (existingContexts.length > 0) return;

  if (creatingOffscreen) {
    await creatingOffscreen;
  } else {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ["IFRAME_SCRIPTING"],
      justification:
        "Load second-hand marketplace search results in iframes to find deals for the user.",
    });
    await creatingOffscreen;
    creatingOffscreen = null;
  }
}

// ---- Message handling ----

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Content script detected a product on the current page
  if (message.type === "PRODUCT_DETECTED") {
    handleProductDetected(message.data, sender.tab).then(sendResponse);
    return true; // async response
  }

  // Offscreen document finished scraping results from an iframe
  if (message.type === "IFRAME_RESULTS") {
    // Forward to the content script of the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "DEAL_RESULTS",
          data: message.data,
        });
      }
    });
  }

  // Popup requests the current product info
  if (message.type === "GET_CURRENT_PRODUCT") {
    chrome.storage.session.get("currentProduct", (result) => {
      sendResponse(result.currentProduct || null);
    });
    return true;
  }
});

async function handleProductDetected(productData, tab) {
  const { brand, productName, price, category, imageUrl } = productData;
  const currentPlatform = detectCurrentPlatform(tab.url);

  // Build search query from detected product info
  const searchQuery = [brand, productName, category]
    .filter(Boolean)
    .join(" ")
    .substring(0, 100);

  // Store current product for popup
  await chrome.storage.session.set({
    currentProduct: { ...productData, searchQuery, currentPlatform },
  });

  // Get list of OTHER platforms to search
  const platformsToSearch = Object.entries(PLATFORMS)
    .filter(([key]) => key !== currentPlatform)
    .map(([key, config]) => ({
      key,
      name: config.name,
      url: config.searchUrl(searchQuery),
      logo: config.logo,
    }));

  // Spin up the offscreen document and tell it to search
  await ensureOffscreenDocument();

  chrome.runtime.sendMessage({
    type: "SEARCH_PLATFORMS",
    data: {
      platforms: platformsToSearch,
      searchQuery,
      sourceProduct: productData,
    },
  });

  return { status: "searching", platforms: platformsToSearch.map((p) => p.name) };
}

// Badge update when deals found
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "DEALS_COUNT") {
    const count = message.count;
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
    chrome.action.setBadgeBackgroundColor({ color: count > 0 ? "#1a1a1a" : "#999" });
  }
});
