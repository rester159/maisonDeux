# MaisonDeux Chrome Extension — Technical Specification & Architecture

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                               │
│                                                                     │
│  ┌─── Active Tab (e.g. therealreal.com/products/chanel-bag) ──────┐│
│  │                                                                 ││
│  │  ┌─ Content Script ──────────────────────────────────────────┐  ││
│  │  │ • Detects product page via URL pattern matching           │  ││
│  │  │ • Reads DOM to extract raw product data                   │  ││
│  │  │ • Sends PRODUCT_DETECTED to Background                   │  ││
│  │  │ • Receives DEAL_RESULTS from Background                  │  ││
│  │  │ • Renders slide-in panel with results + filters           │  ││
│  │  └──────────────────────────────────────────────────────────┘  ││
│  └─────────────────────────────────────────────────────────────────┘│
│                              │                                      │
│                     chrome.runtime.sendMessage                      │
│                              │                                      │
│  ┌─── Background Service Worker ──────────────────────────────────┐│
│  │ • Receives PRODUCT_DETECTED from Content Script                ││
│  │ • Calls Claude API for source product classification           ││
│  │ • Generates platform-specific search queries                   ││
│  │ • Creates/manages Offscreen Document                           ││
│  │ • Receives IFRAME_RESULTS from Offscreen Document              ││
│  │ • Classifies results (heuristic + AI for top candidates)       ││
│  │ • Scores relevance against source attributes                   ││
│  │ • Sends DEAL_RESULTS to Content Script                         ││
│  │ • Manages classification cache                                  ││
│  │ • Manages API key + rate limiting                               ││
│  └─────────────────────────────────────────────────────────────────┘│
│                              │                                      │
│                     chrome.runtime.sendMessage                      │
│                              │                                      │
│  ┌─── Offscreen Document (HIDDEN — user never sees) ──────────────┐│
│  │ • Static HTML page bundled with extension                       ││
│  │ • Creates iframes pointing to other platforms' search pages     ││
│  │ • Iframes load with user's REAL cookies + session               ││
│  │ • Full Chromium rendering (JS, CSS, images — everything)        ││
│  │ • Reads rendered DOM from each iframe to extract listings       ││
│  │ • Sends IFRAME_RESULTS back to Background                      ││
│  │                                                                  ││
│  │  ┌─ iframe: ebay.com/sch?q=chanel+classic+flap ─────────────┐  ││
│  │  │ (loads with user's eBay cookies)                           │  ││
│  │  └───────────────────────────────────────────────────────────┘  ││
│  │  ┌─ iframe: poshmark.com/search?query=chanel... ─────────────┐  ││
│  │  │ (loads 1.5-3.5s after eBay, with user's Poshmark cookies)  │  ││
│  │  └───────────────────────────────────────────────────────────┘  ││
│  │  ... sequential, one at a time, with randomized delays ...      ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌─── Claude API (External) ──────────────────────────────────────┐│
│  │ • Source product classification (Vision: image + text → JSON)   ││
│  │ • Batch result classification (text → JSON array)               ││
│  │ • Search query generation (attributes → per-platform queries)   ││
│  │ • Visual match verification (two images → similarity score)     ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Specifications

### 2.1 Manifest (manifest.json)

```json
{
  "manifest_version": 3,
  "name": "MaisonDeux — Second-Hand Deal Finder",
  "version": "1.0.0",
  "description": "Find second-hand deals across luxury resale platforms.",
  "permissions": [
    "offscreen",
    "activeTab",
    "storage",
    "scripting",
    "declarativeNetRequest"
  ],
  "host_permissions": [
    "https://www.therealreal.com/*",
    "https://www.ebay.com/*",
    "https://poshmark.com/*",
    "https://www.vestiairecollective.com/*",
    "https://www.grailed.com/*",
    "https://www.mercari.com/*",
    "https://www.shopgoodwill.com/*"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": [
        "https://www.therealreal.com/products/*",
        "https://www.ebay.com/itm/*",
        "https://poshmark.com/listing/*",
        "https://www.vestiairecollective.com/*",
        "https://www.grailed.com/listings/*",
        "https://www.mercari.com/item/*",
        "https://www.shopgoodwill.com/item/*"
      ],
      "js": ["content-script.js"],
      "css": ["content-style.css"],
      "run_at": "document_idle"
    }
  ],
  "declarative_net_request": {
    "rule_resources": [{
      "id": "iframe_rules",
      "enabled": true,
      "path": "rules.json"
    }]
  },
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
}
```

### 2.2 Background Service Worker (background.js)

**Responsibilities:**
- Orchestrate the entire product detection → classification → search → ranking pipeline
- Manage offscreen document lifecycle (create on demand, reuse, close when idle)
- Make Claude API calls for classification
- Manage classification cache (chrome.storage.local)
- Rate-limit API calls (max 200/hour)
- Route messages between Content Script and Offscreen Document
- Update extension badge with deal count

**Key State:**
```javascript
// In-memory state (lost when service worker sleeps)
let currentProduct = null;      // Currently classified source product
let searchResults = [];          // Accumulated results from all platforms
let searchInProgress = false;    // Prevent duplicate searches

// Persistent state (chrome.storage)
// chrome.storage.sync: { apiKey, preferences }
// chrome.storage.local: { classificationCache, usageStats }
// chrome.storage.session: { currentProduct, searchResults }
```

**Message Routing Table:**

| Incoming Message | Source | Action |
|-----------------|--------|--------|
| PRODUCT_DETECTED | Content Script | Start classification + search pipeline |
| IFRAME_RESULTS | Offscreen Document | Classify results, score, send to Content Script |
| GET_CURRENT_PRODUCT | Popup | Return current product from session storage |
| UPDATE_SETTINGS | Settings Page | Update preferences in sync storage |

### 2.3 Offscreen Document (offscreen/offscreen.html + offscreen.js)

**Responsibilities:**
- Receive SEARCH_PLATFORMS messages from Background
- Load each platform's search results page in an iframe
- Wait for iframe to fully render (including JS-driven content)
- Extract listing data from the rendered DOM
- Send IFRAME_RESULTS back to Background
- Handle iframe load failures gracefully

**Critical Technical Details:**

1. **Only one offscreen document allowed per extension.** We reuse the same document and load iframes sequentially.

2. **Offscreen documents can only access chrome.runtime API.** All other Chrome APIs must be accessed via messages to the Background Service Worker.

3. **The reason must be IFRAME_SCRIPTING** to allow cross-origin iframe loading with content script injection.

4. **Iframe loading is sequential** with randomized delays (1500 + Math.random() * 2000 ms) between platforms.

5. **Timeout per platform: 12 seconds.** If an iframe doesn't load, skip it and move to the next platform.

6. **Wait 2.5 seconds after iframe load event** for JS-rendered content to populate before reading DOM.

### 2.4 Content Script (content-script.js + content-style.css)

**Responsibilities:**
- Detect whether the current page is a product detail page (URL pattern matching)
- Extract raw product data from the DOM using platform-specific selectors
- Send PRODUCT_DETECTED to Background
- Receive DEAL_RESULTS from Background
- Render and manage the slide-in results panel
- Handle filter interactions
- Handle panel open/close/resize

**Product Page Detection Rules:**

| Platform | URL Must Contain | Selector Confirmation |
|----------|-----------------|---------------------|
| The RealReal | /products/ | .product-details or [data-testid="product-name"] exists |
| eBay | /itm/ | h1.x-item-title__mainTitle or h1[itemprop='name'] exists |
| Poshmark | /listing/ | [data-testid='listing-title'] or .listing__title exists |
| Vestiaire | matches /-\d+\.shtml$/ | .product__brand or [data-testid='designer-name'] exists |
| Grailed | /listings/ | .listing-title or [data-testid='listing-title'] exists |
| Mercari | /item/ | [data-testid='ItemName'] or .ItemName exists |
| ShopGoodwill | /item/ | Auction title element or item detail container exists |

**DOM Extraction Per Platform:**

Each platform has a primary extractor function and multiple fallback selectors per field. The extractor returns a raw product object:

```javascript
{
  brand: string | null,        // From DOM element
  productName: string | null,  // Product title
  price: string | null,        // Price as displayed (e.g., "$4,895")
  imageUrl: string | null,     // Primary product image src
  description: string | null,  // Description text if available
  conditionText: string | null,// Condition as displayed by platform
  categoryText: string | null, // Category breadcrumbs
  platformText: string | null, // All visible text from product section
  source: string               // Platform name
}
```

### 2.5 Classifier Module (classifier.js)

**Responsibilities:**
- Accept raw product data, return standardized attribute objects
- Two-tier classification: heuristic (free, local) and AI (Claude API, costs money)
- Maintain normalization dictionaries for colors, materials, sizes, conditions
- Score relevance between any two classified products
- Filter and rank arrays of results

**Full Attribute Schema:**

```javascript
{
  // Core Identity
  brand: string | null,
  model: string | null,
  modelVariant: string | null,

  // Category
  category: "Handbags" | "Jewelry" | "Watches" | "Shoes" | "Clothing" | "Accessories" | null,
  subcategory: string | null,

  // Visual / Physical
  color: string | null,           // Normalized English: "Black", "Beige", etc.
  colorFamily: "Neutral" | "Warm" | "Cool" | "Metallic" | "Multicolor" | null,
  material: string | null,        // From taxonomy: "Lambskin", "Caviar Leather", etc.
  hardware: "Gold" | "Silver" | "Ruthenium" | "Palladium" | "Rose Gold" | null,
  pattern: string | null,         // "Quilted", "Monogram", "Plain", etc.

  // Size
  size: string | null,            // "Medium", "Small", "36", "6.5"
  sizeSystem: "Generic" | "US" | "EU" | "UK" | "cm" | null,
  dimensions: string | null,      // "25 × 16 × 7 cm"

  // Condition & Provenance
  condition: "New" | "Excellent" | "Very Good" | "Good" | "Fair" | null,
  authenticated: boolean,
  year: string | null,

  // Pricing
  listedPrice: number | null,
  currency: "USD" | "EUR" | "GBP",
  estimatedRetail: number | null,

  // Metadata
  _confidence: number,            // 0.0–1.0
  _source: string                 // Platform name
}
```

### 2.6 Header Bypass Rules (rules.json)

Required because most platforms set X-Frame-Options and Content-Security-Policy headers that block iframe embedding.

```json
[
  {
    "id": 1,
    "priority": 1,
    "action": {
      "type": "modifyHeaders",
      "responseHeaders": [
        { "header": "x-frame-options", "operation": "remove" },
        { "header": "content-security-policy", "operation": "remove" }
      ]
    },
    "condition": {
      "resourceTypes": ["sub_frame"],
      "requestDomains": [
        "www.therealreal.com",
        "www.ebay.com",
        "poshmark.com",
        "www.vestiairecollective.com",
        "www.grailed.com",
        "www.mercari.com",
        "www.shopgoodwill.com"
      ]
    }
  }
]
```

---

## 3. Data Flow — Complete Sequence

```
Time  Action
───── ─────────────────────────────────────────────────────────
0.0s  User navigates to therealreal.com/products/chanel-classic-flap
0.5s  Content Script: URL matches /products/ pattern
2.0s  Content Script: DOM settled (MutationObserver debounce)
2.0s  Content Script: Extracts raw product data from DOM
2.0s  Content Script: Sends PRODUCT_DETECTED to Background
2.1s  Background: Checks classification cache for this URL
      → Cache miss: proceed with classification
      → Cache hit: skip to step at 3.5s with cached attributes
2.2s  Background: Calls Claude API — source product classification
      → Sends: product image URL + title + brand + price + description
      → Model: claude-sonnet-4-20250514 with vision
3.2s  Background: Receives classified source attributes (JSON)
3.2s  Background: Caches classification keyed by URL (7-day TTL)
3.3s  Background: Calls Claude API — search query generation
      → Sends: classified attributes
      → Receives: per-platform optimized search queries
3.5s  Background: Determines platforms to search (all except current)
3.5s  Background: Creates Offscreen Document (if not already open)
3.6s  Background: Sends SEARCH_PLATFORMS to Offscreen Document
3.6s  Offscreen: Creates iframe → ebay.com/sch?q={ebay_query}
      → Iframe loads with user's eBay cookies
      → Full page render including JavaScript
6.1s  Offscreen: Reads rendered DOM, extracts listing data (up to 10)
6.1s  Offscreen: Sends IFRAME_RESULTS (platform: eBay) to Background
6.2s  Background: Runs heuristic classification on all 10 results
6.2s  Background: Identifies top 3 by heuristic score for AI classification
6.3s  Background: Calls Claude API — batch classify top 3 results
6.8s  Background: Scores all results for relevance against source
6.8s  Background: Sends DEAL_RESULTS (platform: eBay, ranked) to Content Script
6.8s  Content Script: Renders eBay results in slide-in panel
7.0s  Content Script: User sees first results (eBay section appears)
      ─── Random delay: 1.5–3.5 seconds ───
9.0s  Offscreen: Creates iframe → poshmark.com/search?query={poshmark_query}
      ... (same extraction + classification flow) ...
11.5s Offscreen: Sends IFRAME_RESULTS (Poshmark)
11.6s Background: Classifies, scores, sends DEAL_RESULTS
11.6s Content Script: Poshmark results appear in panel
      ─── Random delay ───
      ... repeat for Vestiaire, Grailed, Mercari ...
~25s  All platforms searched. Background sends final DEAL_RESULTS with complete: true
25s   Content Script: Hides loading spinner, shows total deal count
25s   Background: Updates extension badge with total count
```

---

## 4. Message Protocol

### 4.1 PRODUCT_DETECTED
```javascript
// Content Script → Background
{
  type: "PRODUCT_DETECTED",
  data: {
    brand: "Chanel",
    productName: "Classic Double Flap Bag Medium Lambskin",
    price: "$4,895",
    imageUrl: "https://therealreal.com/photos/...",
    description: "Chanel black quilted lambskin Classic Medium Double Flap...",
    conditionText: "Very Good",
    categoryText: "Handbags > Shoulder Bags",
    platformText: "...all visible text from product section...",
    source: "The RealReal",
    pageUrl: "https://www.therealreal.com/products/..."
  }
}
```

### 4.2 SEARCH_PLATFORMS
```javascript
// Background → Offscreen Document
{
  type: "SEARCH_PLATFORMS",
  data: {
    platforms: [
      {
        key: "ebay",
        name: "eBay",
        url: "https://www.ebay.com/sch/i.html?_nkw=Chanel+Classic+Flap+Medium+Black&_sacat=11450",
        logo: "https://logo.clearbit.com/ebay.com"
      },
      // ... other platforms
    ],
    searchQuery: "Chanel Classic Double Flap Medium Black Lambskin Gold",
    sourceProduct: { /* raw product data */ },
    sourceAttributes: { /* classified attributes */ }
  }
}
```

### 4.3 IFRAME_RESULTS
```javascript
// Offscreen Document → Background
{
  type: "IFRAME_RESULTS",
  data: {
    platform: "eBay",
    platformKey: "ebay",
    logo: "https://logo.clearbit.com/ebay.com",
    searchUrl: "https://www.ebay.com/sch/...",
    listings: [
      {
        title: "CHANEL Classic Medium Double Flap Lambskin Black GHW",
        price: "$4,200",
        img: "https://i.ebayimg.com/...",
        link: "https://www.ebay.com/itm/...",
        condition: "Pre-Owned · Excellent"
      },
      // ... up to 10 listings
    ],
    complete: false  // true when ALL platforms are done
  }
}
```

### 4.4 DEAL_RESULTS
```javascript
// Background → Content Script
{
  type: "DEAL_RESULTS",
  data: {
    platform: "eBay",
    platformKey: "ebay",
    logo: "https://logo.clearbit.com/ebay.com",
    searchUrl: "https://www.ebay.com/sch/...",
    listings: [
      {
        title: "CHANEL Classic Medium Double Flap Lambskin Black GHW",
        price: "$4,200",
        img: "https://i.ebayimg.com/...",
        link: "https://www.ebay.com/itm/...",
        condition: "Pre-Owned · Excellent",
        attributes: {
          brand: "Chanel",
          model: "Classic Double Flap",
          color: "Black",
          material: "Lambskin",
          hardware: "Gold",
          size: "Medium",
          condition: "Excellent",
          listedPrice: 4200,
          currency: "USD",
          _confidence: 0.94
        },
        relevance: {
          score: 0.97,
          label: "Exact Match",
          breakdown: {
            brand: { score: 1.0, reason: "match" },
            model: { score: 1.0, reason: "match" },
            color: { score: 1.0, reason: "match" },
            size: { score: 1.0, reason: "match" },
            material: { score: 1.0, reason: "match" },
            hardware: { score: 1.0, reason: "match" }
          }
        },
        priceDelta: {
          absolute: 695,
          percentage: 14,
          isCheaper: true,
          label: "$695 less (14% off)"
        }
      },
      // ... more listings, sorted by relevance then price
    ],
    sourceAttributes: { /* classified source product */ },
    complete: false
  }
}
```

---

## 5. Storage Schema

### 5.1 chrome.storage.sync (syncs across user's Chrome instances)
```javascript
{
  "md_api_key": "sk-ant-...",              // Anthropic API key
  "md_preferences": {
    "enabledPlatforms": {
      "therealreal": true,
      "ebay": true,
      "poshmark": true,
      "vestiaire": true,
      "grailed": true,
      "mercari": true,
      "shopgoodwill": true
    },
    "defaultMinRelevance": 0.3,
    "defaultFilters": {
      "color": "Any",
      "size": "Any",
      "material": "Any",
      "hardware": "Any",
      "condition": "Any"
    },
    "autoOpenPanel": true,
    "maxResultsPerPlatform": 10
  }
}
```

### 5.2 chrome.storage.local (device-local, larger capacity)
```javascript
{
  "md_classification_cache": {
    "https://www.therealreal.com/products/chanel-bag-xyz": {
      "attributes": { /* full attribute object */ },
      "cachedAt": "2026-03-21T10:00:00Z",
      "ttl": 604800000  // 7 days in ms
    },
    // ... LRU cache, max 500 entries
  },
  "md_usage_stats": {
    "month": "2026-03",
    "apiCalls": 142,
    "classifications": 89,
    "estimatedCost": 2.84
  }
}
```

### 5.3 chrome.storage.session (cleared when browser closes)
```javascript
{
  "md_current_product": {
    "raw": { /* raw product data from DOM */ },
    "attributes": { /* classified attributes */ },
    "searchResults": [ /* accumulated results from all platforms */ ],
    "searchComplete": true
  }
}
```

---

## 6. Anti-Detection Architecture

### 6.1 Why Our Approach is Undetectable

The extension makes requests that are **literally identical** to the user opening a tab and searching. Here's why:

| Detection Method | What It Checks | Why We Pass |
|-----------------|---------------|-------------|
| Bot fingerprinting | navigator.webdriver, window.chrome, WebGL, canvas | We're a real Chromium context — all values are genuine |
| Session validation | Cookies, auth tokens, session IDs | We use the user's actual cookies — we ARE the user |
| Rate limiting | Requests per time window per IP/session | 1 search per platform per product = normal behavior |
| CAPTCHA triggers | Suspicious request patterns, volume | 5-6 total requests spread over ~25 seconds |
| Headless detection | Missing browser APIs, wrong user agent | Not headless — full Chrome rendering engine |
| Request pattern analysis | Timing, parallelism, missing assets | Sequential loads with randomized delays, full asset loading |

### 6.2 Rate Limiting Rules

```
Per platform per session:
  - Max 1 search per product view
  - Max 20 product views per hour
  - Max 100 product views per day

If rate limit hit:
  - Skip that platform for this product view
  - Show cached results if available
  - Cool down for 30 minutes if 429 received from platform
  - Never retry automatically — wait for next user-initiated product view
```

### 6.3 Graceful Degradation Priority

```
1. Platform returns results normally → extract and classify
2. Platform returns CAPTCHA → skip platform, show "CAPTCHA — visit site directly"
3. Platform returns 429 → skip platform, back off 30 minutes
4. Iframe fails to load (timeout) → skip platform silently
5. DOM extraction fails (selectors changed) → try fallback selectors → try AI vision on screenshot → skip
6. Claude API fails → fall back to heuristic-only classification
7. All platforms fail → show "No results available, try again later"
```

---

## 7. File Structure

```
maisondeux-extension/
├── manifest.json                  # Extension manifest (Manifest V3)
├── rules.json                     # declarativeNetRequest rules for header stripping
├── background.js                  # Service worker — orchestrates everything
├── classifier.js                  # AI + heuristic classification module
├── taxonomy.js                    # Normalization dictionaries (colors, materials, sizes)
├── relevance.js                   # Scoring algorithm
├── content-script.js              # Runs on product pages — detection + UI
├── content-style.css              # Slide-in panel styling
├── extractors/
│   ├── therealreal.js             # DOM extraction for The RealReal
│   ├── ebay.js                    # DOM extraction for eBay
│   ├── poshmark.js                # DOM extraction for Poshmark
│   ├── vestiaire.js               # DOM extraction for Vestiaire Collective
│   ├── grailed.js                 # DOM extraction for Grailed
│   ├── mercari.js                 # DOM extraction for Mercari
│   └── shopgoodwill.js            # DOM extraction for ShopGoodwill (auction format)
├── offscreen/
│   ├── offscreen.html             # Hidden document that hosts iframes
│   └── offscreen.js               # Iframe management + result extraction
├── popup/
│   ├── popup.html                 # Extension icon popup
│   ├── popup.js                   # Popup logic
│   └── popup.css                  # Popup styles
├── settings/
│   ├── settings.html              # Settings page
│   ├── settings.js                # Settings logic
│   └── settings.css               # Settings styles
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── utils/
    ├── messaging.js               # Message type constants + helpers
    ├── cache.js                   # LRU classification cache
    ├── currency.js                # Exchange rate conversion
    └── logger.js                  # Debug logging with levels
```

---

## 8. API Integration Details

### 8.1 Claude API Configuration

```
Endpoint: https://api.anthropic.com/v1/messages
Model: claude-sonnet-4-20250514 (primary), claude-haiku-4-5-20251001 (cost optimization)
API Version Header: anthropic-version: 2023-06-01
Browser Access Header: anthropic-dangerous-direct-browser-access: true
Max Tokens: 1000 (classification), 2000 (batch), 500 (query generation)
```

### 8.2 Rate Limits to Respect

```
Anthropic API rate limits (vary by tier):
- Tier 1: 50 requests/minute, 40,000 tokens/minute
- Tier 2: 100 requests/minute, 80,000 tokens/minute

MaisonDeux self-imposed limits:
- Max 10 API calls per product view
- Max 200 API calls per hour
- Track usage in chrome.storage.local
```

### 8.3 Cost Breakdown Per API Call

| Call Type | Model | Input Tokens | Output Tokens | Cost |
|-----------|-------|-------------|--------------|------|
| Source classification (image + text) | Sonnet | ~1,500 | ~300 | ~$0.006 |
| Batch classify 5 results (text only) | Sonnet | ~3,000 | ~1,500 | ~$0.012 |
| Batch classify 5 results (text only) | Haiku | ~3,000 | ~1,500 | ~$0.003 |
| Search query generation | Haiku | ~500 | ~200 | ~$0.001 |
| Visual match verification (2 images) | Sonnet | ~2,000 | ~200 | ~$0.008 |

**Typical cost per product view: $0.02–$0.04**
**Heavy user (50 views/day): ~$1.50/day, ~$45/month**
**Casual user (5 views/day): ~$0.15/day, ~$4.50/month**

---

## 9. Error Handling Strategy

### 9.1 Error Categories and Recovery

| Error | Detection | Recovery |
|-------|-----------|----------|
| No API key configured | Check chrome.storage.sync on startup | Show setup prompt in panel, link to settings |
| API key invalid/expired | 401 from Claude API | Show "API key invalid" in panel, link to settings |
| API rate limit exceeded | 429 from Claude API | Fall back to heuristic-only mode, show notice |
| Platform iframe blocked | Load timeout (12s) or error event | Skip platform, try next |
| Platform returns CAPTCHA | Detect CAPTCHA page content in iframe | Skip platform, show "visit directly" link |
| DOM extraction finds nothing | 0 results from extractor | Log selectors tried, fall back to broader selectors |
| Classification returns invalid JSON | JSON.parse fails | Fall back to heuristic classification |
| Network offline | navigator.onLine check | Show "offline" state, disable searching |
| Service worker sleeps mid-search | Chrome suspends worker | Save state to session storage, resume on wake |

### 9.2 Logging

All errors and significant events are logged to an in-memory ring buffer (last 200 events). The settings page has a "Debug Log" section that displays these for troubleshooting. Logs are never sent to any server.

```javascript
// Log levels: DEBUG, INFO, WARN, ERROR
logger.info("CLASSIFY", "Source product classified", { brand: "Chanel", confidence: 0.96 });
logger.warn("IFRAME", "Platform timeout", { platform: "Vestiaire", timeout: 12000 });
logger.error("API", "Classification failed", { error: err.message });
```

---

## 10. Infrastructure & Deployment

### 10.1 Development Tooling

All development is done via Claude Code CLI — no VS Code or other IDE required.

```bash
# All building happens in Claude Code
cd maisondeux-extension
claude
# Paste build prompts from /prompts directory
```

### 10.2 Backend API (Railway)

The backend API runs on Railway and handles:
- Server-side Claude API calls (so users don't need their own API key)
- Classification caching (shared across users)
- User authentication and preferences sync
- Usage tracking and rate limiting
- Community listing index aggregation

```
Service: Railway (railway.app)
Runtime: Node.js 20
Deploy: Git push to main branch (auto-deploy)
Environment variables:
  - ANTHROPIC_API_KEY: sk-ant-...
  - DATABASE_URL: postgresql://... (from Neon)
  - JWT_SECRET: (for user auth)
  - RAILWAY_ENVIRONMENT: production
```

### 10.3 Database (Neon Postgres)

Neon provides a serverless Postgres database for persistent storage.

```
Service: Neon (neon.tech)
Tables:
  - classifications: cached product classifications (URL, attributes, created_at, expires_at)
  - users: user accounts, preferences, API usage
  - usage_stats: per-user API call tracking for rate limiting
  - community_listings: anonymized listing data shared across users (Phase 4)

Connection: Neon connection string stored as DATABASE_URL in Railway env vars
Pooling: Use Neon's built-in connection pooling endpoint for serverless
```

### 10.4 Architecture Evolution

```
V1 (Chrome extension only — client-side):
  Extension → Claude API directly (user provides own API key)
  Storage: chrome.storage.local + chrome.storage.sync

V2 (With backend):
  Extension → Railway API → Claude API (server-side key)
  Extension → Railway API → Neon (shared cache, user prefs)
  Users no longer need their own Anthropic API key
```

---

## 11. Taxonomy Module — Implementation Details

The `taxonomy.js` module is the core normalization layer. It exports dictionary constants and lookup functions used by both the heuristic classifier and the extractor post-processing.

### 11.1 Dictionary Structure

Each dictionary maps canonical values to arrays of raw aliases (all lowercased for lookup). A `buildMap()` helper inverts this into a fast `alias → canonical` map at module load time.

### 11.2 Dictionaries (10 total)

| Dictionary | Canonical Values | Alias Count | Notes |
|-----------|-----------------|-------------|-------|
| COLORS | 12+ families (Black, White, Beige, Brown, Red, Pink, Blue, Green, Grey, etc.) | 200+ | Multilingual: noir, nero, bleu, rosa, etc. |
| COLOR_FAMILIES | 5 groups (Neutral, Warm, Cool, Metallic, Multicolor) | Derived from COLORS | Used for fuzzy color matching |
| MATERIALS | Leather variants, fabrics, metals, exotics | 200+ | Lambskin vs Caviar vs Calfskin distinction |
| HARDWARE | Gold, Silver, Ruthenium, Palladium, Rose Gold | 30+ | Common abbreviations: GHW, SHW, RHW, PHW |
| BRANDS | 120+ luxury brands | 120+ aliases | Covers abbreviations (LV, YSL) and misspellings |
| CATEGORIES | 6 top-level types | 50+ | Handbags, Jewelry, Watches, Shoes, Clothing, Accessories |
| CONDITIONS | 5 levels (New, Excellent, Very Good, Good, Fair) | Platform-specific mappings | Each platform's condition terminology mapped |
| SIZES | Generic + US/EU/UK/cm systems | Variable | Converts across sizing systems |
| PATTERNS | Quilted, Monogram, Plain, etc. | 30+ | Visual pattern recognition support |
| SUBCATEGORIES | Per-category subtypes | 60+ | Shoulder Bags, Totes, Satchels, Crossbody, etc. |

### 11.3 Exported API

- `normalize(category, rawValue)` — Single-value lookup. Returns canonical value or null.
- `normalizeAll(rawText)` — Scans freeform text and extracts all identifiable attributes across all dictionaries. Returns an object keyed by category.
- `unknowns` — Unknown-term capture system. When a raw value does not match any dictionary, it is logged to `chrome.storage.local` under a per-category unknowns list for periodic review.

---

## 12. Dev Control Dashboard — Technical Architecture

### 12.1 Overview

A separate React + Vite + TypeScript application (`apps/dev-dashboard/`) providing developer-only controls for AI model configuration and API key management. Not deployed to production.

### 12.2 Frontend

```
apps/dev-dashboard/
├── package.json
├── tsconfig.json
└── src/
    ├── main.tsx
    └── components/        # UI components (in progress)
```

### 12.3 Backend

- **Routes**: Fastify plugin at `/dev-admin/*` on the existing API server (`apps/api/`)
- **Guard**: All routes check `DEV_DASHBOARD_ENABLED` environment variable; return 404 when disabled
- **Config file**: `apps/api/dev-config.json` stores model-to-function assignments
- **API keys**: Stored in `.env` file, never in config JSON

### 12.4 AI Function Registry

7 registered AI functions, each assignable to a specific model:

```json
{
  "functions": {
    "product_identification": { "model": "claude-sonnet", "provider": "anthropic" },
    "brand_inference":        { "model": "claude-haiku",  "provider": "anthropic" },
    "description_analysis":   { "model": "claude-sonnet", "provider": "anthropic" },
    "product_matching":       { "model": "claude-sonnet", "provider": "anthropic" },
    "price_estimation":       { "model": "gpt-4o-mini",   "provider": "openai" },
    "search_query_generation":{ "model": "claude-haiku",  "provider": "anthropic" },
    "trust_scoring":          { "model": "claude-haiku",  "provider": "anthropic" }
  }
}
```

Available models: Claude Sonnet, Claude Haiku (Anthropic), GPT-4o, GPT-4o mini (OpenAI), Gemini Pro, Gemini Flash (Google).

### 12.5 API Key Management

Supports viewing, editing, and live validation of keys for:

| Provider | Keys |
|----------|------|
| Anthropic | API key |
| OpenAI | API key |
| Google (Gemini) | API key |
| eBay | App ID, Dev ID, Cert ID |

---

## 13. eBay API Integration

eBay API credentials (App ID, Dev ID, Cert ID) are available and stored in environment variables for integration. This enables:
- Authenticated eBay Finding API searches (higher rate limits, structured results)
- eBay Browse API for richer product data (images, item specifics, seller info)
- Potential future eBay Partner Network affiliate link generation for monetization
