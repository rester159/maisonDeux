import test from "node:test";
import assert from "node:assert/strict";
import { defaultTextAnalysis, parseVisionOutput } from "./vision";

test("defaultTextAnalysis infers brand and keywords", () => {
  const analysis = defaultTextAnalysis("Rolex Submariner Date", "watch");
  assert.equal(analysis.brand, "Rolex");
  assert.equal(analysis.category, "watch");
  assert.deepEqual(analysis.style_keywords, ["Rolex", "Submariner", "Date"]);
});

test("parseVisionOutput accepts fenced json responses", () => {
  const parsed = parseVisionOutput(`\`\`\`json
{
  "brand": "Gucci",
  "category": "shoes",
  "subcategory": "loafers",
  "color_primary": "red",
  "color_secondary": null,
  "material": "suede",
  "style_keywords": ["loafer", "luxury"],
  "model_name": null,
  "estimated_era": "contemporary",
  "confidence": 0.88
}
\`\`\``);
  assert.equal(parsed.category, "shoes");
  assert.equal(parsed.color_primary, "red");
  assert.equal(parsed.brand, "Gucci");
});
