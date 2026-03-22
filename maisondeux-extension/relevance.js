/**
 * @file relevance.js
 * @description Scores how relevant a cross-platform search result is to the
 * product currently being viewed. Considers brand, category, model name,
 * and condition to filter noise from search results.
 */

/**
 * @typedef {Object} Product
 * @property {string}  brand     - Brand name (e.g. "Gucci").
 * @property {string}  title     - Full listing title.
 * @property {string}  category  - Normalized category key.
 * @property {string}  condition - Normalized condition key.
 * @property {number}  price     - Listing price in its original currency.
 * @property {string}  currency  - ISO 4217 currency code.
 * @property {string}  url       - Canonical listing URL.
 * @property {string}  platform  - Platform identifier (e.g. "therealreal").
 */

/**
 * Compute a relevance score (0–1) between a source product and a candidate.
 * @param {Product} source    - The product the user is currently viewing.
 * @param {Product} candidate - A search result from another platform.
 * @returns {number} Score between 0 (unrelated) and 1 (near-certain match).
 */
export function scoreRelevance(source, candidate) {
  let score = 0;

  // Brand match (most important signal).
  if (source.brand && candidate.brand) {
    if (normalize(source.brand) === normalize(candidate.brand)) {
      score += 0.4;
    } else {
      return 0; // Different brand — not the same product.
    }
  }

  // Category match.
  if (source.category && candidate.category && source.category === candidate.category) {
    score += 0.2;
  }

  // Title similarity (keyword overlap).
  const srcWords = tokenize(source.title);
  const candWords = tokenize(candidate.title);
  if (srcWords.size && candWords.size) {
    const intersection = new Set([...srcWords].filter((w) => candWords.has(w)));
    const overlap = intersection.size / Math.max(srcWords.size, candWords.size);
    score += overlap * 0.3;
  }

  // Condition similarity bonus.
  if (source.condition && candidate.condition && source.condition === candidate.condition) {
    score += 0.1;
  }

  return Math.min(score, 1);
}

/**
 * Normalize a string for comparison (lowercase, trimmed).
 * @param {string} s
 * @returns {string}
 */
function normalize(s) {
  return (s || '').toLowerCase().trim();
}

/**
 * Tokenize a title into a set of meaningful lowercase words.
 * Strips common filler words and short tokens.
 * @param {string} title
 * @returns {Set<string>}
 */
function tokenize(title) {
  const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'in', 'on', 'for', 'with', 'of', 'by', 'to', 'new', 'used']);
  const words = (title || '').toLowerCase().split(/\W+/).filter((w) => w.length > 2 && !STOP.has(w));
  return new Set(words);
}
