import { useEffect, useMemo, useRef, useState } from "react";
import type { CanonicalListing } from "@luxefinder/shared";
import "./App.css";

type SearchStatus = "pending" | "processing" | "completed" | "failed";
type ApiSearch = {
  status: SearchStatus;
  image_analysis?: {
    brand?: string | null;
    category?: string | null;
    subcategory?: string | null;
    model_name?: string | null;
    color_primary?: string | null;
    color_secondary?: string | null;
  } | null;
  size_text?: string | null;
};
type PollResponse = {
  search: ApiSearch;
  results: Array<{ listing: CanonicalListing }>;
  disclaimer: string;
};
type RowKey = "exact" | "brand" | "different";
type RowState = Record<RowKey, boolean>;

const ROW_PREVIEW_COUNT = 4;
const ROW_TARGET_COUNT = 6;
const SETTINGS_KEY = "maisondeux-settings";
const DEFAULT_STATUS = "Ready to search.";

type StoredSettings = {
  shopgoodwill_access_token?: string;
  shopgoodwill_username?: string;
  shopgoodwill_password?: string;
  ebay_oauth_token?: string;
  chrono24_api_key?: string;
  therealreal_api_key?: string;
  vestiaire_api_key?: string;
  search_precision?: number;
};

function formatMoney(value: number | null | undefined): string {
  return "$" + Number(value || 0).toLocaleString();
}

function clampPrecision(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 75;
  return Math.min(100, Math.max(10, Math.round(n)));
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: unknown): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1);
}

function hasTokenOverlap(tokensA: string[], tokensB: string[]): boolean {
  if (!tokensA.length || !tokensB.length) return false;
  const b = new Set(tokensB);
  return tokensA.some((token) => b.has(token));
}

function modelSimilarityScore(
  item: CanonicalListing,
  analysis?: NonNullable<ApiSearch["image_analysis"]> | null
): number {
  if (!analysis) return 0;
  const haystack = normalizeText((item.title || "") + " " + (item.subcategory || ""));
  const model = normalizeText(analysis.model_name || "");
  const subcategory = normalizeText(analysis.subcategory || "");
  let score = 0;
  if (model && haystack.includes(model)) score += 3;
  if (!model && subcategory && haystack.includes(subcategory)) score += 2;
  if (model && hasTokenOverlap(tokenize(model), tokenize(haystack))) score += 1;
  if (subcategory && hasTokenOverlap(tokenize(subcategory), tokenize(haystack))) score += 1;
  if (analysis.category && item.category === analysis.category) score += 1;
  return score;
}

function buildDetectedLine(analysis?: ApiSearch["image_analysis"] | null, sizeText?: string | null): string {
  if (!analysis) return "";
  const brand = analysis.brand || "Unknown brand";
  const model = analysis.model_name || analysis.subcategory || "unknown model";
  const category = analysis.category || "accessory";
  const attributes = ["Brand: " + brand, "Model: " + model, "Category: " + category];
  if (sizeText && String(sizeText).trim()) attributes.push("Size: " + String(sizeText).trim());
  const primary = analysis.color_primary && String(analysis.color_primary).trim();
  const secondary = analysis.color_secondary && String(analysis.color_secondary).trim();
  const colorValue = primary && secondary ? primary + ", " + secondary : primary || secondary;
  if (colorValue) attributes.push("Color: " + colorValue);
  return "Detected: " + attributes.join(" / ");
}

function getStoredSettings(): StoredSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as StoredSettings;
  } catch {
    return {};
  }
}

function buildRuntimeCredentials(settings: StoredSettings): Record<string, unknown> | undefined {
  const credentials: Record<string, unknown> = {};
  if (settings.ebay_oauth_token) credentials.ebay = { oauth_token: settings.ebay_oauth_token };
  if (settings.shopgoodwill_access_token || settings.shopgoodwill_username || settings.shopgoodwill_password) {
    credentials.shopgoodwill = {
      access_token: settings.shopgoodwill_access_token || undefined,
      username: settings.shopgoodwill_username || undefined,
      password: settings.shopgoodwill_password || undefined
    };
  }
  if (settings.chrono24_api_key) credentials.chrono24 = { api_key: settings.chrono24_api_key };
  if (settings.therealreal_api_key) credentials.therealreal = { api_key: settings.therealreal_api_key };
  if (settings.vestiaire_api_key) credentials.vestiaire = { api_key: settings.vestiaire_api_key };
  credentials.search = { precision: clampPrecision(settings.search_precision ?? 75) };
  return Object.keys(credentials).length ? credentials : undefined;
}

function buildRowBuckets(items: CanonicalListing[], analysis?: ApiSearch["image_analysis"] | null): Record<RowKey, CanonicalListing[]> {
  if (!analysis) {
    return {
      exact: items.slice(0, ROW_TARGET_COUNT),
      brand: items.slice(ROW_TARGET_COUNT, ROW_TARGET_COUNT * 2),
      different: items.slice(ROW_TARGET_COUNT * 2, ROW_TARGET_COUNT * 3)
    };
  }
  const detectedBrand = normalizeText(analysis.brand || "");
  const remaining = items.slice();
  const used = new Set<string>();
  const rows: Record<RowKey, CanonicalListing[]> = { exact: [], brand: [], different: [] };
  const isExactBrand = (item: CanonicalListing): boolean =>
    Boolean(detectedBrand) && normalizeText(item.brand || "") === detectedBrand;
  const takeForRow = (row: RowKey, predicate: (item: CanonicalListing) => boolean): void => {
    for (const item of remaining) {
      const id = item.listing_id;
      if (used.has(id)) continue;
      if (!predicate(item)) continue;
      used.add(id);
      rows[row].push(item);
      if (rows[row].length >= ROW_TARGET_COUNT) return;
    }
  };

  takeForRow("exact", (item) => isExactBrand(item) && modelSimilarityScore(item, analysis) >= 3);
  if (rows.exact.length < ROW_TARGET_COUNT) {
    takeForRow("exact", (item) => isExactBrand(item) && modelSimilarityScore(item, analysis) >= 2);
  }
  if (rows.exact.length < ROW_TARGET_COUNT) {
    takeForRow("exact", (item) => isExactBrand(item) && modelSimilarityScore(item, analysis) >= 1);
  }

  takeForRow("brand", (item) => isExactBrand(item) && modelSimilarityScore(item, analysis) >= 1);
  if (rows.brand.length < ROW_TARGET_COUNT) takeForRow("brand", (item) => isExactBrand(item));

  takeForRow("different", (item) => !isExactBrand(item) && modelSimilarityScore(item, analysis) >= 2);
  if (rows.different.length < ROW_TARGET_COUNT) {
    takeForRow("different", (item) => !isExactBrand(item) && modelSimilarityScore(item, analysis) >= 1);
  }

  (["exact", "brand", "different"] as RowKey[]).forEach((row) => {
    if (rows[row].length < ROW_TARGET_COUNT) takeForRow(row, () => true);
  });
  return rows;
}

export function App() {
  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [metaLine, setMetaLine] = useState("");
  const [disclaimer, setDisclaimer] = useState("");
  const [detectedLine, setDetectedLine] = useState("");
  const [queryText, setQueryText] = useState("");
  const [sizeText, setSizeText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sortMode, setSortMode] = useState("best");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [searchId, setSearchId] = useState<string | null>(null);
  const [results, setResults] = useState<CanonicalListing[]>([]);
  const [analysis, setAnalysis] = useState<ApiSearch["image_analysis"] | null>(null);
  const [expandedRows, setExpandedRows] = useState<RowState>({ exact: false, brand: false, different: false });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<StoredSettings>(() => getStoredSettings());
  const [searchInProgress, setSearchInProgress] = useState(false);
  const pollTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimer.current) window.clearInterval(pollTimer.current);
    };
  }, []);

  const sortedFiltered = useMemo(() => {
    let items = results.slice();
    if (verifiedOnly) items = items.filter((item) => item.authentication_status === "platform_authenticated");
    if (sortMode === "low") items.sort((a, b) => a.price_usd - b.price_usd);
    if (sortMode === "high") items.sort((a, b) => b.price_usd - a.price_usd);
    if (sortMode === "trust") items.sort((a, b) => b.trust_score - a.trust_score);
    return items;
  }, [results, verifiedOnly, sortMode]);

  const buckets = useMemo(() => buildRowBuckets(sortedFiltered, analysis), [sortedFiltered, analysis]);

  async function pollSearch(id: string): Promise<void> {
    if (pollTimer.current) window.clearInterval(pollTimer.current);
    pollTimer.current = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/search/${id}`);
        if (!response.ok) {
          setStatus("Polling error. Try again.");
          if (pollTimer.current) window.clearInterval(pollTimer.current);
          pollTimer.current = null;
          return;
        }
        const data = (await response.json()) as PollResponse;
        const search = data.search;
        const listings = (data.results || []).map((entry) => entry.listing).filter(Boolean);
        setResults(listings);
        setDisclaimer(data.disclaimer || "");
        setAnalysis(search?.image_analysis ?? null);
        setDetectedLine(buildDetectedLine(search?.image_analysis, search?.size_text));
        setMetaLine(String(listings.length) + " listings • status: " + search.status);
        if (search.status === "completed" || search.status === "failed") {
          setStatus(search.status === "completed" ? "Search completed." : "Search failed.");
          if (pollTimer.current) window.clearInterval(pollTimer.current);
          pollTimer.current = null;
          setSearchInProgress(false);
        } else {
          setStatus("Searching marketplaces...");
        }
      } catch {
        setStatus("Polling error. Try again.");
        if (pollTimer.current) window.clearInterval(pollTimer.current);
        pollTimer.current = null;
        setSearchInProgress(false);
      }
    }, 1500);
  }

  async function startTextSearch(): Promise<void> {
    const q = queryText.trim();
    if (!q) {
      setStatus("Enter a text query first.");
      return;
    }
    setExpandedRows({ exact: false, brand: false, different: false });
    setAnalysis(null);
    setDetectedLine("");
    setStatus("Starting text search...");
    setSearchInProgress(true);
    try {
      const response = await fetch("/api/v1/search/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query_text: q,
          category: "accessory",
          runtime_credentials: buildRuntimeCredentials(settings)
        })
      });
      if (!response.ok) {
        setStatus("Text search failed.");
        setSearchInProgress(false);
        return;
      }
      const data = (await response.json()) as { search_id?: string };
      if (!data.search_id) {
        setStatus("Text search failed.");
        setSearchInProgress(false);
        return;
      }
      setSearchId(data.search_id);
      await pollSearch(data.search_id);
    } catch {
      setStatus("Network or server error. Try again.");
      setSearchInProgress(false);
    }
  }

  async function startImageSearch(): Promise<void> {
    if (!file) {
      setStatus("Choose an image file first.");
      return;
    }
    setExpandedRows({ exact: false, brand: false, different: false });
    setAnalysis(null);
    setDetectedLine("");
    setStatus("Uploading image...");
    setSearchInProgress(true);
    try {
      const formData = new FormData();
      const trimmedSize = sizeText.trim();
      if (trimmedSize) formData.append("size_text", trimmedSize);
      const runtimeCredentials = buildRuntimeCredentials(settings);
      if (runtimeCredentials) formData.append("runtime_credentials", JSON.stringify(runtimeCredentials));
      formData.append("image", file);
      const response = await fetch("/api/v1/search/image-upload", { method: "POST", body: formData });
      if (!response.ok) {
        setStatus("Image upload/search failed.");
        setSearchInProgress(false);
        return;
      }
      const data = (await response.json()) as { search_id?: string };
      if (!data.search_id) {
        setStatus("Image upload/search failed.");
        setSearchInProgress(false);
        return;
      }
      setSearchId(data.search_id);
      await pollSearch(data.search_id);
    } catch {
      setStatus("Network or server error. Try again.");
      setSearchInProgress(false);
    }
  }

  function saveSettings(): void {
    const next = { ...settings, search_precision: clampPrecision(settings.search_precision ?? 75) };
    setSettings(next);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    setStatus("Settings saved for this browser.");
  }

  function clearSettings(): void {
    localStorage.removeItem(SETTINGS_KEY);
    setSettings({ search_precision: 75 });
    setStatus("Settings cleared.");
  }

  const renderRowSection = (rowKey: RowKey, title: string, items: CanonicalListing[]) => {
    const expanded = expandedRows[rowKey];
    const visible = expanded ? items : items.slice(0, ROW_PREVIEW_COUNT);
    return (
      <section className="row-section">
        <div className="row-head">
          <div className="row-title">
            {title} ({items.length})
          </div>
          {items.length > ROW_PREVIEW_COUNT ? (
            <button
              className="more-btn"
              type="button"
              onClick={() => setExpandedRows((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }))}
            >
              {expanded ? "Show less" : "More"}
            </button>
          ) : null}
        </div>
        <div className="row-grid">
          {visible.map((item) => (
            <article className="listing" key={item.listing_id}>
              <img src={item.images?.[0] || ""} alt={item.title || "listing"} />
              <div className="body">
                <div className="row">
                  <span className="platform">{item.platform}</span>
                  <span className="price">{formatMoney(item.price_usd)}</span>
                </div>
                <div className="title">{item.title || ""}</div>
                <div className="sub">
                  {item.condition || "unknown"} • {item.brand || ""}
                </div>
                <div className="trust">Trust: {item.trust_score || 0}/100</div>
                <a className="footer-link" href={item.platform_listing_url} target="_blank" rel="noopener noreferrer">
                  View on {item.platform}
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="wrap">
      <section className="hero">
        <h1>maisonDeux</h1>
        <p>
          Upload one photo and instantly search luxury resale marketplaces in parallel. Compare trusted listings,
          condition, and pricing in one gorgeous feed.
        </p>

        <div className="toolbar">
          <div className="input-row">
            <input
              type="text"
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              placeholder="Try: Rolex Submariner, Chanel Flap, Cartier Love..."
            />
            <button onClick={() => void startTextSearch()} disabled={searchInProgress}>
              Search by Text
            </button>
          </div>
          <div className="input-row">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <button className="secondary" onClick={() => void startImageSearch()} disabled={searchInProgress}>
              Search by Image
            </button>
          </div>
          <div className="input-row">
            <input
              type="text"
              value={sizeText}
              onChange={(event) => setSizeText(event.target.value)}
              placeholder="Optional size text (e.g., US 10, EU 42, Medium)"
            />
            <span className="chip">Used to refine image search</span>
          </div>
        </div>

        <div className="meta">
          <span className="chip">Fashion, Bags, Watches, Jewelry</span>
          <span className="chip">10 Marketplace Connectors</span>
          <span className="chip">Image-first discovery</span>
        </div>

        <div className="controls">
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
            <option value="best">Sort: Best Match</option>
            <option value="low">Sort: Price Low to High</option>
            <option value="high">Sort: Price High to Low</option>
            <option value="trust">Sort: Trust Score</option>
          </select>
          <label className="chip">
            <input type="checkbox" checked={verifiedOnly} onChange={(event) => setVerifiedOnly(event.target.checked)} />{" "}
            Verified only
          </label>
          <button className="secondary" type="button" onClick={() => setSettingsOpen((prev) => !prev)}>
            Marketplace Settings
          </button>
        </div>

        <div id="settingsPanel" className={`settings ${settingsOpen ? "open" : ""}`}>
          <h3>Per-user marketplace credentials (saved in your browser)</h3>
          <div className="settings-grid">
            <input
              type="text"
              placeholder="ShopGoodwill access token (optional)"
              value={settings.shopgoodwill_access_token || ""}
              onChange={(event) => setSettings((prev) => ({ ...prev, shopgoodwill_access_token: event.target.value.trim() }))}
            />
            <input
              type="text"
              placeholder="ShopGoodwill username (optional)"
              value={settings.shopgoodwill_username || ""}
              onChange={(event) => setSettings((prev) => ({ ...prev, shopgoodwill_username: event.target.value.trim() }))}
            />
            <input
              type="password"
              placeholder="ShopGoodwill password (optional)"
              value={settings.shopgoodwill_password || ""}
              onChange={(event) => setSettings((prev) => ({ ...prev, shopgoodwill_password: event.target.value.trim() }))}
            />
            <input
              type="text"
              placeholder="eBay OAuth token (optional)"
              value={settings.ebay_oauth_token || ""}
              onChange={(event) => setSettings((prev) => ({ ...prev, ebay_oauth_token: event.target.value.trim() }))}
            />
            <input
              type="text"
              placeholder="Chrono24 API key (optional)"
              value={settings.chrono24_api_key || ""}
              onChange={(event) => setSettings((prev) => ({ ...prev, chrono24_api_key: event.target.value.trim() }))}
            />
            <input
              type="text"
              placeholder="The RealReal API key (optional)"
              value={settings.therealreal_api_key || ""}
              onChange={(event) => setSettings((prev) => ({ ...prev, therealreal_api_key: event.target.value.trim() }))}
            />
            <input
              type="text"
              placeholder="Vestiaire API key (optional)"
              value={settings.vestiaire_api_key || ""}
              onChange={(event) => setSettings((prev) => ({ ...prev, vestiaire_api_key: event.target.value.trim() }))}
            />
            <input
              type="number"
              min={10}
              max={100}
              step={1}
              placeholder="Search precision 10-100 (default 75)"
              value={String(clampPrecision(settings.search_precision ?? 75))}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, search_precision: clampPrecision(Number(event.target.value || 75)) }))
              }
            />
          </div>
          <div className="settings-actions">
            <button type="button" onClick={saveSettings}>
              Save Settings
            </button>
            <button className="secondary" type="button" onClick={clearSettings}>
              Clear Settings
            </button>
          </div>
        </div>

        <div className="status">{status}</div>
        <div id="analysisLine" className="status">
          {detectedLine}
        </div>
        <div id="metaLine" className="status">
          {metaLine}
        </div>
        {searchId ? <div className="status">Search: {searchId}</div> : null}
      </section>

      <section className="grid">
        {sortedFiltered.length ? (
          <>
            {renderRowSection("exact", "Exact brand and model", buckets.exact)}
            {renderRowSection("brand", "Exact brand, similar model", buckets.brand)}
            {renderRowSection("different", "Different brand, similar model", buckets.different)}
          </>
        ) : null}
      </section>
      {!sortedFiltered.length ? (
        <div className="empty">No results yet. Start with image upload or text search above.</div>
      ) : null}
      <div className="disclaimer">{disclaimer}</div>
    </div>
  );
}
