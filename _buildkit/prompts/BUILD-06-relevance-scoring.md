### BUILD PROMPT 6: Relevance Scoring

```
Create the relevance scoring module (relevance.js) for MaisonDeux.

Exports:

1. scoreRelevance(source, candidate) — Compare two classified products
   Returns: { score: 0-1, label: string, breakdown: { [attr]: { score, reason, source?, candidate? } } }

2. filterAndRank(sourceAttributes, results, options) — Process raw results into ranked deals
   Returns: sorted, scored, filtered array

Scoring weights:
- brand: 30 (wrong brand = wrong product)
- model: 25 (different model = different product)
- color: 12 (high visual importance)
- size: 12 (functional — wrong size is unusable)
- material: 10 (Lambskin vs Caviar matters)
- hardware: 6 (aesthetic preference)
- category: 5 (sanity check)

Match functions:
- exactMatch(a, b): case-insensitive string equality → 1.0 or 0.0
- fuzzyMatch(a, b, threshold): check substring inclusion (0.85), then Jaccard word similarity. Return 0 if below threshold.
- colorFamilyMatch(source, candidate): same colorFamily → 0.6, else 0
- sizeMatch(a, b): exact match → 1.0, adjacent size (e.g. Small/Medium) → 0.4, numeric within 0.5 → 0.9, numeric within 1.0 → 0.6, else 0

If source doesn't have an attribute, skip it (don't penalize). If candidate doesn't have an attribute the source has, give benefit-of-the-doubt score of 0.2.

Result labels by score:
- 0.85–1.0: "Exact Match"
- 0.70–0.84: "Very Similar"
- 0.50–0.69: "Similar"
- 0.30–0.49: "Related"
- 0.00–0.29: "Weak Match"

filterAndRank should:
- Accept options: { minScore: 0.3, maxResults: 20 }
- Classify each result (using pre-computed attributes)
- Score each result against source
- Filter below minScore
- Sort by: relevance (primary, higher first), then price (secondary, lower first)
- Compute priceDelta for each result: { absolute, percentage, isCheaper, label }
- Return top maxResults
```

---

