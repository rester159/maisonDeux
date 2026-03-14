# LuxeFinder v1.0

LuxeFinder is an image-first luxury resale search engine MVP with:

- Fastify + TypeScript API
- Prisma + PostgreSQL persistent storage
- Redis + BullMQ async workers for search fan-out
- Marketplace adapter architecture (`Promise.allSettled`)
- React Native mobile client (Expo runtime) with all core screens

## Project Structure

- `apps/api`: Fastify API, BullMQ worker, Prisma schema, marketplace adapters
- `apps/mobile`: React Native app (search, results, details, saved/history/alerts/profile/onboarding)
- `packages/shared`: shared business logic and TypeScript types

## Implemented API Routes

- `POST /api/v1/search/image`
- `POST /api/v1/search/image-upload`
- `POST /api/v1/search/text`
- `GET /api/v1/search/:searchId`
- `GET /api/v1/listings/:listingId`
- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/oauth` (placeholder `501`)
- `GET /api/v1/user/profile`
- `PUT /api/v1/user/preferences`
- `GET /api/v1/user/saved-searches`
- `POST /api/v1/user/saved-searches`
- `DELETE /api/v1/user/saved-searches/:id`
- `PUT /api/v1/user/saved-searches/:id/alert`
- `GET /api/v1/admin/marketplace-status`
- `GET /api/v1/admin/worker-status`
- `GET /api/v1/admin/metrics`
- `GET /readyz`

## Local Development

1. Copy environment variables:
   - `cp .env.example .env`
2. Install dependencies:
   - `npm install`
3. Generate Prisma client and push schema:
   - `npm run prisma:generate -w @luxefinder/api`
   - `npm run prisma:push -w @luxefinder/api`
4. Run API:
   - `npm run dev:api`
5. Run worker:
   - `npm run dev:worker`
6. Run mobile app:
   - `npm run dev:mobile`

## Search Execution (Phase 2)

1. Client submits image/text search.
2. API stores search row with `pending` status and returns `search_id`.
   - Local/mobile uploads can post image file bytes to `/api/v1/search/image-upload` (multipart form-data).
3. API enqueues `search-jobs` BullMQ task.
4. Worker processes job:
   - Vision analysis (OpenAI)
   - Query construction
   - Marketplace fan-out in parallel
   - Canonical normalization + trust score + ranking
   - Upsert listings + write ranked `search_results`
5. Search is marked `completed` (or `failed` with error message).
6. Client polls `GET /api/v1/search/:searchId`.

## Marketplace Adapters

- `ebay`: live Browse API with token support (env token or client-credentials token fetch)
- `shopgoodwill`: realtime unofficial search integration via `buyerapi.shopgoodwill.com/api/Search/ItemListing` (feature-flagged, no scheduled cache)
- `therealreal`, `vestiaire`, `chrono24`: live partner REST adapter support (with safe fallback to mock)
- `1stdibs`, `rebag`, `grailed`, `fashionphile`, `watchbox`, `chronext`: mock adapters wired through shared interface

## Phase 4 Hardening

- Queue retries with exponential backoff and dead-letter queue (`search-jobs-dlq`)
- Per-marketplace Redis-backed rate limiting
- Worker heartbeat tracking and admin visibility
- Runtime metrics counters and gauges
- Health and readiness endpoints for orchestrators
- Unraid compose resource limits, healthchecks, and log rotation

## Test Suite

Run all backend tests:

- `npm run test -w apps/api`

Key coverage areas:

- Normalization + currency mapping
- Retry and rate-limit helpers
- Metrics + worker heartbeat primitives
- Adapter mapping/fallback behavior
- Search ranking helper logic
- Vision text fallback analysis

## Unraid Container Deployment

Use `docker-compose.unraid.yml`:

1. Create `.env` in repo root (same keys as `.env.example`)
2. Deploy stack:
   - `docker compose -f docker-compose.unraid.yml up -d --build`
3. Containers started:
   - `luxefinder-api` (Fastify)
   - `luxefinder-worker` (BullMQ worker)
   - `luxefinder-postgres`
   - `luxefinder-redis`
4. API health:
   - `http://<unraid-host-ip>:3000/healthz`
   - `http://<unraid-host-ip>:3000/readyz`

The API and worker both run `prisma db push` at startup, so schema bootstraps automatically.
