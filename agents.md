# maisonDeux Agent Roles

This document defines the agent structure for the maisonDeux project. **Tier 1** agents own major app domains; the **Attribute System** agent (A) has its own sub-agents in **Tier 2**.

---

## Tier 1: App Domain Agents

```
┌─────────────────────────────────────────────────────────┐
│                    maisonDeux App                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  A  Attribute System          ← has sub-agents (Tier 2)   │
│  B  Marketplace Connectors                               │
│  C  Search & Ranking                                    │
│  D  Image Intelligence                                  │
│  E  Frontend & UX                                       │
│  F  Pricing Intelligence                                │
│  G  Infrastructure & DevOps                             │
│  H  Data Quality & Testing                              │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### A — Attribute System
Owns all reference data (brands, models, colors, materials, sizes), the extraction engine, and classification logic. Answers "what is this item?" Has dedicated sub-agents A.1–A.10 (see Tier 2).

### B — Marketplace Connectors
Owns every adapter (eBay, ShopGoodwill, TheRealReal, 1stDibs, Vestiaire, Chrono24, etc.). API integrations, scrape fallbacks, HTML/JSON parsing, retries, new platforms, clean `CanonicalListing` output. Feeds raw data to Agent A.

### C — Search & Ranking
Owns query construction (text + image → search queries), precision/fuzzy expansion, relevance scoring (`scoreRelevance`), result filtering, and row bucketing (`buildRowBuckets`). Consumes enriched data from Agent A. Controls what users see and in what order.

### D — Image Intelligence
Owns the image-to-attributes pipeline: OpenAI Vision, Google Lens (SerpAPI), brand/model identification from visual matches, confidence merging. Produces `image_analysis` for Agents A and C. Uses Agent A's catalog to validate/correct visual identification.

### E — Frontend & UX
Owns the React web app (`apps/web/`). Mobile layout, card rendering, carousels, bottom nav (Home / Queue / Profile), settings panel, search flow, loading states, error handling. Consumes API responses shaped by A and C.

### F — Pricing Intelligence
Owns retail price estimation (Google Shopping, eBay new-condition fallback), deal scoring (listing vs retail), future price trend work. Produces `estimated_retail_price_usd` and discount calculations.

### G — Infrastructure & DevOps
Owns Docker builds, Unraid deployment, Cloudflare tunnel config, env management, health checks, structured logging, one-command deploy, container auto-restart, `/api/v1/diagnostics`.

### H — Data Quality & Testing
Owns test suites, accuracy benchmarks, regression detection. Builds fixtures from real marketplace data. Tracks extraction accuracy. Validates cross-agent changes.

---

## Tier 2: Attribute System Sub-Agents

```
┌─────────────────────────────────────────────────────────────────┐
│                 A  Attribute System                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─── Data Layer (parallel) ───────────────────────────────┐    │
│  │                                                          │    │
│  │  A.1  Brand & Model Catalog    300+ brands, 5K models    │    │
│  │  A.2  Color Vocabulary         150 entries + aliases     │    │
│  │  A.3  Material Vocabulary      80 entries + aliases       │    │
│  │  A.4  Size Pattern Engine      category-aware rules      │    │
│  │                                                          │    │
│  └────────────────────┬───────────────────────────────────┘    │
│                        │                                         │
│                        ▼                                         │
│  ┌─── Engine Layer ───────────────────────────────────────┐    │
│  │                                                          │    │
│  │  A.5  Extraction Matcher       cascading pipeline,       │    │
│  │                                fuzzy matching,           │    │
│  │                                confidence scoring        │    │
│  │                                                          │    │
│  └────────────────────┬───────────────────────────────────┘    │
│                        │                                         │
│                        ▼                                         │
│  ┌─── Integration Layer (parallel) ──────────────────────┐    │
│  │                                                          │    │
│  │  A.6  Pipeline Integration     wire into search-pipeline │    │
│  │                                enrich listings server-side    │
│  │                                                          │    │
│  │  A.7  Frontend Cleanup         remove client-side        │    │
│  │                                inference, use server     │    │
│  │                                fields directly           │    │
│  │                                                          │    │
│  │  A.8  Bucketing Rewrite        new classification using  │    │
│  │                                extracted attrs + gates   │    │
│  │                                                          │    │
│  └────────────────────┬───────────────────────────────────┘    │
│                        │                                         │
│                        ▼                                         │
│  ┌─── Validation Layer ───────────────────────────────────┐    │
│  │                                                          │    │
│  │  A.9  Test Harness            100+ real listings,        │    │
│  │                                accuracy benchmarks       │    │
│  │                                                          │    │
│  │  A.10 Feedback Loop          log extraction misses,     │    │
│  │                                flag unknown brands/models│    │
│  │                                for catalog expansion      │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### A.1 — Brand & Model Catalog Builder
**Scope:** `packages/shared/src/reference-data/brands.ts` — 300+ brands with aliases; 3,000–5,000 models scoped per brand. Tiers: luxury houses, premium contemporary, watches, jewelry, streetwear.

**Output:** `BrandEntry[]` with `ModelEntry[]` per brand. Models include canonical name, aliases, variants, categories, signature materials.

### A.2 — Color Vocabulary Builder
**Scope:** `packages/shared/src/reference-data/colors.ts` — ~150 entries. Fashion-aware: cognac, etoupe, noir, bleu nuit, blush, champagne. Each has canonical name, aliases (incl. French/Italian), and family.

**Output:** `ColorEntry[]`.

### A.3 — Material Vocabulary Builder
**Scope:** `packages/shared/src/reference-data/materials.ts` — ~80 entries. Saffiano, Epsom, vachetta, GG Supreme canvas, toile, suede, patent leather. Each has canonical name, aliases, family.

**Output:** `MaterialEntry[]`.

### A.4 — Size Pattern Engine
**Scope:** `packages/shared/src/reference-data/sizes.ts` — category-aware extraction. Shoes (EU 35–52, US/UK), clothing (XS–XXXL, numeric), bags (mini/small/medium/large + dimensions), watches (mm, strap width), jewelry (ring sizes, bracelet lengths).

**Output:** `SizePattern[]` config + `extractSize(text, category): { value, system, confidence }`.

### A.5 — Extraction Matcher
**Scope:** `packages/shared/src/attribute-extractor.ts` — cascading pipeline: normalize → brand → model (brand-scoped or reverse lookup) → color → material → size. Uses exact alias scan, fuzzy (Levenshtein), confidence scoring.

**Depends on:** A.1–A.4 for data. Can build against interfaces early.

**Output:** `extractAttributes(title, description, sellerFields, category): ExtractedAttributes`.

### A.6 — Pipeline Integration
**Scope:** Wire A.5 into `apps/api/src/services/search-pipeline.ts`. Enrich every listing server-side before persistence. Update API response shape.

**Depends on:** A.5.

### A.7 — Frontend Cleanup
**Scope:** Remove `inferModel`, `inferColor`, `inferSize`, `inferBrand` from `apps/web/src/App.tsx`. Use server-supplied extracted fields. Update `extractStandardizedItemFields` to read, not infer.

**Depends on:** A.5 (API returns enriched data).

### A.8 — Bucketing Rewrite
**Scope:** Rewrite `buildRowBuckets` and `modelSimilarityScore` to use extracted attributes with confidence gates. Exact/similar/different classification based on high-confidence brand/model/color.

**Depends on:** A.5.

### A.9 — Test Harness
**Scope:** `packages/shared/src/__tests__/attribute-extractor.test.ts` — 100+ real listing titles from each marketplace. Benchmark brand, model, color, material, size accuracy.

**Target:** >85% brand, >70% model, >90% color on luxury listings.

**Depends on:** A.5 (runs against extraction engine).

### A.10 — Feedback Loop
**Scope:** Log extraction misses, unknown brands/models. Flag for catalog expansion. Future: telemetry or admin UI for manual corrections feeding back into A.1–A.4.

**Depends on:** A.5, A.6.

---

## Dependency Flow

### Within Attribute System (A)

```
A.1 ─┐
A.2 ─┤  (all parallel, no deps between them)
A.3 ─┤
A.4 ─┘
      └──► A.5  (needs data from A.1–A.4)
              └──► A.6, A.7, A.8  (parallel once A.5 is ready)
                        └──► A.9, A.10  (validation after integration)
```

### Cross-Domain

| Agent | Depends On | Feeds Into |
|-------|------------|------------|
| A | — | C, D, E |
| B | — | A, C |
| C | A | E |
| D | — | A, C |
| E | A, C | — |
| F | — | E |
| G | — | — |
| H | All | — |

---

## Interaction Flow

```
User search (text or image)
         │
         ▼
    C  Search & Ranking  (builds query)
         │
         ├──────────────┬──────────────┬──────────────┐
         ▼              ▼              ▼              ▼
    B  eBay        B  1stDibs     B  TRR          B  ...
    adapter       adapter       adapter
         │              │              │
         └──────────────┼──────────────┘
                        │ raw CanonicalListings
                        ▼
                 A  Attribute System
                 extractAttributes()
                 → brand, model, color, material, size
                        │ enriched listings
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
    C  Ranking     F  Pricing     C  Bucketing
    & scoring     retail est     exact/similar/different
         └──────────────┼──────────────┘
                        ▼
                 E  Frontend & UX
                 renders cards, carousels
```

---

## First Wave (can start in parallel)

| Agent | First Task | Blocks |
|-------|------------|--------|
| **A.1** | Generate brand + model catalog | A.5 |
| **A.2** | Build color vocabulary | A.5 |
| **A.3** | Build material vocabulary | A.5 |
| **A.4** | Build size pattern rules | A.5 |
| **B** | Scraper hardening, 1stDibs/TRR fixes | — |
| **G** | DevOps polish, diagnostics endpoint | — |
