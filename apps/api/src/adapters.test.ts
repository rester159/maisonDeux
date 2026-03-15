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

test("Chrono24Adapter falls back to scraping when API key missing", async () => {
  const originalFetch = global.fetch;
  const originalChrono = process.env.CHRONO24_API_KEY;
  delete process.env.CHRONO24_API_KEY;
  try {
    global.fetch = (async () =>
      ({
        ok: true,
        text: async () => `<!doctype html><html><body>
          <div class="tile">
            <a href="/rolex/submariner/id-998877/" data-tn="item-tile-title-anchor">
              <h2>Rolex Submariner Date 41mm</h2>
            </a>
            <div>$12950</div>
            <img src="https://cdn.example.com/c24.jpg" />
          </div>
        </body></html>`
      }) as Response);

    const chrono = new Chrono24Adapter();
    const results = await chrono.search("Rolex Submariner", "watch");
    assert.equal(results.length, 1);
    assert.equal(results[0].platform, "chrono24");
    assert.equal(results[0].price_usd, 12950);
  } finally {
    global.fetch = originalFetch;
    if (originalChrono) process.env.CHRONO24_API_KEY = originalChrono;
  }
});

test("VestiaireAdapter falls back to scraping when API key missing", async () => {
  const originalFetch = global.fetch;
  const originalVest = process.env.VESTIAIRE_API_KEY;
  delete process.env.VESTIAIRE_API_KEY;
  try {
    global.fetch = (async () =>
      ({
        ok: true,
        text: async () => `<!doctype html><html><head>
          <script type="application/ld+json">
          {"@context":"https://schema.org","@type":"ItemList","itemListElement":[{"@type":"ListItem","position":1,"item":{"@type":"Product","sku":"vc-998","name":"Hermes Birkin 30 Togo","url":"https://www.vestiairecollective.com/women-bags/handbags/hermes/birkin-30","image":"https://cdn.example.com/vc-birkin.jpg","offers":{"@type":"Offer","price":"14500","priceCurrency":"USD","itemCondition":"https://schema.org/UsedCondition"}}}]}
          </script>
          </head><body></body></html>`
      }) as Response);

    const vestiaire = new VestiaireAdapter();
    const results = await vestiaire.search("Hermes Birkin", "bag");
    assert.equal(results.length, 1);
    assert.equal(results[0].platform, "vestiaire");
    assert.equal(results[0].price_usd, 14500);
  } finally {
    global.fetch = originalFetch;
    if (originalVest) process.env.VESTIAIRE_API_KEY = originalVest;
  }
});

test("TheRealRealAdapter falls back to scraping when API key missing", async () => {
  const originalFetch = global.fetch;
  const originalTrr = process.env.THEREALREAL_API_KEY;
  delete process.env.THEREALREAL_API_KEY;
  try {
    global.fetch = (async () =>
      ({
        ok: true,
        text: async () => `<!doctype html><html><head>
          <script type="application/ld+json">
          {"@context":"https://schema.org","@type":"ItemList","itemListElement":[{"@type":"ListItem","position":1,"item":{"@type":"Product","sku":"trr-551","name":"Gucci Ophidia Crossbody Bag","url":"https://www.therealreal.com/products/women/handbags/shoulder-bags/gucci-ophidia-crossbody","image":"https://cdn.example.com/trr-ophidia.jpg","offers":{"@type":"Offer","price":"1295","priceCurrency":"USD","itemCondition":"https://schema.org/UsedCondition"}}}]}
          </script>
          </head><body></body></html>`
      }) as Response);

    const adapter = new TheRealRealAdapter();
    const results = await adapter.search("Gucci Ophidia", "bag");
    assert.equal(results.length, 1);
    assert.equal(results[0].platform, "therealreal");
    assert.equal(results[0].platform_listing_id, "trr-551");
    assert.equal(results[0].price_usd, 1295);
  } finally {
    global.fetch = originalFetch;
    if (originalTrr) process.env.THEREALREAL_API_KEY = originalTrr;
  }
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

test("ScrapedMarketplaceAdapter maps HTML tile anchors like 1stdibs", async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = (async () =>
      ({
        ok: true,
        text: async () => `<!doctype html><html><body>
          <div class="tile">
            <div><img src="https://a.1stdibscdn.com/item.jpg" alt="dress"/></div>
            <a href="/fashion/clothing/evening-dresses/sass-bide-beaded-bralette-v-neck-evening-down-silk-crepe-dress-au-36-us-2-uk-6/id-v_28420512/" data-tn="item-tile-title-anchor" data-pk="v_28420512">
              <h2>Sass &amp; Bide Beaded Bralette V Neck Evening Down Silk Crepe Dress AU 36 US 2 UK 6</h2>
            </a>
            <div>$216</div>
          </div>
        </body></html>`
      }) as Response);

    const adapter = new ScrapedMarketplaceAdapter({
      platform: "1stdibs",
      searchUrl: (query) => `https://www.1stdibs.com/search/?q=${encodeURIComponent(query)}`,
      buyerFeePct: null
    });
    const results = await adapter.search("sass bide dress", "apparel");
    assert.equal(results.length, 1);
    assert.equal(results[0].platform, "1stdibs");
    assert.equal(results[0].price_usd, 216);
    assert.equal(
      results[0].platform_listing_url,
      "https://www.1stdibs.com/fashion/clothing/evening-dresses/sass-bide-beaded-bralette-v-neck-evening-down-silk-crepe-dress-au-36-us-2-uk-6/id-v_28420512/"
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test("ScrapedMarketplaceAdapter handles 1stdibs tile when data-tn appears before href and price is farther away", async () => {
  const originalFetch = global.fetch;
  try {
    const filler = "x".repeat(6500);
    global.fetch = (async () =>
      ({
        ok: true,
        text: async () => `<!doctype html><html><body>
          <div class="tile">
            <a data-tn="item-tile-title-anchor" data-pk="v_28420512" href="/fashion/clothing/evening-dresses/sass-bide-beaded-bralette-v-neck-evening-down-silk-crepe-dress-au-36-us-2-uk-6/id-v_28420512/">
              <h2>Sass &amp; Bide Beaded Bralette V Neck Evening Down Silk Crepe Dress AU 36 US 2 UK 6</h2>
            </a>
            <div>${filler}</div>
            <div>$216</div>
          </div>
        </body></html>`
      }) as Response);

    const adapter = new ScrapedMarketplaceAdapter({
      platform: "1stdibs",
      searchUrl: (query) => `https://www.1stdibs.com/search/?q=${encodeURIComponent(query)}`,
      buyerFeePct: null
    });
    const results = await adapter.search("sass bide dress", "apparel");
    assert.equal(results.length, 1);
    assert.equal(
      results[0].platform_listing_url,
      "https://www.1stdibs.com/fashion/clothing/evening-dresses/sass-bide-beaded-bralette-v-neck-evening-down-silk-crepe-dress-au-36-us-2-uk-6/id-v_28420512/"
    );
    assert.equal(results[0].price_usd, 216);
  } finally {
    global.fetch = originalFetch;
  }
});

test("ScrapedMarketplaceAdapter reads 1stdibs price from embedded state using data-pk", async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = (async () =>
      ({
        ok: true,
        text: async () => `<!doctype html><html><body>
          <script>
            window.__APOLLO_STATE__ = {
              "SXRlbTp2XzI4NDIwNTEy":{"serviceId":"v_28420512","ecommerceTrackingParams":{"id":"v_28420512","price":216}}
            };
          </script>
          <article data-tn="item-tile-wrapper">
            <a data-tn="item-tile-title-anchor" data-pk="v_28420512" href="/fashion/clothing/evening-dresses/sass-bide-beaded-bralette-v-neck-evening-down-silk-crepe-dress-au-36-us-2-uk-6/id-v_28420512/">
              <h2>Sass &amp; Bide Beaded Bralette V Neck Evening Down Silk Crepe Dress AU 36 US 2 UK 6</h2>
            </a>
            <img src="https://a.1stdibscdn.com/item.jpg" />
          </article>
        </body></html>`
      }) as Response);

    const adapter = new ScrapedMarketplaceAdapter({
      platform: "1stdibs",
      searchUrl: (query) => `https://www.1stdibs.com/search/?q=${encodeURIComponent(query)}`,
      buyerFeePct: null
    });
    const results = await adapter.search("sass bide dress", "apparel");
    assert.equal(results.length, 1);
    assert.equal(results[0].platform_listing_id, "v_28420512");
    assert.equal(results[0].price_usd, 216);
  } finally {
    global.fetch = originalFetch;
  }
});
