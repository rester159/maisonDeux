import test from "node:test";
import assert from "node:assert/strict";
import { extractAttributes, mergeExtractedIntoListing } from "@luxefinder/shared";

test("extractAttributes extracts brand and model from Gucci Ophidia title", () => {
  const out = extractAttributes({
    title: "Gucci Ophidia GG Supreme small crossbody bag green",
    description: "Authentic pre-owned Gucci bag.",
    category: "bag"
  });
  assert.equal(out.brand.value, "Gucci");
  assert.ok(out.brand.confidence >= 0.9);
  assert.equal(out.model.value, "Ophidia");
  assert.ok(out.model.confidence >= 0.7);
  assert.equal(out.color.value, "Green");
  assert.ok(out.color.confidence >= 0.7);
});

test("extractAttributes extracts Louis Vuitton and Neverfull", () => {
  const out = extractAttributes({
    title: "Louis Vuitton Neverfull MM Monogram Canvas tote bag",
    description: "LV neverfull",
    category: "bag"
  });
  assert.equal(out.brand.value, "Louis Vuitton");
  assert.equal(out.model.value, "Neverfull");
  assert.ok(out.material.value.toLowerCase().includes("canvas") || out.material.value === "Monogram Canvas");
});

test("extractAttributes extracts Rolex Submariner from watch title", () => {
  const out = extractAttributes({
    title: "Rolex Submariner Date 41mm 126610LN",
    description: "Stainless steel, black dial.",
    category: "watch"
  });
  assert.equal(out.brand.value, "Rolex");
  assert.equal(out.model.value, "Submariner");
  assert.equal(out.color.value, "Black");
});

test("extractAttributes uses seller brand when provided and matches", () => {
  const out = extractAttributes({
    title: "Vintage crossbody bag leather",
    description: "Designer bag",
    sellerBrand: "Chanel",
    category: "bag"
  });
  assert.equal(out.brand.value, "Chanel");
  assert.ok(out.brand.confidence >= 0.9);
});

test("extractAttributes extracts size for shoes", () => {
  const out = extractAttributes({
    title: "Gucci Ace sneaker white US size 8",
    description: "EU 41",
    category: "shoes"
  });
  assert.ok(out.brand.value === "Gucci");
  assert.ok(out.size.value !== "" && out.size.confidence > 0);
});

test("mergeExtractedIntoListing prefers extracted when confidence high", () => {
  const listing = {
    brand: "unknown",
    color: null as string | null,
    size: null as string | null,
    material: null as string | null
  };
  const extracted = extractAttributes({
    title: "Chanel Classic Flap medium black caviar",
    description: "",
    category: "bag"
  });
  const merged = mergeExtractedIntoListing(listing, extracted, 0.6);
  assert.equal(merged.brand, "Chanel");
  assert.ok(merged.color === "Black" || merged.color?.toLowerCase().includes("black"));
});
