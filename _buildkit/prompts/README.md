# MaisonDeux — Prompt Library Index

14 prompts organized into two categories. Use them in the order listed.

## Runtime Prompts (Extension → Claude API)

These are called by the running extension. They go into your classifier.js code.

| # | File | Purpose | Model | When Called |
|---|------|---------|-------|-------------|
| R1 | `RUNTIME-01-source-product-classification.md` | Classify the product the user is viewing | Sonnet (vision) | Every product page (cache miss) |
| R2 | `RUNTIME-02-batch-result-classification.md` | Classify 5–10 search results in one call | Sonnet or Haiku | After extracting results from each platform |
| R3 | `RUNTIME-03-search-query-generation.md` | Generate optimized search queries per platform | Haiku | After source classification, before searching |
| R4 | `RUNTIME-04-visual-match-verification.md` | Compare two product images for similarity | Sonnet (vision) | Only for ambiguous matches (score 0.5–0.7) |

## Build Prompts (For Claude Code)

Paste these into Claude Code in order. Each one builds one component of the extension.

| # | File | What It Builds | Build Phase |
|---|------|---------------|-------------|
| B1 | `BUILD-01-project-scaffolding.md` | Full project structure, manifest, utils | Phase 1, Step 1.2 |
| B2 | `BUILD-02-taxonomy-normalization.md` | Color/material/size/condition dictionaries | Phase 1, Step 1.3 |
| B3 | `BUILD-03-platform-extractors.md` | DOM extractors for all 6 platforms | Phase 1, Step 1.4 |
| B4 | `BUILD-04-offscreen-document.md` | Hidden iframe loader | Phase 1, Step 1.5 |
| B5 | `BUILD-05-ai-classifier.md` | Claude API integration + heuristic fallback | Phase 2, Step 2.1 |
| B6 | `BUILD-06-relevance-scoring.md` | Weighted scoring algorithm | Phase 2, Step 2.2 |
| B7 | `BUILD-07-background-service-worker.md` | Central orchestrator | Phase 2, Step 2.3 |
| B8 | `BUILD-08-content-script-ui.md` | Slide-in panel with filters | Phase 3, Step 3.1 |
| B9 | `BUILD-09-popup-settings.md` | Extension popup + settings page | Phase 3, Step 3.4 |
| B10 | `BUILD-10-integration-testing.md` | Test pages and unit tests | Phase 4, Step 4.1 |
