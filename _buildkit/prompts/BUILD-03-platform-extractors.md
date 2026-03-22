### BUILD PROMPT 3: Platform-Specific Extractors

```
Create DOM extractor modules for each supported resale platform. Each extractor should be in its own file under extractors/.

Each extractor exports two functions:
1. extractProductPage(document) — extracts raw product data from a product detail page
2. extractSearchResults(document) — extracts an array of listing objects from a search results page

Both return objects matching these interfaces:

extractProductPage returns:
{
  brand: string | null,
  productName: string | null,
  price: string | null,
  imageUrl: string | null,
  description: string | null,
  conditionText: string | null,
  categoryText: string | null,
  platformText: string | null,
  source: string
}

extractSearchResults returns array of:
{
  title: string | null,
  price: string | null,
  img: string | null,
  link: string | null,
  condition: string | null
}

CRITICAL: Each field must have AT LEAST 3 fallback selectors ordered from most specific (data-testid) to most general (tag name). This is because platforms redesign frequently and selectors break.

Here are the selectors to implement per platform:

THE REALREAL (extractors/therealreal.js):
Product page:
- brand: [data-testid="designer-name"] || .product-details__designer || .pdp-designer-name || h2 a[href*="/designers/"]
- productName: [data-testid="product-name"] || .product-details__name || h1 || .pdp-product-name
- price: [data-testid="price"] || .product-details__price || .pdp-price || [itemprop="price"]
- imageUrl: .pdp-image img || [data-testid="product-image"] img || .product-media img || meta[property="og:image"]
- condition: .product-details__condition || [data-testid="condition"] || text matching /condition:/i
- category: [data-testid="breadcrumb"] || .breadcrumbs || nav[aria-label="breadcrumb"]
Search results:
- container: [data-testid="product-card"] || .product-card || .SearchResults__item || article
- Up to 10 results

EBAY (extractors/ebay.js):
Product page:
- brand: .x-item-specifics [contains "Brand"] + value || [itemprop="brand"] || extract from title using brand dictionary
- productName: h1.x-item-title__mainTitle span || h1[itemprop='name'] || .it-ttl
- price: .x-price-primary span || [itemprop='price'] || .vi-price
- imageUrl: #icImg || .ux-image-carousel img || img[itemprop='image'] || meta[property="og:image"]
- condition: .x-item-condition span || [data-testid="ux-icon-text"] || .vi-cond
- category: .breadcrumbs a || nav.breadcrumbs li
Search results:
- container: .s-item || .srp-results .s-item__wrapper
- Filter out "Shop on eBay" promotional items
- Up to 10 results

POSHMARK (extractors/poshmark.js):
Product page:
- brand: [data-testid="brand-name"] || .listing__brand || a[href*="/brand/"]
- productName: [data-testid="listing-title"] || .listing__title || h1
- price: [data-testid="listing-price"] || .listing__price || .price
- imageUrl: [data-testid="listing-image"] img || .listing__image img || .carousel img
Search results:
- container: [data-testid="listing-card"] || .card--small || .tile
- Up to 10 results

VESTIAIRE COLLECTIVE (extractors/vestiaire.js):
Product page:
- brand: .product__brand || [data-testid="designer-name"] || .pdp-brand || a[href*="/designers/"]
- productName: .product__name || [data-testid="product-title"] || h1
- price: .product__price || [data-testid="product-price"] || .price-box
- imageUrl: .product__image img || [data-testid="product-image"] img
Search results:
- container: [data-testid="product-card"] || .productCard || .catalog__product
- Up to 10 results

GRAILED (extractors/grailed.js):
Product page:
- brand: .listing-designer-info a || [data-testid="designer"] || .Details-designerName
- productName: .listing-title || [data-testid="listing-title"] || h1
- price: .listing-price || [data-testid="price"] || .Price
- imageUrl: .listing-photos img || [data-testid="listing-photo"] img
Search results:
- container: .feed-item || .FeedItem || [data-testid="listing-card"]
- Up to 10 results

MERCARI (extractors/mercari.js):
Product page:
- brand: [data-testid="BrandName"] || .BrandName || a[href*="/brand/"]
- productName: [data-testid="ItemName"] || h1 || .ItemName
- price: [data-testid="ItemPrice"] || .ItemPrice || .price
- imageUrl: [data-testid="ItemImage"] img || .ItemImage img
Search results:
- container: [data-testid="SearchResults"] [data-testid="ItemCell"] || .SearchResultItem
- Up to 10 results

Each extractor should:
- Try selectors in order, use first non-null result
- Trim all text content
- Handle missing elements gracefully (return null, never throw)
- Extract absolute URLs for images (resolve relative URLs)
- Log which selectors succeeded/failed for debugging
```

---

