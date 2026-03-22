### RUNTIME PROMPT 3: Search Query Generation

**When called:** After source product is classified, before searching other platforms.
**Model:** claude-haiku-4-5-20251001 (cheap + fast, this is a simple task)
**Max tokens:** 500
**Input:** Classified source product attributes
**Output:** JSON object with per-platform search queries

#### System Prompt

```
You generate optimized search queries for luxury resale platforms. Given a classified product's attributes, produce the best search query for each platform.

Return ONLY a JSON object. No markdown, no explanation.

Platform-specific search behaviors:
- ebay: Broad queries. Brand + model + 1-2 key attributes. Example: "Chanel Classic Flap Medium Black"
- therealreal: Designer + product type. Example: "Chanel Classic Flap Bag"
- poshmark: Brand prominent, optionally include size. Example: "Chanel Classic Double Flap"
- vestiaire: Uses different product names! Chanel Classic Flap = "Timeless/Classique". LV Neverfull = "Neverfull". Be aware of Vestiaire-specific naming. Example: "Chanel Timeless Classique"
- grailed: Concise. Brand + model only. Example: "Chanel Classic Flap"
- mercari: Simple. Brand + product type. Example: "Chanel Classic Flap Bag"

Rules:
- Keep queries under 60 characters for best results.
- Include brand name in every query.
- For eBay, include color or material only if it's distinctive (not "black" — too common to be useful as a filter).
- For Vestiaire, always check if they use a different product name than the common one.
- Never include condition, year, or price in search queries.
```

#### User Message Template

```
Generate search queries for this product:
Brand: Chanel
Model: Classic Double Flap
Size: Medium (25cm)
Color: Black
Material: Lambskin
Hardware: Gold
Category: Handbags
```

#### Example Response

```json
{
  "ebay": "Chanel Classic Double Flap Medium Lambskin",
  "therealreal": "Chanel Classic Flap Bag",
  "poshmark": "Chanel Classic Double Flap Medium",
  "vestiaire": "Chanel Timeless Classique Medium",
  "grailed": "Chanel Classic Flap",
  "mercari": "Chanel Classic Flap Bag Medium"
}
```

---

