### BUILD PROMPT 7: Background Service Worker

```
Create the background service worker (background.js) that orchestrates the entire MaisonDeux pipeline.

This is the central coordinator. It:

1. Listens for PRODUCT_DETECTED from Content Script
2. Checks classification cache (utils/cache.js)
3. Classifies source product via classifier.js (AI or cached)
4. Generates search queries via classifier.js
5. Creates offscreen document and sends SEARCH_PLATFORMS
6. Receives IFRAME_RESULTS from offscreen document
7. Classifies results (heuristic for all, AI for top candidates)
8. Scores and ranks results via relevance.js
9. Sends DEAL_RESULTS to Content Script
10. Updates extension badge with deal count

Implementation details:

Offscreen document lifecycle:
- Use chrome.offscreen.createDocument with reason IFRAME_SCRIPTING
- Check for existing document before creating (chrome.runtime.getContexts)
- Use a global promise to prevent concurrent creation
- Close document after search is complete (optional — can reuse)

API key management:
- Read from chrome.storage.sync on first use
- If not set, send a "setup required" message to Content Script
- Never log the API key

Rate limiting:
- Track API calls in chrome.storage.local (md_usage_stats)
- Max 200 API calls per hour
- If exceeded, switch to heuristic-only mode

Classification caching:
- Use utils/cache.js with URL as key
- TTL: 7 days
- Max entries: 500

Message handling should be clean and organized:
- Use a switch on message.type
- Each message type calls a dedicated handler function
- All handlers are async
- Return true from onMessage listener for async responses

Handle service worker sleep/wake:
- Save search state to chrome.storage.session
- On wake, check if there's an interrupted search
- Resume or discard based on age of saved state
```

---

