import type { ListingCategory } from "@luxefinder/shared";

type LensResultRow = {
  title?: string;
  source?: string;
  link?: string;
  snippet?: string;
};

type LensResponse = {
  exact_matches?: LensResultRow[];
  visual_matches?: LensResultRow[];
  products?: LensResultRow[];
};

export interface GoogleImageIdentification {
  brand: string | null;
  model_name: string | null;
  query: string | null;
  confidence: number;
}

const SERP_API_URL = "https://serpapi.com/search.json";
const LUXURY_BRANDS = [
  "louis vuitton",
  "gucci",
  "prada",
  "chanel",
  "dior",
  "hermes",
  "saint laurent",
  "balenciaga",
  "fendi",
  "givenchy",
  "cartier",
  "tiffany",
  "bvlgari",
  "rolex",
  "omega",
  "patek philippe",
  "audemars piguet",
  "tag heuer",
  "iwc",
  "longines",
  "valentino",
  "bottega veneta",
  "celine",
  "loewe",
  "burberry",
  "versace",
  "miu miu",
  "the row",
  "tom ford",
  "jimmy choo",
  "christian louboutin",
  "manolo blahnik",
  "salvatore ferragamo"
];

const MODEL_STOPWORDS = new Set([
  "new",
  "used",
  "authentic",
  "vintage",
  "preowned",
  "pre",
  "owned",
  "official",
  "store",
  "sale",
  "buy",
  "price",
  "women",
  "mens",
  "men",
  "womens",
  "size",
  "black",
  "white",
  "brown",
  "blue",
  "red",
  "green",
  "leather",
  "canvas",
  "suede",
  "bag",
  "shoe",
  "shoes",
  "watch",
  "watches",
  "jewelry",
  "apparel",
  "accessory"
]);

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string | null | undefined): string[] {
  return normalizeText(value)
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
}

function rowsFromLens(payload: LensResponse): LensResultRow[] {
  const rows = [...(payload.exact_matches ?? []), ...(payload.products ?? []), ...(payload.visual_matches ?? [])];
  return rows.filter((row) => typeof row.title === "string" && row.title.trim().length > 0).slice(0, 40);
}

export function inferBrandAndModelFromLensRows(rows: LensResultRow[]): GoogleImageIdentification {
  if (!rows.length) return { brand: null, model_name: null, query: null, confidence: 0 };

  const titleBag = rows.map((row) => normalizeText(row.title));
  const brandScores = new Map<string, number>();

  for (const brand of LUXURY_BRANDS) {
    const score = titleBag.reduce((count, title) => count + (title.includes(brand) ? 1 : 0), 0);
    if (score > 0) brandScores.set(brand, score);
  }

  const sortedBrands = Array.from(brandScores.entries()).sort((a, b) => b[1] - a[1]);
  const selectedBrand = sortedBrands[0]?.[0] ?? null;
  const selectedBrandCount = sortedBrands[0]?.[1] ?? 0;
  const modelNgramCounts = new Map<string, number>();
  const modelCandidateTitles = selectedBrand
    ? titleBag.filter((title) => title.includes(selectedBrand))
    : titleBag;

  for (const title of modelCandidateTitles) {
    const cleaned = selectedBrand ? title.replace(new RegExp(`\\b${selectedBrand}\\b`, "g"), " ") : title;
    const tokens = tokenize(cleaned).filter((token) => !MODEL_STOPWORDS.has(token));
    for (let i = 0; i < tokens.length; i += 1) {
      for (let size = 1; size <= 3; size += 1) {
        const ngramTokens = tokens.slice(i, i + size);
        if (ngramTokens.length !== size) continue;
        const ngram = ngramTokens.join(" ");
        if (ngram.length < 3) continue;
        const prev = modelNgramCounts.get(ngram) ?? 0;
        modelNgramCounts.set(ngram, prev + 1);
      }
    }
  }

  const sortedModels = Array.from(modelNgramCounts.entries())
    .filter((entry) => entry[1] >= 2)
    .sort((a, b) => b[1] - a[1]);
  const modelName = sortedModels[0]?.[0] ?? null;
  const modelCount = sortedModels[0]?.[1] ?? 0;
  const query = selectedBrand ? [selectedBrand, modelName].filter(Boolean).join(" ") : modelName;
  const confidenceBase = rows.length >= 5 ? 0.45 : 0.3;
  const confidence = Math.min(0.98, confidenceBase + selectedBrandCount * 0.05 + modelCount * 0.04);

  return {
    brand: selectedBrand,
    model_name: modelName,
    query: query || null,
    confidence
  };
}

export function mergeGoogleIdentificationIntoCategory(
  category: ListingCategory,
  identification: GoogleImageIdentification | null
): GoogleImageIdentification | null {
  if (!identification?.query) return null;
  const normalizedCategory = category === "accessory" ? "" : category;
  return {
    ...identification,
    query: [identification.query, normalizedCategory].filter(Boolean).join(" ").trim()
  };
}

export async function identifyBrandModelFromGoogleImage(imageUrl: string): Promise<GoogleImageIdentification | null> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) return null;

  const url = new URL(SERP_API_URL);
  url.searchParams.set("engine", "google_lens");
  url.searchParams.set("type", "exact_matches");
  url.searchParams.set("url", imageUrl);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", "us");

  const response = await fetch(url.toString(), { method: "GET" });
  if (!response.ok) return null;

  const payload = (await response.json()) as LensResponse;
  const rows = rowsFromLens(payload);
  if (!rows.length) return null;
  return inferBrandAndModelFromLensRows(rows);
}
