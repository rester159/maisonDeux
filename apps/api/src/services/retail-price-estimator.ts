import type { CanonicalListing } from "@luxefinder/shared";

type RetailEstimate = {
  priceUsd: number | null;
  source: string | null;
};

type ShoppingRow = {
  price?: string;
  extracted_price?: number;
  source?: string;
  title?: string;
  link?: string;
};

type SerpShoppingResponse = {
  shopping_results?: ShoppingRow[];
};

function normalizeQueryText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildRetailQuery(listing: CanonicalListing, fallbackQuery: string): string {
  const brand = normalizeQueryText(listing.brand);
  const modelHint = normalizeQueryText(listing.title).split(" ").slice(0, 6).join(" ");
  const category = normalizeQueryText(listing.subcategory || listing.category);
  const base = [brand, modelHint || category].filter(Boolean).join(" ");
  return normalizeQueryText(base || fallbackQuery);
}

function parsePriceUsd(row: ShoppingRow): number | null {
  if (typeof row.extracted_price === "number" && Number.isFinite(row.extracted_price) && row.extracted_price > 0) {
    return row.extracted_price;
  }
  if (typeof row.price !== "string") return null;
  const cleaned = row.price.replace(/[^0-9.]/g, "");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

async function estimateFromSerpGoogleShopping(query: string): Promise<RetailEstimate> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey || !query) return { priceUsd: null, source: null };

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_shopping");
  url.searchParams.set("q", query);
  url.searchParams.set("gl", "us");
  url.searchParams.set("hl", "en");
  url.searchParams.set("api_key", apiKey);

  const response = await fetch(url.toString(), { method: "GET" });
  if (!response.ok) return { priceUsd: null, source: null };
  const payload = (await response.json()) as SerpShoppingResponse;
  const rows = payload.shopping_results ?? [];
  for (const row of rows) {
    const priceUsd = parsePriceUsd(row);
    if (!priceUsd) continue;
    const source = row.source ? `google_shopping:${row.source}` : "google_shopping";
    return { priceUsd, source };
  }
  return { priceUsd: null, source: null };
}

export async function enrichListingsWithRetailPrice(
  listings: CanonicalListing[],
  query: string
): Promise<CanonicalListing[]> {
  if (!listings.length) return listings;
  const capped = listings.slice(0, 20);
  const enriched = await Promise.all(
    capped.map(async (listing) => {
      const lookupQuery = buildRetailQuery(listing, query);
      if (!lookupQuery) return listing;
      const estimate = await estimateFromSerpGoogleShopping(lookupQuery).catch(() => ({
        priceUsd: null,
        source: null
      }));
      return {
        ...listing,
        estimated_retail_price_usd: estimate.priceUsd,
        retail_price_source: estimate.source
      };
    })
  );
  return enriched;
}
