### BUILD PROMPT 5: AI Classifier

```
Create the AI classification module (classifier.js) for MaisonDeux.

This module handles all Claude API interactions for product classification.

Exports:

1. classifyProduct(productData, apiKey) — Full AI classification using Claude Vision
   - Sends product image + text to claude-sonnet-4-20250514
   - Returns classified attribute object
   - Falls back to classifyHeuristic() on API failure

2. classifyBatch(listings, platform, apiKey) — Batch classification of search results
   - Sends up to 10 listings in a single API call
   - Uses claude-sonnet-4-20250514 or claude-haiku-4-5-20251001 (configurable)
   - Returns array of classified attribute objects

3. generateSearchQueries(sourceAttributes, apiKey) — Generate per-platform search queries
   - Uses claude-haiku-4-5-20251001
   - Returns object with platform keys and query strings

4. verifyVisualMatch(sourceImageUrl, candidateImageUrl, apiKey) — Image comparison
   - Sends two images to claude-sonnet-4-20250514
   - Returns visual match score and analysis

5. classifyHeuristic(productData) — Local heuristic classification (no API)
   - Uses taxonomy.js normalization dictionaries
   - Scans title + description for color, material, size, hardware, condition, category keywords
   - Returns classified attribute object with lower confidence

API call implementation:
- Endpoint: https://api.anthropic.com/v1/messages
- Required headers: Content-Type, x-api-key, anthropic-version: 2023-06-01, anthropic-dangerous-direct-browser-access: true
- Always wrap in try/catch
- Parse response: data.content[0].text → strip markdown fences → JSON.parse
- If API returns error, log it and fall back to heuristic

Use the system prompts and user message templates from the Prompt Library document (Part A, Prompts 1-4).

The heuristic classifier should:
- Loop through taxonomy dictionaries looking for keyword matches in the lowercased text
- Calculate a confidence score: +0.25 for brand, +0.15 each for color/material/size, +0.10 each for category/hardware/condition. Cap at 1.0.
- Return the same attribute schema as the AI classifier
```

---

