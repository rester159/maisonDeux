import type { SizePattern, SizeResult } from "../attribute-types.js";

/** Category-aware size patterns. Order matters: first match wins per category. */
export const SIZE_PATTERNS: SizePattern[] = [
  // Shoes: EU 35-52, US 4-16, UK 2-12, IT
  {
    categories: ["shoes"],
    patterns: [
      { regex: /\b(3[5-9]|4[0-9]|5[0-2])\s*(?:eu|eur|european)?\b/i, system: "EU" },
      { regex: /\b(?:eu|eur)\s*(3[5-9]|4[0-9]|5[0-2])\b/i, system: "EU" },
      { regex: /\b(4|5|6|7|8|9|10|11|12)(?:\s*\.\s*5)?\s*(?:us|usa)?\b/i, system: "US" },
      { regex: /\b(?:us|usa)\s*(\d{1,2}(?:\.5)?)\b/i, system: "US", group: 1 },
      { regex: /\b(2|3|4|5|6|7|8|9|10|11|12)\s*(?:uk)?\b/i, system: "UK" },
      { regex: /\b(?:uk)\s*(\d{1,2})\b/i, system: "UK", group: 1 },
      { regex: /\b(3[5-9]|4[0-9])\s*(?:it|italian)?\b/i, system: "IT" },
      { regex: /\bxx?xs|xx?small|small|medium|large|xx?l|xx?large\b/i, system: "Letter" }
    ]
  },
  // Apparel: XS–XXXL, numeric US 0-18, IT 36-52
  {
    categories: ["apparel", "accessory"],
    patterns: [
      { regex: /\b(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL)\b/i, system: "Letter" },
      { regex: /\b(00|0|2|4|6|8|10|12|14|16|18|20)\s*(?:us|usa|womens?|womens)?\b/i, system: "US" },
      { regex: /\b(3[6-9]|4[0-9]|5[0-2])\s*(?:it|eu|eur)?\b/i, system: "EU" },
      { regex: /\bsize\s+([a-z0-9.\-\/]+)\b/i, system: "Generic", group: 1 },
      { regex: /\b(one\s*size|os|one\s*sized)\b/i, system: "OS" }
    ]
  },
  // Bags & accessories: mini, small, medium, large, dimensions
  {
    categories: ["bag", "accessory"],
    patterns: [
      { regex: /\b(mini|small|medium|medium\s*large|large|xl|jumbo|maxi)\b/i, system: "Letter" },
      { regex: /\b(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:cm|in|inches)?\b/i, system: "Dimensions" },
      { regex: /\b(\d+(?:\.\d+)?)\s*cm\s*(?:x|by)\s*(\d+(?:\.\d+)?)\s*cm\b/i, system: "Dimensions" },
      { regex: /\bsize\s+([a-z0-9.\-\/]+)\b/i, system: "Generic", group: 1 },
      { regex: /\b(one\s*size|os)\b/i, system: "OS" }
    ]
  },
  // Watches: case diameter mm, strap width
  {
    categories: ["watch"],
    patterns: [
      { regex: /\b(2[6-9]|3[0-9]|4[0-9]|5[0-2])\s*mm\b/i, system: "mm" },
      { regex: /\b(?:case|diameter)\s*(?:size)?\s*(\d+(?:\.\d+)?)\s*mm\b/i, system: "mm", group: 1 },
      { regex: /\b(\d+(?:\.\d+)?)\s*mm\s*(?:case|diameter)\b/i, system: "mm", group: 1 },
      { regex: /\b(?:strap|band)\s*(?:width)?\s*(\d+(?:\.\d+)?)\s*mm\b/i, system: "Strap mm", group: 1 },
      { regex: /\bsize\s+([a-z0-9.\-\/]+)\b/i, system: "Generic", group: 1 }
    ]
  },
  // Jewelry: ring size US, EU; bracelet length
  {
    categories: ["jewelry"],
    patterns: [
      { regex: /\b(?:ring\s*size|size)\s*([3-9]|1[0-3])(?:\s*\.\s*5)?\b/i, system: "US", group: 1 },
      { regex: /\b(4[6-9]|5[0-6])\s*(?:eu|european)?\s*ring\b/i, system: "EU" },
      { regex: /\b(?:bracelet|length)\s*(\d+(?:\.\d+)?)\s*(?:cm|inches?)\b/i, system: "Length", group: 1 },
      { regex: /\b(\d+(?:\.\d+)?)\s*(?:cm|inches?)\s*(?:bracelet|chain)\b/i, system: "Length", group: 1 },
      { regex: /\bsize\s+([a-z0-9.\-\/]+)\b/i, system: "Generic", group: 1 }
    ]
  },
  // Fallback: any category
  {
    categories: ["watch", "jewelry", "bag", "shoes", "apparel", "accessory"],
    patterns: [
      { regex: /\b(US|EU|UK|IT)\s*(\d{1,2}(?:\.\d)?)\b/i, system: "Generic" },
      { regex: /\bsize\s+([a-z0-9.\-\/]+)\b/i, system: "Generic", group: 1 },
      { regex: /\b(XS|S|M|L|XL|XXL)\b/i, system: "Letter" },
      { regex: /\b(one\s*size|os)\b/i, system: "OS" }
    ]
  }
];

const DEFAULT_SIZE_RESULT: SizeResult = { value: "", system: "", confidence: 0 };

function normalizeForSize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract size from text with category-aware patterns.
 * category should match ListingCategory (watch, jewelry, bag, shoes, apparel, accessory).
 */
export function extractSize(text: string, category: string): SizeResult {
  if (!text || !String(text).trim()) return DEFAULT_SIZE_RESULT;
  const normalized = normalizeForSize(text);
  const categoryLower = String(category).toLowerCase();

  for (const patternConfig of SIZE_PATTERNS) {
    const matchesCategory =
      patternConfig.categories.some((c) => c.toLowerCase() === categoryLower) ||
      patternConfig.categories.includes("*");
    if (!matchesCategory) continue;

    for (const { regex, system, group } of patternConfig.patterns) {
      const match = normalized.match(regex);
      if (!match) continue;
      const value =
        group !== undefined && match[group] !== undefined
          ? match[group].trim()
          : (match[0] ?? "").trim();
      if (!value) continue;
      return {
        value: value.charAt(0).toUpperCase() + value.slice(1).toLowerCase(),
        system,
        confidence: system === "Generic" ? 0.7 : 0.9
      };
    }
  }

  return DEFAULT_SIZE_RESULT;
}
