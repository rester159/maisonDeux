# maisonDeux Project Overview

## Mission
- `maisonDeux` is an image-first luxury resale search aggregator.
- Users can search by image or text and receive normalized listings from multiple marketplaces.
- The platform is opinionated about ranking and trust signaling, but does **not** authenticate items itself.

## Repository Shape
- Monorepo with npm workspaces:
  - `apps/api`: Fastify API, BullMQ worker, Prisma persistence, marketplace adapters
  - `apps/mobile`: Expo React Native client
  - `packages/shared`: shared types, query builder, trust score/disclaimer

## Core Data Flow
1. Client submits search (`/api/v1/search/text` or `/api/v1/search/image-upload`).
2. API validates with Zod and creates a `Search` row in Postgres.
3. API enqueues `search-jobs` in BullMQ (or runs inline if Redis unavailable).
4. Worker executes `processSearch()`:
   - analyze image/text
   - build query
   - fan out to adapters in parallel
   - normalize + rank + trust-score
   - persist `Listing` + `SearchResult`
5. Client polls `/api/v1/search/:searchId` for completion.

## Important Files
- `apps/api/src/server.ts`: API routes + web UI HTML + runtime credentials form
- `apps/api/src/services/search-pipeline.ts`: search orchestration and ranking
- `apps/api/src/adapters.ts`: marketplace adapter implementations
- `apps/api/prisma/schema.prisma`: DB schema
- `apps/mobile/src/store.ts`: global mobile search state
- `apps/mobile/src/api.ts`: mobile API client
- `packages/shared/src/index.ts`: canonical types, trust logic
- `docker-compose.unraid.yml`: Unraid deployment baseline

## Runtime Infrastructure
- API + worker containers share Redis + Postgres.
- Public traffic is routed via Cloudflare tunnel to API at port `3000`.
- IG autoposter remains a separate tunnel route to port `3420`.

## Current Product Naming
- User-facing name is `maisonDeux`.
- Legacy internal package names still use `luxefinder` and should only be changed with coordinated migration.
