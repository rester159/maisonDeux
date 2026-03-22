### BUILD PROMPT 4: Offscreen Document

```
Create the offscreen document system for MaisonDeux.

offscreen/offscreen.html:
- Minimal HTML page bundled with the extension
- Contains a div#iframe-container (positioned offscreen: left -9999px, width 1400px, height 900px)
- Loads offscreen.js

offscreen/offscreen.js:
- Listens for SEARCH_PLATFORMS messages from Background via chrome.runtime.onMessage
- For each platform in the message:
  1. Remove any existing iframe from the container
  2. Create a new iframe element (width 1400px, height 900px, no border)
  3. Set iframe.src to the platform's search URL
  4. Wait for the 'load' event (with 12-second timeout)
  5. After load, wait an additional 2500ms for JS-rendered content
  6. Call the appropriate extractor to read listings from iframe.contentDocument
  7. Send IFRAME_RESULTS message back to Background with extracted listings
  8. Remove the iframe
  9. Wait a random delay (1500 + Math.random() * 2000 ms) before next platform
- Handle errors gracefully:
  - If iframe load fails or times out, resolve with empty array
  - If DOM extraction throws (cross-origin), resolve with empty array
  - Log all failures for debugging
- After all platforms are searched, send a final IFRAME_RESULTS with complete: true
- Send DEALS_COUNT message with total count

Important: Import the search result extractor functions from each platform's extractor module. The offscreen document needs access to these extractors — either bundle them into offscreen.js or use importScripts.

The extractors need to handle the cross-origin iframe limitation: if iframe.contentDocument is null or throws, the extraction cannot proceed. In production, this is solved by the declarativeNetRequest rules removing X-Frame-Options headers, and by Chrome's content script injection into cross-origin frames for extensions with host_permissions.
```

---

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

