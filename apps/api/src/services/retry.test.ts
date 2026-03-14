import test from "node:test";
import assert from "node:assert/strict";
import { withRetry } from "./retry";

test("withRetry retries transient failures", async () => {
  let attempts = 0;
  const value = await withRetry(
    async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("503 upstream");
      return "ok";
    },
    { maxAttempts: 4, baseDelayMs: 1, maxDelayMs: 5 },
    () => true
  );
  assert.equal(value, "ok");
  assert.equal(attempts, 3);
});

test("withRetry stops retrying when predicate rejects", async () => {
  let attempts = 0;
  await assert.rejects(
    () =>
      withRetry(
        async () => {
          attempts += 1;
          throw new Error("validation error");
        },
        { maxAttempts: 4, baseDelayMs: 1, maxDelayMs: 5 },
        () => false
      ),
    /validation error/
  );
  assert.equal(attempts, 1);
});
