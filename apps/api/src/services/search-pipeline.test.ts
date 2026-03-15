import test from "node:test";
import assert from "node:assert/strict";
import type { CanonicalListing } from "@luxefinder/shared";
import {
  buildQueryCandidates,
  filterRankedListingsForImageSearch,
  getMarketAveragePrice,
  resolveSearchPrecision,
  resolveSearchSizeText,
  scoreRelevance,
  shouldRetryAdapter
} from "./search-pipeline";

function listing(overrides: Partial<CanonicalListing> = {}): CanonicalListing {
  return {
    listing_id: "ebay-1",
    platform_listing_id: "1",
    platform: "ebay",
    platform_listing_url: "https://example.com",
    brand: "Rolex",
    category: "watch",
    subcategory: "watch_item",
    title: "Rolex Submariner Date",
    description: "Rolex watch",
    price_usd: 10000,
    original_currency: "USD",
    original_price: 10000,
    condition: "excellent",
    condition_raw: "Excellent",
    images: ["https://img/1.jpg"],
    size: null,
    color: null,
    material: null,
    seller_rating: 4.8,
    seller_sales_count: 80,
    seller_verified: true,
    authentication_status: "platform_authenticated",
    authentication_badge: "Verified",
    listed_at: new Date().toISOString(),
    scraped_at: new Date().toISOString(),
    is_available: true,
    shipping_available_us: true,
    location_country: "US",
    platform_fees_buyer_pct: null,
    trust_score: 90,
    ...overrides
  };
}

test("scoreRelevance favors matching query and trust", () => {
  const high = scoreRelevance("Rolex Submariner", listing({ trust_score: 90 }));
  const low = scoreRelevance("Omega Speedmaster", listing({ trust_score: 10 }));
  assert.equal(high > low, true);
});

test("getMarketAveragePrice computes mean", () => {
  const avg = getMarketAveragePrice([listing({ price_usd: 100 }), listing({ price_usd: 300 })]);
  assert.equal(avg, 200);
});

test("shouldRetryAdapter matches retryable error signatures", () => {
  assert.equal(shouldRetryAdapter(new Error("429 too many requests")), true);
  assert.equal(shouldRetryAdapter(new Error("503 service unavailable")), true);
  assert.equal(shouldRetryAdapter(new Error("validation failed")), false);
});

test("resolveSearchPrecision clamps to allowed range", () => {
  assert.equal(resolveSearchPrecision(undefined), 75);
  assert.equal(resolveSearchPrecision({ search: { precision: 160 } }), 100);
  assert.equal(resolveSearchPrecision({ search: { precision: 2 } }), 10);
  assert.equal(resolveSearchPrecision({ search: { precision: 62.2 } }), 62);
});

test("buildQueryCandidates broadens query at lower precision", () => {
  const exact = buildQueryCandidates("gucci giglio small tote bag", 95);
  const broad = buildQueryCandidates("gucci giglio small tote bag", 55);
  assert.equal(exact.length, 1);
  assert.equal(exact[0], "gucci giglio small tote bag");
  assert.equal(broad.includes("gucci bag"), true);
  assert.equal(broad.includes("gucci"), true);
});

test("resolveSearchSizeText normalizes and bounds size input", () => {
  assert.equal(resolveSearchSizeText(undefined), null);
  assert.equal(resolveSearchSizeText({ search: { size_text: "  42 EU  " } }), "42 EU");
  assert.equal(resolveSearchSizeText({ search: { size_text: "   " } }), null);
});

test("filterRankedListingsForImageSearch keeps category-relevant items", () => {
  const ranked = [
    { listing: listing({ category: "shoes", title: "Gucci Loafers Brown Leather", brand: "Gucci" }), relevance: 0.62 },
    { listing: listing({ category: "shoes", title: "Mens leather loafers vintage", brand: "Unknown" }), relevance: 0.4 },
    { listing: listing({ category: "apparel", title: "Phoenix Suns T Shirt", brand: "Pro Standard" }), relevance: 0.35 }
  ];
  const filtered = filterRankedListingsForImageSearch(
    ranked,
    {
      brand: null,
      category: "shoes",
      subcategory: "loafers",
      color_primary: "brown",
      color_secondary: null,
      material: "leather",
      style_keywords: ["loafers"],
      model_name: null,
      estimated_era: null,
      confidence: 0.72
    },
    75
  );
  assert.equal(filtered.some((entry) => entry.listing.category === "apparel"), false);
  assert.equal(filtered.length >= 1, true);
});

test("filterRankedListingsForImageSearch prefers exact detected brand", () => {
  const ranked = [
    { listing: listing({ category: "shoes", brand: "Gucci", title: "Gucci Brixton Horsebit Loafer" }), relevance: 0.5 },
    { listing: listing({ category: "shoes", brand: "Prada", title: "Prada Running Sneakers" }), relevance: 0.55 }
  ];
  const filtered = filterRankedListingsForImageSearch(
    ranked,
    {
      brand: "Gucci",
      category: "shoes",
      subcategory: "loafers",
      color_primary: null,
      color_secondary: null,
      material: null,
      style_keywords: ["horsebit"],
      model_name: "Brixton",
      estimated_era: null,
      confidence: 0.82
    },
    85
  );
  assert.equal(filtered.some((entry) => entry.listing.brand === "Gucci"), true);
});
