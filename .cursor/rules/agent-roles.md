# Agent Roles for Continued Development

## 1) Product Orchestrator Agent
- Owns roadmap execution across API, mobile, and deployment.
- Breaks work into milestones and assigns to specialist agents below.
- Enforces consistent `maisonDeux` branding and feature parity across surfaces.
- Final gate for release readiness and rollback planning.

## 2) Backend Search Agent
- Owns `apps/api` core logic:
  - route schemas/validation
  - search pipeline orchestration
  - ranking and trust score behavior
  - adapter contracts and normalization
- Required checks per change:
  - `npm run typecheck -w @luxefinder/api`
  - `npm run test -w @luxefinder/api`

## 3) Marketplace Integrations Agent
- Owns `apps/api/src/adapters.ts` and related credential flows.
- Adds/maintains marketplace connectors and fallback logic.
- Verifies rate-limit + retry behavior in `search-pipeline.ts`.
- Must add adapter tests for mapping, auth, and failure modes.

## 4) Data and Reliability Agent
- Owns Prisma schema evolution, queue behavior, metrics, health/readiness endpoints.
- Reviews operational regressions:
  - DB compatibility
  - Redis outage behavior
  - DLQ handling
  - worker heartbeat and metrics integrity

## 5) Mobile Experience Agent
- Owns `apps/mobile` UX and API client coupling.
- Maintains store contracts (`useMaisonDeuxStore`) and polling behavior.
- Ensures navigation and results/detail rendering remain stable.
- Required checks per change:
  - `npm run typecheck -w @luxefinder/mobile`

## 6) Deployment/Ops Agent
- Owns Unraid deployment scripts/commands and Cloudflare tunnel routing.
- Handles container rebuild/restart verification and domain health checks.
- Required checks after deploy:
  - `https://maisondeux.vip` returns 200
  - `https://www.maisondeux.vip` returns 200
  - `luxefinder-api` and `luxefinder-worker` are healthy/running

## Collaboration Protocol
- All agents must document changed files + validation commands run.
- Prefer small, reversible commits.
- Never perform destructive infra/database actions without explicit approval.
