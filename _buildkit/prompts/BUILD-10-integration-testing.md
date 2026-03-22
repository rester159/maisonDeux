### BUILD PROMPT 10: Integration Testing

```
Create a test page and test script to verify the MaisonDeux extension works end-to-end.

Create test/mock-product-page.html:
- A static HTML page that mimics a The RealReal product page
- Contains all the DOM elements the therealreal.js extractor expects
- Product: Chanel Classic Double Flap, Medium, Black, Lambskin, Gold HW, $4,895
- Include realistic class names and data-testid attributes

Create test/test-classifier.js:
- Unit tests for the heuristic classifier
- Test: "CHANEL Classic Medium Double Flap Lambskin Black GHW" → brand: Chanel, color: Black, material: Lambskin, hardware: Gold, size: Medium
- Test: "Auth LV Speedy Bandouliere 30 Monogram Canvas" → brand: Louis Vuitton, material: Coated Canvas, size: Medium
- Test: "Hermes Birkin 25 Gold Togo GHW" → brand: Hermes, color: Tan, material: Calfskin, size: Small, hardware: Gold
- Test edge cases: empty string, no brand, multiple colors mentioned, conflicting sizes

Create test/test-relevance.js:
- Unit tests for the relevance scorer
- Test exact match: same brand, model, color, size, material, hardware → score > 0.9
- Test model mismatch: same brand, different model → score < 0.5
- Test partial match: same brand + model, different color → score 0.6-0.8
- Test missing attributes: candidate has nulls → score uses benefit-of-the-doubt (0.2)

Create test/test-taxonomy.js:
- Unit tests for normalization
- Test: normalize("colors", "noir") → "Black"
- Test: normalize("materials", "caviar") → "Caviar Leather"
- Test: normalize("conditions", "nwt") → "New"
- Test: normalize("hardware", "ghw") → "Gold"
- Test unknown values return null
```
