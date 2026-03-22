### BUILD PROMPT 8: Content Script & UI

```
Create the content script (content-script.js) and its styles (content-style.css) for MaisonDeux.

The content script has two jobs:
1. Detect and extract the product on the current page
2. Render and manage the slide-in results panel

PART 1 — PRODUCT DETECTION:

- Check URL against platform patterns to determine if this is a product page
- If yes, wait for DOM to settle (MutationObserver with 1-second debounce, plus 2-second initial delay)
- Call the appropriate platform extractor to get raw product data
- Send PRODUCT_DETECTED to Background
- Only detect once per page navigation (set a flag)

PART 2 — SLIDE-IN PANEL:

Build a fixed-position panel (400px wide, full height, right side, z-index 2147483647) with:

Header section:
- MaisonDeux logo (black square with "M" + "MaisonDeux" text)
- Close button (×)

Product context section:
- "Currently viewing on {platform}" subtitle
- Product name (brand — name)
- Current price
- AI-classified attribute chips (appear progressively as classification completes)

Filter section (appears after first results arrive):
- Dropdown selectors for: Color, Size, Material, Hardware, Condition
- Each dropdown shows "Any" by default, then available values
- Active filters get a visual indicator (dark border)
- "Clear N filters" link when filters are active
- Relevance threshold slider (30% / 50% / 70% / 85%)

Status section:
- Spinner + "Searching N platforms…" during search
- Updates to "Checked N platforms, searching more…" as results arrive
- "✓ N deals found across N platforms" when complete

Results section (scrollable):
- Grouped by platform
- Platform header: logo, name, result count, "View all →" link to full search page
- Individual listing cards:
  - Thumbnail image (56x56, rounded corners)
  - Title (truncated with ellipsis)
  - Price (bold) + savings badge (green if cheaper: "▼ $695 less (14% off)")
  - Relevance label + score badge (color-coded: green ≥85%, yellow ≥70%, orange ≥50%, red <50%)
  - Attribute match chips: small colored pills showing ✓ Black (green), ~ Small (yellow), ✗ Caviar (red)
  - Click to open listing in new tab
- Results appear with a fade-in animation as each platform completes

Footer:
- "Powered by MaisonDeux" link

The panel should:
- Slide in from the right with a cubic-bezier easing (0.16, 1, 0.3, 1)
- Have a subtle left border and box-shadow
- Use a neutral, luxury aesthetic: off-white background (#fafaf8), dark text, minimal color
- Font: DM Sans (loaded via Google Fonts @import in CSS)
- Be completely self-contained — all styles scoped to #maisondeux-panel to avoid conflicts with host page
- Support light scrollbar styling
- Be responsive to different viewport heights

Listen for DEAL_RESULTS messages from Background:
- If complete: false, append results to the appropriate platform section
- If complete: true, hide loading spinner, show final count
- Apply current filters to all displayed results
- Re-filter instantly when any dropdown changes
```

---

