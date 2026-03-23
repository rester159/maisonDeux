# maisonDeux Data Sources

## Source Categories
- **Direct/partner APIs**: eBay, Chrono24, The RealReal, Vestiaire. When API key is present, use API; on API failure, scrape fallback is used for TRR/Vestiaire/Chrono24. When API key is absent, these adapters return empty (no scrape) because many of these sites require login to see search results.
- **Unofficial API-like integration**: ShopGoodwill real-time search endpoint.
- **Scraped (public pages)**: 1stDibs, Rebag, Grailed, Fashionphile, WatchBox, Chronext.

## Login-gated / API-only strategy
- The RealReal, Vestiaire, Chrono24: without a partner API key we do not attempt to scrape (sites often require login for full results). Users can use the in-app "Search on [Site]" deep links to open each marketplace with the current query and sign in there.

## Browser extension (bridge) — login-required sites
- **Preferred solution** for sites that require login and have no public API/OAuth: the **maisonDeux browser extension** (see `docs/website-spec.md` §9 and agent **EX** in `agents.md`).
- The extension runs in the user’s browser; the user logs into The RealReal, Vestiaire, Chrono24, 1stDibs, etc. once in that browser. When the user searches on maisonDeux, the extension opens each site’s search URL in a background tab (using the user’s existing session cookies), scrapes the result page, and sends `CanonicalListing`-like JSON to the web app. The web app merges these with API results. No passwords are ever sent to maisonDeux; the server never logs in as the user.
- Extension-sourced listings should be normalized to the same `CanonicalListing` shape and merged with server results in the frontend (or optionally sent to the backend for persistence). Product spec: `docs/website-spec.md` §9.

## Canonicalization Contract
- All adapter output must conform to `CanonicalListing` in `packages/shared/src/index.ts`.
- Adapter-specific payloads must be normalized before persistence.
- Condition, auth status, and currency must pass through helpers in `apps/api/src/normalization.ts`.

## Credentials and Priority
- Runtime credentials from request (`runtime_credentials`) override env defaults.
- Supported runtime keys include:
  - `ebay.oauth_token`
  - `shopgoodwill.access_token|username|password`
  - `chrono24.api_key`
  - `therealreal.api_key`
  - `vestiaire.api_key`
- If runtime credentials are absent, adapters may use environment variables.

## Persistence of Search Data
- Primary DB: PostgreSQL via Prisma (`apps/api/prisma/schema.prisma`).
- Key entities: `Search`, `Listing`, `SearchResult`, `MarketplaceConfig`, `SavedSearch`, `User`.
- `Search.runtimeCredentials` is JSON and should be treated as sensitive request data.

## Queue and Operational Data
- Redis is used for:
  - BullMQ queues (`search-jobs`, dead-letter queue)
  - rate limiting buckets
  - lightweight metrics/heartbeat

## Guardrails for Future Integrations
- New adapters must:
  1. Implement `MarketplaceAdapter`
  2. Return canonical listings only
  3. Respect rate-limiting and retry wrappers in pipeline
  4. Fail soft (no hard crash of whole search fan-out)
  5. Include tests (mapping + failure scenarios)

## Trust and User Messaging
- Always return `TRUST_DISCLAIMER` from shared package in search responses.
- Never imply maisonDeux performs item authentication.
