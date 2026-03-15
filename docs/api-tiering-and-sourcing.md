# API Tiering and Data Sourcing (maisonDeux)

## Tier 1 (Essential to start testing)

### 1) OpenAI Vision
- **Env:** `OPENAI_API_KEY`
- **Docs:** [OpenAI API keys](https://platform.openai.com/api-keys)
- **Fit for maisonDeux:** **Yes**. Required for image-first search query construction.

### 2) eBay Browse API (official inventory)
- **Env:** `EBAY_APP_ID`, `EBAY_CERT_ID` (and optionally `EBAY_OAUTH_TOKEN`)
- **Docs:** [eBay Browse item search](https://developer.ebay.com/api-docs/buy/browse/resources/item_summary/methods/search), [OAuth client credentials](https://developer.ebay.com/api-docs/static/oauth-client-credentials-grant.html)
- **Fit for maisonDeux:** **Yes**. Official inventory search endpoint returns listing summaries with price, URL, condition, seller/location metadata.

### 3) ShopGoodwill realtime endpoint (unofficial)
- **Env:** `SHOPGOODWILL_ENABLED`, `SHOPGOODWILL_API_ROOT` (+ optional runtime credentials in UI)
- **Docs:** No official public developer portal for this endpoint.
- **Fit for maisonDeux:** **Yes (pragmatic)**. Works as realtime search source but is unofficial and may change.

### 4) Realtime scraper sources (no dependable public inventory APIs)
- **Platforms:** `1stdibs`, `rebag`, `grailed`, `fashionphile`, `watchbox`, `chronext`
- **Fit for maisonDeux:** **Yes via scraping strategy**.
- **Implementation status:** live scraper adapters now run during search and return normalized listings into UI.

### Tier 1 infrastructure requirements
- `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `PORT`, `NODE_ENV`

## Tier 2 (Nice to have / quality + resilience)

### 1) The RealReal partner API
- **Env:** `THEREALREAL_API_KEY`, `THEREALREAL_API_SECRET`, `THEREALREAL_BASE_URL`
- **Docs:** [The RealReal vendor docs](https://vendor-docs.therealreal.com/)
- **Fit for maisonDeux:** **Conditional**. Vendor-oriented APIs are useful with approved partner access, but not the fastest path to open consumer inventory search.

### 2) Chrono24 partner/enterprise integrations
- **Env:** `CHRONO24_API_KEY`, `CHRONO24_API_SECRET`, `CHRONO24_BASE_URL`
- **Public link:** [Chrono24 partners](https://about.chrono24.com/en/partners)
- **Fit for maisonDeux:** **Conditional**. Access appears partner-gated; good upgrade path for higher quality watch inventory.

### 3) Vestiaire official API access
- **Env:** `VESTIAIRE_API_KEY`, `VESTIAIRE_BASE_URL`
- **Fit for maisonDeux:** **Likely partner-gated / limited public docs**. Keep as optional until direct partner access is secured.

### 4) Additional model providers and platform keys
- `XIMILAR_API_KEY`, `GOOGLE_CLOUD_VISION_API_KEY`
- `FIRSTDIBS_API_KEY`, `REBAG_API_KEY`, `GRAILED_API_KEY`, `FASHIONPHILE_API_KEY`, `WATCHBOX_API_KEY`, `CHRONEXT_API_KEY`
- **Fit for maisonDeux:** resilience and future direct integrations.

## Realtime Scraping Strategy (for non-API inventory sources)

1. On each search, scraper adapters fetch each marketplace search page URL in parallel.
2. Extract embedded JSON-LD (`application/ld+json`) product data from HTML.
3. Map product fields into `CanonicalListing`:
   - URL, title, price, currency, image, condition fallback.
4. Normalize currency and compute trust score.
5. Return results immediately to existing fan-out pipeline and ranking flow.
6. If scrape fails or no parseable products, return soft fallback mock listings to preserve UX continuity.

## Code locations
- Scraper adapters: `apps/api/src/adapters.ts` (`ScrapedMarketplaceAdapter`, `SCRAPE_SOURCES`)
- Fan-out usage: `getTierOneAdapters(...)`
- Pipeline orchestration: `apps/api/src/services/search-pipeline.ts`
