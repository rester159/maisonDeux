/**
 * @file relevance.js
 * @description Relevance scoring and ranking for cross-platform deal comparison.
 *
 * Exports:
 *  - scoreRelevance(source, candidate) — detailed score with breakdown
 *  - filterAndRank(sourceAttrs, results, options) — filter, score, sort, return top deals
 */

import { COLOR_FAMILIES } from './taxonomy.js';

// ---------------------------------------------------------------------------
// Scoring weights (total = 100)
// ---------------------------------------------------------------------------

const WEIGHTS = {
  brand:    30,
  model:    25,
  color:    12,
  size:     12,
  material: 10,
  hardware:  6,
  category:  5,
};

const TOTAL_WEIGHT = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------------------
// 1. scoreRelevance
// ---------------------------------------------------------------------------

/**
 * Compare a source product's attributes against a candidate listing.
 * @param {Object} source    - Classified source product attributes.
 * @param {Object} candidate - Classified candidate listing attributes.
 * @returns {{ score: number, label: string, breakdown: Object }}
 */
export function scoreRelevance(source, candidate) {
  const breakdown = {};
  let weightedSum = 0;
  let applicableWeight = 0;

  for (const [attr, weight] of Object.entries(WEIGHTS)) {
    const srcVal = source[attr];
    const candVal = candidate[attr];

    // If source doesn't have this attribute, skip it entirely.
    if (!srcVal) continue;

    applicableWeight += weight;

    if (!candVal) {
      // Candidate missing an attribute the source has — benefit of the doubt.
      const score = 0.2;
      weightedSum += score * weight;
      breakdown[attr] = { score, reason: 'candidate missing', source: srcVal, candidate: null };
      continue;
    }

    let score = 0;
    let reason = 'no match';

    switch (attr) {
      case 'brand':
        score = exactMatch(srcVal, candVal) ? 1.0 : 0.0;
        reason = score ? 'exact' : 'different brand';
        break;

      case 'model':
        if (exactMatch(srcVal, candVal)) { score = 1.0; reason = 'exact'; }
        else { score = fuzzyMatch(srcVal, candVal, 0.5); reason = score > 0 ? 'fuzzy' : 'different model'; }
        break;

      case 'color':
        if (exactMatch(srcVal, candVal)) { score = 1.0; reason = 'exact'; }
        else { score = colorFamilyMatch(srcVal, candVal); reason = score > 0 ? 'same family' : 'different color'; }
        break;

      case 'size':
        score = sizeMatch(srcVal, candVal);
        reason = score >= 1 ? 'exact' : score > 0 ? 'adjacent' : 'different size';
        break;

      case 'material':
      case 'hardware':
      case 'category':
        if (exactMatch(srcVal, candVal)) { score = 1.0; reason = 'exact'; }
        else { score = fuzzyMatch(srcVal, candVal, 0.6); reason = score > 0 ? 'fuzzy' : 'no match'; }
        break;
    }

    weightedSum += score * weight;
    breakdown[attr] = { score, reason, source: srcVal, candidate: candVal };
  }

  const finalScore = applicableWeight > 0 ? weightedSum / applicableWeight : 0;
  const label = scoreLabel(finalScore);

  return { score: Math.round(finalScore * 100) / 100, label, breakdown };
}

// ---------------------------------------------------------------------------
// 2. filterAndRank
// ---------------------------------------------------------------------------

/**
 * Score, filter, and rank an array of candidate results against source attributes.
 * @param {Object}   sourceAttrs - Classified source product attributes.
 * @param {Object[]} results     - Array of candidate listings (with attrs).
 * @param {Object}   [options]
 * @param {number}   [options.minScore=0.3]
 * @param {number}   [options.maxResults=20]
 * @returns {Object[]} Sorted, scored, filtered results with priceDelta.
 */
export function filterAndRank(sourceAttrs, results, options = {}) {
  const { minScore = 0.3, maxResults = 20 } = options;
  const sourcePrice = parseFloat(String(sourceAttrs.price || '').replace(/[^0-9.]/g, '')) || 0;

  const scored = results.map((candidate) => {
    const candAttrs = candidate.attrs || candidate;
    const { score, label, breakdown } = scoreRelevance(sourceAttrs, candAttrs);

    // Compute price delta.
    const candPrice = parseFloat(String(candidate.price || '').replace(/[^0-9.]/g, '')) || 0;
    let priceDelta = null;
    if (sourcePrice > 0 && candPrice > 0) {
      const absolute = sourcePrice - candPrice;
      const percentage = Math.round((Math.abs(absolute) / sourcePrice) * 100);
      const isCheaper = absolute > 0;
      const deltaLabel = isCheaper
        ? `$${Math.round(absolute)} less (${percentage}% off)`
        : `$${Math.round(Math.abs(absolute))} more (+${percentage}%)`;
      priceDelta = { absolute, percentage, isCheaper, label: deltaLabel };
    }

    return {
      ...candidate,
      relevanceScore: score,
      relevanceLabel: label,
      relevanceBreakdown: breakdown,
      priceDelta,
    };
  });

  // Filter below minScore.
  const filtered = scored.filter((r) => r.relevanceScore >= minScore);

  // Sort: relevance desc, then price asc.
  filtered.sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
    const priceA = parseFloat(String(a.price || '').replace(/[^0-9.]/g, '')) || Infinity;
    const priceB = parseFloat(String(b.price || '').replace(/[^0-9.]/g, '')) || Infinity;
    return priceA - priceB;
  });

  return filtered.slice(0, maxResults);
}

// ---------------------------------------------------------------------------
// Match helpers
// ---------------------------------------------------------------------------

function exactMatch(a, b) {
  return (a || '').toLowerCase().trim() === (b || '').toLowerCase().trim();
}

function fuzzyMatch(a, b, threshold) {
  const la = (a || '').toLowerCase().trim();
  const lb = (b || '').toLowerCase().trim();

  // Substring inclusion.
  if (la.includes(lb) || lb.includes(la)) return 0.85;

  // Jaccard word similarity.
  const wordsA = new Set(la.split(/\W+/).filter(Boolean));
  const wordsB = new Set(lb.split(/\W+/).filter(Boolean));
  if (!wordsA.size || !wordsB.size) return 0;

  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  const jaccard = intersection / union;

  return jaccard >= threshold ? jaccard : 0;
}

function colorFamilyMatch(source, candidate) {
  const srcFamily = COLOR_FAMILIES[source];
  const candFamily = COLOR_FAMILIES[candidate];
  if (srcFamily && candFamily && srcFamily === candFamily) return 0.6;
  return 0;
}

function sizeMatch(a, b) {
  const la = (a || '').toLowerCase().trim();
  const lb = (b || '').toLowerCase().trim();

  if (la === lb) return 1.0;

  // Adjacent sizes.
  const sizeOrder = ['nano', 'micro', 'mini', 'small', 'small/medium', 'medium', 'large', 'jumbo', 'maxi', 'extra large', 'xxl'];
  const idxA = sizeOrder.indexOf(la);
  const idxB = sizeOrder.indexOf(lb);
  if (idxA >= 0 && idxB >= 0) {
    const diff = Math.abs(idxA - idxB);
    if (diff === 1) return 0.4;
    return 0;
  }

  // Numeric sizes (e.g. shoe sizes, cm).
  const numA = parseFloat(la);
  const numB = parseFloat(lb);
  if (!isNaN(numA) && !isNaN(numB)) {
    const diff = Math.abs(numA - numB);
    if (diff <= 0.5) return 0.9;
    if (diff <= 1.0) return 0.6;
    return 0;
  }

  return 0;
}

function scoreLabel(score) {
  if (score >= 0.85) return 'Exact Match';
  if (score >= 0.70) return 'Very Similar';
  if (score >= 0.50) return 'Similar';
  if (score >= 0.30) return 'Related';
  return 'Weak Match';
}
