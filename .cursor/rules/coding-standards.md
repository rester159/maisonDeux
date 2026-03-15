# Coding Standards for maisonDeux

## General Principles
- Keep changes minimal, explicit, and testable.
- Prefer readability over cleverness.
- Avoid broad refactors unless required by the task.

## TypeScript and API Standards
- Maintain strict TypeScript compatibility (`tsconfig` strict mode).
- Reuse shared contracts from `@luxefinder/shared` instead of duplicating types.
- Validate inbound API payloads with Zod before side effects.
- Use canonical response shapes (`search_id`, `runtime_credentials`, etc.) consistently.

## Search Pipeline Standards
- Do not bypass `processSearch()` orchestration patterns:
  - `Promise.allSettled` fan-out
  - retry wrappers
  - rate-limit slot waiting
  - status transitions (`pending` -> `processing` -> `completed|failed`)
- Fail soft per-adapter; one source failing must not collapse all results.

## Adapter Standards
- New adapter code must implement `MarketplaceAdapter`.
- Return only `CanonicalListing[]`; normalize all external fields.
- Never hardcode secrets or credential values in code.
- Log and surface errors in a way that preserves partial results.

## Data and Security
- Treat credentials and tokens as sensitive:
  - no plaintext logging of secrets
  - no committing `.env` files
- Keep Prisma writes transactional when mutating coupled entities.
- Preserve backward compatibility for persisted JSON fields where possible.

## Mobile Standards
- Keep API usage centralized in `apps/mobile/src/api.ts`.
- Use `useMaisonDeuxStore` for search state; avoid duplicating global state.
- UI copy must use `maisonDeux` branding.

## Testing and Verification
- Run relevant checks after substantive edits:
  - `npm run typecheck`
  - `npm run test -w @luxefinder/api` when backend behavior changes
- Add/adjust tests when modifying:
  - normalization logic
  - adapter mapping/auth
  - retry/rate-limit behavior
  - trust score or ranking logic

## Deployment Safety
- For Unraid releases, verify container startup logs and public domain health.
- Keep rollout reversible; avoid destructive DB actions without explicit approval.
