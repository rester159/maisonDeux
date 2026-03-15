import test from "node:test";
import assert from "node:assert/strict";
import {
  inferBrandAndModelFromLensRows,
  mergeGoogleIdentificationIntoCategory
} from "./google-image-identification";

test("inferBrandAndModelFromLensRows extracts frequent brand and model", () => {
  const inferred = inferBrandAndModelFromLensRows([
    { title: "Gucci Brixton Horsebit Loafer Women Black" },
    { title: "Gucci Brixton loafers authentic leather" },
    { title: "Gucci brixton horsebit loafers size 39" },
    { title: "How to style gucci brixton mule loafer" }
  ]);
  assert.equal(inferred.brand, "gucci");
  assert.equal(Boolean(inferred.model_name?.includes("brixton")), true);
  assert.equal(Boolean(inferred.query?.includes("gucci")), true);
  assert.equal(inferred.confidence > 0.5, true);
});

test("mergeGoogleIdentificationIntoCategory appends category token", () => {
  const merged = mergeGoogleIdentificationIntoCategory("shoes", {
    brand: "gucci",
    model_name: "brixton",
    query: "gucci brixton",
    confidence: 0.7
  });
  assert.equal(merged?.query, "gucci brixton shoes");
});
