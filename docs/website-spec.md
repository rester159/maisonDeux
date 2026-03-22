# maisonDeux Web Application — Product Specification

This document is maintained by the **Program Manager** agent (see `agents.md`). It captures the current website behavior in detail and must be updated whenever the product or UI changes (e.g. new features, pill system, new filters, new pages).

---

## 1. Overview

- **Product**: maisonDeux — luxury resale search aggregator (image-first discovery, multi-marketplace results).
- **Stack**: React (Vite, TypeScript), single-page app; API: Fastify, Node 20.
- **Entry**: `/web/` (or `/` redirect); base path `/web/`.

---

## 2. Layout and Chrome

### 2.1 Top bar (fixed)
- **Position**: Fixed at top; does not scroll.
- **Content**: Left: “+” (new search). Center: “maisonDeux” title. Right: “☰” (open/close settings).
- **Behavior**: “+” clears query, size, file, results, and resets to initial state. “☰” toggles settings panel.

### 2.2 Toolbar (search)
- **Search input**: Single text field; placeholder e.g. “Try: Rolex Submariner, Chanel Flap…”.
- **Photo button**: Opens file picker; accepted types: JPEG, PNG, WebP, HEIC. Selecting a file triggers image search.
- **Size input**: Optional text; sent with search (e.g. size filter).
- **Verified checkbox**: Filter results to platform-authenticated only when checked.
- **Search button**: Submits text search using current query and credentials.

### 2.3 Controls
- **Sort dropdown**: Single control. Options: Best Match, Price Low to High, Price High to Low, Trust Score. Applies to the single result list.

### 2.4 Settings panel (slide-out / overlay)
- **Trigger**: Hamburger “☰”.
- **Content**: Per-user marketplace credentials (saved in browser only): ShopGoodwill (token, username, password), eBay (OAuth token; App ID/Dev ID/Cert ID available for authenticated API access), Chrono24 API key, The RealReal API key, Vestiaire API key, Search precision (10–100, default 75).
- **Actions**: Save Settings, Clear Settings. Key: `maisondeux-settings` in localStorage.

### 2.5 Bottom navigation (fixed)
- **Tabs**: Home (active), Queue, Profile. Icons + labels. Position: fixed bottom; content area has padding-bottom so list is not obscured.

### 2.6 Orientation and viewport
- **Lock**: Attempt portrait lock where supported (e.g. PWA).
- **Scroll**: No horizontal scroll of the page; overflow-x hidden. Single vertical scroll for content.

---

## 3. Search and Results

### 3.1 Search modes
- **Text search**: POST `/api/v1/search/text` with `query_text`, `category`, `runtime_credentials`. Returns `search_id`; client polls GET `/api/v1/search/:searchId` until `status` is `completed` or `failed`.
- **Image search**: POST `/api/v1/search/image-upload` with form data (image file, optional `size_text`, `runtime_credentials`). Same poll pattern. When completed, `constructed_query` from image analysis is written into the search text input.

### 3.2 Result set
- **Source**: List of listings from API (`results[].listing`); each is a `CanonicalListing` (platform, title, price, brand, category, size, color, material, condition, verified, trust_score, images, etc.).
- **Sort**: One list, sorted by selected sort mode (best match, price low→high, price high→low, trust).
- **Filter**: Verified-only filter (when checked) and **pill filters** (see §4). No separate “three rows” (exact brand/model, same brand, different brand); all results appear in one vertically scrolling list.

### 3.3 List presentation
- **Layout**: Single vertical list of cards (no row-based sections).
- **Card density**: Cards are compact to show as many as possible while keeping text and key fields legible (reduced image height, padding, and font sizes where appropriate).
- **Card content**: Thumbnail image, platform badge, price, title, and standardized fields (Brand, Model, Category, Color, Size, Condition, Verified, New at retail). Trust score and “View on [platform]” link. Fields come from server-enriched data when available; client may infer for display only when missing.

### 3.4 Empty and edge states
- No query and no results: “No results yet. Start with image upload or text search above.”
- Query present but no results: “No results from connected sources. Use the links above to search on each site.”
- When there is a query, a “Search on other sites” block is shown with deep links (The RealReal, Vestiaire, 1stDibs, eBay, Chrono24, Rebag, Fashionphile, Grailed, Shop Goodwill); some labels note “May require login.” Links open the marketplace search URL with the current query.

---

## 4. Pill System (Filter Facets)

### 4.1 Purpose
- Pills provide **filter facets** derived from the current search results. Users can toggle attribute values on/off to show or hide cards without reloading the page.

### 4.2 Pill categories (fixed)
- Categories are fixed; their **values** are computed from the current result set. Categories:
  - **Brand** — e.g. Gucci, Louis Vuitton, Chanel (from listing brand / extracted brand).
  - **Category** — product type: bag, watch, shoes, jewelry, apparel, accessory (from listing category/subcategory).
  - **Size** — e.g. S, M, 42, US 8 (from listing size or inferred size).
  - **Color** — e.g. Black, Navy, Beige (from listing color or inferred color).
  - **Material** — e.g. Leather, Canvas (from listing material or inferred).

### 4.3 Value extraction and frequency
- For each listing in the result set, values for Brand, Category, Size, Color, and Material are taken from standardized/extracted fields (and raw listing fields when needed).
- Values are normalized for display (e.g. title case, blank/unknown coalesced to a single “—” or “Unknown” if desired).
- **Frequency**: For each category, count how many listings have each value. Values within a pill are sorted by count descending (most frequent first). Categories (pills) are ordered by **total number of listings that have a value in that category** (most impactful category first, left to right).

### 4.4 Pill placement and carousel
- Pills sit **above the result list** (below the sort control).
- Pills are in a **horizontal carousel** that scrolls left-to-right.
- **Scroll hint**: A visual indication that the list is scrollable (e.g. gradient fade on the right, or “scroll” icon). No pagination of pills; all visible by horizontal scroll.

### 4.5 Pill interaction
- **Label**: Each pill shows the **category name** (e.g. “Brand”, “Color”).
- **Dropdown**: Clicking a pill opens a **dropdown menu** listing the **values** for that category (from current results), each with its count (optional) and a **toggle** (on/off).
- **Toggle default**: All attribute values are **on** by default (all cards visible).
- **Toggle off**: When the user turns an attribute value **off** (e.g. “Gucci” under Brand), every card that has that value **disappears** from the list immediately (no page reload).
- **Toggle on**: When the user turns an attribute value back **on**, those cards **reappear** immediately.
- **Filter rule**: A card is shown if and only if, for every category for which the card has a value, that value’s toggle is **on**. (If a card has no value for a category, it is not filtered out by that category.)

### 4.6 State and performance
- Filter state (which attribute values are on/off) is held in client state only. No server round-trip for toggling.
- List is filtered in the frontend over the current result set; sorting (best, price, trust) applies to the filtered list.

---

## 5. Deep Links and Login-Gated Sites

- **Search on other sites**: When the user has a query, a set of links is shown. Each link opens the corresponding marketplace’s search URL with that query. Sites that often require login (The RealReal, Vestiaire, Chrono24) may be labeled “May require login.”
- **API-only strategy**: For The RealReal, Vestiaire, and Chrono24, if no API key is configured, the backend does not attempt to scrape (to avoid hitting login walls). Users can still use the deep links to search on those sites directly.
- **Preferred solution for login-required sites**: The **maisonDeux browser extension** (see §9) allows results from these sites to appear in the maisonDeux UI without the user sharing passwords or the server ever logging in. When the extension is installed and the user has logged into a site once in that browser, the extension can fetch results on demand and merge them into the main result list.

---

## 6. Trust and Legal

- A **disclaimer** is shown (e.g. that maisonDeux is an aggregator and does not authenticate items; users should rely on the source platform’s guarantee). Sourced from shared package and returned in API responses.

---

## 7. Responsiveness and Accessibility

- **Mobile-first**: Layout and touch targets are suitable for portrait mobile; bottom nav and top bar are fixed.
- **Landscape**: Message or prompt to rotate to portrait where applicable.
- **Semantics**: Sections and controls use appropriate labels/aria where needed (e.g. “Search on other sites”, primary navigation).

---

## 8. Revision History

- **Initial**: Layout, toolbar, search, settings, bottom nav, single sort, deep links, login-gated strategy.
- **Pill system**: Replaced three-row bucketing with single vertical list; added pill categories (Brand, Category, Size, Color, Material), carousel, dropdowns, per-value toggles, live filtering; compact cards.
- **Browser extension (bridge)**: Documented extension as the solution for login-required, no-API sites (§9).
- **ShopGoodwill**: Added as 7th supported platform across extension and web app; auction-format pricing.
- **eBay API credentials**: App ID, Dev ID, Cert ID available for authenticated eBay API integration.
- **Dev Control Dashboard**: Internal developer tool for AI model/key management (§10).
- **Chrome Extension scaffolding**: 7 extractors, taxonomy module (10 dictionaries), unknown-term capture, LRU cache, ring-buffer logger, currency converter.

---

## 9. Browser Extension (Bridge) — Login-Required Sites

### 9.1 Purpose

Many critical marketplaces (The RealReal, Vestiaire, Chrono24, 1stDibs, etc.) require login to see full search results and do not offer a public API or end-user OAuth. The **maisonDeux browser extension** solves this by running the search **inside the user’s own browser**, where they are already logged in. The extension never sees or stores passwords; the maisonDeux server never logs in as the user.

### 9.2 User flow

1. User **installs the maisonDeux browser extension** (Chrome/Edge; Firefox later if needed).
2. User **logs into each marketplace as usual** in that same browser (The RealReal, Vestiaire, Chrono24, etc.). They do this once per site (or when their session expires). No credentials are sent to maisonDeux.
3. User goes to **maisonDeux** (web app) and runs a search (text or image).
4. The web app asks the extension: “Fetch results for this query from [TRR / Vestiaire / Chrono24 / …].”
5. The extension opens the marketplace search URL in a **background tab** (or reuses an existing tab). The browser sends the **existing session cookies** with the request, so the site returns the results page as if the user had clicked from their bookmarks.
6. The extension **scrapes the results** from that page (content script, same origin as the tab) and sends structured listing data back to the maisonDeux page (e.g. via `postMessage` or a small backend endpoint).
7. The web app **merges** extension-sourced results with server-sourced results (eBay, 1stDibs scrape, etc.) and shows **one combined list** in the maisonDeux UI (same pills, sort, and cards).

**Sites do not need to be open** when the user is on maisonDeux. As long as the user has the extension and has logged into a site at least once in that browser (and the session is still valid), the extension can open the site on demand and fetch results.

### 9.3 Technical flow (high level)

```
User on maisonDeux → runs search
  → Web app requests extension: "fetch TRR (and Vestiaire, Chrono24, …) for query Q"
  → Extension, for each enabled login-required site:
      - Opens site search URL in background tab (cookies = user's existing session)
      - Waits for results page to load
      - Content script scrapes listing data from DOM
      - Sends JSON (CanonicalListing-like) to web app
  → Web app merges with API results, dedupes, applies sort/pills
  → Single unified list displayed
```

### 9.4 Security and privacy

- **No passwords**: maisonDeux and the extension never see or store the user’s marketplace passwords.
- **No server-side login**: The maisonDeux API never authenticates to The RealReal, Vestiaire, etc.; only the user’s browser does, using the session they already have.
- **Sessions**: Session cookies remain in the user’s browser; the extension only reads pages that load in that browser under the user’s existing sessions. When a session expires, the user logs in again on the site as usual.

### 9.5 Supported sites (extension bridge)

- **The RealReal** — search URL, result page selectors (to be implemented).
- **Vestiaire Collective** — search URL, result page selectors.
- **Chrono24** — search URL, result page selectors.
- **1stDibs** — search URL, result page selectors (if login required for full results).
- Others can be added (Rebag, Fashionphile, etc.) as needed; each requires a search URL and stable selectors for the result list.

### 9.6 Web app behavior when extension is present

- The web app **detects** whether the maisonDeux extension is installed (e.g. via a message handshake or presence of a content script).
- If the extension is present: when the user runs a search, the app **requests** extension-sourced results for configured login-required sites and merges them with API results. Optional: show a short “Including results from The RealReal, Vestiaire…” when extension results are included.
- If the extension is not present: behavior is unchanged (API + scrape-only sources; deep links for “Search on The RealReal” etc.).

### 9.7 Fallback

- **Deep links** (“Search on The RealReal”, etc.) remain available for users who do not install the extension, so they can open the marketplace with the query and search there after logging in.

---

## 10. Dev Control Dashboard (Internal Tool)

### 10.1 Purpose

A separate React + Vite web application (`apps/dev-dashboard/`) for developer use only. Provides a UI to manage AI provider configuration and API keys without editing config files or environment variables by hand.

### 10.2 Key Features

- **API Key Management**: View, edit, and validate keys for AI providers (Anthropic, OpenAI, Google) and marketplace APIs (eBay App ID/Dev ID/Cert ID).
- **AI Function Registry**: Assign specific models to 7 AI functions (Product Identification, Brand Inference, Description Analysis, Product Matching, Price Estimation, Search Query Generation, Trust Scoring).
- **Model Selection**: Per-function model picker from: Claude Sonnet, Claude Haiku, GPT-4o, GPT-4o mini, Gemini Pro, Gemini Flash.

### 10.3 Access

- Backend routes mounted at `/dev-admin/*` on the API server (Fastify plugin).
- Gated by `DEV_DASHBOARD_ENABLED` environment variable; returns 404 when disabled.
- Configuration stored in `apps/api/dev-config.json` (model assignments) and `.env` (API keys).
- Not deployed to production; intended for local development and staging only.
