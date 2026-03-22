# MaisonDeux Chrome Extension — Proof of Concept

## What It Does

When you browse a product page on any supported second-hand marketplace (The RealReal, eBay, Poshmark, Vestiaire Collective, Grailed, Mercari), MaisonDeux automatically:

1. **Detects** the product you're viewing (brand, name, price, image)
2. **Searches** every other supported platform for the same or similar item
3. **Shows** results in a sleek slide-in panel on the right side of the page

If you're on The RealReal looking at a Chanel Classic Flap, MaisonDeux checks eBay, Poshmark, Vestiaire, Grailed, and Mercari — all in real time.

---

## Architecture: Why Offscreen Documents?

### The Problem
We need to load search results from other platforms using the user's own logged-in session, without triggering anti-bot defenses.

### The Solution: Offscreen Document with IFRAME_SCRIPTING

```
┌──────────────────────────────────────────────────────┐
│  User's Browser Tab (e.g. therealreal.com/products/…)│
│                                                       │
│  ┌─ Content Script ─────────────────────────────────┐ │
│  │ 1. Detects product on page (brand, name, price)  │ │
│  │ 2. Sends product data to Background              │ │
│  │ 3. Renders results panel when deals come back     │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
         │ chrome.runtime.sendMessage
         ▼
┌──────────────────────────────────────────────────────┐
│  Background Service Worker                            │
│                                                       │
│  • Determines which platforms to search               │
│  • Builds search URLs with product query              │
│  • Creates/manages offscreen document                 │
│  • Routes results back to content script              │
└──────────────────────────────────────────────────────┘
         │ chrome.runtime.sendMessage
         ▼
┌──────────────────────────────────────────────────────┐
│  Offscreen Document (HIDDEN — user never sees this)   │
│                                                       │
│  ┌─ iframe: ebay.com/sch?q=chanel+classic+flap ────┐ │
│  │ Loads with user's eBay cookies & session          │ │
│  │ Full browser rendering (JS, images, everything)   │ │
│  │ → Extract listings from rendered DOM              │ │
│  └──────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─ iframe: poshmark.com/search?query=chanel… ─────┐ │
│  │ (loaded AFTER eBay, with human-like delay)        │ │
│  │ → Extract listings from rendered DOM              │ │
│  └──────────────────────────────────────────────────┘ │
│                                                       │
│  ... one platform at a time, 1.5-3.5s apart ...      │
└──────────────────────────────────────────────────────┘
```

### Why This Evades Detection

| Defense Mechanism       | Why It Doesn't Trigger                                   |
|------------------------|----------------------------------------------------------|
| Bot fingerprinting      | Real Chrome browser, real user agent, real JS engine     |
| Session validation      | User's own cookies, same auth as if they typed the URL   |
| Rate limiting           | Sequential loading, human-like delays (1.5-3.5s)        |
| CAPTCHA triggers        | Single search per platform per product — normal behavior |
| Headless detection      | Not headless — it's a real Chromium rendering context    |
| Request pattern analysis| Looks identical to user opening a tab and searching      |

### Key Design Decisions

- **Sequential, not parallel**: Platforms are searched one at a time with randomized delays. Five simultaneous requests would look suspicious.
- **DOM reading, not API scraping**: We read the rendered page just like a screen reader would. No hidden API endpoints, no reverse-engineered auth tokens.
- **Incremental results**: The panel updates as each platform finishes, so the user doesn't wait for all 5 to complete.
- **Graceful degradation**: If a platform blocks the iframe (X-Frame-Options), we skip it silently rather than erroring.

---

## Installation (Developer Mode)

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select this folder (`maisondeux-extension/`)
5. Navigate to any product page on a supported platform

---

## Known Limitations (POC)

### X-Frame-Options / CSP
Many platforms set `X-Frame-Options: DENY` or strict Content Security Policy headers that prevent their pages from loading in iframes — even in extension offscreen documents. This is the biggest technical risk.

**Mitigations for production:**
- Use `chrome.declarativeNetRequest` to strip X-Frame-Options headers for target domains (extension has permission to modify headers for its host_permissions)
- Fall back to opening a real but minimized/hidden tab via `chrome.tabs.create({ active: false })`
- For platforms with public search (eBay), use their official API as primary, DOM extraction as fallback

### Selector Fragility
The DOM selectors for each platform will break when they redesign. Production should use:
- Multiple fallback selectors per field
- AI vision as a resilient fallback (screenshot → extract with Claude API)
- Automated selector health monitoring

### Single Offscreen Document Limit
Chrome allows only one offscreen document per extension. We handle this by reusing the same document and loading iframes sequentially.

---

## File Structure

```
maisondeux-extension/
├── manifest.json            # Extension manifest (Manifest V3)
├── background.js            # Service worker — orchestrates everything
├── content-script.js        # Runs on marketplace pages — detects + renders
├── content-style.css        # Slide-in panel styling
├── offscreen/
│   ├── offscreen.html       # Hidden document that hosts iframes
│   └── offscreen.js         # Loads platforms, extracts listing data
├── popup/
│   ├── popup.html           # Extension icon popup
│   └── popup.js             # Popup logic
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md                # This file
```

---

## Next Steps for Production

1. **Header stripping**: Use `declarativeNetRequest` to remove X-Frame-Options for target domains
2. **AI vision fallback**: When DOM extraction fails, screenshot the iframe and use Claude API to extract structured listing data
3. **eBay Partner API**: Use official API for eBay (highest coverage, legitimate affiliate revenue)
4. **Price comparison logic**: Normalize prices across platforms, highlight savings
5. **User preferences**: Let users choose which platforms to search, set price alerts
6. **Community index**: Anonymized listing data shared across users to improve matching
