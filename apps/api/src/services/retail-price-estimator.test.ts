import test from "node:test";
import assert from "node:assert/strict";
import type { CanonicalListing } from "@luxefinder/shared";
import { enrichListingsWithRetailPrice } from "./retail-price-estimator";

function listing(overrides: Partial<CanonicalListing> = {}): CanonicalListing {
  return {
    listing_id: "ebay-1",
    platform_listing_id: "1",
    platform: "ebay",
    platform_listing_url: "https://example.com",
    brand: "Gucci",
    category: "shoes",
    subcategory: "loafers",
    title: "Gucci Brixton Horsebit Loafer",
    description: "Test listing",
    price_usd: 700,
    original_currency: "USD",
    original_price: 700,
    condition: "excellent",
    condition_raw: "Excellent",
    images: [],
    size: null,
    color: null,
    material: null,
    seller_rating: null,
    seller_sales_count: null,
    seller_verified: false,
    authentication_status: "unverified",
    authentication_badge: null,
    listed_at: new Date().toISOString(),
    scraped_at: new Date().toISOString(),
    is_available: true,
    shipping_available_us: true,
    location_country: "US",
    platform_fees_buyer_pct: null,
    trust_score: 50,
    ...overrides
  };
}

test("enrichListingsWithRetailPrice leaves listing when no SerpAPI key", async () => {
  const previous = process.env.SERPAPI_API_KEY;
  delete process.env.SERPAPI_API_KEY;
  const results = await enrichListingsWithRetailPrice([listing()], "gucci loafers");
  assert.equal(results.length, 1);
  assert.equal(results[0].estimated_retail_price_usd ?? null, null);
  assert.equal(results[0].retail_price_source ?? null, null);
  if (previous) process.env.SERPAPI_API_KEY = previous;
});
