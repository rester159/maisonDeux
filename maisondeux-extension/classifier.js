/**
 * @file classifier.js
 * @description AI and heuristic classification for MaisonDeux.
 *
 * Exports:
 *  1. classifyProduct(productData, apiKey)       — Full AI classification via Claude Vision
 *  2. classifyBatch(listings, platform, apiKey)   — Batch AI classification of search results
 *  3. generateSearchQueries(attrs, apiKey)        — AI-generated per-platform search queries
 *  4. verifyVisualMatch(srcImg, candImg, apiKey)  — AI image comparison
 *  5. classifyHeuristic(productData)              — Local taxonomy-based classification
 *
 * All AI calls use the Anthropic Messages API with the
 * anthropic-dangerous-direct-browser-access header for extension use.
 */

import {
  normalize,
  normalizeAll,
  CATEGORIES,
  CONDITIONS,
  BRAND_ALIASES,
  COLOR_FAMILIES,
} from './taxonomy.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL_SONNET = 'claude-sonnet-4-5-20250514';
const MODEL_HAIKU = 'claude-haiku-4-5-20241022';

// ---------------------------------------------------------------------------
// 1. classifyProduct — Full AI classification
// ---------------------------------------------------------------------------

/**
 * Classify a single product using Claude Vision.
 * Falls back to heuristic classification on API failure.
 *
 * @param {Object} productData - Extracted product data (brand, title, imageUrl, etc.)
 * @param {string} apiKey      - Anthropic API key.
 * @returns {Promise<Object>}  Classified attribute object.
 */
export async function classifyProduct(productData, apiKey) {
  if (!apiKey) return classifyHeuristic(productData);

  try {
    const content = [];

    // Include image if available.
    if (productData.imageUrl) {
      content.push({
        type: 'image',
        source: { type: 'url', url: productData.imageUrl },
      });
    }

    content.push({
      type: 'text',
      text: `Classify this luxury resale product. Here is the listing data:

Brand: ${productData.brand || 'Unknown'}
Title: ${productData.productName || productData.title || ''}
Description: ${productData.description || ''}
Listed Condition: ${productData.conditionText || ''}
Listed Category: ${productData.categoryText || ''}
Price: ${productData.price || ''}
Platform: ${productData.source || productData.platform || ''}

Return a JSON object with these fields:
{
  "brand": "canonical brand name",
  "model": "specific model name if identifiable",
  "category": "one of: Handbags, Shoes, Clothing, Accessories, Jewelry, Watches, Small Leather Goods",
  "color": "canonical color name",
  "colorFamily": "Neutral, Warm, Cool, or Metallic",
  "material": "canonical material name",
  "hardware": "hardware finish if applicable",
  "size": "canonical size",
  "condition": "one of: New, Excellent, Very Good, Good, Fair",
  "confidence": 0.0-1.0,
  "notes": "any additional observations"
}

Return ONLY the JSON object, no markdown fences or extra text.`,
    });

    const result = await callAnthropic(apiKey, MODEL_SONNET, [
      { role: 'user', content },
    ], 'You are a luxury goods authentication and classification expert. Identify brands, models, materials, colors, and conditions with precision.');

    return { ...parseJsonResponse(result), _source: 'ai' };
  } catch (err) {
    console.warn('[MaisonDeux][classifier] AI classification failed, using heuristic:', err.message);
    return classifyHeuristic(productData);
  }
}

// ---------------------------------------------------------------------------
// 2. classifyBatch — Batch AI classification
// ---------------------------------------------------------------------------

/**
 * Classify up to 10 search-result listings in a single API call.
 *
 * @param {Object[]} listings - Array of listing objects from extractors.
 * @param {string}   platform - Platform key for context.
 * @param {string}   apiKey   - Anthropic API key.
 * @returns {Promise<Object[]>} Array of classified attribute objects.
 */
export async function classifyBatch(listings, platform, apiKey) {
  if (!apiKey || !listings.length) {
    return listings.map((l) => classifyHeuristic(l));
  }

  const batch = listings.slice(0, 10);

  try {
    const listingsSummary = batch.map((l, i) =>
      `[${i + 1}] Title: ${l.title || ''} | Price: ${l.price || ''} | Condition: ${l.condition || ''}`
    ).join('\n');

    const result = await callAnthropic(apiKey, MODEL_HAIKU, [
      {
        role: 'user',
        content: `Classify these ${batch.length} ${platform} listings into structured attributes.

${listingsSummary}

Return a JSON array where each element has:
{
  "index": 1,
  "brand": "canonical brand name or null",
  "model": "model name or null",
  "category": "Handbags|Shoes|Clothing|Accessories|Jewelry|Watches|Small Leather Goods",
  "color": "canonical color or null",
  "material": "canonical material or null",
  "condition": "New|Excellent|Very Good|Good|Fair or null",
  "confidence": 0.0-1.0
}

Return ONLY the JSON array.`,
      },
    ], 'You are a luxury goods classification expert. Analyze resale listings and extract structured product attributes.');

    const parsed = parseJsonResponse(result);
    if (Array.isArray(parsed)) {
      return batch.map((listing, i) => {
        const aiResult = parsed.find((r) => r.index === i + 1) || {};
        return { ...classifyHeuristic(listing), ...aiResult, _source: 'ai-batch' };
      });
    }

    return batch.map((l) => classifyHeuristic(l));
  } catch (err) {
    console.warn('[MaisonDeux][classifier] Batch classification failed:', err.message);
    return batch.map((l) => classifyHeuristic(l));
  }
}

// ---------------------------------------------------------------------------
// 3. generateSearchQueries — AI search query generation
// ---------------------------------------------------------------------------

/**
 * Generate optimized search queries for each platform.
 *
 * @param {Object} sourceAttributes - Classified attributes of the source product.
 * @param {string} apiKey           - Anthropic API key.
 * @returns {Promise<Record<string, string>>} Platform → search query.
 */
export async function generateSearchQueries(sourceAttributes, apiKey) {
  const fallback = buildFallbackQueries(sourceAttributes);
  if (!apiKey) return fallback;

  try {
    const result = await callAnthropic(apiKey, MODEL_HAIKU, [
      {
        role: 'user',
        content: `Generate optimized search queries for finding this product on each resale platform:

Brand: ${sourceAttributes.brand || ''}
Model: ${sourceAttributes.model || ''}
Category: ${sourceAttributes.category || ''}
Color: ${sourceAttributes.color || ''}
Material: ${sourceAttributes.material || ''}
Size: ${sourceAttributes.size || ''}

Return a JSON object with platform keys and query strings optimized for each platform's search syntax:
{
  "therealreal": "query",
  "ebay": "query",
  "poshmark": "query",
  "vestiaire": "query",
  "grailed": "query",
  "mercari": "query",
  "shopgoodwill": "query"
}

Keep queries concise (under 100 chars). Focus on brand + model + distinguishing features.
Return ONLY the JSON object.`,
      },
    ], 'You are an expert at searching luxury resale platforms. Generate queries that maximize relevant results while minimizing noise.');

    const parsed = parseJsonResponse(result);
    return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch (err) {
    console.warn('[MaisonDeux][classifier] Query generation failed:', err.message);
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// 4. verifyVisualMatch — AI image comparison
// ---------------------------------------------------------------------------

/**
 * Compare two product images to determine if they're the same item.
 *
 * @param {string} sourceImageUrl    - URL of the source product image.
 * @param {string} candidateImageUrl - URL of the candidate listing image.
 * @param {string} apiKey            - Anthropic API key.
 * @returns {Promise<{score: number, analysis: string}>}
 */
export async function verifyVisualMatch(sourceImageUrl, candidateImageUrl, apiKey) {
  if (!apiKey || !sourceImageUrl || !candidateImageUrl) {
    return { score: 0, analysis: 'No API key or images unavailable' };
  }

  try {
    const result = await callAnthropic(apiKey, MODEL_SONNET, [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Image 1 (source product):' },
          { type: 'image', source: { type: 'url', url: sourceImageUrl } },
          { type: 'text', text: 'Image 2 (candidate listing):' },
          { type: 'image', source: { type: 'url', url: candidateImageUrl } },
          {
            type: 'text',
            text: `Compare these two product images. Are they the same or very similar product?

Return a JSON object:
{
  "score": 0.0-1.0,
  "sameProduct": true/false,
  "sameBrand": true/false,
  "sameModel": true/false,
  "sameColor": true/false,
  "analysis": "brief explanation"
}

Return ONLY the JSON object.`,
          },
        ],
      },
    ], 'You are a luxury goods visual comparison expert. Determine if two images show the same product, considering brand, model, color, material, and hardware.');

    return parseJsonResponse(result);
  } catch (err) {
    console.warn('[MaisonDeux][classifier] Visual match failed:', err.message);
    return { score: 0, analysis: `Error: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// 5. classifyHeuristic — Local taxonomy-based classification
// ---------------------------------------------------------------------------

/**
 * Classify a product using taxonomy dictionaries only (no API call).
 * Scans title + description for keyword matches and calculates confidence.
 *
 * @param {Object} productData - Raw product data from extractor.
 * @returns {Object} Classified attribute object.
 */
export function classifyHeuristic(productData) {
  const text = [
    productData.brand,
    productData.productName || productData.title,
    productData.description,
    productData.conditionText || productData.condition,
    productData.categoryText || productData.category,
  ].filter(Boolean).join(' ');

  const attrs = normalizeAll(text, productData.source || productData.platform);

  // Brand resolution.
  let brand = '';
  if (productData.brand) {
    brand = normalize('brand', productData.brand) || productData.brand.trim();
  }
  if (!brand && attrs.brands.length) {
    brand = attrs.brands[0];
  }

  // Pick first match from each attribute category.
  const color = attrs.colors[0] || null;
  const material = attrs.materials[0] || null;
  const size = attrs.sizes[0] || null;
  const hardware = attrs.hardware[0] || null;
  const category = attrs.categories[0] || normalize('category', productData.categoryText || productData.category) || 'Other';
  const condition = attrs.conditions[0] || normalize('condition', productData.conditionText || productData.condition) || 'Unknown';
  const colorFamily = color ? (COLOR_FAMILIES[color] || null) : null;

  // Calculate confidence score.
  let confidence = 0;
  if (brand)     confidence += 0.25;
  if (color)     confidence += 0.15;
  if (material)  confidence += 0.15;
  if (size)      confidence += 0.15;
  if (category && category !== 'Other') confidence += 0.10;
  if (hardware)  confidence += 0.10;
  if (condition && condition !== 'Unknown') confidence += 0.10;
  confidence = Math.min(confidence, 1.0);

  return {
    brand: brand || null,
    model: null, // Heuristic can't determine specific model.
    category,
    color,
    colorFamily,
    material,
    hardware,
    size,
    condition,
    confidence: Math.round(confidence * 100) / 100,
    _source: 'heuristic',
  };
}

// ---------------------------------------------------------------------------
// Anthropic API helper
// ---------------------------------------------------------------------------

/**
 * Call the Anthropic Messages API.
 * @param {string}   apiKey
 * @param {string}   model
 * @param {Object[]} messages
 * @param {string}   [system]
 * @returns {Promise<string>} The text content of the first response block.
 */
async function callAnthropic(apiKey, model, messages, system) {
  const body = {
    model,
    max_tokens: 2048,
    messages,
  };
  if (system) body.system = system;

  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Anthropic API ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || '';
}

/**
 * Parse a JSON response from Claude, stripping markdown fences if present.
 * @param {string} text
 * @returns {*}
 */
function parseJsonResponse(text) {
  let cleaned = text.trim();
  // Strip ```json ... ``` fences.
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  return JSON.parse(cleaned);
}

// ---------------------------------------------------------------------------
// Fallback query builder
// ---------------------------------------------------------------------------

/**
 * Build simple keyword-based search queries when AI is unavailable.
 * @param {Object} attrs
 * @returns {Record<string, string>}
 */
function buildFallbackQueries(attrs) {
  const parts = [attrs.brand, attrs.model, attrs.color, attrs.material]
    .filter(Boolean)
    .join(' ')
    .slice(0, 100);

  return {
    therealreal:  parts,
    ebay:         parts,
    poshmark:     parts,
    vestiaire:    parts,
    grailed:      parts,
    mercari:      parts,
    shopgoodwill: parts,
  };
}
