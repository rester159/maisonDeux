import { computeTrustScore, type CanonicalListing, type ListingCategory } from "@luxefinder/shared";
import { normalizeAuthStatus, normalizeCondition, normalizeCurrencyToUsd } from "./normalization";

export interface MarketplaceAdapter {
  readonly platform: string;
  search(query: string, analysisCategory: ListingCategory): Promise<CanonicalListing[]>;
}

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

  async search(query: string, category: ListingCategory): Promise<CanonicalListing[]> {
    if (!this.oauthToken) {
      return [
        createMockListing(this.platform, `${query} (mock)`, category, 2490),
        createMockListing(this.platform, `${query} (mock alt)`, category, 3190)
      ];
    }

    const params = new URLSearchParams({
      q: query,
      limit: "20",
      filter: "conditions:{NEW|USED}",
      sort: "price"
    });

    const response = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${this.oauthToken}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"
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
  protected abstract readonly apiKey?: string;
  protected abstract readonly baseUrl: string;
  protected abstract readonly buyerFeePct: number | null;

  protected fallback(query: string, category: ListingCategory): CanonicalListing[] {
    return [
      createMockListing(this.platform, `${query} (mock)`, category, 1900),
      createMockListing(this.platform, `${query} (mock alt)`, category, 2400)
    ];
  }

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
    if (!this.apiKey) return this.fallback(query, category);
    const items = await this.fetchPartnerListings(query);
    if (!items.length) return this.fallback(query, category);
    return items.map((item) => this.mapPartnerItem(item, category));
  }
}

export class Chrono24Adapter extends PartnerRestAdapter {
  readonly platform = "chrono24";
  protected readonly apiKey = process.env.CHRONO24_API_KEY;
  protected readonly baseUrl = process.env.CHRONO24_BASE_URL ?? "https://api.chrono24.com/v1";
  protected readonly buyerFeePct = null;
}

export class TheRealRealAdapter extends PartnerRestAdapter {
  readonly platform = "therealreal";
  protected readonly apiKey = process.env.THEREALREAL_API_KEY;
  protected readonly baseUrl = process.env.THEREALREAL_BASE_URL ?? "https://api.therealreal.com/v1";
  protected readonly buyerFeePct = null;
}

export class VestiaireAdapter extends PartnerRestAdapter {
  readonly platform = "vestiaire";
  protected readonly apiKey = process.env.VESTIAIRE_API_KEY;
  protected readonly baseUrl = process.env.VESTIAIRE_BASE_URL ?? "https://api.vestiairecollective.com/v1";
  protected readonly buyerFeePct = 15;
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

  async search(query: string, category: ListingCategory): Promise<CanonicalListing[]> {
    if (!this.enabled) return [];

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

export function getTierOneAdapters(ebayToken?: string): MarketplaceAdapter[] {
  return [
    new EbayAdapter(ebayToken),
    new ShopGoodwillAdapter(),
    new TheRealRealAdapter(),
    new VestiaireAdapter(),
    new Chrono24Adapter(),
    new MockMarketplaceAdapter("1stdibs"),
    new MockMarketplaceAdapter("rebag"),
    new MockMarketplaceAdapter("grailed"),
    new MockMarketplaceAdapter("fashionphile"),
    new MockMarketplaceAdapter("watchbox"),
    new MockMarketplaceAdapter("chronext")
  ];
}
