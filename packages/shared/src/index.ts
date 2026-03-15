export type ListingCategory =
  | "watch"
  | "jewelry"
  | "bag"
  | "shoes"
  | "apparel"
  | "accessory";

export type ListingCondition =
  | "new_with_tags"
  | "like_new"
  | "excellent"
  | "good"
  | "fair"
  | "poor";

export type AuthStatus =
  | "platform_authenticated"
  | "seller_claimed"
  | "unverified";

export interface ImageAnalysis {
  brand: string | null;
  category: ListingCategory;
  subcategory: string;
  color_primary: string | null;
  color_secondary: string | null;
  material: string | null;
  style_keywords: string[];
  model_name: string | null;
  estimated_era: string | null;
  confidence: number;
}

export interface CanonicalListing {
  listing_id: string;
  platform_listing_id: string;
  platform: string;
  platform_listing_url: string;
  brand: string;
  category: ListingCategory;
  subcategory: string;
  title: string;
  description: string;
  price_usd: number;
  original_currency: string;
  original_price: number;
  condition: ListingCondition;
  condition_raw: string;
  images: string[];
  size: string | null;
  color: string | null;
  material: string | null;
  seller_rating: number | null;
  seller_sales_count: number | null;
  seller_verified: boolean;
  authentication_status: AuthStatus;
  authentication_badge: string | null;
  listed_at: string;
  scraped_at: string;
  is_available: boolean;
  shipping_available_us: boolean;
  location_country: string | null;
  platform_fees_buyer_pct: number | null;
  trust_score: number;
  estimated_retail_price_usd?: number | null;
  retail_price_source?: string | null;
}

export const TRUST_DISCLAIMER =
  "maisonDeux is a search aggregator. We do not authenticate items. Always review the source platform's guarantee before purchasing.";

export function buildSearchQuery(analysis: ImageAnalysis): string {
  const { brand, model_name, category, subcategory, style_keywords } = analysis;
  if (brand && model_name) return `${brand} ${model_name}`;
  if (brand && subcategory) return `${brand} ${subcategory.replace(/_/g, " ")}`;
  if (brand) return `${brand} ${category}`;
  return `${style_keywords.slice(0, 3).join(" ")} ${category}`.trim();
}

export function computeTrustScore(
  listing: Pick<
    CanonicalListing,
    | "authentication_status"
    | "seller_rating"
    | "seller_sales_count"
    | "images"
    | "price_usd"
    | "brand"
    | "subcategory"
  >,
  marketAveragePriceUsd?: number
): number {
  let score = 0;
  if (listing.authentication_status === "platform_authenticated") score += 50;
  if ((listing.seller_rating ?? 0) >= 4.5) score += 20;
  if ((listing.seller_sales_count ?? 0) >= 50) score += 10;
  if (listing.images.length >= 3) score += 10;
  if (
    marketAveragePriceUsd &&
    Math.abs(listing.price_usd - marketAveragePriceUsd) / marketAveragePriceUsd <= 0.2
  ) {
    score += 10;
  }
  return Math.max(0, Math.min(100, score));
}
