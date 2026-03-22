### BUILD PROMPT 9: Popup & Settings

```
Create the extension popup (popup/) and settings page (settings/).

POPUP (popup/popup.html + popup.js + popup.css):
- 340px wide
- Header: MaisonDeux logo + "Second-hand deal finder" tagline
- Idle state (not on a product page): explanatory text + grid of supported platform tags
- Active state (on a product page): current product info + search status
- Settings link at bottom
- Clean, minimal luxury aesthetic matching the side panel

SETTINGS (settings/settings.html + settings.js + settings.css):
- Full-page settings accessible from popup
- Sections:
  1. API Key: password input for Anthropic API key, "Save" button, validation indicator
  2. Platforms: toggle switches for each platform (on/off)
  3. Defaults: default relevance threshold dropdown, default filter selections
  4. Usage: API calls this month, estimated cost, classification count
  5. Debug: expandable log viewer showing last 200 log entries from logger.js
  6. About: version, links
- Settings are saved to chrome.storage.sync immediately on change
- API key validation: make a minimal test call to Claude API with a simple prompt
```

---

