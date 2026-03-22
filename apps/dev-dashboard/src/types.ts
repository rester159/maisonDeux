// ---------------------------------------------------------------------------
// AI Providers & Models
// ---------------------------------------------------------------------------

export type AIProvider = "openai" | "anthropic" | "google";

export interface AIModel {
  id: string;
  provider: AIProvider;
  displayName: string;
  capabilities: ("vision" | "text" | "structured_output")[];
  costTier: "low" | "medium" | "high";
}

export const AI_MODELS: AIModel[] = [
  { id: "gpt-4o",               provider: "openai",    displayName: "GPT-4o",              capabilities: ["vision", "text", "structured_output"], costTier: "high" },
  { id: "gpt-4o-mini",          provider: "openai",    displayName: "GPT-4o Mini",          capabilities: ["text", "structured_output"],           costTier: "low" },
  { id: "claude-sonnet-4-5-20250514",  provider: "anthropic", displayName: "Claude Sonnet 4.5",    capabilities: ["vision", "text"],                      costTier: "high" },
  { id: "claude-haiku",         provider: "anthropic", displayName: "Claude Haiku",         capabilities: ["text"],                                costTier: "low" },
  { id: "gemini-1.5-pro",       provider: "google",    displayName: "Gemini 1.5 Pro",       capabilities: ["vision", "text"],                      costTier: "medium" },
  { id: "gemini-1.5-flash",     provider: "google",    displayName: "Gemini 1.5 Flash",     capabilities: ["text"],                                costTier: "low" },
];

// ---------------------------------------------------------------------------
// AI Functions
// ---------------------------------------------------------------------------

export interface AIFunction {
  id: string;
  name: string;
  description: string;
  requiredCapabilities: ("vision" | "text" | "structured_output")[];
  recommendedModelIds: string[];
}

export const AI_FUNCTIONS: AIFunction[] = [
  {
    id: "product_identification",
    name: "Product Identification",
    description: "Identifies what product is in an uploaded image — brand, category, model name, and key visual attributes.",
    requiredCapabilities: ["vision"],
    recommendedModelIds: ["claude-sonnet-4-5-20250514", "gpt-4o", "gemini-1.5-pro"],
  },
  {
    id: "brand_inference",
    name: "Brand Inference",
    description: "Determines the brand from a listing title and description text using fuzzy matching and contextual clues.",
    requiredCapabilities: ["text"],
    recommendedModelIds: ["claude-haiku", "gpt-4o-mini", "gemini-1.5-flash"],
  },
  {
    id: "description_analysis",
    name: "Description Analysis",
    description: "Extracts structured attributes (condition, materials, hardware, size, color) from free-text listing descriptions.",
    requiredCapabilities: ["text"],
    recommendedModelIds: ["claude-sonnet-4-5-20250514", "gpt-4o-mini"],
  },
  {
    id: "product_matching",
    name: "Product Matching",
    description: "Determines whether two listings from different platforms refer to the same product, accounting for naming variations.",
    requiredCapabilities: ["text"],
    recommendedModelIds: ["claude-sonnet-4-5-20250514", "gpt-4o"],
  },
  {
    id: "price_estimation",
    name: "Price Estimation",
    description: "Estimates fair market value for a product based on comparable listings, condition, and market trends.",
    requiredCapabilities: ["text"],
    recommendedModelIds: ["gpt-4o-mini", "claude-haiku"],
  },
  {
    id: "search_query_generation",
    name: "Search Query Generation",
    description: "Generates optimal search queries tailored to each platform's search syntax for cross-platform product discovery.",
    requiredCapabilities: ["text"],
    recommendedModelIds: ["claude-haiku", "gpt-4o-mini"],
  },
  {
    id: "trust_scoring",
    name: "Trust Scoring",
    description: "Evaluates listing authenticity signals — seller history, image quality, pricing anomalies, description red flags.",
    requiredCapabilities: ["text"],
    recommendedModelIds: ["claude-sonnet-4-5-20250514", "gpt-4o"],
  },
];

// ---------------------------------------------------------------------------
// API Key Slots
// ---------------------------------------------------------------------------

export interface ApiKeySlot {
  name: string;
  envVar: string;
  provider?: AIProvider;
  group: "ai" | "marketplace";
  label: string;
}

export const API_KEY_SLOTS: ApiKeySlot[] = [
  // AI Providers
  { name: "openai",          envVar: "OPENAI_API_KEY",    provider: "openai",    group: "ai",          label: "OpenAI" },
  { name: "anthropic",       envVar: "ANTHROPIC_API_KEY", provider: "anthropic", group: "ai",          label: "Anthropic" },
  { name: "google_ai",       envVar: "GOOGLE_AI_API_KEY", provider: "google",    group: "ai",          label: "Google AI" },
  // Marketplaces
  { name: "ebay_app_id",     envVar: "EBAY_APP_ID",       group: "marketplace", label: "eBay App ID" },
  { name: "ebay_dev_id",     envVar: "EBAY_DEV_ID",       group: "marketplace", label: "eBay Dev ID" },
  { name: "ebay_cert_id",    envVar: "EBAY_CERT_ID",      group: "marketplace", label: "eBay Cert ID" },
  { name: "serpapi",          envVar: "SERPAPI_API_KEY",    group: "marketplace", label: "SerpAPI" },
];

// ---------------------------------------------------------------------------
// API Response Types
// ---------------------------------------------------------------------------

export interface KeyStatus {
  name: string;
  envVar: string;
  configured: boolean;
  maskedValue: string | null;
}

export interface FunctionWithAssignment extends AIFunction {
  currentModelId: string | null;
}

export interface ProviderStatus {
  provider: AIProvider;
  configured: boolean;
}
