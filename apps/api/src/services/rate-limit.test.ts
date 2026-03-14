import test from "node:test";
import assert from "node:assert/strict";
import { parseRateLimitWaitMs } from "./rate-limit";

test("parseRateLimitWaitMs parses structured wait time", () => {
  const wait = parseRateLimitWaitMs(new Error("rate_limited:1500"));
  assert.equal(wait, 1500);
});

test("parseRateLimitWaitMs ignores unrelated errors", () => {
  const wait = parseRateLimitWaitMs(new Error("boom"));
  assert.equal(wait, null);
});
