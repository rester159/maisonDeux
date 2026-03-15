import { useEffect, useMemo, useRef, useState } from "react";
import type { CanonicalListing } from "@luxefinder/shared";
import "./App.css";
import { inferBrandFromText } from "./brand-reference";

type SearchStatus = "pending" | "processing" | "completed" | "failed";
type ApiSearch = {
  status: SearchStatus;
  constructed_query?: string | null;
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

type ListingAttributes = {
  brand: string;
  model: string;
  color: string;
  price: number;
};
type StandardizedItemFields = {
  brand: string;
  brandConfidence: number;
  brandSource: string;
  model: string;
  category: string;
  color: string;
  size: string;
  condition: string;
  verified: boolean;
  newAtRetail: string;
};
const MODEL_STOPWORDS = new Set([
  "new",
  "used",
  "with",
  "without",
  "size",
  "bag",
  "dress",
  "watch",
  "shoes",
  "shoe",
  "jacket",
  "coat",
  "accessory",
  "item",
  "authentic",
  "vintage",
  "nwt",
  "nwot"
]);
const COLOR_WORDS = [
  "black",
  "white",
  "red",
  "blue",
  "green",
  "brown",
  "beige",
  "tan",
  "pink",
  "purple",
  "yellow",
  "orange",
  "gold",
  "silver",
  "grey",
  "gray",
  "navy",
  "burgundy",
  "cream",
  "ivory"
];
const SIMILARITY_STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "item",
  "authentic",
  "vintage",
  "new",
  "used",
  "size",
  "bag",
  "bags",
  "dress",
  "wallet",
  "wallets",
  "accessory",
  "accessories"
]);

function extractListingAttributes(item: CanonicalListing): ListingAttributes {
  const brand = item.brand || "Unknown brand";
  const model = item.title?.trim()
    ? item.title.trim().split(/\s+/).slice(0, 6).join(" ")
    : "unknown model";
  const color = item.color || "unknown color";
  const price = Number(item.price_usd || 0);
  return { brand, model, color, price };
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function inferModel(item: CanonicalListing): string {
  const title = (item.title || "").trim();
  if (!title) return "Unknown";
  const brand = normalizeText(inferBrand(item));
  const tokens = title
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !brand || !normalizeText(token).includes(brand))
    .filter((token) => token.length >= 3)
    .filter((token) => !MODEL_STOPWORDS.has(token.toLowerCase()));
  if (!tokens.length) return "Unknown";
  return titleCase(tokens.slice(0, 3).join(" "));
}

function inferBrand(item: CanonicalListing): string {
  const brandMatch = inferBrandFromText({
    title: item.title,
    description: item.description,
    sellerBrand: item.brand
  });
  return brandMatch.brand ?? "Unknown";
}

function inferColor(item: CanonicalListing): string {
  if (item.color) return titleCase(String(item.color));
  const haystack = normalizeText((item.title || "") + " " + (item.description || ""));
  const match = COLOR_WORDS.find((color) => haystack.includes(color));
  return match ? titleCase(match) : "Unknown";
}

function inferSize(item: CanonicalListing): string {
  if (item.size && String(item.size).trim()) return String(item.size).trim();
  const title = String(item.title || "");
  const sizeMatch =
    title.match(/\b(?:US|EU|UK)\s?\d{1,2}(?:\.\d)?\b/i) ||
    title.match(/\bsize\s+([a-z0-9.\-\/]+)\b/i) ||
    title.match(/\b(XS|S|M|L|XL|XXL)\b/i);
  if (!sizeMatch) return "Unknown";
  return (sizeMatch[0] || sizeMatch[1] || "").trim();
}

function formatCategory(item: CanonicalListing): string {
  const raw = item.subcategory || item.category || "accessory";
  return titleCase(String(raw).replace(/_/g, " "));
}

function formatCondition(item: CanonicalListing): string {
  if (item.condition_raw && String(item.condition_raw).trim()) return String(item.condition_raw).trim();
  if (item.condition) return titleCase(String(item.condition).replace(/_/g, " "));
  return "Unknown";
}

function formatRetailWithDiscount(item: CanonicalListing): string {
  const retail = Number(item.estimated_retail_price_usd ?? 0);
  const price = Number(item.price_usd ?? 0);
  if (!Number.isFinite(retail) || retail <= 0 || !Number.isFinite(price) || price <= 0) return "Unavailable";
  const discountPct = Math.round(((retail - price) / retail) * 100);
  if (discountPct >= 0) return `${formatMoney(retail)} (${discountPct}% off)`;
  return `${formatMoney(retail)} (${Math.abs(discountPct)}% above)`;
}

function extractStandardizedItemFields(item: CanonicalListing): StandardizedItemFields {
  const brandMatch = inferBrandFromText({
    title: item.title,
    description: item.description,
    sellerBrand: item.brand
  });
  const brand = brandMatch.brand ?? "Unknown";
  return {
    brand,
    brandConfidence: brandMatch.confidence,
    brandSource: brandMatch.source,
    model: inferModel(item),
    category: formatCategory(item),
    color: inferColor(item),
    size: inferSize(item),
    condition: formatCondition(item),
    verified: item.authentication_status === "platform_authenticated",
    newAtRetail: formatRetailWithDiscount(item)
  };
}

function hasTokenOverlap(tokensA: string[], tokensB: string[]): boolean {
  if (!tokensA.length || !tokensB.length) return false;
  const b = new Set(tokensB);
  return tokensA.some((token) => b.has(token));
}

function similarityTokens(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 2 && !SIMILARITY_STOPWORDS.has(token));
}

function toWeightedVector(textParts: Array<{ text: string; weight: number }>): Map<string, number> {
  const vector = new Map<string, number>();
  for (const part of textParts) {
    const tokens = similarityTokens(part.text);
    for (let i = 0; i < tokens.length; i += 1) {
      const unigram = tokens[i];
      vector.set(unigram, (vector.get(unigram) ?? 0) + part.weight);
      if (i + 1 < tokens.length) {
        const bigram = `${tokens[i]}_${tokens[i + 1]}`;
        vector.set(bigram, (vector.get(bigram) ?? 0) + part.weight * 1.35);
      }
    }
  }
  return vector;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  if (!a.size || !b.size) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const value of a.values()) normA += value * value;
  for (const value of b.values()) normB += value * value;
  for (const [key, valueA] of a.entries()) {
    const valueB = b.get(key);
    if (valueB) dot += valueA * valueB;
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function detectedIntentVector(analysis: NonNullable<ApiSearch["image_analysis"]>): Map<string, number> {
  return toWeightedVector([
    { text: analysis.model_name || "", weight: 3.2 },
    { text: analysis.subcategory || "", weight: 2.4 },
    { text: analysis.category || "", weight: 1.5 },
    { text: analysis.color_primary || "", weight: 1.1 },
    { text: analysis.color_secondary || "", weight: 0.9 }
  ]);
}

function listingSimilarityVector(item: CanonicalListing): Map<string, number> {
  const standardized = extractStandardizedItemFields(item);
  return toWeightedVector([
    { text: standardized.model, weight: 3.0 },
    { text: standardized.category, weight: 2.0 },
    { text: item.title || "", weight: 1.8 },
    { text: item.description || "", weight: 1.1 },
    { text: standardized.color, weight: 0.8 }
  ]);
}

function modelSimilarityScore(
  item: CanonicalListing,
  analysis?: NonNullable<ApiSearch["image_analysis"]> | null
): number {
  if (!analysis) return 0;
  const standardized = extractStandardizedItemFields(item);
  const haystack = normalizeText(
    [item.title || "", standardized.model, standardized.color, standardized.category].join(" ")
  );
  const model = normalizeText(analysis.model_name || "");
  const subcategory = normalizeText(analysis.subcategory || "");
  const lexicalBoost =
    (model && haystack.includes(model) ? 0.22 : 0) +
    (!model && subcategory && haystack.includes(subcategory) ? 0.12 : 0) +
    (model && hasTokenOverlap(tokenize(model), tokenize(haystack)) ? 0.1 : 0) +
    (subcategory && hasTokenOverlap(tokenize(subcategory), tokenize(haystack)) ? 0.08 : 0) +
    (analysis.category && item.category === analysis.category ? 0.08 : 0);
  const vectorScore = cosineSimilarity(detectedIntentVector(analysis), listingSimilarityVector(item));
  return Math.min(1, vectorScore + lexicalBoost);
}

function buildDetectedLine(analysis?: ApiSearch["image_analysis"] | null, sizeText?: string | null): string {
  if (!analysis) return "";
  const brand = analysis.brand || "Unknown brand";
  const model = analysis.model_name || "unknown model";
  const category = analysis.category || "accessory";
  const attributes = ["Brand: " + brand, "Model: " + model, "Category: " + category];
  if (sizeText && String(sizeText).trim()) attributes.push("Size: " + String(sizeText).trim());
  const primary = analysis.color_primary && String(analysis.color_primary).trim();
  const secondary = analysis.color_secondary && String(analysis.color_secondary).trim();
  const colorValue = primary && secondary ? primary + ", " + secondary : primary || secondary;
  if (colorValue) attributes.push("Color: " + colorValue);
  return "Detected: " + attributes.join(" / ");
}

function buildRetailSummary(items: CanonicalListing[]): string {
  const prices = items
    .map((item) => item.estimated_retail_price_usd)
    .filter((value): value is number => value !== null && value !== undefined && Number.isFinite(Number(value)))
    .map((value) => Number(value))
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
  if (!prices.length) return "Estimated new retail: unavailable";
  const median = prices[Math.floor(prices.length / 2)];
  const min = prices[0];
  const max = prices[prices.length - 1];
  if (Math.abs(max - min) <= Math.max(25, median * 0.08)) {
    return `Estimated new retail: ${formatMoney(median)}`;
  }
  return `Estimated new retail: ${formatMoney(median)} (range ${formatMoney(min)} - ${formatMoney(max)})`;
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
  const byPriceAsc = (a: CanonicalListing, b: CanonicalListing) =>
    extractListingAttributes(a).price - extractListingAttributes(b).price;
  if (!analysis) {
    return {
      exact: items.slice(0, ROW_TARGET_COUNT).sort(byPriceAsc),
      brand: items.slice(ROW_TARGET_COUNT, ROW_TARGET_COUNT * 2).sort(byPriceAsc),
      different: items.slice(ROW_TARGET_COUNT * 2, ROW_TARGET_COUNT * 3).sort(byPriceAsc)
    };
  }
  const detectedBrand = normalizeText(analysis.brand || "");
  const remaining = items.slice();
  const used = new Set<string>();
  const rows: Record<RowKey, CanonicalListing[]> = { exact: [], brand: [], different: [] };
  const isExactBrand = (item: CanonicalListing): boolean =>
    Boolean(detectedBrand) && normalizeText(extractStandardizedItemFields(item).brand) === detectedBrand;
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

  takeForRow("exact", (item) => isExactBrand(item) && modelSimilarityScore(item, analysis) >= 0.64);
  if (rows.exact.length < ROW_TARGET_COUNT) {
    takeForRow("exact", (item) => isExactBrand(item) && modelSimilarityScore(item, analysis) >= 0.5);
  }
  if (rows.exact.length < ROW_TARGET_COUNT) {
    takeForRow("exact", (item) => isExactBrand(item) && modelSimilarityScore(item, analysis) >= 0.36);
  }

  takeForRow("brand", (item) => isExactBrand(item) && modelSimilarityScore(item, analysis) >= 0.28);
  if (rows.brand.length < ROW_TARGET_COUNT) takeForRow("brand", (item) => isExactBrand(item));

  takeForRow("different", (item) => !isExactBrand(item) && modelSimilarityScore(item, analysis) >= 0.42);
  if (rows.different.length < ROW_TARGET_COUNT) {
    takeForRow("different", (item) => !isExactBrand(item) && modelSimilarityScore(item, analysis) >= 0.3);
  }

  (["exact", "brand", "different"] as RowKey[]).forEach((row) => {
    if (rows[row].length < ROW_TARGET_COUNT) {
      if (row === "different") {
        takeForRow("different", (item) => !isExactBrand(item));
      } else {
        takeForRow(row, () => true);
      }
    }
    rows[row].sort(byPriceAsc);
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
  const [activeSearchMode, setActiveSearchMode] = useState<"text" | "image" | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pollTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimer.current) window.clearInterval(pollTimer.current);
    };
  }, []);

  useEffect(() => {
    const orientation = (screen as { orientation?: { lock?: (mode: string) => Promise<void> } }).orientation;
    if (!orientation?.lock) return;
    orientation.lock("portrait").catch(() => {
      // Not all browsers allow orientation lock outside fullscreen/PWA.
    });
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
  const retailSummary = useMemo(() => buildRetailSummary(sortedFiltered), [sortedFiltered]);

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
        if (activeSearchMode === "image" && search?.constructed_query && search.constructed_query.trim()) {
          setQueryText(search.constructed_query.trim());
        }
        if (search.status === "completed" || search.status === "failed") {
          setStatus(search.status === "completed" ? "Search completed." : "Search failed.");
          if (pollTimer.current) window.clearInterval(pollTimer.current);
          pollTimer.current = null;
          setSearchInProgress(false);
          setActiveSearchMode(null);
        } else {
          setStatus("Searching marketplaces...");
        }
      } catch {
        setStatus("Polling error. Try again.");
        if (pollTimer.current) window.clearInterval(pollTimer.current);
        pollTimer.current = null;
        setSearchInProgress(false);
        setActiveSearchMode(null);
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
    setActiveSearchMode("text");
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
        setActiveSearchMode(null);
        return;
      }
      const data = (await response.json()) as { search_id?: string };
      if (!data.search_id) {
        setStatus("Text search failed.");
        setSearchInProgress(false);
        setActiveSearchMode(null);
        return;
      }
      setSearchId(data.search_id);
      await pollSearch(data.search_id);
    } catch {
      setStatus("Network or server error. Try again.");
      setSearchInProgress(false);
      setActiveSearchMode(null);
    }
  }

  async function startImageSearch(selectedFile?: File | null): Promise<void> {
    const targetFile = selectedFile ?? file;
    if (!targetFile) {
      setStatus("Choose an image file first.");
      return;
    }
    setExpandedRows({ exact: false, brand: false, different: false });
    setAnalysis(null);
    setDetectedLine("");
    setStatus("Uploading image...");
    setSearchInProgress(true);
    setActiveSearchMode("image");
    try {
      const formData = new FormData();
      const trimmedSize = sizeText.trim();
      if (trimmedSize) formData.append("size_text", trimmedSize);
      const runtimeCredentials = buildRuntimeCredentials(settings);
      if (runtimeCredentials) formData.append("runtime_credentials", JSON.stringify(runtimeCredentials));
      formData.append("image", targetFile);
      const response = await fetch("/api/v1/search/image-upload", { method: "POST", body: formData });
      if (!response.ok) {
        setStatus("Image upload/search failed.");
        setSearchInProgress(false);
        setActiveSearchMode(null);
        return;
      }
      const data = (await response.json()) as { search_id?: string };
      if (!data.search_id) {
        setStatus("Image upload/search failed.");
        setSearchInProgress(false);
        setActiveSearchMode(null);
        return;
      }
      setSearchId(data.search_id);
      await pollSearch(data.search_id);
    } catch {
      setStatus("Network or server error. Try again.");
      setSearchInProgress(false);
      setActiveSearchMode(null);
    }
  }

  function resetSearchView(): void {
    setQueryText("");
    setSizeText("");
    setFile(null);
    setResults([]);
    setAnalysis(null);
    setDetectedLine("");
    setMetaLine("");
    setSearchId(null);
    setStatus(DEFAULT_STATUS);
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
                {(() => {
                  const fields = extractStandardizedItemFields(item);
                  return (
                    <div className="item-fields">
                      <div className="field-row">
                        <span className="field-label">Brand</span>
                        <span className="field-value" title={`source: ${fields.brandSource}, confidence: ${fields.brandConfidence.toFixed(2)}`}>
                          {fields.brand}
                        </span>
                      </div>
                      <div className="field-row">
                        <span className="field-label">Model</span>
                        <span className="field-value">{fields.model}</span>
                      </div>
                      <div className="field-row">
                        <span className="field-label">Category</span>
                        <span className="field-value">{fields.category}</span>
                      </div>
                      <div className="field-row">
                        <span className="field-label">Color</span>
                        <span className="field-value">{fields.color}</span>
                      </div>
                      <div className="field-row">
                        <span className="field-label">Size</span>
                        <span className="field-value">{fields.size}</span>
                      </div>
                      <div className="field-row">
                        <span className="field-label">Condition</span>
                        <span className="field-value">{fields.condition}</span>
                      </div>
                      <div className="field-row">
                        <span className="field-label">Verified</span>
                        <span className={`field-value ${fields.verified ? "verified-yes" : "verified-no"}`}>
                          {fields.verified ? "✓" : "✕"}
                        </span>
                      </div>
                      <div className="field-row">
                        <span className="field-label">New at retail</span>
                        <span className="field-value">{fields.newAtRetail}</span>
                      </div>
                    </div>
                  );
                })()}
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
        <div className="topbar">
          <button className="icon-btn" type="button" onClick={resetSearchView} aria-label="New search">
            +
          </button>
          <h1>maisonDeux</h1>
          <button className="icon-btn" type="button" onClick={() => setSettingsOpen((prev) => !prev)} aria-label="Menu">
            ☰
          </button>
        </div>

        <div className="toolbar">
          <div className="search-inline">
            <input
              className="query-inline"
              type="text"
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              placeholder="Try: Rolex Submariner, Chanel Flap, Cartier Love..."
            />
            <input
              ref={fileInputRef}
              className="hidden-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                setFile(selected);
                void startImageSearch(selected);
              }}
            />
            <button className="secondary compact-btn" type="button" onClick={() => fileInputRef.current?.click()} disabled={searchInProgress}>
              Photo
            </button>
            <input
              className="size-inline"
              type="text"
              value={sizeText}
              onChange={(event) => setSizeText(event.target.value)}
              placeholder="Size"
            />
            <label className="chip verified-inline">
              <input type="checkbox" checked={verifiedOnly} onChange={(event) => setVerifiedOnly(event.target.checked)} /> Verified
            </label>
            <button className="compact-btn" onClick={() => void startTextSearch()} disabled={searchInProgress}>
              Search
            </button>
          </div>
        </div>

        <div className="controls">
          <select className="sort-right" value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
            <option value="best">Sort: Best Match</option>
            <option value="low">Sort: Price Low to High</option>
            <option value="high">Sort: Price High to Low</option>
            <option value="trust">Sort: Trust Score</option>
          </select>
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
      <nav className="bottom-nav" aria-label="Primary navigation">
        <button type="button" className="nav-item active">
          <span className="nav-icon">🏠</span>
          <span>Home</span>
        </button>
        <button type="button" className="nav-item">
          <span className="nav-icon">🧾</span>
          <span>Queue</span>
        </button>
        <button type="button" className="nav-item">
          <span className="nav-icon">👤</span>
          <span>Profile</span>
        </button>
      </nav>
    </div>
  );
}
