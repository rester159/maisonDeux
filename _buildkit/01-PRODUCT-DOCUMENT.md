# MaisonDeux Chrome Extension — Product Document

## 1. Product Summary

MaisonDeux is a Chrome extension that finds second-hand deals across luxury resale platforms in real time. When a user views any product on a supported marketplace (The RealReal, eBay, Poshmark, Vestiaire Collective, Grailed, Mercari, ShopGoodwill), the extension automatically searches every OTHER platform for the same or similar item, classifies results using AI vision, and displays ranked deals in a slide-in panel — with pull-based filters for color, size, material, hardware, and condition.

The user never leaves the page they're on. The extension works silently in the background using Chrome's Offscreen Document API, loading search results from other platforms in the user's own authenticated browser context (their cookies, their session), making the requests indistinguishable from normal browsing.

---

## 2. The Problem

Second-hand luxury is fragmented across 10+ platforms. A Chanel Classic Flap listed at $4,895 on The RealReal might be $3,950 on Poshmark and €3,400 on Vestiaire Collective. But:

- No one has time to search 6 platforms manually for every item they consider
- The same product is named completely differently across platforms ("Classic Double Flap" on eBay vs "Timeless/Classique" on Vestiaire)
- Listings come and go in hours, so any cached/aggregated approach goes stale
- Most platforms require login to see full pricing and availability
- There's no universal "size" or "condition" standard across platforms

The result: buyers overpay or miss deals constantly, and sellers on less-trafficked platforms lose potential buyers.

---

## 3. The Solution

A Chrome extension that acts as a real-time shopping companion with three layers:

### Layer 1: Detection
When the user lands on a product page on any supported platform, the extension reads the page DOM to extract raw product information (title, brand, price, images, description text, condition, category).

### Layer 2: AI Classification
The raw product data (text + product image) is sent to Claude's Vision API, which returns a standardized attribute object:

```json
{
  "brand": "Chanel",
  "model": "Classic Double Flap",
  "modelVariant": "Medium (25cm)",
  "category": "Handbags",
  "color": "Black",
  "colorFamily": "Neutral",
  "material": "Lambskin",
  "hardware": "Gold",
  "pattern": "Quilted",
  "size": "Medium",
  "condition": "Very Good",
  "authenticated": true,
  "listedPrice": 4895,
  "currency": "USD",
  "estimatedRetail": 10800,
  "_confidence": 0.96
}
```

This classification is what makes accurate cross-platform matching possible. A human looking at a "Chanel Classic Double Flap Medium Black Lambskin GHW" on eBay and a "Timeless/Classique leather handbag" on Vestiaire knows they're the same product. The AI classifier does the same thing — it normalizes every listing into a common vocabulary.

### Layer 3: Cross-Platform Search + Ranking
The extension searches every other supported platform using the Offscreen Document API (loading their search pages in a hidden iframe with the user's cookies), classifies each result using the same AI system, scores relevance against the source product, and presents ranked results in a slide-in panel with attribute-level match indicators and pull-based filters.

---

## 4. Supported Platforms (Launch)

| Platform | URL Pattern | Data Quality | Auth Status | Notes |
|----------|------------|-------------|-------------|-------|
| The RealReal | therealreal.com/products/* | High — structured designer, product, condition | All items authenticated | Best structured data |
| eBay | ebay.com/itm/* | Variable — freeform titles, abbreviations | Authenticity Guarantee for $500+ | Largest inventory, most diverse |
| Poshmark | poshmark.com/listing/* | Moderate — brand structured, rest freeform | Posh Authenticate $500+ | Strong for women's fashion |
| Vestiaire Collective | vestiairecollective.com/*-{id}.shtml | High — structured brand, material, color | All items verified | Different product naming (Timeless/Classique) |
| Grailed | grailed.com/listings/* | Moderate — designer structured | Not authenticated | Skews menswear |
| Mercari | mercari.com/item/* | Low-moderate — mostly freeform | Not authenticated | Casual listings |
| ShopGoodwill | shopgoodwill.com/item/* | Low-moderate — auction titles, freeform | Not authenticated | Auction format; price = current bid |

### Future Platforms (Phase 4)
Rebag, Fashionphile, 1stDibs, Depop, ThredUp, Tradesy, The Vestiaire Edit, Hardly Ever Worn It (HEWI)

---

## 5. User Flows

### Flow 1: Passive Discovery (Primary)
1. User browses The RealReal, clicks on a Chanel bag product page
2. Extension icon lights up with a badge (e.g., "7" for 7 deals found)
3. A slide-in panel appears on the right side of the page
4. Panel shows: the detected product with AI-classified attributes (Black, Medium, Lambskin, Gold HW)
5. Below: ranked results from eBay, Poshmark, Vestiaire, Grailed, Mercari
6. Each result shows: image thumbnail, title, price, savings vs current listing, relevance score, and attribute match chips (✓ Black, ✓ Medium, ✗ Caviar — shows matches and mismatches at a glance)
7. Results load incrementally as each platform finishes (no waiting for all 5)
8. User can filter by color, size, material, hardware, condition, or minimum relevance
9. Clicking a result opens it in a new tab on the other platform

### Flow 2: Manual Search (Secondary)
1. User clicks extension icon to open popup
2. Popup shows current product info if on a product page
3. User can manually trigger a search if the auto-detection didn't fire
4. Popup shows platform status (searching, found N results, failed)

### Flow 3: First-Run Setup
1. User installs extension from Chrome Web Store
2. First-run popup explains what the extension does
3. User enters their Anthropic API key (or signs up for one)
4. Extension prompts user to browse their usual platforms so cookies are established
5. User visits a product page — magic happens

---

## 6. Feature Spec

### 6.1 Product Detection
- Automatically detect when user is on a product detail page (not search, not browse)
- Extract: brand, product name, price, all product images, description text, condition text, category breadcrumbs, any structured attributes visible in the DOM
- Use MutationObserver for SPA navigation (React/Next.js sites that don't do full page loads)
- Debounce detection — wait 2 seconds after page load for dynamic content to render
- Only trigger once per page navigation

### 6.2 AI Classification
- Source product: ALWAYS classified using Claude Vision (image + text)
- Search results: classified using two-tier system:
  - Tier 2 (heuristic): keyword matching against taxonomy dictionaries. Free, instant. Used for all results as a pre-filter.
  - Tier 1 (Claude Vision): API call with image + text. Used for source product (always), results with heuristic confidence < 0.7, and results in price-competitive range (±30% of source price).
- Batch classification: send 5-10 results in a single API call to reduce cost
- Classification caching: cache by product URL for 7 days to avoid re-classifying

### 6.3 Relevance Scoring
- Weighted multi-factor scoring:
  - Brand: 30% (wrong brand = wrong product)
  - Model: 25% (Boy Bag ≠ Classic Flap)
  - Color: 12% (high visual importance)
  - Size: 12% (functional — wrong size is unusable)
  - Material: 10% (Lambskin vs Caviar is meaningful)
  - Hardware: 6% (GHW vs SHW matters to enthusiasts)
  - Category: 5% (sanity check)
- Match types: Exact (1.0), Fuzzy (0.7-0.9), Partial (0.3-0.6), Unknown (0.2), Mismatch (0.0)
- Labels: Exact Match (85-100%), Very Similar (70-84%), Similar (50-69%), Related (30-49%), Weak Match (<30%)
- Default minimum threshold: 30% (user adjustable)

### 6.4 Pull-Based Filters
- Dropdown selectors for: Color, Size, Material, Hardware, Condition
- Relevance threshold slider (30% / 50% / 70% / 85%)
- "Clear all filters" button
- Active filter count indicator
- Filters apply instantly to loaded results (no re-search needed)
- Filter state persists within session

### 6.5 Price Comparison
- Show absolute savings ("$695 less") and percentage ("14% off") vs source listing
- Green badge for cheaper, red text for more expensive
- Handle cross-currency: USD, EUR, GBP with daily exchange rates
- "Best deal" highlight for the lowest-priced exact match

### 6.6 Side Panel UI
- Fixed-position panel on the right side of the page, 400px wide
- Slides in with smooth animation on product detection
- Close button to dismiss (stays dismissed until next product page)
- Header: MaisonDeux logo, deal count badge
- Product context: "Currently viewing on The RealReal" + product name + price
- Attribute chips: AI-classified attributes with confidence indicator
- Filter row: pull-based filter dropdowns
- Results: grouped by platform, each with header (logo, name, count, "view all" link)
- Individual listing cards: image, title, price, savings, relevance score, attribute match chips
- Click to expand: per-attribute relevance breakdown (bar chart showing brand 100%, model 85%, color 100%, etc.)
- Footer: "Powered by MaisonDeux" link

### 6.7 Extension Popup
- Shows current product if on a product page
- Idle state with supported platforms list if not on a product page
- Settings link
- Usage stats (API calls this month)

### 6.8 Settings
- API key entry (stored encrypted in Chrome sync storage)
- Platform toggles (enable/disable individual platforms)
- Default relevance threshold
- Default filters
- Usage dashboard (classification count, API cost estimate)

---

## 7. What Makes This Product Defensible

1. **The taxonomy and classification model** — mapping every platform's naming conventions into a universal vocabulary is hard, domain-specific work. This is the real IP.

2. **The Chrome extension form factor** — meets users where they already are (browsing). No cold-start problem. No need to build a marketplace.

3. **The offscreen document approach** — uses the user's own browser context, so it works with every platform's auth, sees authenticated prices, and doesn't trigger bot detection.

4. **Network effects** — every user's browsing enriches the classification model's understanding of how platforms name products. Future: anonymized community index makes everyone's search better.

5. **Revenue potential** — eBay Partner Network affiliate links, Vestiaire affiliate program, premium tier for power users (more platforms, price alerts, saved searches).

---

## 8. Success Metrics

| Metric | Target (Month 1) | Target (Month 3) |
|--------|------------------|-------------------|
| Install-to-first-use rate | >60% | >70% |
| Classification accuracy (brand + model correct) | >85% | >92% |
| Average deals found per product view | >3 | >5 |
| Results in <15 seconds | >80% | >90% |
| User retention (weekly active / installed) | >30% | >40% |
| Average savings shown per deal | >$200 | >$300 |

---

## 9. Infrastructure

| Component | Service | Purpose |
|-----------|---------|---------|
| Extension hosting | Chrome Web Store | Distribution to users |
| Backend API | Railway | Server-side Claude API calls, user auth, caching |
| Database | Neon (Postgres) | Classification cache, user accounts, usage stats, community index |
| AI classification | Anthropic Claude API | Product attribute extraction (Sonnet for vision, Haiku for text) |
| Development | Claude Code CLI | All building and coding done via Claude Code |

---

## 10. Out of Scope (V1)

- Mobile app or Safari extension
- Price alert notifications / saved searches
- Selling tools / listing creation
- Chat or community features
- Browser automation beyond read-only search
- Clicking, bidding, or purchasing on behalf of the user
- Scraping user accounts or personal data
- Storing any user browsing data on servers

---

## 11. Chrome Extension — Implementation Status

The extension (`maisondeux-extension/`) is fully scaffolded with the following components built:

### 11.1 Platform Extractors (7 platforms)

Each extractor provides `extractProductPage()` and `extractSearchResults()` functions with 3+ fallback CSS selectors per field to handle platform DOM changes:

- **TheRealReal** (`extractors/therealreal.js`)
- **eBay** (`extractors/ebay.js`)
- **Poshmark** (`extractors/poshmark.js`)
- **Vestiaire Collective** (`extractors/vestiaire.js`)
- **Grailed** (`extractors/grailed.js`)
- **Mercari** (`extractors/mercari.js`)
- **ShopGoodwill** (`extractors/shopgoodwill.js`) — handles auction-format listings where "price" is the current bid

### 11.2 Taxonomy Module (`taxonomy.js`)

A comprehensive normalization system with 10 dictionaries that map raw marketplace text to canonical values:

- **Colors** — 200+ aliases across 12+ color families (includes multilingual: noir, nero, bleu, etc.)
- **Color Families** — Groups colors into Neutral, Warm, Cool, Metallic, Multicolor
- **Materials** — 200+ aliases covering leather variants, fabrics, metals, exotics
- **Hardware** — Gold, Silver, Ruthenium, Palladium, Rose Gold with common abbreviations (GHW, SHW)
- **Brands** — 120+ aliases and common misspellings/abbreviations (LV, YSL, CDior, etc.)
- **Categories** — Handbags, Jewelry, Watches, Shoes, Clothing, Accessories
- **Conditions** — Platform-specific terms mapped to New/Excellent/Very Good/Good/Fair
- **Sizes** — US, EU, UK, generic, and cm-based sizing
- **Patterns** — Quilted, Monogram, Plain, Houndstooth, etc.
- **Subcategories** — Shoulder Bags, Totes, Satchels, etc.

**Unknown-term capture**: When a raw value does not match any dictionary, it is logged to `chrome.storage.local` under a per-category unknowns list. This enables periodic review and dictionary expansion without losing unrecognized terms.

### 11.3 Utilities (`utils/`)

- **`cache.js`** — LRU cache for classification results (max 500 entries, 7-day TTL)
- **`logger.js`** — Ring-buffer logger (last 200 events) with DEBUG/INFO/WARN/ERROR levels; viewable in settings page
- **`currency.js`** — Currency converter (USD/EUR/GBP) with daily exchange rate support
- **`messaging.js`** — Message type constants and helpers for inter-component communication

### 11.4 UI Components

- **Popup** (`popup/`) — Extension icon popup showing current product or idle state
- **Settings** (`settings/`) — API key management, platform toggles, usage dashboard
- **Offscreen Document** (`offscreen/`) — Hidden iframe-based search document for cross-platform queries
- **declarativeNetRequest rules** (`rules.json`) — Strips X-Frame-Options and CSP headers for iframe loading

---

## 12. Dev Control Dashboard (In Progress)

A separate developer-facing web application (`apps/dev-dashboard/`) for managing AI configuration, API keys, and model assignments. Not user-facing — intended for internal development and testing.

### 12.1 Purpose

Provides a single interface for developers to:
- View and manage API keys for AI providers and marketplace integrations
- Assign specific AI models to specific functions (e.g., use Haiku for search query generation, Sonnet for classification)
- Validate that configured keys are working

### 12.2 Stack

- **Frontend**: React + Vite + TypeScript (`apps/dev-dashboard/`)
- **Backend**: Fastify plugin mounted at `/dev-admin/*` routes on the existing API server
- **Guard**: All routes gated by `DEV_DASHBOARD_ENABLED` environment variable (disabled in production)
- **Config storage**: `apps/api/dev-config.json` for model assignments; `.env` for API keys

### 12.3 AI Function Registry

The dashboard manages model selection for 7 AI functions:

| Function | Description | Default Model |
|----------|-------------|---------------|
| Product Identification | Classify product from image + text | Claude Sonnet |
| Brand Inference | Identify brand from partial/ambiguous text | Claude Haiku |
| Description Analysis | Parse freeform descriptions into attributes | Claude Sonnet |
| Product Matching | Score similarity between two products | Claude Sonnet |
| Price Estimation | Estimate fair market value | GPT-4o mini |
| Search Query Generation | Generate per-platform search queries | Claude Haiku |
| Trust Scoring | Assess listing trustworthiness | Claude Haiku |

Available models per function: Claude Sonnet, Claude Haiku, GPT-4o, GPT-4o mini, Gemini Pro, Gemini Flash.

### 12.4 API Key Management

The dashboard supports viewing, editing, and validating keys for:
- **AI providers**: Anthropic (Claude), OpenAI (GPT), Google (Gemini)
- **Marketplace APIs**: eBay (App ID, Dev ID, Cert ID available for integration)
