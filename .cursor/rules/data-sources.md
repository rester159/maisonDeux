# maisonDeux Data Sources

## Source Categories
- **Direct/partner APIs**: eBay, Chrono24, The RealReal, Vestiaire (with fallbacks).
- **Unofficial API-like integration**: ShopGoodwill real-time search endpoint.
- **Mock adapters** (for unsupported or credential-missing paths): 1stdibs, Rebag, Grailed, Fashionphile, WatchBox, Chronext.

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
