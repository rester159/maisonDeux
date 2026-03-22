### BUILD PROMPT 1: Project Scaffolding

```
Create a Chrome extension project for "MaisonDeux" — a second-hand luxury deal finder.

Set up the following file structure:
maisondeux-extension/
├── manifest.json
├── rules.json
├── background.js
├── classifier.js
├── taxonomy.js
├── relevance.js
├── content-script.js
├── content-style.css
├── extractors/
│   ├── therealreal.js
│   ├── ebay.js
│   ├── poshmark.js
│   ├── vestiaire.js
│   ├── grailed.js
│   └── mercari.js
├── offscreen/
│   ├── offscreen.html
│   └── offscreen.js
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── settings/
│   ├── settings.html
│   ├── settings.js
│   └── settings.css
├── icons/ (placeholder PNGs)
└── utils/
    ├── messaging.js
    ├── cache.js
    ├── currency.js
    └── logger.js

manifest.json should be Manifest V3 with these permissions: offscreen, activeTab, storage, scripting, declarativeNetRequest.

Host permissions for: therealreal.com, ebay.com, poshmark.com, vestiairecollective.com, grailed.com, mercari.com.

Content scripts should only match product page URL patterns (not all pages):
- therealreal.com/products/*
- ebay.com/itm/*
- poshmark.com/listing/*
- vestiairecollective.com/* (will filter by URL regex in content script)
- grailed.com/listings/*
- mercari.com/item/*

rules.json should contain declarativeNetRequest rules to strip X-Frame-Options and Content-Security-Policy headers from sub_frame requests to all host_permissions domains.

utils/messaging.js should export message type constants: PRODUCT_DETECTED, SEARCH_PLATFORMS, IFRAME_RESULTS, DEAL_RESULTS, DEALS_COUNT, GET_CURRENT_PRODUCT, UPDATE_SETTINGS.

utils/logger.js should implement a ring buffer logger with DEBUG, INFO, WARN, ERROR levels. Max 200 entries.

utils/cache.js should implement an LRU cache backed by chrome.storage.local with configurable max entries (default 500) and TTL (default 7 days).

utils/currency.js should export a convertPrice(amount, fromCurrency, toCurrency) function with hardcoded fallback rates (USD/EUR: 0.92, USD/GBP: 0.79) and a fetchRates() function that gets current rates from a free API.

All files should have clear JSDoc comments explaining their purpose. Use ES modules (import/export) where supported, falling back to global scope where Chrome extension architecture requires it.
```

---

