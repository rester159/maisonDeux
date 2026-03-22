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
/** Fixed pill categories; values are filled from search results, frequency-sorted. */
const PILL_CATEGORIES = ["Brand", "Category", "Size", "Color", "Material"] as const;
type PillCategoryId = (typeof PILL_CATEGORIES)[number];

type FacetValue = { value: string; count: number };
type PillFacet = { categoryId: PillCategoryId; label: string; values: FacetValue[]; totalCount: number };
const SETTINGS_KEY = "maisondeux-settings";
const DEFAULT_STATUS = "Ready to search.";

/** Deep links to search on each site (some require login). Use when we have a query. */
const MARKETPLACE_SEARCH_LINKS: Array<{ label: string; url: (q: string) => string; note?: string }> = [
  { label: "The RealReal", url: (q) => `https://www.therealreal.com/search?q=${encodeURIComponent(q)}`, note: "May require login" },
  { label: "Vestiaire", url: (q) => `https://www.vestiairecollective.com/search/?q=${encodeURIComponent(q)}`, note: "May require login" },
  { label: "1stDibs", url: (q) => `https://www.1stdibs.com/search/?q=${encodeURIComponent(q)}` },
  { label: "eBay", url: (q) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}` },
  { label: "Chrono24", url: (q) => `https://www.chrono24.com/search/index.htm?query=${encodeURIComponent(q)}`, note: "May require login" },
  { label: "Rebag", url: (q) => `https://shop.rebag.com/search?q=${encodeURIComponent(q)}` },
  { label: "Fashionphile", url: (q) => `https://www.fashionphile.com/shop?term=${encodeURIComponent(q)}` },
  { label: "Grailed", url: (q) => `https://www.grailed.com/shop/${encodeURIComponent(q.toLowerCase().replace(/\s+/g, "-"))}` },
  { label: "Shop Goodwill", url: (q) => `https://shopgoodwill.com/shop?query=${encodeURIComponent(q)}` }
];

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
  const serverBrand = (item.brand ?? "").trim();
  const brandMatch = serverBrand
    ? { brand: serverBrand, confidence: 0.95, source: "dictionary_exact" as const }
    : inferBrandFromText({
          title: item.title,
          description: item.description,
          sellerBrand: item.brand
        });
  const brand = brandMatch.brand ?? "Unknown";
  const color = (item.color ?? "").trim() ? titleCase(String(item.color).trim()) : inferColor(item);
  const size = (item.size ?? "").trim() ? String(item.size).trim() : inferSize(item);
  return {
    brand,
    brandConfidence: brandMatch.confidence,
    brandSource: brandMatch.source,
    model: inferModel(item),
    category: formatCategory(item),
    color,
    size,
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

function attributeKey(categoryId: PillCategoryId, value: string): string {
  const v = normalizeText(value).trim() || "_";
  return `${categoryId}:${v}`;
}

function getCardAttributeKeys(item: CanonicalListing): string[] {
  const fields = extractStandardizedItemFields(item);
  const keys: string[] = [];
  if (fields.brand && fields.brand !== "Unknown") keys.push(attributeKey("Brand", fields.brand));
  if (fields.category && fields.category !== "Unknown") keys.push(attributeKey("Category", fields.category));
  if (fields.size && fields.size !== "Unknown") keys.push(attributeKey("Size", fields.size));
  if (fields.color && fields.color !== "Unknown") keys.push(attributeKey("Color", fields.color));
  const material = (item.material ?? "").trim() || fields.category;
  if (material && material !== "Unknown") keys.push(attributeKey("Material", material));
  return keys;
}

function buildPillFacets(items: CanonicalListing[]): PillFacet[] {
  const counts: Record<PillCategoryId, Record<string, number>> = {
    Brand: {},
    Category: {},
    Size: {},
    Color: {},
    Material: {}
  };
  for (const item of items) {
    const fields = extractStandardizedItemFields(item);
    const brand = fields.brand?.trim();
    if (brand && brand !== "Unknown") counts.Brand[brand] = (counts.Brand[brand] ?? 0) + 1;
    const cat = fields.category?.trim();
    if (cat && cat !== "Unknown") counts.Category[cat] = (counts.Category[cat] ?? 0) + 1;
    const size = fields.size?.trim();
    if (size && size !== "Unknown") counts.Size[size] = (counts.Size[size] ?? 0) + 1;
    const color = fields.color?.trim();
    if (color && color !== "Unknown") counts.Color[color] = (counts.Color[color] ?? 0) + 1;
    const mat = (item.material ?? "").trim() || "";
    if (mat) counts.Material[mat] = (counts.Material[mat] ?? 0) + 1;
  }
  const facets: PillFacet[] = PILL_CATEGORIES.map((categoryId) => {
    const valueCounts = counts[categoryId];
    const values = Object.entries(valueCounts)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
    const totalCount = values.reduce((sum, v) => sum + v.count, 0);
    return { categoryId, label: categoryId, values, totalCount };
  }).filter((f) => f.values.length > 0);
  facets.sort((a, b) => b.totalCount - a.totalCount);
  return facets;
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
  const [activeAttributeKeys, setActiveAttributeKeys] = useState<Set<string>>(new Set());
  const [pillOpenCategory, setPillOpenCategory] = useState<PillCategoryId | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<StoredSettings>(() => getStoredSettings());
  const [searchInProgress, setSearchInProgress] = useState(false);
  const [activeSearchMode, setActiveSearchMode] = useState<"text" | "image" | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pollTimer = useRef<number | null>(null);
  const pillCarouselRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimer.current) window.clearInterval(pollTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!pillOpenCategory) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        pillCarouselRef.current &&
        !pillCarouselRef.current.contains(target)
      ) {
        setPillOpenCategory(null);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [pillOpenCategory]);

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

  const pillFacets = useMemo(() => buildPillFacets(sortedFiltered), [sortedFiltered]);

  useEffect(() => {
    const allKeys = new Set<string>();
    for (const item of sortedFiltered) {
      for (const key of getCardAttributeKeys(item)) allKeys.add(key);
    }
    setActiveAttributeKeys(allKeys);
  }, [sortedFiltered]);

  const listFilteredByPills = useMemo(() => {
    if (activeAttributeKeys.size === 0) return sortedFiltered;
    return sortedFiltered.filter((item) => {
      const keys = getCardAttributeKeys(item);
      if (keys.length === 0) return true;
      return keys.every((k) => activeAttributeKeys.has(k));
    });
  }, [sortedFiltered, activeAttributeKeys]);

  function toggleAttributeKey(key: string): void {
    setActiveAttributeKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const retailSummary = useMemo(() => buildRetailSummary(listFilteredByPills), [listFilteredByPills]);

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

  const renderCard = (item: CanonicalListing) => {
    const fields = extractStandardizedItemFields(item);
    return (
      <article className="listing listing-compact" key={item.listing_id}>
        <img src={item.images?.[0] || ""} alt={item.title || "listing"} />
        <div className="body">
          <div className="row">
            <span className="platform">{item.platform}</span>
            <span className="price">{formatMoney(item.price_usd)}</span>
          </div>
          <div className="title">{item.title || ""}</div>
          <div className="item-fields">
            <div className="field-row">
              <span className="field-label">Brand</span>
              <span className="field-value">{fields.brand}</span>
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
              <span className={`field-value ${fields.verified ? "verified-yes" : "verified-no"}`}>{fields.verified ? "✓" : "✕"}</span>
            </div>
            <div className="field-row">
              <span className="field-label">New at retail</span>
              <span className="field-value">{fields.newAtRetail}</span>
            </div>
          </div>
          <div className="trust">Trust: {item.trust_score || 0}/100</div>
          <a className="footer-link" href={item.platform_listing_url} target="_blank" rel="noopener noreferrer">
            View on {item.platform}
          </a>
        </div>
      </article>
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

      {sortedFiltered.length > 0 ? (
        <section className="pill-section" aria-label="Filter by attribute">
          <div className="pill-carousel-wrap">
            <div className="pill-carousel" ref={pillCarouselRef} role="list">
              {pillFacets.map((facet) => {
                const isOpen = pillOpenCategory === facet.categoryId;
                return (
                  <div className="pill-wrapper" key={facet.categoryId} role="listitem">
                    <button
                      type="button"
                      className={`pill ${isOpen ? "pill-open" : ""}`}
                      onClick={() => setPillOpenCategory(isOpen ? null : facet.categoryId)}
                      aria-expanded={isOpen}
                      aria-haspopup="listbox"
                    >
                      {facet.label}
                    </button>
                    {isOpen ? (
                      <div className="pill-dropdown" role="listbox">
                        {facet.values.map(({ value, count }) => {
                          const key = attributeKey(facet.categoryId, value);
                          const isActive = activeAttributeKeys.has(key);
                          return (
                            <button
                              key={key}
                              type="button"
                              className={`pill-dropdown-item ${isActive ? "pill-item-on" : "pill-item-off"}`}
                              role="option"
                              aria-selected={isActive}
                              onClick={() => toggleAttributeKey(key)}
                            >
                              <span className="pill-item-label">{value}</span>
                              <span className="pill-item-count">{count}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="pill-scroll-hint" aria-hidden="true">
              ← scroll →
            </div>
          </div>
        </section>
      ) : null}

      <section className="result-list">
        {listFilteredByPills.map((item) => renderCard(item))}
      </section>
      {queryText.trim() ? (
        <section className="search-on-sites" aria-label="Search on other sites">
          <p className="search-on-sites-intro">
            Some sites require login or an API key to see results here. Search on each site with your query:
          </p>
          <div className="search-on-sites-links">
            {MARKETPLACE_SEARCH_LINKS.map(({ label, url, note }) => (
              <a
                key={label}
                className="search-on-sites-link"
                href={url(queryText.trim())}
                target="_blank"
                rel="noopener noreferrer"
              >
                {label}
                {note ? <span className="search-on-sites-note"> ({note})</span> : null}
              </a>
            ))}
          </div>
        </section>
      ) : null}
      {!sortedFiltered.length && !queryText.trim() ? (
        <div className="empty">No results yet. Start with image upload or text search above.</div>
      ) : null}
      {!sortedFiltered.length && queryText.trim() ? (
        <div className="empty">No results from connected sources. Use the links above to search on each site.</div>
      ) : null}
      {sortedFiltered.length > 0 && listFilteredByPills.length === 0 ? (
        <div className="empty">No listings match the current filters. Turn some pill attributes back on.</div>
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
