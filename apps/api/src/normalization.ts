import type { ListingCondition } from "@luxefinder/shared";

const CONDITION_MAP: Record<string, ListingCondition> = {
  "new with tags": "new_with_tags",
  nwot: "new_with_tags",
  unworn: "new_with_tags",
  pristine: "like_new",
  "like new": "like_new",
  excellent: "excellent",
  "very good": "good",
  good: "good",
  fair: "fair",
  poor: "poor"
};

export function normalizeCondition(raw: string): ListingCondition {
  const key = raw.trim().toLowerCase();
  return CONDITION_MAP[key] ?? "good";
}

const AUTHENTICATED_PLATFORMS = new Set([
  "therealreal",
  "rebag",
  "watchbox",
  "chronext",
  "fashionphile"
]);

export function normalizeAuthStatus(
  platform: string,
  verifiedBadge: boolean
): "platform_authenticated" | "seller_claimed" | "unverified" {
  const normalized = platform.toLowerCase();
  if (AUTHENTICATED_PLATFORMS.has(normalized) || verifiedBadge) {
    return "platform_authenticated";
  }
  if (normalized === "ebay" || normalized === "grailed") {
    return "seller_claimed";
  }
  return "unverified";
}

export function normalizeCurrencyToUsd(
  amount: number,
  currency: string,
  fxRates: Record<string, number>
): number {
  const upperCurrency = currency.toUpperCase();
  if (upperCurrency === "USD") return amount;
  const rate = fxRates[upperCurrency];
  if (!rate) return amount;
  return Number((amount / rate).toFixed(2));
}
