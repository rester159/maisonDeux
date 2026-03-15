import type { CanonicalListing } from "@luxefinder/shared";
import { getEbayAccessToken } from "./ebay-token";

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

type EbayBrowseResponse = {
  itemSummaries?: Array<{
    price?: { value?: string };
  }>;
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

async function estimateFromEbayNew(query: string): Promise<RetailEstimate> {
  const token = await getEbayAccessToken();
  if (!token || !query) return { priceUsd: null, source: null };
  const base = String(process.env.EBAY_ENVIRONMENT ?? "production").toLowerCase() === "sandbox"
    ? "https://api.sandbox.ebay.com"
    : "https://api.ebay.com";
  const marketplace = process.env.EBAY_MARKETPLACE_ID?.trim() || "EBAY_US";
  const params = new URLSearchParams({
    q: query,
    limit: "10",
    filter: "conditions:{NEW}",
    sort: "price"
  });
  const response = await fetch(`${base}/buy/browse/v1/item_summary/search?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": marketplace
    }
  });
  if (!response.ok) return { priceUsd: null, source: null };
  const payload = (await response.json()) as EbayBrowseResponse;
  const prices = (payload.itemSummaries ?? [])
    .map((item) => Number(item.price?.value ?? 0))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (!prices.length) return { priceUsd: null, source: null };
  const median = prices[Math.floor(prices.length / 2)];
  return { priceUsd: median, source: "ebay_new_fallback" };
}

export async function enrichListingsWithRetailPrice(
  listings: CanonicalListing[],
  query: string
): Promise<CanonicalListing[]> {
  if (!listings.length) return listings;
  const capped = listings.slice(0, 20);
  const cache = new Map<string, RetailEstimate>();
  const enriched = await Promise.all(
    capped.map(async (listing) => {
      const lookupQuery = buildRetailQuery(listing, query);
      if (!lookupQuery) return listing;
      if (!cache.has(lookupQuery)) {
        const primary = await estimateFromSerpGoogleShopping(lookupQuery).catch(() => ({
          priceUsd: null,
          source: null
        }));
        const fallback = primary.priceUsd == null
          ? await estimateFromEbayNew(lookupQuery).catch(() => ({ priceUsd: null, source: null }))
          : null;
        cache.set(lookupQuery, fallback ?? primary);
      }
      const estimate = cache.get(lookupQuery) ?? { priceUsd: null, source: null };
      return {
        ...listing,
        estimated_retail_price_usd: estimate.priceUsd,
        retail_price_source: estimate.source
      };
    })
  );
  return enriched;
}
