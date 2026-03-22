/**
 * @file routes/dev-admin.ts
 * @description Fastify plugin providing /dev-admin/* endpoints for the
 * developer control dashboard. Manages API keys (.env) and AI model
 * assignments (dev-config.json).
 *
 * Guard with DEV_DASHBOARD_ENABLED=true in the environment.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { FastifyInstance } from "fastify";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ENV_PATH = resolve(__dirname, "../../.env");
const CONFIG_PATH = resolve(__dirname, "../../dev-config.json");

// ---------------------------------------------------------------------------
// Known key slots
// ---------------------------------------------------------------------------

interface KeySlot {
  name: string;
  envVar: string;
  group: "ai" | "marketplace";
  provider?: string;
}

const KEY_SLOTS: KeySlot[] = [
  { name: "openai",       envVar: "OPENAI_API_KEY",    group: "ai",          provider: "openai" },
  { name: "anthropic",    envVar: "ANTHROPIC_API_KEY",  group: "ai",          provider: "anthropic" },
  { name: "google_ai",    envVar: "GOOGLE_AI_API_KEY",  group: "ai",          provider: "google" },
  { name: "ebay_app_id",  envVar: "EBAY_APP_ID",        group: "marketplace" },
  { name: "ebay_dev_id",  envVar: "EBAY_DEV_ID",        group: "marketplace" },
  { name: "ebay_cert_id", envVar: "EBAY_CERT_ID",       group: "marketplace" },
  { name: "serpapi",       envVar: "SERPAPI_API_KEY",     group: "marketplace" },
];

// ---------------------------------------------------------------------------
// AI function definitions
// ---------------------------------------------------------------------------

interface AIFunctionDef {
  id: string;
  name: string;
  description: string;
  requiredCapabilities: string[];
  recommendedModelIds: string[];
}

const AI_FUNCTIONS: AIFunctionDef[] = [
  { id: "product_identification",   name: "Product Identification",   description: "Identifies product from uploaded image",                     requiredCapabilities: ["vision"],  recommendedModelIds: ["claude-sonnet-4-5-20250514", "gpt-4o", "gemini-1.5-pro"] },
  { id: "brand_inference",          name: "Brand Inference",          description: "Determines brand from listing text",                         requiredCapabilities: ["text"],    recommendedModelIds: ["claude-haiku", "gpt-4o-mini", "gemini-1.5-flash"] },
  { id: "description_analysis",     name: "Description Analysis",     description: "Extracts structured attributes from free-text descriptions", requiredCapabilities: ["text"],    recommendedModelIds: ["claude-sonnet-4-5-20250514", "gpt-4o-mini"] },
  { id: "product_matching",         name: "Product Matching",         description: "Determines if two listings match",                           requiredCapabilities: ["text"],    recommendedModelIds: ["claude-sonnet-4-5-20250514", "gpt-4o"] },
  { id: "price_estimation",         name: "Price Estimation",         description: "Estimates fair market value",                                requiredCapabilities: ["text"],    recommendedModelIds: ["gpt-4o-mini", "claude-haiku"] },
  { id: "search_query_generation",  name: "Search Query Generation",  description: "Generates cross-platform search queries",                    requiredCapabilities: ["text"],    recommendedModelIds: ["claude-haiku", "gpt-4o-mini"] },
  { id: "trust_scoring",            name: "Trust Scoring",            description: "Evaluates listing authenticity",                             requiredCapabilities: ["text"],    recommendedModelIds: ["claude-sonnet-4-5-20250514", "gpt-4o"] },
];

// ---------------------------------------------------------------------------
// .env helpers
// ---------------------------------------------------------------------------

function readEnvFile(): Map<string, string> {
  const map = new Map<string, string>();
  if (!existsSync(ENV_PATH)) return map;
  const lines = readFileSync(ENV_PATH, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes.
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    map.set(key, val);
  }
  return map;
}

function writeEnvVar(envVar: string, value: string): void {
  let content = "";
  if (existsSync(ENV_PATH)) {
    content = readFileSync(ENV_PATH, "utf-8");
  }

  const lines = content.split("\n");
  const pattern = new RegExp(`^\\s*${envVar}\\s*=`);
  let replaced = false;

  const updated = lines.map((line) => {
    if (pattern.test(line)) {
      replaced = true;
      return `${envVar}="${value}"`;
    }
    return line;
  });

  if (!replaced) {
    updated.push(`${envVar}="${value}"`);
  }

  writeFileSync(ENV_PATH, updated.join("\n"), "utf-8");

  // Hot-reload into the running process.
  process.env[envVar] = value;
}

// ---------------------------------------------------------------------------
// dev-config.json helpers
// ---------------------------------------------------------------------------

interface DevConfig {
  modelAssignments: Record<string, string>;
}

function readConfig(): DevConfig {
  if (!existsSync(CONFIG_PATH)) return { modelAssignments: {} };
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return { modelAssignments: {} };
  }
}

function writeConfig(config: DevConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Key validation
// ---------------------------------------------------------------------------

async function validateApiKey(slotName: string, key: string): Promise<{ valid: boolean; error?: string }> {
  try {
    switch (slotName) {
      case "openai": {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        return res.ok ? { valid: true } : { valid: false, error: `HTTP ${res.status}` };
      }
      case "anthropic": {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20241022",
            max_tokens: 1,
            messages: [{ role: "user", content: "hi" }],
          }),
        });
        // 200 or 400 (bad request but auth worked) both indicate valid key.
        return res.status !== 401 ? { valid: true } : { valid: false, error: "Unauthorized" };
      }
      case "google_ai": {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${key}`);
        return res.ok ? { valid: true } : { valid: false, error: `HTTP ${res.status}` };
      }
      case "serpapi": {
        const res = await fetch(`https://serpapi.com/account.json?api_key=${key}`);
        return res.ok ? { valid: true } : { valid: false, error: `HTTP ${res.status}` };
      }
      default:
        // No validation available for this key type.
        return { valid: true };
    }
  } catch (e: any) {
    return { valid: false, error: e.message };
  }
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default async function devAdminPlugin(app: FastifyInstance) {
  // GET /dev-admin/keys — list all key slots with status.
  app.get("/keys", async () => {
    const env = readEnvFile();
    return KEY_SLOTS.map((slot) => {
      const val = process.env[slot.envVar] || env.get(slot.envVar) || "";
      return {
        name: slot.name,
        envVar: slot.envVar,
        configured: val.length > 0,
        maskedValue: val.length >= 4 ? val.slice(-4) : null,
      };
    });
  });

  // PUT /dev-admin/keys/:keyName — set or update a key.
  app.put<{ Params: { keyName: string }; Body: { value: string } }>(
    "/keys/:keyName",
    async (request, reply) => {
      const slot = KEY_SLOTS.find((s) => s.name === request.params.keyName);
      if (!slot) return reply.status(404).send({ error: "Unknown key" });
      writeEnvVar(slot.envVar, request.body.value);
      return { ok: true };
    }
  );

  // POST /dev-admin/keys/:keyName/validate — test a key.
  app.post<{ Params: { keyName: string } }>(
    "/keys/:keyName/validate",
    async (request, reply) => {
      const slot = KEY_SLOTS.find((s) => s.name === request.params.keyName);
      if (!slot) return reply.status(404).send({ error: "Unknown key" });
      const val = process.env[slot.envVar] || "";
      if (!val) return { valid: false, error: "Key not configured" };
      return validateApiKey(slot.name, val);
    }
  );

  // GET /dev-admin/functions — list AI functions with model assignments.
  app.get("/functions", async () => {
    const config = readConfig();
    return AI_FUNCTIONS.map((fn) => ({
      ...fn,
      currentModelId: config.modelAssignments[fn.id] || null,
    }));
  });

  // PUT /dev-admin/functions/:functionId/model — assign a model to a function.
  app.put<{ Params: { functionId: string }; Body: { modelId: string } }>(
    "/functions/:functionId/model",
    async (request, reply) => {
      const fn = AI_FUNCTIONS.find((f) => f.id === request.params.functionId);
      if (!fn) return reply.status(404).send({ error: "Unknown function" });
      const config = readConfig();
      if (request.body.modelId) {
        config.modelAssignments[fn.id] = request.body.modelId;
      } else {
        delete config.modelAssignments[fn.id];
      }
      writeConfig(config);
      return { ok: true };
    }
  );

  // GET /dev-admin/providers — which AI providers have configured keys.
  app.get("/providers", async () => {
    return [
      { provider: "openai",    configured: !!(process.env.OPENAI_API_KEY) },
      { provider: "anthropic", configured: !!(process.env.ANTHROPIC_API_KEY) },
      { provider: "google",    configured: !!(process.env.GOOGLE_AI_API_KEY) },
    ];
  });
}
