import type { ExtractedAttributes, ExtractedField } from "./attribute-types.js";
import { BRANDS_AND_MODELS } from "./reference-data/brands-and-models.js";
import { COLOR_VOCABULARY } from "./reference-data/colors.js";
import { MATERIAL_VOCABULARY } from "./reference-data/materials.js";
import { extractSize } from "./reference-data/sizes.js";

const BRAND_STOPWORDS = new Set([
  "mens", "men", "womens", "women", "vintage", "new", "preowned", "pre-owned",
  "authentic", "rare", "classic", "small", "medium", "large", "wallet", "bag", "bags", "dress", "dresses"
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text).split(" ").filter(Boolean);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// —— Index: normalized alias → canonical (brand, color, material); model alias → { brand, model canonical }
type BrandAliasEntry = { canonical: string; alias: string };
type ModelAliasEntry = { brandCanonical: string; modelCanonical: string; alias: string };

const brandAliases: BrandAliasEntry[] = [];
const modelAliases: ModelAliasEntry[] = [];

for (const brand of BRANDS_AND_MODELS) {
  const canon = brand.canonical;
  for (const a of brand.aliases) {
    const n = normalize(a);
    if (n && !BRAND_STOPWORDS.has(n)) brandAliases.push({ canonical: canon, alias: n });
  }
  for (const model of brand.models) {
    for (const a of model.aliases) {
      const n = normalize(a);
      if (n && n.length >= 2) modelAliases.push({ brandCanonical: canon, modelCanonical: model.canonical, alias: n });
    }
  }
}
// Longest first for greedy match
brandAliases.sort((a, b) => b.alias.length - a.alias.length);
modelAliases.sort((a, b) => b.alias.length - a.alias.length);

const colorAliases: Array<{ canonical: string; alias: string }> = [];
for (const c of COLOR_VOCABULARY) {
  for (const a of c.aliases) {
    const n = normalize(a);
    if (n) colorAliases.push({ canonical: c.canonical, alias: n });
  }
}
colorAliases.sort((a, b) => b.alias.length - a.alias.length);

const materialAliases: Array<{ canonical: string; alias: string }> = [];
for (const m of MATERIAL_VOCABULARY) {
  for (const a of m.aliases) {
    const n = normalize(a);
    if (n) materialAliases.push({ canonical: m.canonical, alias: n });
  }
}
materialAliases.sort((a, b) => b.alias.length - a.alias.length);

function emptyField(): ExtractedField {
  return { value: "", confidence: 0, source: "none" };
}

function extractBrand(haystack: string, padded: string, sellerBrand: string): ExtractedField {
  const sellerNorm = normalize(sellerBrand);
  if (sellerNorm && !BRAND_STOPWORDS.has(sellerNorm)) {
    const byAlias = brandAliases.find((e) => e.alias === sellerNorm);
    if (byAlias) return { value: byAlias.canonical, confidence: 0.97, source: "seller" };
  }

  for (const { canonical, alias } of brandAliases) {
    const pattern = ` ${alias} `;
    if (padded.includes(pattern)) return { value: canonical, confidence: 0.93, source: "exact" };
  }

  const tokens = tokenize(haystack).filter((t) => t.length >= 4 && !BRAND_STOPWORDS.has(t));
  for (const token of tokens) {
    for (const { canonical, alias } of brandAliases) {
      if (alias.includes(" ")) continue;
      const maxD = alias.length >= 7 ? 2 : 1;
      if (levenshtein(token, alias) <= maxD) return { value: canonical, confidence: 0.78, source: "fuzzy" };
    }
  }

  if (sellerNorm && !BRAND_STOPWORDS.has(sellerNorm))
    return { value: titleCase(sellerBrand), confidence: 0.55, source: "inferred" };

  return emptyField();
}

function extractModel(
  haystack: string,
  padded: string,
  brandCanonical: string | null
): ExtractedField {
  const candidates = brandCanonical
    ? modelAliases.filter((e) => e.brandCanonical === brandCanonical)
    : modelAliases;

  for (const { modelCanonical, alias } of candidates) {
    const pattern = ` ${alias} `;
    if (padded.includes(pattern)) return { value: modelCanonical, confidence: 0.92, source: "exact" };
  }

  for (const { modelCanonical, alias } of candidates) {
    if (alias.includes(" ")) continue;
    const tokens = tokenize(haystack);
    for (const t of tokens) {
      if (t.length >= 3 && levenshtein(t, alias) <= 1)
        return { value: modelCanonical, confidence: 0.75, source: "fuzzy" };
    }
  }

  return emptyField();
}

function extractColor(haystack: string, padded: string): ExtractedField {
  for (const { canonical, alias } of colorAliases) {
    const pattern = ` ${alias} `;
    if (padded.includes(pattern)) return { value: canonical, confidence: 0.9, source: "exact" };
  }
  for (const { canonical, alias } of colorAliases) {
    if (alias.includes(" ")) continue;
    const tokens = tokenize(haystack);
    for (const t of tokens) {
      if (t.length >= 3 && levenshtein(t, alias) <= 1)
        return { value: canonical, confidence: 0.72, source: "fuzzy" };
    }
  }
  return emptyField();
}

function extractMaterial(haystack: string, padded: string): ExtractedField {
  for (const { canonical, alias } of materialAliases) {
    const pattern = ` ${alias} `;
    if (padded.includes(pattern)) return { value: canonical, confidence: 0.88, source: "exact" };
  }
  for (const { canonical, alias } of materialAliases) {
    if (alias.includes(" ")) continue;
    const tokens = tokenize(haystack);
    for (const t of tokens) {
      if (t.length >= 4 && levenshtein(t, alias) <= 1)
        return { value: canonical, confidence: 0.7, source: "fuzzy" };
    }
  }
  return emptyField();
}

export type ExtractAttributesInput = {
  title?: string | null;
  description?: string | null;
  sellerBrand?: string | null;
  sellerColor?: string | null;
  sellerSize?: string | null;
  sellerMaterial?: string | null;
  /** One of: watch, jewelry, bag, shoes, apparel, accessory */
  category?: string | null;
};

/**
 * Run the full attribute extraction pipeline.
 * Uses reference data for brand, model, color, material; category-aware size patterns.
 */
export function extractAttributes(input: ExtractAttributesInput): ExtractedAttributes {
  const title = String(input.title ?? "").trim();
  const description = String(input.description ?? "").trim();
  const haystack = normalize(`${title} ${description}`);
  const padded = ` ${haystack} `;
  const category = input.category ? String(input.category).toLowerCase() : "accessory";

  const brand = extractBrand(haystack, padded, input.sellerBrand ?? "");
  const model = extractModel(haystack, padded, brand.value || null);
  const color = extractColor(haystack, padded);
  const material = extractMaterial(haystack, padded);
  const sizeResult = extractSize(haystack, category);

  const size: ExtractedField = sizeResult.value
    ? {
        value: sizeResult.value,
        confidence: sizeResult.confidence,
        source: sizeResult.confidence >= 0.85 ? "exact" : "inferred"
      }
    : input.sellerSize && String(input.sellerSize).trim()
      ? { value: String(input.sellerSize).trim(), confidence: 0.8, source: "seller" }
      : emptyField();

  const colorFinal: ExtractedField =
    color.value ? color : input.sellerColor && String(input.sellerColor).trim()
      ? { value: titleCase(String(input.sellerColor)), confidence: 0.7, source: "seller" }
      : emptyField();

  const materialFinal: ExtractedField =
    material.value ? material : input.sellerMaterial && String(input.sellerMaterial).trim()
      ? { value: titleCase(String(input.sellerMaterial)), confidence: 0.7, source: "seller" }
      : emptyField();

  return {
    brand: brand.value ? brand : emptyField(),
    model: model.value ? model : emptyField(),
    color: colorFinal,
    material: materialFinal,
    size
  };
}

/**
 * Merge extracted attributes into a listing-like object.
 * Prefer extracted value when confidence >= minConfidence; otherwise keep existing.
 */
export function mergeExtractedIntoListing<T extends { brand?: string | null; color?: string | null; size?: string | null; material?: string | null }>(
  listing: T,
  extracted: ExtractedAttributes,
  minConfidence = 0.6
): T {
  const brand = extracted.brand.confidence >= minConfidence && extracted.brand.value
    ? extracted.brand.value
    : (listing.brand ?? "");
  const color = extracted.color.confidence >= minConfidence && extracted.color.value
    ? extracted.color.value
    : (listing.color ?? null);
  const size = extracted.size.confidence >= minConfidence && extracted.size.value
    ? extracted.size.value
    : (listing.size ?? null);
  const material = extracted.material.confidence >= minConfidence && extracted.material.value
    ? extracted.material.value
    : (listing.material ?? null);
  return {
    ...listing,
    brand: (brand || listing.brand) ?? "",
    color: (color || listing.color) ?? null,
    size: (size || listing.size) ?? null,
    material: (material || listing.material) ?? null
  };
}
