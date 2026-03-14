import test from "node:test";
import assert from "node:assert/strict";
import { Chrono24Adapter, EbayAdapter, TheRealRealAdapter, VestiaireAdapter } from "./adapters";

test("EbayAdapter falls back to mock without token", async () => {
  const adapter = new EbayAdapter(undefined);
  const results = await adapter.search("Rolex Submariner", "watch");
  assert.equal(results.length, 2);
  assert.equal(results[0].platform, "ebay");
});

test("EbayAdapter maps browse API response", async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = (async () =>
      ({
        ok: true,
        json: async () => ({
          itemSummaries: [
            {
              itemId: "123",
              title: "Rolex Submariner Date",
              itemWebUrl: "https://www.ebay.com/itm/123",
              condition: "Used",
              image: { imageUrl: "https://img/1.jpg" },
              additionalImages: [{ imageUrl: "https://img/2.jpg" }],
              price: { value: "9999", currency: "USD" },
              seller: { feedbackPercentage: "96" },
              itemLocation: { country: "US" }
            }
          ]
        })
      }) as Response);

    const adapter = new EbayAdapter("token");
    const results = await adapter.search("Rolex Submariner", "watch");
    assert.equal(results.length, 1);
    assert.equal(results[0].listing_id, "ebay-123");
    assert.equal(results[0].price_usd, 9999);
    assert.equal(results[0].seller_rating, 4.8);
  } finally {
    global.fetch = originalFetch;
  }
});

test("Partner adapters fallback without keys", async () => {
  const originalChrono = process.env.CHRONO24_API_KEY;
  const originalTrr = process.env.THEREALREAL_API_KEY;
  const originalVest = process.env.VESTIAIRE_API_KEY;
  delete process.env.CHRONO24_API_KEY;
  delete process.env.THEREALREAL_API_KEY;
  delete process.env.VESTIAIRE_API_KEY;
  const chrono = new Chrono24Adapter();
  const trr = new TheRealRealAdapter();
  const vestiaire = new VestiaireAdapter();
  const [a, b, c] = await Promise.all([
    chrono.search("Cartier Tank", "watch"),
    trr.search("Chanel Flap", "bag"),
    vestiaire.search("Hermes Birkin", "bag")
  ]);
  assert.equal(a.length, 2);
  assert.equal(b.length, 2);
  assert.equal(c.length, 2);
  if (originalChrono) process.env.CHRONO24_API_KEY = originalChrono;
  if (originalTrr) process.env.THEREALREAL_API_KEY = originalTrr;
  if (originalVest) process.env.VESTIAIRE_API_KEY = originalVest;
});
