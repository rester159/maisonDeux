# MaisonDeux — Build Playbook

A step-by-step guide from zero to a fully functioning Chrome extension. Every command, every API key, every prompt, in exact order.

---

## Prerequisites

Before you start, you need:

| Requirement | Where to Get It | Cost |
|-------------|----------------|------|
| Google Chrome (latest) | chrome.google.com | Free |
| Node.js 18+ | nodejs.org | Free |
| Claude Code CLI | `npm install -g @anthropic-ai/claude-code` | Requires Anthropic API key |
| Anthropic API key | console.anthropic.com → API Keys → Create Key | Pay-as-you-go (~$0.02-0.04 per product view) |
| Git | git-scm.com | Free |
| Railway account | railway.app | Free tier available, then usage-based |
| Neon account | neon.tech | Free tier (0.5 GB), then usage-based |

### API Keys You'll Need

1. **Anthropic API Key** (required)
   - Go to: https://console.anthropic.com
   - Sign up / sign in
   - Navigate to: API Keys → Create Key
   - Copy the key (starts with `sk-ant-`)
   - This key is used in TWO places:
     a. Claude Code CLI (for building the extension) — set as env var
     b. The extension itself (for runtime classification) — entered in extension settings
   - Estimated cost for building: $5-15 in API calls
   - Estimated cost for using: $0.02-0.04 per product view

2. **Chrome Web Store Developer Account** (only needed for Phase 4 — publishing)
   - Go to: https://chrome.google.com/webstore/devconsole
   - One-time fee: $5
   - Not needed during development

3. **Railway Account** (needed for backend deployment)
   - Go to: https://railway.app
   - Sign up with GitHub
   - Free tier includes $5/month of usage
   - Used to host the backend API that handles Claude API calls server-side
   - You'll need a Railway API token for CI/CD: Settings → Tokens → Create Token

4. **Neon Account** (Postgres database)
   - Go to: https://neon.tech
   - Sign up (free tier: 0.5 GB storage, 1 project)
   - Create a new project → copy the connection string (starts with `postgresql://`)
   - Used for: classification cache, user accounts, usage tracking, community listing index
   - The connection string goes into Railway as an environment variable

### Setting Up Claude Code

```bash
# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Set your API key
export ANTHROPIC_API_KEY="sk-ant-your-key-here"

# Verify it works
claude --version
```

---

## Phase 1: Foundation (Estimated: 2-4 hours)

### Step 1.1: Create Project Directory

```bash
mkdir maisondeux-extension
cd maisondeux-extension
git init
```

### Step 1.2: Scaffold the Project

Open Claude Code and give it Build Prompt 1 from the Prompt Library (Document 3, Part B, Build Prompt 1).

```bash
claude
```

Paste the full "BUILD PROMPT 1: Project Scaffolding" prompt. This creates all files and directories.

**Verify:** After Claude Code finishes, check that you have:
```bash
ls -la
# Should see: manifest.json, rules.json, background.js, classifier.js, etc.
ls extractors/
# Should see: therealreal.js, ebay.js, poshmark.js, vestiaire.js, grailed.js, mercari.js
ls offscreen/
# Should see: offscreen.html, offscreen.js
ls popup/
# Should see: popup.html, popup.js, popup.css
ls settings/
# Should see: settings.html, settings.js, settings.css
ls utils/
# Should see: messaging.js, cache.js, currency.js, logger.js
```

### Step 1.3: Build the Taxonomy

In the same Claude Code session (or a new one in the same directory):

Paste "BUILD PROMPT 2: Taxonomy & Normalization Dictionaries" from the Prompt Library.

**Verify:** Open taxonomy.js and check that:
- COLORS dictionary has entries for noir, nero, schwarz mapping to "Black"
- MATERIALS dictionary has entries for lambskin, caviar, calfskin
- normalize("colors", "noir") would return "Black"
- normalizeAll("Chanel Classic Flap Black Lambskin GHW") extracts color, material, hardware

### Step 1.4: Build Platform Extractors

Paste "BUILD PROMPT 3: Platform-Specific Extractors" from the Prompt Library.

**Verify:** Each file in extractors/ should export extractProductPage() and extractSearchResults() with multiple fallback selectors per field.

### Step 1.5: Build the Offscreen Document

Paste "BUILD PROMPT 4: Offscreen Document" from the Prompt Library.

**Verify:** offscreen/offscreen.js should:
- Listen for SEARCH_PLATFORMS messages
- Create iframes sequentially
- Extract listings using the extractor modules
- Send IFRAME_RESULTS back
- Have randomized delays between platforms

### Step 1.6: Load the Extension in Chrome

1. Open Chrome
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked"
5. Select your `maisondeux-extension/` directory
6. The extension should appear with the MaisonDeux icon

**Verify:**
- No errors in the extension card (check for red error badges)
- Click "Errors" or "Service worker" link to check for console errors
- If there are import/module errors, you may need to adjust how modules are loaded (Chrome extension service workers have specific module rules)

### Step 1.7: Test Basic Detection

1. Navigate to https://www.therealreal.com
2. Click on any product
3. Open Chrome DevTools (F12) → Console
4. Look for "[MaisonDeux]" log messages
5. The content script should detect the product and log the extracted data

**If nothing happens:**
- Check that content_scripts.matches in manifest.json covers the URL pattern
- Check the content script's console logs in the page's DevTools (not the extension's)
- Check the background service worker's console (click "Service worker" in chrome://extensions)

### Step 1.8: Fix Module Loading Issues

Chrome extension service workers and content scripts have different module capabilities. You'll likely need to:

In Claude Code:
```
The extension is loaded but there are module import errors. Chrome extension content scripts cannot use ES module imports. Convert all imports in content-script.js to use globally available functions. The content script needs access to the platform extractors — bundle them inline or load via chrome.scripting.executeScript.

For the background service worker (which IS declared as type: module in the manifest), ensure imports use proper relative paths.

For the offscreen document, bundle the extractor functions into offscreen.js directly since offscreen documents can't use chrome.scripting and have limited API access.
```

### Step 1.9: Test Offscreen Document

In Claude Code:
```
Add debug logging to the offscreen document. When it receives a SEARCH_PLATFORMS message, log each step: iframe creation, load event, DOM extraction attempt, results found. Also add a manual test trigger: when the user clicks the extension icon, if we're on a product page, manually trigger a search for just eBay (one platform) and log the results.
```

**Verify:** Click the extension icon on a product page. Check the service worker console for IFRAME_RESULTS logs. If iframes fail to load, the X-Frame-Options rules aren't working — proceed to the next step.

### Step 1.10: Debug X-Frame-Options

If iframes aren't loading:

In Claude Code:
```
The offscreen document iframes are being blocked by X-Frame-Options headers. Verify that:
1. rules.json has declarativeNetRequest rules removing x-frame-options and content-security-policy headers
2. manifest.json declares "declarative_net_request" in the "declarative_net_request" field and "declarativeNetRequest" in permissions
3. The rules target "sub_frame" resource types for all supported platform domains
4. Add a debug rule check: in background.js, on startup, call chrome.declarativeNetRequest.getDynamicRules() and log the result to verify rules are active.

If rules.json static rules don't work, try registering dynamic rules in background.js using chrome.declarativeNetRequest.updateDynamicRules().
```

### Phase 1 Checkpoint

At this point, you should have:
- [ ] Extension loads in Chrome without errors
- [ ] Content script detects products on at least The RealReal
- [ ] Offscreen document loads at least one platform's search results in an iframe
- [ ] Raw (unranked) listings are extracted and logged in the console
- [ ] The side panel appears (even if results aren't rendered yet)

---

## Phase 2: Intelligence (Estimated: 3-5 hours)

### Step 2.1: Build the AI Classifier

Paste "BUILD PROMPT 5: AI Classifier" from the Prompt Library.

**Important:** The classifier needs your Anthropic API key to call Claude. For development, you can hardcode it temporarily, but the production version reads it from chrome.storage.sync.

In Claude Code, after the initial build:
```
Add a temporary development mode to classifier.js. If a global DEV_API_KEY is set, use it instead of reading from chrome.storage.sync. Add a comment marking this for removal before production.
```

**Verify:** Open the browser console and test the heuristic classifier manually:
```javascript
// In the background service worker console
classifyHeuristic({
  title: "CHANEL Classic Medium Double Flap Lambskin Black GHW",
  price: "$4,200",
  source: "eBay"
});
// Should return: { brand: "Chanel", color: "Black", material: "Lambskin", hardware: "Gold", size: "Medium", ... }
```

### Step 2.2: Build the Relevance Scorer

Paste "BUILD PROMPT 6: Relevance Scoring" from the Prompt Library.

**Verify:**
```javascript
// Test in console
const source = { brand: "Chanel", model: "Classic Double Flap", color: "Black", size: "Medium", material: "Lambskin", hardware: "Gold", category: "Handbags" };
const exact = { brand: "Chanel", model: "Classic Double Flap", color: "Black", size: "Medium", material: "Lambskin", hardware: "Gold", category: "Handbags" };
const partial = { brand: "Chanel", model: "Classic Flap", color: "Beige", size: "Small", material: "Caviar Leather", hardware: "Gold", category: "Handbags" };

scoreRelevance(source, exact);   // Should return score > 0.9, label: "Exact Match"
scoreRelevance(source, partial); // Should return score 0.4-0.6, label: "Similar"
```

### Step 2.3: Wire the Classification Pipeline

In Claude Code:
```
Now wire everything together in background.js. When PRODUCT_DETECTED is received:

1. Check classification cache for the page URL
2. If cache miss, call classifyProduct() with the raw product data (use the AI classifier with the image)
3. Cache the result
4. Call generateSearchQueries() to get per-platform optimized queries (or fall back to simple brand + model concatenation if API fails)
5. Build platform search URLs using the generated queries
6. Send SEARCH_PLATFORMS to offscreen document with these URLs
7. When IFRAME_RESULTS come back:
   a. Run classifyHeuristic() on all results (instant)
   b. Filter to results with heuristic confidence > 0.3
   c. For the top 5 results by heuristic score, call classifyBatch() for AI classification
   d. Run scoreRelevance() on all classified results against source attributes
   e. Run filterAndRank() to sort and filter
   f. Send DEAL_RESULTS to content script with classified, scored results

Make sure the content script receives incremental updates — send DEAL_RESULTS after each platform finishes, not just at the end.
```

### Step 2.4: Test the Full Pipeline

1. Set your API key (temporarily in code or via the settings page if built)
2. Navigate to a product on The RealReal
3. Watch the service worker console for:
   - "Source product classified: {...}" log
   - "Search queries generated: {...}" log
   - "Platform X: extracted N listings" log
   - "Platform X: classified N results" log
   - "Platform X: top result score: 0.XX" log
4. Check that results appear in the side panel (even if unstyled)

**Common issues at this stage:**
- API key not reaching the classifier → check how it's passed through messages
- JSON parse errors from Claude API → the response may have markdown fences, ensure you strip them
- Image URL blocked by CORS → for image classification, pass the URL directly to Claude (it fetches it), don't try to download the image in the extension

### Step 2.5: Add API Key Settings

In Claude Code:
```
Build the settings page so users can enter their Anthropic API key. When the "Save" button is clicked:
1. Validate the key by making a minimal test call to Claude (send "Hi" and check for 200 response)
2. If valid, save to chrome.storage.sync with key "md_api_key"
3. Show a green checkmark
4. If invalid, show an error message

Also update the background.js to read the API key from chrome.storage.sync before any API call. If no key is set, send a "SETUP_REQUIRED" message to the content script so it can show a prompt in the panel.
```

### Phase 2 Checkpoint

- [ ] Source products are classified with full attribute objects
- [ ] Search results are classified (heuristic + AI for top candidates)
- [ ] Relevance scores appear on each result
- [ ] Results are sorted by relevance, then price
- [ ] API key can be entered and validated in settings
- [ ] Classification caching works (second visit to same product is instant)

---

## Phase 3: Polish (Estimated: 4-6 hours)

### Step 3.1: Build the Full UI

Paste "BUILD PROMPT 8: Content Script & UI" from the Prompt Library.

This is the largest single build step. The content script UI needs to be comprehensive and polished.

**Verify:** Navigate to a product page. The panel should:
- Slide in smoothly from the right
- Show the detected product with price
- Show AI-classified attribute chips
- Show filter dropdowns
- Show results grouped by platform with relevance scores
- Show attribute match/mismatch chips on each result
- Show price savings badges
- Filtering should work instantly

### Step 3.2: Polish the Attribute Chips

In Claude Code:
```
The attribute chips on each result need to clearly show match status:
- Green chip (✓) for exact match attributes
- Yellow chip (~) for partial match (e.g., adjacent size)
- Red chip (✗) for mismatch
- Grey chip (?) for unknown/missing attributes

The chip label should show the CANDIDATE's value, not the source's. So if the source is "Black" and the candidate is "Beige", the chip shows "✗ Beige" in red.

Also add a click-to-expand on each result card that shows the full relevance breakdown — a mini bar chart showing each attribute's score (brand: 100%, model: 85%, color: 0%, etc.) with the source and candidate values.
```

### Step 3.3: Price Comparison

In Claude Code:
```
Implement price comparison features:
1. For each result, calculate priceDelta vs source product
2. Show green savings badge: "▼ $695 less (14% off)" if cheaper
3. Show subtle red text: "▲ $205 more" if more expensive
4. Handle cross-currency: use the exchange rates from utils/currency.js
5. If currencies differ and we can't convert, show "€3,400 (EUR)" without comparison
6. Add a "Best Deal" highlight — a small gold star or banner on the cheapest exact-match result
```

### Step 3.4: Build the Popup

Paste "BUILD PROMPT 9: Popup & Settings" from the Prompt Library.

**Verify:** Click the extension icon:
- On a product page: shows current product + search status
- On a non-product page: shows idle state with platform list
- Settings link works and opens settings page

### Step 3.5: Error States & Edge Cases

In Claude Code:
```
Add comprehensive error handling to the UI:

1. No API key: Panel shows "Set up your API key to find deals" with a button that opens settings
2. API rate limit: Panel shows "API limit reached, showing basic results" and switches to heuristic-only
3. No results found: Panel shows "No matching items found on other platforms"
4. All platforms failed: Panel shows "Unable to search other platforms right now. Try again later."
5. Product detection failed: Panel doesn't appear (silent — don't show an empty panel)
6. Slow connection: After 5 seconds of no results, show "Still searching... this may take a moment"
7. Platform-specific CAPTCHA: Show "Platform X requires manual login — visit directly" with a link

Also add:
- A retry button on error states
- A manual "Search again" button in the panel header
- Ability to dismiss the panel and have it stay dismissed until next navigation
- Save panel open/closed state per session
```

### Step 3.6: Performance Optimization

In Claude Code:
```
Optimize the extension for performance:

1. Abort search if user navigates away: listen for beforeunload and send cancel message to offscreen document
2. Debounce MutationObserver properly — 1000ms debounce, max 5 attempts
3. Lazy classification: only AI-classify results that are visible in the panel (load more on scroll)
4. Image lazy loading: use loading="lazy" on result thumbnails
5. Don't re-search if the URL hasn't changed (SPA soft navigation that doesn't change the product)
6. Minimize memory: clear offscreen document iframe after extraction
7. Batch DOM reads in content script (avoid layout thrashing)
8. Use chrome.storage.session for current state (faster than local for temporary data)
```

### Phase 3 Checkpoint

- [ ] Panel UI is polished and responsive
- [ ] Filters work instantly on all attributes
- [ ] Price comparison with savings badges works
- [ ] Attribute match chips show colored indicators
- [ ] Error states are handled gracefully
- [ ] Extension popup works in both active and idle states
- [ ] Settings page with API key management works
- [ ] Performance is acceptable (first results in <10 seconds)

---

## Phase 4: Testing & Hardening (Estimated: 2-3 hours)

### Step 4.1: Build Tests

Paste "BUILD PROMPT 10: Integration Testing" from the Prompt Library.

Run the tests:
```bash
# If using Node.js test runner
node --test test/test-taxonomy.js
node --test test/test-classifier.js
node --test test/test-relevance.js
```

### Step 4.2: Manual Testing Across Platforms

Test each platform manually:

| Platform | Test Product | What to Verify |
|----------|-------------|----------------|
| The RealReal | Any Chanel bag | Brand, model, price, condition extracted correctly |
| eBay | Search for "Chanel Classic Flap" | Results extracted from search page, abbreviations decoded |
| Poshmark | Any luxury listing | Brand detection, image extraction |
| Vestiaire | Any Chanel or LV item | Different naming ("Timeless/Classique") handled |
| Grailed | Any designer listing | Menswear items classified correctly |
| Mercari | Any branded item | Low-quality listings handled gracefully |

For each platform, verify:
- [ ] Product page detected automatically
- [ ] Raw data extracted (check console logs)
- [ ] Classification produces reasonable attributes
- [ ] Other platforms' search results load in offscreen iframes
- [ ] Results are ranked by relevance
- [ ] Clicking a result opens the correct URL in a new tab

### Step 4.3: Selector Resilience

In Claude Code:
```
Some platforms may have changed their DOM since these selectors were written. For any platform where extraction fails:

1. Go to the platform's product page in Chrome
2. Right-click on the product title/price/brand → Inspect
3. Note the actual selector (class name, data attribute, etc.)
4. Update the corresponding extractor file with the correct selectors
5. Keep the old selectors as fallbacks — add new ones at the top of the priority list

Also add a debug mode: when the extension is loaded in developer mode, show a small debug overlay in the bottom-left of the page that lists which selectors succeeded and which failed for each field.
```

### Step 4.4: Rate Limit Testing

In Claude Code:
```
Test the rate limiting behavior:
1. Set the hourly API limit to 5 (for testing)
2. Trigger 6 product views rapidly
3. Verify that the 6th view falls back to heuristic-only mode
4. Verify the panel shows a notice about rate limiting
5. Reset the limit to 200 for production
```

---

## Phase 5: Polish & Ship (Estimated: 2-4 hours)

### Step 5.1: Create Icons

In Claude Code:
```
Generate proper extension icons. Create SVG-based icons at 16x16, 48x48, and 128x128 pixels.

Design: Black rounded square with white "M" letterform. Clean, minimal, luxury feel.

Save as PNG files in icons/ directory.
```

Or create them in any design tool (Figma, Sketch, Canva) and save to the icons/ directory.

### Step 5.2: Final Review

In Claude Code:
```
Do a final code review of the entire extension:

1. Remove any hardcoded API keys or debug credentials
2. Remove console.log statements (keep logger.js calls)
3. Ensure all TODO comments are resolved
4. Check that all error messages are user-friendly
5. Verify manifest.json has correct version number
6. Check that all permissions in manifest.json are actually used
7. Ensure no unused files or dependencies
8. Add a LICENSE file (MIT or your preferred license)
9. Add a README.md with installation and usage instructions
```

### Step 5.3: Package for Distribution

```bash
# Create a zip for Chrome Web Store or manual distribution
cd ..
zip -r maisondeux-extension.zip maisondeux-extension/ \
  -x "maisondeux-extension/.git/*" \
  -x "maisondeux-extension/test/*" \
  -x "maisondeux-extension/node_modules/*"
```

### Step 5.4: Load Final Build

1. Go to `chrome://extensions/`
2. Remove the old unpacked version
3. Click "Load unpacked" and select the directory
4. Test the full flow one more time end-to-end

---

## Troubleshooting Guide

### Extension won't load
- Check manifest.json for JSON syntax errors
- Ensure all files referenced in manifest exist
- Check chrome://extensions for specific error messages

### Content script doesn't run
- Check that the URL matches the patterns in manifest.json content_scripts.matches
- Open the page's DevTools console (not the extension's) and look for errors
- Try navigating to a different product page

### Offscreen iframes don't load
- Check that declarativeNetRequest rules are registered (log them in background.js)
- Try accessing the platform directly in Chrome — if you're not logged in, the iframe won't show authenticated content
- Some platforms may block iframes even with header stripping — check the network tab for CSP violations

### Claude API calls fail
- Verify API key is valid: run a test call with curl
- Check for rate limiting (429 responses)
- Ensure the anthropic-dangerous-direct-browser-access header is included
- Check that the model name is correct: claude-sonnet-4-20250514

### Classification seems wrong
- Check the raw product data being sent to the classifier (log it)
- Test the heuristic classifier independently with the same input
- If AI classification is wrong, the prompt may need adjustment — test in Claude.ai directly

### Results are slow
- Check which step is taking the longest (add timing logs)
- Most likely: iframe loading (network) or API calls (Claude)
- If iframes are slow: reduce timeout to 8 seconds, skip slow platforms
- If API is slow: use Haiku instead of Sonnet for batch classification

### Panel doesn't appear
- Check that content-style.css is being injected (look for <style> or <link> in page head)
- Check z-index conflicts — some sites use very high z-index values
- Check that the content script's panel rendering code is reached (add a log)

---

## Cost Tracking

Track your spend as you develop:

| Activity | Model | Approx Cost |
|----------|-------|-------------|
| Building with Claude Code | Claude Sonnet | $5-15 total |
| Testing source classification | Claude Sonnet (vision) | ~$0.006 per call |
| Testing batch classification | Claude Sonnet/Haiku | ~$0.003-0.012 per call |
| Testing query generation | Claude Haiku | ~$0.001 per call |
| Runtime: typical product view | Mixed | ~$0.02-0.04 per view |

Monitor at: https://console.anthropic.com/settings/usage

---

## What's Next (Post-V1)

Once V1 is working:
1. **More platforms**: Rebag, Fashionphile, 1stDibs, Depop
2. **eBay Partner API**: Official API for better eBay results + affiliate revenue
3. **Price alerts**: Notify when a matching item appears below target price
4. **Backend service on Railway**: Deploy a Node.js API on Railway that handles Claude API calls server-side — eliminates the need for users to provide their own API key. Use Neon (Postgres) to store classification cache, user preferences, and usage tracking across devices.
5. **Chrome Web Store**: Publish for public distribution ($5 one-time fee)
6. **Community index**: Anonymized listing data shared across users (opt-in), stored in Neon
7. **Browser support**: Firefox, Safari, Edge
