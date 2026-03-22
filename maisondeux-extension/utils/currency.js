/**
 * @file currency.js
 * @description Currency conversion utilities with hardcoded fallback rates
 * and an optional live-rate fetcher.
 */

/**
 * Hardcoded fallback exchange rates (base: USD).
 * Used when the network fetch fails or hasn't run yet.
 */
const FALLBACK_RATES = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
};

/** @type {Record<string, number>|null} Live rates once fetched. */
let liveRates = null;

/**
 * Fetch current exchange rates from a free API (frankfurter.app).
 * Populates {@link liveRates} on success; failures are silently ignored
 * so the extension degrades gracefully to hardcoded rates.
 * @returns {Promise<Record<string, number>>} Rates keyed by currency code (base USD).
 */
export async function fetchRates() {
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD');
    const json = await res.json();
    liveRates = { USD: 1, ...json.rates };
    return liveRates;
  } catch {
    // Graceful degradation — return fallbacks.
    return { ...FALLBACK_RATES };
  }
}

/**
 * Convert an amount between two currencies.
 * Uses live rates if available, otherwise falls back to hardcoded rates.
 *
 * @param {number} amount        - The monetary amount to convert.
 * @param {string} fromCurrency  - ISO 4217 currency code (e.g. "EUR").
 * @param {string} toCurrency    - ISO 4217 currency code (e.g. "USD").
 * @returns {number} The converted amount (not rounded).
 * @throws {Error} If either currency code is unknown.
 */
export function convertPrice(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return amount;

  const rates = liveRates || FALLBACK_RATES;
  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];

  if (fromRate === undefined) throw new Error(`Unknown currency: ${fromCurrency}`);
  if (toRate === undefined) throw new Error(`Unknown currency: ${toCurrency}`);

  // Convert via USD as the common base.
  const amountInUSD = amount / fromRate;
  return amountInUSD * toRate;
}
