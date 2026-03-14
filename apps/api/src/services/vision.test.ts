import test from "node:test";
import assert from "node:assert/strict";
import { defaultTextAnalysis } from "./vision";

test("defaultTextAnalysis infers brand and keywords", () => {
  const analysis = defaultTextAnalysis("Rolex Submariner Date", "watch");
  assert.equal(analysis.brand, "Rolex");
  assert.equal(analysis.category, "watch");
  assert.deepEqual(analysis.style_keywords, ["Rolex", "Submariner", "Date"]);
});
