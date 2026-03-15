import { computeTrustScore, type CanonicalListing, type ListingCategory } from "@luxefinder/shared";
import { normalizeAuthStatus, normalizeCondition, normalizeCurrencyToUsd } from "./normalization";

export interface MarketplaceAdapter {
  readonly platform: string;
  search(query: string, analysisCategory: ListingCategory): Promise<CanonicalListing[]>;
}

export type RuntimeCredentials = {
  ebay?: { oauth_token?: string };
  shopgoodwill?: { access_token?: string; username?: string; password?: string };
  therealreal?: { api_key?: string };
  vestiaire?: { api_key?: string };
  chrono24?: { api_key?: string };
  search?: { precision?: number; size_text?: string };
};

const FX_RATES = { EUR: 0.92, GBP: 0.79, JPY: 149.5, USD: 1 };

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function fromUnknownRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = asNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function maybeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function slugifyQuery(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

function absolutizeUrl(url: string, baseUrl: string): string {
  const normalized = normalizeUrl(url);
  if (!normalized) return "";
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) return normalized;
  if (normalized.startsWith("/")) {
    try {
      return new URL(normalized, baseUrl).toString();
    } catch {
      return "";
    }
  }
  return normalized;
}

function readPath(value: unknown, path: string): unknown {
  const parts = path.split(".");
  let cursor: unknown = value;
  for (const part of parts) {
    if (cursor === null || cursor === undefined) return undefined;
    if (Array.isArray(cursor)) {
      const index = Number(part);
      if (!Number.isInteger(index)) return undefined;
      cursor = cursor[index];
      continue;
    }
    if (typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

function pickStringByPaths(row: Record<string, unknown>, paths: string[], fallback = ""): string {
  for (const path of paths) {
    const value = readPath(row, path);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

function pickNumberByPaths(row: Record<string, unknown>, paths: string[], fallback = 0): number {
  for (const path of paths) {
    const value = readPath(row, path);
    const parsed = asNumber(value, Number.NaN);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function looksLikeListingRow(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  const title = pickStringByPaths(row, ["title", "name", "productName", "item.title", "item.name"]);
  const url = pickStringByPaths(row, ["url", "href", "productUrl", "product_url", "item.url", "seo.url"]);
  const price = pickNumberByPaths(
    row,
    [
      "price",
      "currentPrice",
      "salePrice",
      "amount",
      "price.value",
      "pricing.price",
      "offers.price",
      "item.price",
      "item.price.value"
    ],
    Number.NaN
  );
  return Boolean(title) && Number.isFinite(price) && price > 0 && Boolean(url);
}

function flattenJsonLdProducts(node: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const walk = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value !== "object") return;
    const row = value as Record<string, unknown>;
    const type = row["@type"];
    const typeValues = Array.isArray(type) ? type : [type];
    if (typeValues.some((entry) => String(entry).toLowerCase() === "product")) {
      out.push(row);
    }
    walk(row["@graph"]);
    const itemList = maybeArray(row.itemListElement);
    itemList.forEach((entry) => {
      const item = fromUnknownRecord(entry).item;
      walk(item ?? entry);
    });
    walk(row.item);
  };
  walk(node);
  return out;
}

function extractJsonLdProducts(html: string): Record<string, unknown>[] {
  const matches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const products: Record<string, unknown>[] = [];
  for (const match of matches) {
    const raw = (match[1] ?? "").trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      products.push(...flattenJsonLdProducts(parsed));
    } catch {
      continue;
    }
  }
  return products;
}

function parseJsonFromScriptBlock(content: string): unknown | null {
  const trimmed = content.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    // proceed to assignment-style extraction
  }
  const assignmentMatches = [
    trimmed.match(/__NEXT_DATA__\s*=\s*(\{[\s\S]*\})\s*;?/),
    trimmed.match(/__NUXT__\s*=\s*(\{[\s\S]*\})\s*;?/),
    trimmed.match(/__INITIAL_STATE__\s*=\s*(\{[\s\S]*\})\s*;?/),
    trimmed.match(/window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*\})\s*;?/),
    trimmed.match(/window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*\})\s*;?/)
  ];
  for (const match of assignmentMatches) {
    const raw = match?.[1];
    if (!raw) continue;
    try {
      return JSON.parse(raw);
    } catch {
      continue;
    }
  }
  return null;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function extractTileRowsFromHtml(html: string): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  const anchorRegex =
    /<a[^>]*href="([^"]+)"[^>]*data-tn="item-tile-title-anchor"[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html))) {
    const href = normalizeUrl(match[1] ?? "");
    const rawTitle = decodeHtmlEntities((match[2] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (!href || !rawTitle) continue;
    const key = `${href}|${rawTitle}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const start = Math.max(0, match.index - 3000);
    const end = Math.min(html.length, match.index + 3000);
    const around = html.slice(start, end);
    const priceMatch = around.match(/\$([0-9][0-9,]*(?:\.[0-9]{2})?)/);
    const imageMatch = around.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
    const price = priceMatch ? Number(priceMatch[1].replace(/,/g, "")) : NaN;
    const row: Record<string, unknown> = {
      title: rawTitle,
      name: rawTitle,
      url: href,
      href
    };
    if (Number.isFinite(price) && price > 0) row.price = price;
    if (imageMatch?.[1]) row.image = imageMatch[1];
    rows.push(row);
  }
  return rows;
}

function extractHeuristicRowsFromScripts(html: string): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];
  const seen = new Set<string>();
  for (const match of scripts) {
    const attrs = (match[1] ?? "").toLowerCase();
    const content = match[2] ?? "";
    const maybeJsonScript =
      attrs.includes("application/json") ||
      attrs.includes("application/ld+json") ||
      attrs.includes("__next_data__") ||
      content.includes("__NEXT_DATA__") ||
      content.includes("__NUXT__") ||
      content.includes("__INITIAL_STATE__");
    if (!maybeJsonScript) continue;
    const parsed = parseJsonFromScriptBlock(content);
    if (!parsed) continue;

    const walk = (value: unknown, depth = 0) => {
      if (depth > 9 || value === null || value === undefined) return;
      if (Array.isArray(value)) {
        value.forEach((entry) => walk(entry, depth + 1));
        return;
      }
      if (typeof value !== "object") return;
      const row = value as Record<string, unknown>;
      if (looksLikeListingRow(row)) {
        const key =
          pickStringByPaths(row, ["id", "sku", "productId", "slug", "url"], "") ||
          JSON.stringify([row.title, row.name, row.price, row.currentPrice]);
        if (!seen.has(key)) {
          seen.add(key);
          rows.push(row);
        }
      }
      for (const child of Object.values(row)) {
        walk(child, depth + 1);
      }
    };
    walk(parsed, 0);
  }
  return rows;
}

function createMockListing(
  platform: string,
  query: string,
  category: ListingCategory,
  price: number
): CanonicalListing {
  const now = new Date().toISOString();
  const listing: CanonicalListing = {
    listing_id: `${platform}-${Math.random().toString(36).slice(2, 10)}`,
    platform_listing_id: Math.random().toString(36).slice(2, 10),
    platform,
    platform_listing_url: `https://${platform}.example.com/listing/${encodeURIComponent(query)}`,
    brand: query.split(" ")[0] ?? "Unknown",
    category,
    subcategory: `${category}_item`,
    title: `${query} - ${platform} listing`,
    description: `Mock listing from ${platform} for ${query}.`,
    price_usd: price,
    original_currency: "USD",
    original_price: price,
    condition: "excellent",
    condition_raw: "Excellent",
    images: [
      "https://images.unsplash.com/photo-1547996160-81dfa63595aa?w=640",
      "https://images.unsplash.com/photo-1509319117193-57bab727e09d?w=640",
      "https://images.unsplash.com/photo-1594534475808-b18fc33b045e?w=640"
    ],
    size: null,
    color: "black",
    material: "leather",
    seller_rating: 4.7,
    seller_sales_count: 125,
    seller_verified: true,
    authentication_status: "platform_authenticated",
    authentication_badge: "Verified",
    listed_at: now,
    scraped_at: now,
    is_available: true,
    shipping_available_us: true,
    location_country: "US",
    platform_fees_buyer_pct: platform === "vestiaire" ? 15 : null,
    trust_score: 0
  };
  listing.trust_score = computeTrustScore(listing, listing.price_usd);
  return listing;
}

export class MockMarketplaceAdapter implements MarketplaceAdapter {
  constructor(public readonly platform: string) {}

  async search(query: string, category: ListingCategory): Promise<CanonicalListing[]> {
    const base = 1000 + Math.floor(Math.random() * 2000);
    return [
      createMockListing(this.platform, query, category, base),
      createMockListing(this.platform, `${query} vintage`, category, base + 400)
    ];
  }
}

type ScrapeSource = {
  platform: string;
  searchUrl: (query: string) => string;
  buyerFeePct: number | null;
};

const SCRAPE_SOURCES: ScrapeSource[] = [
  {
    platform: "1stdibs",
    searchUrl: (query) => `https://www.1stdibs.com/search/?q=${encodeURIComponent(query)}`,
    buyerFeePct: null
  },
  {
    platform: "rebag",
    searchUrl: (query) => `https://shop.rebag.com/search?q=${encodeURIComponent(query)}`,
    buyerFeePct: null
  },
  {
    platform: "grailed",
    searchUrl: (query) => `https://www.grailed.com/shop/${slugifyQuery(query)}`,
    buyerFeePct: null
  },
  {
    platform: "fashionphile",
    searchUrl: (query) => `https://www.fashionphile.com/shop?term=${encodeURIComponent(query)}`,
    buyerFeePct: null
  },
  {
    platform: "watchbox",
    searchUrl: (query) => `https://www.thewatchbox.com/search?q=${encodeURIComponent(query)}`,
    buyerFeePct: null
  },
  {
    platform: "chronext",
    searchUrl: (query) => `https://www.chronext.com/search?query=${encodeURIComponent(query)}`,
    buyerFeePct: null
  }
];

export class ScrapedMarketplaceAdapter implements MarketplaceAdapter {
  readonly platform: string;
  private readonly searchUrlFactory: (query: string) => string;
  private readonly buyerFeePct: number | null;

  constructor(source: ScrapeSource) {
    this.platform = source.platform;
    this.searchUrlFactory = source.searchUrl;
    this.buyerFeePct = source.buyerFeePct;
  }

  private mapScrapedProduct(
    row: Record<string, unknown>,
    query: string,
    category: ListingCategory,
    baseUrl: string
  ): CanonicalListing | null {
    const now = new Date().toISOString();
    const offersRaw = Array.isArray(row.offers) ? row.offers[0] : row.offers;
    const offers = fromUnknownRecord(offersRaw);
    const imageRaw = row.image;
    const image =
      typeof imageRaw === "string"
        ? normalizeUrl(imageRaw)
        : Array.isArray(imageRaw)
          ? normalizeUrl(asString(imageRaw[0]))
          : normalizeUrl(asString(fromUnknownRecord(imageRaw).url));
    const listingUrl = absolutizeUrl(
      pickStringByPaths(row, ["url", "href", "productUrl", "product_url", "item.url", "seo.url"]),
      baseUrl
    );
    if (!listingUrl) return null;
    const originalCurrency = pickStringByPaths(
      row,
      ["offers.priceCurrency", "currency", "priceCurrency", "pricing.currency", "price.currency"],
      asString(offers.priceCurrency, "USD")
    ).toUpperCase();
    const originalPrice = pickNumberByPaths(
      row,
      [
        "offers.price",
        "price",
        "price.value",
        "currentPrice",
        "salePrice",
        "amount",
        "pricing.price",
        "item.price",
        "item.price.value"
      ],
      asNumber(offers.price, asNumber(row.price, asNumber(offers.lowPrice, asNumber(offers.highPrice, 0))))
    );
    const priceUsd = normalizeCurrencyToUsd(originalPrice, originalCurrency, FX_RATES);
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) return null;
    const title = pickStringByPaths(row, ["name", "title", "productName", "item.title", "item.name"], `${query} listing`);
    const idSeed =
      pickStringByPaths(row, ["sku", "productID", "productId", "id", "item.id", "slug", "mpn"]) ||
      Buffer.from(listingUrl).toString("base64url").slice(0, 18);
    const conditionRaw = pickStringByPaths(
      row,
      ["offers.itemCondition", "itemCondition", "condition", "item.condition"],
      asString(offers.itemCondition) || asString(row.itemCondition) || "Used"
    );
    const listing: CanonicalListing = {
      listing_id: `${this.platform}-${idSeed}`,
      platform_listing_id: idSeed,
      platform: this.platform,
      platform_listing_url: listingUrl,
      brand: pickStringByPaths(row, ["brand", "brand.name", "manufacturer", "item.brand"], title.split(" ")[0] ?? "Unknown"),
      category,
      subcategory: `${category}_item`,
      title,
      description: pickStringByPaths(row, ["description", "shortDescription", "item.description"], title),
      price_usd: priceUsd,
      original_currency: originalCurrency,
      original_price: originalPrice,
      condition: normalizeCondition(conditionRaw),
      condition_raw: conditionRaw,
      images: image ? [image] : [],
      size: null,
      color: null,
      material: pickStringByPaths(row, ["material", "item.material", "attributes.material"]) || null,
      seller_rating: null,
      seller_sales_count: null,
      seller_verified: false,
      authentication_status: "unverified",
      authentication_badge: null,
      listed_at: now,
      scraped_at: now,
      is_available: true,
      shipping_available_us: true,
      location_country: null,
      platform_fees_buyer_pct: this.buyerFeePct,
      trust_score: 0
    };
    listing.trust_score = computeTrustScore(listing, listing.price_usd);
    return listing;
  }

  async search(query: string, category: ListingCategory): Promise<CanonicalListing[]> {
    const searchUrl = this.searchUrlFactory(query);
    try {
      const response = await fetchWithTimeout(
        searchUrl,
        {
          headers: {
            Accept: "text/html,application/xhtml+xml,application/json",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
          }
        },
        9000
      );
      if (!response.ok) throw new Error(`${this.platform} scrape failed (${response.status})`);
      const html = await response.text();
      const parsed = [...extractJsonLdProducts(html), ...extractHeuristicRowsFromScripts(html), ...extractTileRowsFromHtml(html)]
        .map((row) => this.mapScrapedProduct(row, query, category, searchUrl))
        .filter((row): row is CanonicalListing => Boolean(row));
      if (!parsed.length) return [];
      const deduped = new Map<string, CanonicalListing>();
      for (const listing of parsed) {
        const dedupeKey = `${listing.platform}:${listing.platform_listing_id}`;
        if (!deduped.has(dedupeKey)) deduped.set(dedupeKey, listing);
      }
      return Array.from(deduped.values()).slice(0, 20);
    } catch {
      return [];
    }
  }
}

type EbayItem = {
  itemId: string;
  title: string;
  itemWebUrl: string;
  condition?: string;
  image?: { imageUrl?: string };
  additionalImages?: Array<{ imageUrl?: string }>;
  price?: { value: string; currency: string };
  seller?: { feedbackPercentage?: string };
  itemLocation?: { country?: string };
};

type EbaySearchResponse = {
  itemSummaries?: EbayItem[];
};

export class EbayAdapter implements MarketplaceAdapter {
  readonly platform = "ebay";

  constructor(private readonly oauthToken?: string) {}

  private ebayBaseUrl(): string {
    return String(process.env.EBAY_ENVIRONMENT ?? "production").toLowerCase() === "sandbox"
      ? "https://api.sandbox.ebay.com"
      : "https://api.ebay.com";
  }

  private ebayMarketplaceId(): string {
    return process.env.EBAY_MARKETPLACE_ID?.trim() || "EBAY_US";
  }

  async search(query: string, category: ListingCategory): Promise<CanonicalListing[]> {
    if (!this.oauthToken) {
      return [];
    }

    const params = new URLSearchParams({
      q: query,
      limit: "20",
      filter: "conditions:{NEW|USED}",
      sort: "price"
    });

    const response = await fetch(`${this.ebayBaseUrl()}/buy/browse/v1/item_summary/search?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${this.oauthToken}`,
        "X-EBAY-C-MARKETPLACE-ID": this.ebayMarketplaceId()
      }
    });

    if (!response.ok) throw new Error(`eBay search failed (${response.status})`);
    const json = (await response.json()) as EbaySearchResponse;
    return (json.itemSummaries ?? []).map((item): CanonicalListing => {
      const originalCurrency = item.price?.currency ?? "USD";
      const originalPrice = Number(item.price?.value ?? 0);
      const priceUsd = normalizeCurrencyToUsd(originalPrice, originalCurrency, FX_RATES);
      const conditionRaw = item.condition ?? "Used";
      const sellerRating = item.seller?.feedbackPercentage
        ? Number(item.seller.feedbackPercentage) / 20
        : null;
      const listing: CanonicalListing = {
        listing_id: `ebay-${item.itemId}`,
        platform_listing_id: item.itemId,
        platform: "ebay",
        platform_listing_url: item.itemWebUrl,
        brand: (item.title.split(" ")[0] ?? "Unknown").replace(/[^a-zA-Z0-9-]/g, ""),
        category,
        subcategory: `${category}_item`,
        title: item.title,
        description: item.title,
        price_usd: priceUsd,
        original_currency: originalCurrency,
        original_price: originalPrice,
        condition: normalizeCondition(conditionRaw),
        condition_raw: conditionRaw,
        images: [
          item.image?.imageUrl,
          ...(item.additionalImages?.map((image) => image.imageUrl) ?? [])
        ].filter((url): url is string => Boolean(url)),
        size: null,
        color: null,
        material: null,
        seller_rating: sellerRating,
        seller_sales_count: null,
        seller_verified: false,
        authentication_status: normalizeAuthStatus("ebay", false),
        authentication_badge: null,
        listed_at: new Date().toISOString(),
        scraped_at: new Date().toISOString(),
        is_available: true,
        shipping_available_us: true,
        location_country: item.itemLocation?.country ?? null,
        platform_fees_buyer_pct: null,
        trust_score: 0
      };
      listing.trust_score = computeTrustScore(listing, listing.price_usd);
      return listing;
    });
  }
}

abstract class PartnerRestAdapter implements MarketplaceAdapter {
  abstract readonly platform: string;
  protected abstract readonly apiKey: string | undefined;
  protected abstract readonly baseUrl: string;
  protected abstract readonly buyerFeePct: number | null;

  protected mapPartnerItem(item: unknown, category: ListingCategory): CanonicalListing {
    const row = fromUnknownRecord(item);
    const imageCandidates = [
      ...asStringArray(row.images),
      asString(row.image_url),
      asString(row.thumbnail),
      ...maybeArray(row.photos).map((photo) => asString(fromUnknownRecord(photo).url))
    ].filter(Boolean);
    const idRaw = asString(row.id) || asString(row.listing_id) || Math.random().toString(36).slice(2, 10);
    const title = asString(row.title) || asString(row.name) || `${this.platform} listing`;
    const brand = asString(row.brand) || (title.split(" ")[0] ?? "Unknown");
    const currency = asString(row.currency, "USD").toUpperCase();
    const originalPrice = asNumber(row.price, asNumber(row.price_amount, 0));
    const conditionRaw = asString(row.condition, "Good");
    const seller = fromUnknownRecord(row.seller);
    const listingUrl = asString(row.url) || asString(row.listing_url);

    const listing: CanonicalListing = {
      listing_id: `${this.platform}-${idRaw}`,
      platform_listing_id: idRaw,
      platform: this.platform,
      platform_listing_url: listingUrl || `${this.baseUrl}/listing/${idRaw}`,
      brand,
      category,
      subcategory: asString(row.subcategory, `${category}_item`),
      title,
      description: asString(row.description, title),
      price_usd: normalizeCurrencyToUsd(originalPrice, currency, FX_RATES),
      original_currency: currency,
      original_price: originalPrice,
      condition: normalizeCondition(conditionRaw),
      condition_raw: conditionRaw,
      images: imageCandidates,
      size: asString(row.size) || null,
      color: asString(row.color) || null,
      material: asString(row.material) || null,
      seller_rating: asNullableNumber(seller.rating),
      seller_sales_count: asNullableNumber(seller.sales_count),
      seller_verified: asBool(seller.verified, false),
      authentication_status: normalizeAuthStatus(this.platform, asBool(row.verified, false)),
      authentication_badge: asString(row.authentication_badge) || null,
      listed_at: asString(row.listed_at) || new Date().toISOString(),
      scraped_at: new Date().toISOString(),
      is_available: asBool(row.is_available, true),
      shipping_available_us: asBool(row.shipping_available_us, true),
      location_country: asString(row.location_country) || null,
      platform_fees_buyer_pct: this.buyerFeePct,
      trust_score: 0
    };
    listing.trust_score = computeTrustScore(listing, listing.price_usd);
    return listing;
  }

  protected async fetchPartnerListings(query: string): Promise<unknown[]> {
    const url = new URL(`${this.baseUrl}/listings/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "20");

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "x-api-key": this.apiKey ?? "",
        Accept: "application/json"
      }
    });
    if (!response.ok) throw new Error(`${this.platform} search failed (${response.status})`);
    const payload = fromUnknownRecord(await response.json());
    const data =
      maybeArray(payload.items).length > 0
        ? maybeArray(payload.items)
        : maybeArray(payload.results).length > 0
          ? maybeArray(payload.results)
          : maybeArray(payload.data);
    return data;
  }

  async search(query: string, category: ListingCategory): Promise<CanonicalListing[]> {
    if (!this.apiKey) return [];
    const items = await this.fetchPartnerListings(query);
    if (!items.length) return [];
    return items.map((item) => this.mapPartnerItem(item, category));
  }
}

export class Chrono24Adapter extends PartnerRestAdapter {
  readonly platform = "chrono24";
  protected readonly apiKey: string | undefined;
  protected readonly baseUrl = process.env.CHRONO24_BASE_URL ?? "https://api.chrono24.com/v1";
  protected readonly buyerFeePct = null;
  private readonly scrapeFallback = new ScrapedMarketplaceAdapter({
    platform: "chrono24",
    searchUrl: (query) => `https://www.chrono24.com/search/index.htm?query=${encodeURIComponent(query)}`,
    buyerFeePct: null
  });

  constructor(runtimeApiKey?: string) {
    super();
    this.apiKey = runtimeApiKey ?? process.env.CHRONO24_API_KEY;
  }

  async search(query: string, category: ListingCategory): Promise<CanonicalListing[]> {
    if (this.apiKey) {
      try {
        const items = await this.fetchPartnerListings(query);
        if (items.length) return items.map((item) => this.mapPartnerItem(item, category));
      } catch {
        // Fall through to public-page scraping when partner API is unavailable.
      }
    }
    return this.scrapeFallback.search(query, category);
  }
}

export class TheRealRealAdapter extends PartnerRestAdapter {
  readonly platform = "therealreal";
  protected readonly apiKey: string | undefined;
  protected readonly baseUrl = process.env.THEREALREAL_BASE_URL ?? "https://api.therealreal.com/v1";
  protected readonly buyerFeePct = null;
  private readonly scrapeFallback = new ScrapedMarketplaceAdapter({
    platform: "therealreal",
    searchUrl: (query) => `https://www.therealreal.com/search?q=${encodeURIComponent(query)}`,
    buyerFeePct: null
  });

  constructor(runtimeApiKey?: string) {
    super();
    this.apiKey = runtimeApiKey ?? process.env.THEREALREAL_API_KEY;
  }

  async search(query: string, category: ListingCategory): Promise<CanonicalListing[]> {
    if (this.apiKey) {
      try {
        const items = await this.fetchPartnerListings(query);
        if (items.length) return items.map((item) => this.mapPartnerItem(item, category));
      } catch {
        // Fall through to public-page scraping when partner API is unavailable.
      }
    }
    return this.scrapeFallback.search(query, category);
  }
}

export class VestiaireAdapter extends PartnerRestAdapter {
  readonly platform = "vestiaire";
  protected readonly apiKey: string | undefined;
  protected readonly baseUrl = process.env.VESTIAIRE_BASE_URL ?? "https://api.vestiairecollective.com/v1";
  protected readonly buyerFeePct = 15;
  private readonly scrapeFallback = new ScrapedMarketplaceAdapter({
    platform: "vestiaire",
    searchUrl: (query) => `https://www.vestiairecollective.com/search/?q=${encodeURIComponent(query)}`,
    buyerFeePct: 15
  });

  constructor(runtimeApiKey?: string) {
    super();
    this.apiKey = runtimeApiKey ?? process.env.VESTIAIRE_API_KEY;
  }

  async search(query: string, category: ListingCategory): Promise<CanonicalListing[]> {
    if (this.apiKey) {
      try {
        const items = await this.fetchPartnerListings(query);
        if (items.length) return items.map((item) => this.mapPartnerItem(item, category));
      } catch {
        // Fall through to public-page scraping when partner API is unavailable.
      }
    }
    return this.scrapeFallback.search(query, category);
  }
}

type ShopGoodwillItem = {
  itemId?: number | string;
  title?: string;
  imageURL?: string;
  itemImageURL?: string;
  currentPrice?: number | string;
  minimumBid?: number | string;
  categoryName?: string;
  sellerName?: string;
  sellerId?: number | string;
  endTime?: string;
  numBids?: number;
  shippingPrice?: number | string;
};

type ShopGoodwillSearchResponse = {
  searchResults?: {
    items?: ShopGoodwillItem[];
    itemCount?: number;
  };
};

export class ShopGoodwillAdapter implements MarketplaceAdapter {
  readonly platform = "shopgoodwill";
  private readonly enabled = (process.env.SHOPGOODWILL_ENABLED ?? "true").toLowerCase() !== "false";
  private readonly apiRoot = process.env.SHOPGOODWILL_API_ROOT ?? "https://buyerapi.shopgoodwill.com/api";
  private readonly accessToken?: string;
  private readonly username?: string;
  private readonly password?: string;

  constructor(credentials?: RuntimeCredentials["shopgoodwill"]) {
    this.accessToken = credentials?.access_token;
    this.username = credentials?.username;
    this.password = credentials?.password;
  }

  private encryptLoginValue(plaintext: string): string {
    const { createCipheriv } = require("node:crypto") as typeof import("node:crypto");
    const key = Buffer.from("6696D2E6F042FEC4D6E3F32AD541143B", "utf8");
    const iv = Buffer.from("0000000000000000", "utf8");
    const cipher = createCipheriv("aes-256-cbc", key, iv);
    const encrypted = Buffer.concat([cipher.update(Buffer.from(plaintext, "utf8")), cipher.final()]);
    return encodeURIComponent(encrypted.toString("base64"));
  }

  private async resolveAccessToken(): Promise<string | undefined> {
    if (this.accessToken) return this.accessToken;
    if (!this.username || !this.password) return undefined;
    const body = {
      browser: "firefox",
      remember: false,
      clientIpAddress: "0.0.0.4",
      appVersion: "00099a1be3bb023ff17d",
      username: this.encryptLoginValue(this.username),
      password: this.encryptLoginValue(this.password)
    };
    const response = await fetchWithTimeout(
      `${this.apiRoot}/SignIn/Login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
        },
        body: JSON.stringify(body)
      },
      8000
    );
    if (!response.ok) return undefined;
    const json = fromUnknownRecord(await response.json());
    return asString(json.accessToken) || undefined;
  }

  async search(query: string, category: ListingCategory): Promise<CanonicalListing[]> {
    if (!this.enabled) return [];
    const accessToken = await this.resolveAccessToken();

    const payload = {
      page: 1,
      pageSize: 24,
      sortColumn: "1",
      sortDescending: "false",
      searchText: query.replace(/"/g, ""),
      selectedCategoryIds: "",
      selectedSellerIds: "",
      lowPrice: "0",
      highPrice: "999999",
      searchBuyNowOnly: "",
      searchPickupOnly: "false",
      searchNoPickupOnly: "false",
      searchOneCentShippingOnly: "false",
      searchDescriptions: "false",
      searchClosedAuctions: "false",
      closedAuctionEndingDate: "1/1/1970",
      closedAuctionDaysBack: "7",
      searchCanadaShipping: "false",
      searchInternationalShippingOnly: "false",
      useBuyerPrefs: "true",
      searchUSOnlyShipping: "false",
      categoryLevelNo: "1",
      categoryLevel: 1,
      categoryId: 0,
      partNumber: "",
      catIds: ""
    };

    const response = await fetchWithTimeout(
      `${this.apiRoot}/Search/ItemListing`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
        },
        body: JSON.stringify(payload)
      },
      9000
    );

    if (!response.ok) {
      throw new Error(`shopgoodwill search failed (${response.status})`);
    }

    const json = (await response.json()) as ShopGoodwillSearchResponse;
    const items = json.searchResults?.items ?? [];
    const now = new Date().toISOString();

    return items.map((item): CanonicalListing => {
      const id = String(item.itemId ?? Math.random().toString(36).slice(2, 10));
      const originalPrice = asNumber(item.currentPrice, asNumber(item.minimumBid, 0));
      const title = asString(item.title, `ShopGoodwill item ${id}`);
      const listing: CanonicalListing = {
        listing_id: `shopgoodwill-${id}`,
        platform_listing_id: id,
        platform: "shopgoodwill",
        platform_listing_url: `https://shopgoodwill.com/item/${id}`,
        brand: title.split(" ")[0] ?? "Unknown",
        category,
        subcategory: `${category}_item`,
        title,
        description: `${title} (ShopGoodwill auction listing)`,
        price_usd: originalPrice,
        original_currency: "USD",
        original_price: originalPrice,
        condition: "good",
        condition_raw: "Auction",
        images: [asString(item.imageURL), asString(item.itemImageURL)].filter(Boolean),
        size: null,
        color: null,
        material: null,
        seller_rating: null,
        seller_sales_count: null,
        seller_verified: false,
        authentication_status: "unverified",
        authentication_badge: null,
        listed_at: asString(item.endTime, now),
        scraped_at: now,
        is_available: true,
        shipping_available_us: true,
        location_country: "US",
        platform_fees_buyer_pct: null,
        trust_score: 0
      };
      listing.trust_score = computeTrustScore(listing, listing.price_usd);
      return listing;
    });
  }
}

export function getTierOneAdapters(options?: {
  ebayToken?: string;
  runtimeCredentials?: RuntimeCredentials;
}): MarketplaceAdapter[] {
  const runtime = options?.runtimeCredentials;
  const scrapedAdapters = SCRAPE_SOURCES.map((source) => new ScrapedMarketplaceAdapter(source));
  return [
    new EbayAdapter(runtime?.ebay?.oauth_token ?? options?.ebayToken),
    new ShopGoodwillAdapter(runtime?.shopgoodwill),
    new TheRealRealAdapter(runtime?.therealreal?.api_key),
    new VestiaireAdapter(runtime?.vestiaire?.api_key),
    new Chrono24Adapter(runtime?.chrono24?.api_key),
    ...scrapedAdapters
  ];
}
