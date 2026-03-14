import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAuthStatus, normalizeCondition, normalizeCurrencyToUsd } from "./normalization";

test("normalizeCondition maps known values", () => {
  assert.equal(normalizeCondition("Excellent"), "excellent");
  assert.equal(normalizeCondition("Very Good"), "good");
  assert.equal(normalizeCondition("Unworn"), "new_with_tags");
});

test("normalizeCondition falls back to good", () => {
  assert.equal(normalizeCondition("mystery"), "good");
});

test("normalizeAuthStatus respects authenticated platform list", () => {
  assert.equal(normalizeAuthStatus("therealreal", false), "platform_authenticated");
  assert.equal(normalizeAuthStatus("ebay", false), "seller_claimed");
  assert.equal(normalizeAuthStatus("unknown", false), "unverified");
});

test("normalizeCurrencyToUsd converts known non-usd rates", () => {
  const rates = { EUR: 0.92, USD: 1 };
  assert.equal(normalizeCurrencyToUsd(920, "EUR", rates), 1000);
  assert.equal(normalizeCurrencyToUsd(100, "USD", rates), 100);
});
