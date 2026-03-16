/** Single extracted attribute with confidence */
export type ExtractedField<T = string> = {
  value: T;
  confidence: number;
  source: "exact" | "fuzzy" | "seller" | "inferred" | "none";
};

/** Result of the attribute extraction pipeline */
export type ExtractedAttributes = {
  brand: ExtractedField;
  model: ExtractedField;
  color: ExtractedField;
  material: ExtractedField;
  size: ExtractedField;
};

/** Brand entry in the reference catalog. categories match ListingCategory. */
export type BrandEntry = {
  canonical: string;
  aliases: string[];
  categories: string[];
  models: ModelEntry[];
};

/** Model entry scoped to a brand */
export type ModelEntry = {
  canonical: string;
  aliases: string[];
  variants?: string[];
  categories?: string[];
  signature_materials?: string[];
};

/** Color entry in the reference vocabulary */
export type ColorEntry = {
  canonical: string;
  aliases: string[];
  family: string;
};

/** Material entry in the reference vocabulary */
export type MaterialEntry = {
  canonical: string;
  aliases: string[];
  family: string;
};

/** Size extraction result */
export type SizeResult = {
  value: string;
  system: string;
  confidence: number;
};

/** Category-aware size pattern config. categories match ListingCategory. */
export type SizePattern = {
  categories: string[];
  patterns: Array<{ regex: RegExp; system: string; group?: number }>;
};
