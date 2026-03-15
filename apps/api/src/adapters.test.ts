import test from "node:test";
import assert from "node:assert/strict";
import {
  Chrono24Adapter,
  EbayAdapter,
  ScrapedMarketplaceAdapter,
  ShopGoodwillAdapter,
  TheRealRealAdapter,
  VestiaireAdapter
} from "./adapters";

test("EbayAdapter returns empty without token", async () => {
  const adapter = new EbayAdapter(undefined);
  const results = await adapter.search("Rolex Submariner", "watch");
  assert.equal(results.length, 0);
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

test("Partner adapters return empty without keys", async () => {
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
  assert.equal(a.length, 0);
  assert.equal(b.length, 0);
  assert.equal(c.length, 0);
  if (originalChrono) process.env.CHRONO24_API_KEY = originalChrono;
  if (originalTrr) process.env.THEREALREAL_API_KEY = originalTrr;
  if (originalVest) process.env.VESTIAIRE_API_KEY = originalVest;
});

test("ShopGoodwillAdapter maps realtime response items", async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = (async () =>
      ({
        ok: true,
        json: async () => ({
          searchResults: {
            itemCount: 1,
            items: [
              {
                itemId: 232420498,
                title: "Zara Satin High Heel Pumps",
                currentPrice: 19.99,
                minimumBid: 19.99,
                imageURL: "https://cdn.shopgoodwill.com/1.jpg",
                endTime: "2026-03-20T20:00:00",
                shippingPrice: 0.01
              }
            ]
          }
        })
      }) as Response);
    const adapter = new ShopGoodwillAdapter();
    const results = await adapter.search("Zara pumps", "shoes");
    assert.equal(results.length, 1);
    assert.equal(results[0].platform, "shopgoodwill");
    assert.equal(results[0].listing_id, "shopgoodwill-232420498");
    assert.equal(results[0].price_usd, 19.99);
  } finally {
    global.fetch = originalFetch;
  }
});

test("ScrapedMarketplaceAdapter maps JSON-LD products from search page", async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = (async () =>
      ({
        ok: true,
        text: async () => `<!doctype html><html><head>
          <script type="application/ld+json">
          {"@context":"https://schema.org","@type":"ItemList","itemListElement":[{"@type":"ListItem","position":1,"item":{"@type":"Product","sku":"rb-123","name":"Rolex Submariner Date","url":"https://shop.rebag.com/products/rolex-submariner-date","image":"https://cdn.example.com/rolex.jpg","offers":{"@type":"Offer","price":"9950","priceCurrency":"USD","itemCondition":"https://schema.org/UsedCondition"}}}]}
          </script>
          </head><body></body></html>`
      }) as Response);

    const adapter = new ScrapedMarketplaceAdapter({
      platform: "rebag",
      searchUrl: (query) => `https://shop.rebag.com/search?q=${encodeURIComponent(query)}`,
      buyerFeePct: null
    });
    const results = await adapter.search("Rolex Submariner", "watch");
    assert.equal(results.length, 1);
    assert.equal(results[0].platform, "rebag");
    assert.equal(results[0].platform_listing_id, "rb-123");
    assert.equal(results[0].price_usd, 9950);
    assert.equal(results[0].platform_listing_url, "https://shop.rebag.com/products/rolex-submariner-date");
  } finally {
    global.fetch = originalFetch;
  }
});

test("ScrapedMarketplaceAdapter maps embedded JSON app state listings", async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = (async () =>
      ({
        ok: true,
        text: async () => `<!doctype html><html><head>
          <script id="__NEXT_DATA__" type="application/json">
          {"props":{"pageProps":{"products":[{"id":"vc-889","title":"Gucci Suede Loafers","url":"https://www.vestiairecollective.com/items/gucci-suede-loafers","price":{"value":"780","currency":"USD"},"image":"https://cdn.example.com/loafer.jpg","brand":"Gucci"}]}}}
          </script>
          </head><body></body></html>`
      }) as Response);

    const adapter = new ScrapedMarketplaceAdapter({
      platform: "vestiaire-scrape",
      searchUrl: (query) => `https://example.com/search?q=${encodeURIComponent(query)}`,
      buyerFeePct: null
    });
    const results = await adapter.search("Gucci loafers", "shoes");
    assert.equal(results.length, 1);
    assert.equal(results[0].platform, "vestiaire-scrape");
    assert.equal(results[0].platform_listing_id, "vc-889");
    assert.equal(results[0].price_usd, 780);
    assert.equal(results[0].brand, "Gucci");
  } finally {
    global.fetch = originalFetch;
  }
});
