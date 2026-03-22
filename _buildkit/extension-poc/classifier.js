// ============================================================
// MaisonDeux — AI Product Classifier
// Takes raw product page data and returns standardized attributes.
// Uses Claude API for vision + text understanding.
// ============================================================

// MaisonDeux taxonomy — the canonical attribute schema
// Every product gets normalized into this structure
export const ATTRIBUTE_SCHEMA = {
  // ---- Core Identity ----
  brand: null,           // "Chanel", "Louis Vuitton", "Cartier"
  model: null,           // "Classic Double Flap", "Speedy", "Love Bracelet"
  modelVariant: null,    // "Jumbo", "Mini", "25cm" — sub-model distinctions

  // ---- Category ----
  category: null,        // "Handbags", "Jewelry", "Watches", "Shoes", "Clothing"
  subcategory: null,     // "Shoulder Bags", "Rings", "Dress Watches", "Heels"

  // ---- Visual / Physical ----
  color: null,           // Normalized: "Black", "Beige", "Red" (not "noir" or "GHW black")
  colorFamily: null,     // "Neutral", "Warm", "Cool", "Metallic" — for fuzzy matching
  material: null,        // "Lambskin", "Caviar Leather", "18K Yellow Gold", "Canvas"
  hardware: null,        // "Gold", "Silver", "Ruthenium", "Palladium", null
  pattern: null,         // "Quilted", "Monogram", "Plain", "Check"

  // ---- Size ----
  size: null,            // Normalized: "Medium", "Small", "36", "6.5"
  sizeSystem: null,      // "Generic" (S/M/L), "US", "EU", "UK", "cm"
  dimensions: null,      // "25 x 16 x 7 cm" — if available

  // ---- Condition & Provenance ----
  condition: null,       // Normalized: "New", "Excellent", "Very Good", "Good", "Fair"
  authenticated: false,  // Whether platform claims authentication
  year: null,            // "2023", "2019-2020", "Vintage" — production year/era
  serialNumber: null,    // Partial or full if visible

  // ---- Pricing ----
  listedPrice: null,     // The actual listed price as a number
  currency: "USD",       // "USD", "EUR", "GBP"
  estimatedRetail: null, // Original retail price if determinable

  // ---- Relevance scoring (computed) ----
  _confidence: 0,        // 0-1, how confident the classifier is
  _source: null,         // Which platform this was classified from
};

// Standard attribute values for normalization
export const NORMALIZED_VALUES = {
  colors: {
    "black": "Black", "noir": "Black", "nero": "Black", "schwarz": "Black",
    "white": "White", "blanc": "White", "bianco": "White", "cream": "White",
    "beige": "Beige", "tan": "Beige", "sand": "Beige", "nude": "Beige",
    "brown": "Brown", "marron": "Brown", "chocolate": "Brown", "cognac": "Brown",
    "red": "Red", "rouge": "Red", "rosso": "Red", "burgundy": "Red",
    "pink": "Pink", "rose": "Pink", "blush": "Pink", "coral": "Pink",
    "blue": "Blue", "bleu": "Blue", "navy": "Blue", "denim": "Blue",
    "green": "Green", "vert": "Green", "olive": "Green", "khaki": "Green",
    "grey": "Grey", "gray": "Grey", "gris": "Grey", "charcoal": "Grey",
    "gold": "Gold", "silver": "Silver", "metallic": "Metallic",
    "orange": "Orange", "yellow": "Yellow", "purple": "Purple",
    "multicolor": "Multicolor", "multi": "Multicolor",
  },
  colorFamilies: {
    "Black": "Neutral", "White": "Neutral", "Beige": "Neutral",
    "Grey": "Neutral", "Brown": "Warm", "Red": "Warm", "Orange": "Warm",
    "Pink": "Warm", "Yellow": "Warm", "Gold": "Metallic", "Silver": "Metallic",
    "Metallic": "Metallic", "Blue": "Cool", "Green": "Cool", "Purple": "Cool",
    "Multicolor": "Multicolor",
  },
  conditions: {
    "new": "New", "nwt": "New", "new with tags": "New", "brand new": "New",
    "nwot": "Excellent", "new without tags": "Excellent", "like new": "Excellent",
    "excellent": "Excellent", "mint": "Excellent", "pristine": "Excellent",
    "very good": "Very Good", "great": "Very Good",
    "good": "Good", "gently used": "Good", "pre-owned": "Good",
    "fair": "Fair", "well worn": "Fair", "used": "Fair",
  },
  materials: {
    "lambskin": "Lambskin", "lamb": "Lambskin", "agneau": "Lambskin",
    "caviar": "Caviar Leather", "caviar leather": "Caviar Leather",
    "calfskin": "Calfskin", "veau": "Calfskin",
    "canvas": "Canvas", "toile": "Canvas", "coated canvas": "Coated Canvas",
    "monogram canvas": "Coated Canvas",
    "patent": "Patent Leather", "patent leather": "Patent Leather", "vernis": "Patent Leather",
    "suede": "Suede", "nubuck": "Suede",
    "denim": "Denim", "tweed": "Tweed",
    "silk": "Silk", "soie": "Silk",
    "18k gold": "18K Gold", "18k yellow gold": "18K Yellow Gold",
    "18k white gold": "18K White Gold", "18k rose gold": "18K Rose Gold",
    "platinum": "Platinum", "sterling silver": "Sterling Silver",
    "stainless steel": "Stainless Steel",
  },
  sizes: {
    "mini": "Mini", "nano": "Nano", "micro": "Micro",
    "small": "Small", "s": "Small", "pm": "Small", "petit": "Small",
    "medium": "Medium", "m": "Medium", "mm": "Medium",
    "large": "Large", "l": "Large", "gm": "Large", "grand": "Large",
    "jumbo": "Jumbo", "maxi": "Maxi", "xl": "Extra Large",
  },
};

// ---- Claude API Classification ----

const CLASSIFICATION_PROMPT = `You are a luxury goods expert classifier for MaisonDeux, a second-hand marketplace aggregator.

Given a product listing from a resale platform, extract and normalize ALL attributes into this exact JSON structure. Be precise — the user is trying to find the exact same item across platforms.

CRITICAL RULES:
- Return ONLY valid JSON, no markdown, no explanation
- Use null for any attribute you cannot determine
- Normalize colors to English (noir → Black)
- Normalize sizes to standard labels (25cm Chanel → Medium)
- For condition, map to: New, Excellent, Very Good, Good, Fair
- For prices, extract the numeric value and currency
- Confidence should reflect how much of the product you could identify (0.0–1.0)
- For brand + model, be very specific: "Classic Double Flap" not just "Flap Bag"

JSON structure:
{
  "brand": "string or null",
  "model": "string or null",
  "modelVariant": "string or null — size name, limited edition name, etc.",
  "category": "Handbags | Jewelry | Watches | Shoes | Clothing | Accessories | null",
  "subcategory": "string or null",
  "color": "normalized English color name or null",
  "colorFamily": "Neutral | Warm | Cool | Metallic | Multicolor | null",
  "material": "string or null",
  "hardware": "Gold | Silver | Ruthenium | Palladium | Rose Gold | null",
  "pattern": "string or null",
  "size": "string or null — normalized",
  "sizeSystem": "Generic | US | EU | UK | cm | null",
  "dimensions": "string or null — e.g. 25 x 16 x 7 cm",
  "condition": "New | Excellent | Very Good | Good | Fair | null",
  "authenticated": true/false,
  "year": "string or null",
  "listedPrice": number or null,
  "currency": "USD | EUR | GBP",
  "estimatedRetail": number or null,
  "_confidence": 0.0-1.0
}`;

/**
 * Classify a product using Claude API (vision + text)
 * @param {Object} productData - Raw product data from page extraction
 * @param {string} productData.title - Product title text
 * @param {string} productData.description - Full description text
 * @param {string} productData.price - Price string
 * @param {string} productData.imageUrl - Product image URL
 * @param {string} productData.platformText - All visible text from the product section
 * @param {string} productData.source - Platform name
 * @returns {Object} Normalized attribute object
 */
export async function classifyProduct(productData, apiKey) {
  const userContent = [];

  // Include product image if available (vision classification)
  if (productData.imageUrl) {
    userContent.push({
      type: "image",
      source: {
        type: "url",
        url: productData.imageUrl,
      },
    });
  }

  // Include all available text context
  const textParts = [
    `Platform: ${productData.source || "Unknown"}`,
    productData.title ? `Title: ${productData.title}` : null,
    productData.brand ? `Brand: ${productData.brand}` : null,
    productData.price ? `Listed Price: ${productData.price}` : null,
    productData.description ? `Description: ${productData.description}` : null,
    productData.platformText ? `Additional page text:\n${productData.platformText}` : null,
  ].filter(Boolean);

  userContent.push({
    type: "text",
    text: textParts.join("\n\n"),
  });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: CLASSIFICATION_PROMPT,
        messages: [
          {
            role: "user",
            content: userContent,
          },
        ],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    // Parse JSON response (strip any accidental markdown fencing)
    const clean = text.replace(/```json|```/g, "").trim();
    const attributes = JSON.parse(clean);

    return {
      ...ATTRIBUTE_SCHEMA,
      ...attributes,
      _source: productData.source,
    };
  } catch (err) {
    console.warn("[MaisonDeux] Classification failed, falling back to heuristic:", err);
    return classifyHeuristic(productData);
  }
}

/**
 * Fast heuristic classification — no API call.
 * Used as fallback or for quick pre-filtering before AI classification.
 */
export function classifyHeuristic(productData) {
  const text = [
    productData.title,
    productData.brand,
    productData.description,
    productData.platformText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const attributes = { ...ATTRIBUTE_SCHEMA };

  // Brand — already extracted by content script
  attributes.brand = productData.brand || null;
  attributes._source = productData.source;

  // Color
  for (const [keyword, normalized] of Object.entries(NORMALIZED_VALUES.colors)) {
    if (text.includes(keyword)) {
      attributes.color = normalized;
      attributes.colorFamily = NORMALIZED_VALUES.colorFamilies[normalized] || null;
      break;
    }
  }

  // Material
  for (const [keyword, normalized] of Object.entries(NORMALIZED_VALUES.materials)) {
    if (text.includes(keyword)) {
      attributes.material = normalized;
      break;
    }
  }

  // Size
  for (const [keyword, normalized] of Object.entries(NORMALIZED_VALUES.sizes)) {
    if (text.includes(keyword)) {
      attributes.size = normalized;
      attributes.sizeSystem = "Generic";
      break;
    }
  }
  // Numeric sizes (shoes, clothing)
  const sizeMatch = text.match(/\bsize\s+(\d+\.?\d*)\b/i);
  if (sizeMatch && !attributes.size) {
    attributes.size = sizeMatch[1];
    attributes.sizeSystem = parseFloat(sizeMatch[1]) > 30 ? "EU" : "US";
  }

  // Condition
  for (const [keyword, normalized] of Object.entries(NORMALIZED_VALUES.conditions)) {
    if (text.includes(keyword)) {
      attributes.condition = normalized;
      break;
    }
  }

  // Hardware
  if (text.includes("gold hardware") || text.includes("ghw")) attributes.hardware = "Gold";
  else if (text.includes("silver hardware") || text.includes("shw")) attributes.hardware = "Silver";
  else if (text.includes("ruthenium") || text.includes("rhw")) attributes.hardware = "Ruthenium";
  else if (text.includes("rose gold")) attributes.hardware = "Rose Gold";

  // Price
  const priceMatch = (productData.price || "").match(/[\$€£]?([\d,]+\.?\d*)/);
  if (priceMatch) {
    attributes.listedPrice = parseFloat(priceMatch[1].replace(/,/g, ""));
    if ((productData.price || "").includes("€")) attributes.currency = "EUR";
    else if ((productData.price || "").includes("£")) attributes.currency = "GBP";
    else attributes.currency = "USD";
  }

  // Category detection
  const categoryKeywords = {
    Handbags: ["bag", "handbag", "tote", "clutch", "purse", "satchel", "crossbody", "flap"],
    Jewelry: ["ring", "necklace", "bracelet", "earring", "pendant", "brooch", "cuff"],
    Watches: ["watch", "timepiece", "chronograph", "datejust", "submariner"],
    Shoes: ["shoe", "heel", "boot", "sneaker", "loafer", "sandal", "pump", "flat"],
    Clothing: ["dress", "jacket", "coat", "blazer", "skirt", "pants", "top", "shirt", "sweater"],
    Accessories: ["scarf", "belt", "sunglasses", "wallet", "keychain", "hat", "gloves"],
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((kw) => text.includes(kw))) {
      attributes.category = category;
      break;
    }
  }

  attributes._confidence = calculateHeuristicConfidence(attributes);
  return attributes;
}

function calculateHeuristicConfidence(attrs) {
  let score = 0;
  if (attrs.brand) score += 0.25;
  if (attrs.color) score += 0.15;
  if (attrs.material) score += 0.15;
  if (attrs.size) score += 0.15;
  if (attrs.category) score += 0.1;
  if (attrs.hardware) score += 0.1;
  if (attrs.condition) score += 0.1;
  return Math.min(score, 1);
}

// ============================================================
// Relevance Scoring — compares two classified products
// ============================================================

/**
 * Score how relevant a candidate listing is to the source product.
 * Returns a score from 0 (irrelevant) to 1 (exact match).
 *
 * @param {Object} source - Classified attributes of the product being viewed
 * @param {Object} candidate - Classified attributes of a search result
 * @returns {{ score: number, breakdown: Object, label: string }}
 */
export function scoreRelevance(source, candidate) {
  const breakdown = {};
  let totalWeight = 0;
  let weightedScore = 0;

  const factors = [
    // [attribute, weight, matchFn]
    ["brand", 30, (s, c) => exactMatch(s, c)],
    ["model", 25, (s, c) => fuzzyMatch(s, c, 0.7)],
    ["color", 12, (s, c) => exactMatch(s, c) || colorFamilyMatch(source, candidate) * 0.5],
    ["size", 12, (s, c) => sizeMatch(s, c)],
    ["material", 10, (s, c) => fuzzyMatch(s, c, 0.6)],
    ["hardware", 6, (s, c) => exactMatch(s, c)],
    ["category", 5, (s, c) => exactMatch(s, c)],
  ];

  for (const [attr, weight, matchFn] of factors) {
    const sourceVal = source[attr];
    const candidateVal = candidate[attr];

    // If source doesn't have this attribute, skip it (don't penalize)
    if (!sourceVal) continue;

    totalWeight += weight;

    if (!candidateVal) {
      // Candidate missing this attribute — partial penalty
      breakdown[attr] = { score: 0.2, reason: "unknown" };
      weightedScore += weight * 0.2; // Benefit of doubt
    } else {
      const matchScore = matchFn(sourceVal, candidateVal);
      breakdown[attr] = {
        score: matchScore,
        source: sourceVal,
        candidate: candidateVal,
        reason: matchScore >= 0.8 ? "match" : matchScore >= 0.4 ? "partial" : "mismatch",
      };
      weightedScore += weight * matchScore;
    }
  }

  const finalScore = totalWeight > 0 ? weightedScore / totalWeight : 0;

  // Determine label
  let label;
  if (finalScore >= 0.85) label = "Exact Match";
  else if (finalScore >= 0.7) label = "Very Similar";
  else if (finalScore >= 0.5) label = "Similar";
  else if (finalScore >= 0.3) label = "Related";
  else label = "Weak Match";

  return { score: finalScore, breakdown, label };
}

// ---- Match helper functions ----

function exactMatch(a, b) {
  if (!a || !b) return 0;
  return a.toLowerCase().trim() === b.toLowerCase().trim() ? 1 : 0;
}

function fuzzyMatch(a, b, threshold) {
  if (!a || !b) return 0;
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();

  if (aLower === bLower) return 1;
  if (aLower.includes(bLower) || bLower.includes(aLower)) return 0.85;

  // Jaccard similarity on words
  const aWords = new Set(aLower.split(/\s+/));
  const bWords = new Set(bLower.split(/\s+/));
  const intersection = new Set([...aWords].filter((w) => bWords.has(w)));
  const union = new Set([...aWords, ...bWords]);
  const jaccard = intersection.size / union.size;

  return jaccard >= threshold ? jaccard : jaccard * 0.5;
}

function colorFamilyMatch(source, candidate) {
  if (source.colorFamily && candidate.colorFamily) {
    return source.colorFamily === candidate.colorFamily ? 0.6 : 0;
  }
  return 0;
}

function sizeMatch(a, b) {
  if (!a || !b) return 0;
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();

  // Exact match
  if (aLower === bLower) return 1;

  // Numeric comparison (within 0.5 = match, within 1 = close)
  const aNum = parseFloat(aLower);
  const bNum = parseFloat(bLower);
  if (!isNaN(aNum) && !isNaN(bNum)) {
    const diff = Math.abs(aNum - bNum);
    if (diff === 0) return 1;
    if (diff <= 0.5) return 0.9;
    if (diff <= 1) return 0.6;
    return 0;
  }

  // Adjacent sizes partial match
  const sizeOrder = ["mini", "nano", "micro", "small", "medium", "large", "jumbo", "maxi"];
  const aIdx = sizeOrder.indexOf(aLower);
  const bIdx = sizeOrder.indexOf(bLower);
  if (aIdx >= 0 && bIdx >= 0) {
    const diff = Math.abs(aIdx - bIdx);
    if (diff === 0) return 1;
    if (diff === 1) return 0.4;
    return 0;
  }

  return 0;
}

// ============================================================
// Filter & Sort — processes raw results into ranked deals
// ============================================================

/**
 * Takes raw search results and the source product attributes,
 * classifies each result, scores relevance, and returns sorted.
 *
 * @param {Object} sourceAttributes - Classified source product
 * @param {Array} rawResults - Array of { platform, listings[] }
 * @param {Object} options - { minScore, maxResults, apiKey }
 * @returns {Array} Sorted, scored, filtered results
 */
export async function filterAndRankResults(sourceAttributes, rawResults, options = {}) {
  const {
    minScore = 0.3,      // Minimum relevance to show
    maxResults = 20,      // Max total results across platforms
    apiKey = null,        // For AI classification of results
  } = options;

  const scoredResults = [];

  for (const platformResult of rawResults) {
    for (const listing of platformResult.listings || []) {
      // Classify the candidate listing
      let candidateAttrs;
      if (apiKey && listing.img) {
        // Full AI classification for top candidates
        candidateAttrs = await classifyProduct(
          {
            title: listing.title,
            price: listing.price,
            imageUrl: listing.img,
            source: platformResult.platform,
          },
          apiKey
        );
      } else {
        // Fast heuristic classification
        candidateAttrs = classifyHeuristic({
          title: listing.title,
          price: listing.price,
          source: platformResult.platform,
        });
      }

      // Score relevance
      const relevance = scoreRelevance(sourceAttributes, candidateAttrs);

      if (relevance.score >= minScore) {
        scoredResults.push({
          ...listing,
          platform: platformResult.platform,
          platformKey: platformResult.platformKey,
          logo: platformResult.logo,
          attributes: candidateAttrs,
          relevance,
          priceDelta: calculatePriceDelta(sourceAttributes, candidateAttrs),
        });
      }
    }
  }

  // Sort: highest relevance first, then by price (lower = better)
  scoredResults.sort((a, b) => {
    // Primary: relevance score
    if (Math.abs(a.relevance.score - b.relevance.score) > 0.1) {
      return b.relevance.score - a.relevance.score;
    }
    // Secondary: better deal (lower price) wins
    const aPrice = a.attributes.listedPrice || Infinity;
    const bPrice = b.attributes.listedPrice || Infinity;
    return aPrice - bPrice;
  });

  return scoredResults.slice(0, maxResults);
}

function calculatePriceDelta(source, candidate) {
  if (!source.listedPrice || !candidate.listedPrice) return null;

  // TODO: currency conversion for cross-currency comparison
  if (source.currency !== candidate.currency) return null;

  const delta = source.listedPrice - candidate.listedPrice;
  const percentage = (delta / source.listedPrice) * 100;

  return {
    absolute: delta,
    percentage: Math.round(percentage),
    isCheaper: delta > 0,
    label:
      delta > 0
        ? `$${Math.abs(delta).toLocaleString()} less (${Math.abs(Math.round(percentage))}% off)`
        : delta < 0
        ? `$${Math.abs(delta).toLocaleString()} more`
        : "Same price",
  };
}
