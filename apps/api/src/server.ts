import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import { Prisma, type SearchStatus } from "@prisma/client";
import { z } from "zod";
import { createHash } from "node:crypto";
import { TRUST_DISCLAIMER } from "@luxefinder/shared";
import { ensureMarketplaceConfigs } from "./marketplace-config";
import { prisma } from "./prisma";
import { enqueueSearchJob, redisConnection, searchDlq, searchQueue } from "./queues";
import { getMetricsSnapshot, getWorkerHeartbeat } from "./services/metrics";

const app = Fastify({ logger: true });

const SIGNUP_SCHEMA = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const LOGIN_SCHEMA = SIGNUP_SCHEMA;

const RUNTIME_CREDENTIALS_SCHEMA = z
  .object({
    ebay: z
      .object({
        oauth_token: z.string().min(1).optional()
      })
      .optional(),
    shopgoodwill: z
      .object({
        access_token: z.string().min(1).optional(),
        username: z.string().min(1).optional(),
        password: z.string().min(1).optional()
      })
      .optional(),
    therealreal: z
      .object({
        api_key: z.string().min(1).optional()
      })
      .optional(),
    vestiaire: z
      .object({
        api_key: z.string().min(1).optional()
      })
      .optional(),
    chrono24: z
      .object({
        api_key: z.string().min(1).optional()
      })
      .optional(),
    search: z
      .object({
        precision: z.number().int().min(10).max(100).optional(),
        size_text: z.string().min(1).max(60).optional()
      })
      .optional()
  })
  .optional();

const IMAGE_SEARCH_SCHEMA = z.object({
  image_url: z.string().url(),
  user_id: z.string().uuid().optional(),
  size_text: z.string().min(1).max(60).optional(),
  runtime_credentials: RUNTIME_CREDENTIALS_SCHEMA
});

const TEXT_SEARCH_SCHEMA = z.object({
  query_text: z.string().min(2),
  category: z
    .enum(["watch", "jewelry", "bag", "shoes", "apparel", "accessory"])
    .default("accessory"),
  user_id: z.string().uuid().optional(),
  runtime_credentials: RUNTIME_CREDENTIALS_SCHEMA
});

const PREFERENCES_SCHEMA = z.object({
  preferences: z.record(z.string(), z.unknown())
});

const SAVE_SEARCH_SCHEMA = z.object({
  name: z.string().optional(),
  query_text: z.string().optional(),
  image_url: z.string().url().optional(),
  image_analysis: z
    .object({
      brand: z.string().nullable(),
      category: z.enum(["watch", "jewelry", "bag", "shoes", "apparel", "accessory"]),
      subcategory: z.string(),
      color_primary: z.string().nullable(),
      color_secondary: z.string().nullable(),
      material: z.string().nullable(),
      style_keywords: z.array(z.string()),
      model_name: z.string().nullable(),
      estimated_era: z.string().nullable(),
      confidence: z.number()
    })
    .optional(),
  price_alert_threshold: z.number().positive().optional(),
  alert_enabled: z.boolean().default(false)
});

const ALERT_UPDATE_SCHEMA = z.object({
  alert_enabled: z.boolean(),
  price_alert_threshold: z.number().positive().optional()
});

const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic"]);

function authGuard(request: any) {
  return request.jwtVerify();
}

function serializeStatus(status: SearchStatus): "pending" | "processing" | "completed" | "failed" {
  return status;
}

function mergeRuntimeCredentials(
  runtime: z.infer<typeof RUNTIME_CREDENTIALS_SCHEMA> | undefined,
  sizeTextRaw: string | undefined
): Prisma.InputJsonValue | Prisma.NullTypes.JsonNull {
  const sizeText = typeof sizeTextRaw === "string" ? sizeTextRaw.trim().slice(0, 60) : "";
  const merged = { ...(runtime ?? {}) } as Record<string, unknown>;
  const search = (merged.search ?? {}) as Record<string, unknown>;
  if (sizeText) {
    search.size_text = sizeText;
    merged.search = search;
  } else if (Object.keys(search).length > 0) {
    merged.search = search;
  }
  return Object.keys(merged).length > 0 ? (merged as Prisma.InputJsonValue) : Prisma.JsonNull;
}

app.register(cors, { origin: true });
app.register(jwt, { secret: process.env.JWT_SECRET ?? "dev-secret-change-me" });
app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  }
});

app.get("/", async (_request, reply) => {
  return reply
    .type("text/html; charset=utf-8")
    .send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>maisonDeux</title>
    <style>
      :root {
        --bg: #07040f;
        --panel: #120a22;
        --panel-soft: #1b0f30;
        --text: #f8f6ff;
        --text-soft: #c8c1de;
        --accent: #ff4fab;
        --accent-two: #8f7cff;
        --good: #22c55e;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        color: var(--text);
        font-family: Inter, "Segoe UI", Arial, sans-serif;
        background:
          radial-gradient(circle at 15% 15%, rgba(255,79,171,0.2), transparent 35%),
          radial-gradient(circle at 85% 20%, rgba(143,124,255,0.2), transparent 30%),
          linear-gradient(135deg, #090512 0%, #130a24 50%, #090512 100%);
      }
      .wrap {
        width: min(1200px, 94vw);
        margin: 24px auto 40px;
      }
      .hero {
        background: linear-gradient(135deg, rgba(255,79,171,0.15), rgba(143,124,255,0.15));
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 20px;
        padding: 28px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.28);
      }
      .hero h1 {
        margin: 0;
        font-size: clamp(32px, 5vw, 56px);
        line-height: 1.05;
        letter-spacing: -0.03em;
      }
      .hero p {
        margin-top: 12px;
        color: var(--text-soft);
        max-width: 720px;
        font-size: 16px;
      }
      .toolbar {
        margin-top: 20px;
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
      }
      .input-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
      }
      input[type="text"], input[type="file"], select {
        border: 1px solid rgba(255,255,255,0.16);
        background: rgba(14, 10, 25, 0.8);
        color: var(--text);
        border-radius: 12px;
        padding: 12px 14px;
        font-size: 15px;
      }
      button {
        border: none;
        background: linear-gradient(135deg, var(--accent), var(--accent-two));
        color: white;
        border-radius: 12px;
        padding: 12px 16px;
        cursor: pointer;
        font-weight: 700;
      }
      button.secondary {
        background: rgba(255,255,255,0.09);
        border: 1px solid rgba(255,255,255,0.18);
      }
      .meta {
        margin-top: 14px;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        color: var(--text-soft);
        font-size: 14px;
      }
      .chip {
        padding: 8px 10px;
        border-radius: 999px;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.15);
      }
      .controls {
        margin-top: 18px;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .grid {
        margin-top: 24px;
        display: flex;
        flex-direction: column;
        gap: 18px;
      }
      .row-section {
        background: rgba(19, 11, 33, 0.62);
        border: 1px solid rgba(255,255,255,0.13);
        border-radius: 16px;
        padding: 12px;
      }
      .row-head {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        align-items: center;
        margin-bottom: 10px;
      }
      .row-title {
        font-size: 15px;
        font-weight: 700;
        color: #f8f6ff;
      }
      .row-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 12px;
      }
      .more-btn {
        border: 1px solid rgba(255,255,255,0.2);
        background: rgba(255,255,255,0.09);
        padding: 8px 10px;
        border-radius: 10px;
        font-size: 12px;
        font-weight: 700;
        color: #fff;
      }
      .listing {
        background: linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03));
        border: 1px solid rgba(255,255,255,0.16);
        border-radius: 16px;
        overflow: hidden;
      }
      .listing img {
        width: 100%;
        height: 220px;
        object-fit: cover;
        background: rgba(255,255,255,0.1);
      }
      .listing .body {
        padding: 12px;
      }
      .row {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        align-items: center;
      }
      .platform {
        font-size: 11px;
        letter-spacing: 0.08em;
        color: #ffd8ef;
        text-transform: uppercase;
      }
      .price {
        font-weight: 800;
        font-size: 20px;
      }
      .title {
        margin-top: 8px;
        font-weight: 600;
        line-height: 1.35;
        min-height: 42px;
      }
      .sub {
        margin-top: 8px;
        color: var(--text-soft);
        font-size: 13px;
      }
      .trust {
        margin-top: 10px;
        font-size: 12px;
        color: #d7ffe5;
      }
      .footer-link {
        margin-top: 12px;
        display: inline-block;
        color: white;
        text-decoration: none;
        font-size: 13px;
        font-weight: 700;
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 10px;
        padding: 8px 10px;
      }
      .status {
        margin-top: 14px;
        font-size: 14px;
        color: #ffe7ff;
      }
      .empty {
        margin-top: 18px;
        color: var(--text-soft);
        border: 1px dashed rgba(255,255,255,0.2);
        border-radius: 14px;
        padding: 18px;
      }
      .disclaimer {
        margin-top: 20px;
        font-size: 12px;
        color: #d4cde8;
      }
      .settings {
        margin-top: 14px;
        display: none;
        padding: 12px;
        background: rgba(12, 8, 22, 0.7);
        border: 1px solid rgba(255,255,255,0.18);
        border-radius: 12px;
      }
      .settings.open { display: block; }
      .settings h3 { margin: 0 0 10px; font-size: 15px; }
      .settings-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 8px;
      }
      .settings input {
        width: 100%;
      }
      .settings-actions {
        margin-top: 10px;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      @media (max-width: 760px) {
        .input-row { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <section class="hero">
        <h1>maisonDeux</h1>
        <p>Upload one photo and instantly search luxury resale marketplaces in parallel. Compare trusted listings, condition, and pricing in one gorgeous feed.</p>

        <div class="toolbar">
          <div class="input-row">
            <input id="textQuery" type="text" placeholder="Try: Rolex Submariner, Chanel Flap, Cartier Love..." />
            <button id="textSearchBtn">Search by Text</button>
          </div>
          <div class="input-row">
            <input id="fileInput" type="file" accept="image/jpeg,image/png,image/webp,image/heic" />
            <button id="imageSearchBtn" class="secondary">Search by Image</button>
          </div>
          <div class="input-row">
            <input id="sizeText" type="text" placeholder="Optional size text (e.g., US 10, EU 42, Medium)" />
            <span class="chip">Used to refine image search</span>
          </div>
        </div>

        <div class="meta">
          <span class="chip">Fashion, Bags, Watches, Jewelry</span>
          <span class="chip">10 Marketplace Connectors</span>
          <span class="chip">Image-first discovery</span>
        </div>

        <div class="controls">
          <select id="sortMode">
            <option value="best">Sort: Best Match</option>
            <option value="low">Sort: Price Low to High</option>
            <option value="high">Sort: Price High to Low</option>
            <option value="trust">Sort: Trust Score</option>
          </select>
          <label class="chip"><input id="verifiedOnly" type="checkbox" /> Verified only</label>
          <button id="settingsToggleBtn" class="secondary" type="button">Marketplace Settings</button>
        </div>
        <div id="settingsPanel" class="settings">
          <h3>Per-user marketplace credentials (saved in your browser)</h3>
          <div class="settings-grid">
            <input id="setSgwAccessToken" type="text" placeholder="ShopGoodwill access token (optional)" />
            <input id="setSgwUsername" type="text" placeholder="ShopGoodwill username (optional)" />
            <input id="setSgwPassword" type="password" placeholder="ShopGoodwill password (optional)" />
            <input id="setEbayToken" type="text" placeholder="eBay OAuth token (optional)" />
            <input id="setChrono24Key" type="text" placeholder="Chrono24 API key (optional)" />
            <input id="setTrrKey" type="text" placeholder="The RealReal API key (optional)" />
            <input id="setVestiaireKey" type="text" placeholder="Vestiaire API key (optional)" />
            <input id="setSearchPrecision" type="number" min="10" max="100" step="1" placeholder="Search precision 10-100 (default 75)" />
          </div>
          <div class="settings-actions">
            <button id="saveSettingsBtn" type="button">Save Settings</button>
            <button id="clearSettingsBtn" class="secondary" type="button">Clear Settings</button>
          </div>
        </div>

        <div id="status" class="status">Ready to search.</div>
        <div id="analysisLine" class="status"></div>
        <div id="metaLine" class="status"></div>
      </section>

      <section id="resultsGrid" class="grid"></section>
      <div id="emptyState" class="empty">No results yet. Start with image upload or text search above.</div>
      <div id="disclaimer" class="disclaimer"></div>
    </div>

    <script>
      const state = {
        searchId: null,
        results: [],
        disclaimer: "",
        pollingTimer: null,
        analysis: null,
        expandedRows: {
          exact: false,
          brand: false,
          different: false
        }
      };

      const statusEl = document.getElementById("status");
      const metaLineEl = document.getElementById("metaLine");
      const gridEl = document.getElementById("resultsGrid");
      const emptyEl = document.getElementById("emptyState");
      const disclaimerEl = document.getElementById("disclaimer");
      const textInput = document.getElementById("textQuery");
      const fileInput = document.getElementById("fileInput");
      const sizeInput = document.getElementById("sizeText");
      const sortSelect = document.getElementById("sortMode");
      const verifiedOnly = document.getElementById("verifiedOnly");
      const settingsPanel = document.getElementById("settingsPanel");
      const settingsToggleBtn = document.getElementById("settingsToggleBtn");
      const saveSettingsBtn = document.getElementById("saveSettingsBtn");
      const clearSettingsBtn = document.getElementById("clearSettingsBtn");
      const settingsInputs = {
        sgwAccessToken: document.getElementById("setSgwAccessToken"),
        sgwUsername: document.getElementById("setSgwUsername"),
        sgwPassword: document.getElementById("setSgwPassword"),
        ebayToken: document.getElementById("setEbayToken"),
        chrono24Key: document.getElementById("setChrono24Key"),
        trrKey: document.getElementById("setTrrKey"),
        vestiaireKey: document.getElementById("setVestiaireKey"),
        searchPrecision: document.getElementById("setSearchPrecision")
      };
      const ROW_PREVIEW_COUNT = 4;
      const ROW_TARGET_COUNT = 6;

      function formatMoney(v) {
        return "$" + Number(v || 0).toLocaleString();
      }

      function setStatus(text) {
        statusEl.textContent = text;
      }

      function renderImageAnalysis(analysis) {
        const el = document.getElementById("analysisLine");
        if (!el) return;
        if (!analysis || typeof analysis !== "object") {
          el.textContent = "";
          return;
        }
        const brand = analysis.brand || "Unknown brand";
        const model = analysis.model_name || analysis.subcategory || "unknown model";
        const category = analysis.category || "accessory";
        el.textContent = "Detected: " + brand + " | " + model + " | " + category;
      }

      function clampPrecision(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return 75;
        return Math.min(100, Math.max(10, Math.round(n)));
      }

      function getStoredSettings() {
        try {
          const raw = localStorage.getItem("maisondeux-settings");
          if (!raw) return {};
          const parsed = JSON.parse(raw);
          return parsed && typeof parsed === "object" ? parsed : {};
        } catch {
          return {};
        }
      }

      function applyStoredSettingsToForm() {
        const s = getStoredSettings();
        settingsInputs.sgwAccessToken.value = s.shopgoodwill_access_token || "";
        settingsInputs.sgwUsername.value = s.shopgoodwill_username || "";
        settingsInputs.sgwPassword.value = s.shopgoodwill_password || "";
        settingsInputs.ebayToken.value = s.ebay_oauth_token || "";
        settingsInputs.chrono24Key.value = s.chrono24_api_key || "";
        settingsInputs.trrKey.value = s.therealreal_api_key || "";
        settingsInputs.vestiaireKey.value = s.vestiaire_api_key || "";
        settingsInputs.searchPrecision.value = String(clampPrecision(s.search_precision ?? 75));
      }

      function collectSettingsFromForm() {
        return {
          shopgoodwill_access_token: (settingsInputs.sgwAccessToken.value || "").trim(),
          shopgoodwill_username: (settingsInputs.sgwUsername.value || "").trim(),
          shopgoodwill_password: (settingsInputs.sgwPassword.value || "").trim(),
          ebay_oauth_token: (settingsInputs.ebayToken.value || "").trim(),
          chrono24_api_key: (settingsInputs.chrono24Key.value || "").trim(),
          therealreal_api_key: (settingsInputs.trrKey.value || "").trim(),
          vestiaire_api_key: (settingsInputs.vestiaireKey.value || "").trim(),
          search_precision: clampPrecision(settingsInputs.searchPrecision.value || 75)
        };
      }

      function buildRuntimeCredentials() {
        const s = getStoredSettings();
        const credentials = {};
        if (s.ebay_oauth_token) credentials.ebay = { oauth_token: s.ebay_oauth_token };
        if (s.shopgoodwill_access_token || s.shopgoodwill_username || s.shopgoodwill_password) {
          credentials.shopgoodwill = {
            access_token: s.shopgoodwill_access_token || undefined,
            username: s.shopgoodwill_username || undefined,
            password: s.shopgoodwill_password || undefined
          };
        }
        if (s.chrono24_api_key) credentials.chrono24 = { api_key: s.chrono24_api_key };
        if (s.therealreal_api_key) credentials.therealreal = { api_key: s.therealreal_api_key };
        if (s.vestiaire_api_key) credentials.vestiaire = { api_key: s.vestiaire_api_key };
        credentials.search = { precision: clampPrecision(s.search_precision ?? 75) };
        return Object.keys(credentials).length ? credentials : undefined;
      }

      function readSortedFilteredResults() {
        let items = state.results.slice();
        if (verifiedOnly.checked) {
          items = items.filter(function(r) {
            return r.authentication_status === "platform_authenticated";
          });
        }
        const mode = sortSelect.value;
        if (mode === "low") items.sort(function(a,b){ return a.price_usd - b.price_usd; });
        if (mode === "high") items.sort(function(a,b){ return b.price_usd - a.price_usd; });
        if (mode === "trust") items.sort(function(a,b){ return b.trust_score - a.trust_score; });
        return items;
      }

      function normalizeText(value) {
        return String(value || "")
          .toLowerCase()
          .replace(/[^a-z0-9\\s-]/g, " ")
          .replace(/\\s+/g, " ")
          .trim();
      }

      function tokenize(value) {
        return normalizeText(value).split(" ").filter(function(t){ return t.length > 1; });
      }

      function hasTokenOverlap(tokensA, tokensB) {
        if (!tokensA.length || !tokensB.length) return false;
        const b = new Set(tokensB);
        return tokensA.some(function(token){ return b.has(token); });
      }

      function modelSimilarityScore(item, analysis) {
        if (!analysis) return 0;
        const haystack = normalizeText((item.title || "") + " " + (item.subcategory || ""));
        let score = 0;
        const model = normalizeText(analysis.model_name || "");
        const subcategory = normalizeText(analysis.subcategory || "");
        if (model && haystack.includes(model)) score += 3;
        if (!model && subcategory && haystack.includes(subcategory)) score += 2;
        if (model && hasTokenOverlap(tokenize(model), tokenize(haystack))) score += 1;
        if (subcategory && hasTokenOverlap(tokenize(subcategory), tokenize(haystack))) score += 1;
        if (analysis.category && item.category === analysis.category) score += 1;
        return score;
      }

      function buildRowBuckets(items, analysis) {
        if (!analysis) {
          return {
            exact: items.slice(0, ROW_TARGET_COUNT),
            brand: items.slice(ROW_TARGET_COUNT, ROW_TARGET_COUNT * 2),
            different: items.slice(ROW_TARGET_COUNT * 2, ROW_TARGET_COUNT * 3)
          };
        }

        const detectedBrand = normalizeText(analysis.brand || "");
        const remaining = items.slice();
        const used = new Set();
        const rows = { exact: [], brand: [], different: [] };

        function takeForRow(rowKey, predicate) {
          for (let i = 0; i < remaining.length; i += 1) {
            const item = remaining[i];
            const id = item.listing_id;
            if (used.has(id)) continue;
            if (!predicate(item)) continue;
            used.add(id);
            rows[rowKey].push(item);
            if (rows[rowKey].length >= ROW_TARGET_COUNT) return;
          }
        }

        function isExactBrand(item) {
          if (!detectedBrand) return false;
          return normalizeText(item.brand || "") === detectedBrand;
        }

        takeForRow("exact", function(item){ return isExactBrand(item) && modelSimilarityScore(item, analysis) >= 3; });
        if (rows.exact.length < ROW_TARGET_COUNT) {
          takeForRow("exact", function(item){ return isExactBrand(item) && modelSimilarityScore(item, analysis) >= 2; });
        }
        if (rows.exact.length < ROW_TARGET_COUNT) {
          takeForRow("exact", function(item){ return isExactBrand(item) && modelSimilarityScore(item, analysis) >= 1; });
        }

        takeForRow("brand", function(item){ return isExactBrand(item) && modelSimilarityScore(item, analysis) >= 1; });
        if (rows.brand.length < ROW_TARGET_COUNT) {
          takeForRow("brand", function(item){ return isExactBrand(item); });
        }

        takeForRow("different", function(item){ return !isExactBrand(item) && modelSimilarityScore(item, analysis) >= 2; });
        if (rows.different.length < ROW_TARGET_COUNT) {
          takeForRow("different", function(item){ return !isExactBrand(item) && modelSimilarityScore(item, analysis) >= 1; });
        }

        const rowOrder = ["exact", "brand", "different"];
        for (const key of rowOrder) {
          if (rows[key].length >= ROW_TARGET_COUNT) continue;
          takeForRow(key, function(){ return true; });
        }
        return rows;
      }

      function createListingCard(item) {
        const card = document.createElement("article");
        card.className = "listing";
        const image = item.images && item.images.length ? item.images[0] : "";
        card.innerHTML =
          '<img src="' + image + '" alt="' + (item.title || "listing") + '">' +
          '<div class="body">' +
            '<div class="row"><span class="platform">' + item.platform + '</span><span class="price">' + formatMoney(item.price_usd) + '</span></div>' +
            '<div class="title">' + (item.title || "") + '</div>' +
            '<div class="sub">' + (item.condition || "unknown") + ' • ' + (item.brand || "") + '</div>' +
            '<div class="trust">Trust: ' + (item.trust_score || 0) + '/100</div>' +
            '<a class="footer-link" href="' + item.platform_listing_url + '" target="_blank" rel="noopener noreferrer">View on ' + item.platform + '</a>' +
          '</div>';
        return card;
      }

      function renderRowSection(sectionKey, title, items) {
        const section = document.createElement("section");
        section.className = "row-section";

        const head = document.createElement("div");
        head.className = "row-head";
        const titleEl = document.createElement("div");
        titleEl.className = "row-title";
        titleEl.textContent = title + " (" + items.length + ")";
        head.appendChild(titleEl);

        const expanded = Boolean(state.expandedRows[sectionKey]);
        if (items.length > ROW_PREVIEW_COUNT) {
          const moreBtn = document.createElement("button");
          moreBtn.className = "more-btn";
          moreBtn.type = "button";
          moreBtn.textContent = expanded ? "Show less" : "More";
          moreBtn.addEventListener("click", function() {
            state.expandedRows[sectionKey] = !expanded;
            renderResults();
          });
          head.appendChild(moreBtn);
        }

        const grid = document.createElement("div");
        grid.className = "row-grid";
        const visible = expanded ? items : items.slice(0, ROW_PREVIEW_COUNT);
        visible.forEach(function(item) {
          grid.appendChild(createListingCard(item));
        });

        section.appendChild(head);
        section.appendChild(grid);
        return section;
      }

      function renderResults() {
        const items = readSortedFilteredResults();
        gridEl.innerHTML = "";
        if (!items.length) {
          emptyEl.style.display = "block";
          return;
        }
        emptyEl.style.display = "none";
        const buckets = buildRowBuckets(items, state.analysis);
        gridEl.appendChild(renderRowSection("exact", "Exact brand and model", buckets.exact));
        gridEl.appendChild(renderRowSection("brand", "Exact brand, similar model", buckets.brand));
        gridEl.appendChild(renderRowSection("different", "Different brand, similar model", buckets.different));
      }

      async function pollSearch(searchId) {
        if (state.pollingTimer) {
          clearInterval(state.pollingTimer);
          state.pollingTimer = null;
        }
        state.pollingTimer = setInterval(async function() {
          try {
            const res = await fetch("/api/v1/search/" + searchId);
            if (!res.ok) return;
            const data = await res.json();
            state.results = (data.results || []).map(function(entry) { return entry.listing; }).filter(Boolean);
            state.disclaimer = data.disclaimer || "";
            state.analysis = data.search && data.search.image_analysis ? data.search.image_analysis : null;
            renderImageAnalysis(data.search && data.search.image_analysis ? data.search.image_analysis : null);
            metaLineEl.textContent = String(state.results.length) + " listings • status: " + data.search.status;
            disclaimerEl.textContent = state.disclaimer;
            renderResults();
            if (data.search.status === "completed" || data.search.status === "failed") {
              setStatus(data.search.status === "completed" ? "Search completed." : "Search failed.");
              clearInterval(state.pollingTimer);
              state.pollingTimer = null;
            } else {
              setStatus("Searching marketplaces...");
            }
          } catch (e) {
            setStatus("Polling error. Try again.");
          }
        }, 1500);
      }

      async function startTextSearch() {
        const q = (textInput.value || "").trim();
        if (!q) {
          setStatus("Enter a text query first.");
          return;
        }
        state.expandedRows = { exact: false, brand: false, different: false };
        state.analysis = null;
        renderImageAnalysis(null);
        setStatus("Starting text search...");
        const res = await fetch("/api/v1/search/text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query_text: q,
            category: "accessory",
            runtime_credentials: buildRuntimeCredentials()
          })
        });
        if (!res.ok) {
          setStatus("Text search failed.");
          return;
        }
        const data = await res.json();
        state.searchId = data.search_id;
        await pollSearch(state.searchId);
      }

      async function startImageSearch() {
        const file = fileInput.files && fileInput.files[0];
        if (!file) {
          setStatus("Choose an image file first.");
          return;
        }
        state.expandedRows = { exact: false, brand: false, different: false };
        state.analysis = null;
        renderImageAnalysis(null);
        const sizeText = (sizeInput.value || "").trim();
        const formData = new FormData();
        formData.append("image", file);
        if (sizeText) {
          formData.append("size_text", sizeText);
        }
        const runtimeCredentials = buildRuntimeCredentials();
        if (runtimeCredentials) {
          formData.append("runtime_credentials", JSON.stringify(runtimeCredentials));
        }
        setStatus("Uploading image...");
        const res = await fetch("/api/v1/search/image-upload", {
          method: "POST",
          body: formData
        });
        if (!res.ok) {
          setStatus("Image upload/search failed.");
          return;
        }
        const data = await res.json();
        state.searchId = data.search_id;
        await pollSearch(state.searchId);
      }

      document.getElementById("textSearchBtn").addEventListener("click", function() {
        void startTextSearch();
      });
      document.getElementById("imageSearchBtn").addEventListener("click", function() {
        void startImageSearch();
      });
      settingsToggleBtn.addEventListener("click", function() {
        settingsPanel.classList.toggle("open");
      });
      saveSettingsBtn.addEventListener("click", function() {
        const next = collectSettingsFromForm();
        localStorage.setItem("maisondeux-settings", JSON.stringify(next));
        setStatus("Settings saved for this browser.");
      });
      clearSettingsBtn.addEventListener("click", function() {
        localStorage.removeItem("maisondeux-settings");
        applyStoredSettingsToForm();
        setStatus("Settings cleared.");
      });
      sortSelect.addEventListener("change", renderResults);
      verifiedOnly.addEventListener("change", renderResults);
      applyStoredSettingsToForm();
    </script>
  </body>
</html>`);
});

app.get("/healthz", async () => {
  const dbCheck = await prisma.$queryRaw`SELECT 1`;
  return {
    ok: true,
    db: Array.isArray(dbCheck),
    redis: Boolean(redisConnection),
    timestamp: new Date().toISOString()
  };
});

app.get("/readyz", async (request, reply) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const queueCounts = searchQueue ? await searchQueue.getJobCounts() : null;
    return {
      ok: true,
      db: true,
      redis: Boolean(redisConnection),
      queue: queueCounts
    };
  } catch (error) {
    request.log.error(error);
    return reply.code(503).send({ ok: false });
  }
});

app.post("/api/v1/auth/signup", async (request, reply) => {
  const parsed = SIGNUP_SCHEMA.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return reply.code(409).send({ error: "email_exists" });
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      passwordHash: createHash("sha256").update(parsed.data.password).digest("hex"),
      subscriptionTier: "free",
      preferences: {} as Prisma.InputJsonValue
    }
  });
  const token = await reply.jwtSign({ sub: user.id, email: user.email });
  return { user: { id: user.id, email: user.email }, token };
});

app.post("/api/v1/auth/login", async (request, reply) => {
  const parsed = LOGIN_SCHEMA.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !user.passwordHash) return reply.code(401).send({ error: "invalid_credentials" });
  const passwordHash = createHash("sha256").update(parsed.data.password).digest("hex");
  if (user.passwordHash !== passwordHash) return reply.code(401).send({ error: "invalid_credentials" });
  const token = await reply.jwtSign({ sub: user.id, email: user.email });
  return { user: { id: user.id, email: user.email }, token };
});

app.post("/api/v1/auth/oauth", async (_request, reply) => {
  return reply.code(501).send({ error: "oauth_not_configured" });
});

app.post("/api/v1/search/image-upload", async (request: any, reply) => {
  const file = await request.file();
  if (!file) return reply.code(400).send({ error: "image_file_required" });
  const mimeType = file.mimetype?.toLowerCase() ?? "";
  if (!ALLOWED_IMAGE_MIME.has(mimeType)) {
    return reply.code(400).send({ error: "unsupported_image_type" });
  }
  const buffer = await file.toBuffer();
  if (!buffer.length) return reply.code(400).send({ error: "empty_image_file" });
  if (buffer.length > 10 * 1024 * 1024) {
    return reply.code(400).send({ error: "image_too_large" });
  }
  let parsedRuntimeCredentials: z.infer<typeof RUNTIME_CREDENTIALS_SCHEMA> | undefined;
  const runtimeRaw = typeof file.fields?.runtime_credentials?.value === "string"
    ? file.fields.runtime_credentials.value
    : undefined;
  if (runtimeRaw) {
    let decoded: unknown;
    try {
      decoded = JSON.parse(runtimeRaw);
    } catch {
      return reply.code(400).send({ error: "invalid_runtime_credentials_json" });
    }
    const parsedRuntime = RUNTIME_CREDENTIALS_SCHEMA.safeParse(decoded);
    if (!parsedRuntime.success) return reply.code(400).send({ error: "invalid_runtime_credentials" });
    parsedRuntimeCredentials = parsedRuntime.data;
  }
  const sizeText = typeof file.fields?.size_text?.value === "string" ? file.fields.size_text.value : undefined;

  const search = await prisma.search.create({
    data: {
      imageUrl: null,
      imageMimeType: mimeType,
      imageBase64: buffer.toString("base64"),
      runtimeCredentials: mergeRuntimeCredentials(parsedRuntimeCredentials, sizeText),
      status: "pending"
    }
  });
  await enqueueSearchJob(search.id);
  return reply.code(202).send({ search_id: search.id, status: "pending" });
});

app.post("/api/v1/search/image", async (request, reply) => {
  const parsed = IMAGE_SEARCH_SCHEMA.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
  const search = await prisma.search.create({
    data: {
      userId: parsed.data.user_id ?? null,
      imageUrl: parsed.data.image_url,
      imageMimeType: null,
      imageBase64: null,
      runtimeCredentials: mergeRuntimeCredentials(parsed.data.runtime_credentials, parsed.data.size_text),
      status: "pending"
    }
  });
  await enqueueSearchJob(search.id);
  return reply.code(202).send({ search_id: search.id, status: "pending" });
});

app.post("/api/v1/search/text", async (request, reply) => {
  const parsed = TEXT_SEARCH_SCHEMA.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
  const search = await prisma.search.create({
    data: {
      userId: parsed.data.user_id ?? null,
      queryText: parsed.data.query_text,
      constructedQuery: parsed.data.query_text,
      runtimeCredentials:
        parsed.data.runtime_credentials !== undefined
          ? (parsed.data.runtime_credentials as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      status: "pending"
    }
  });
  await enqueueSearchJob(search.id);
  return reply.code(202).send({ search_id: search.id, status: "pending" });
});

app.get("/api/v1/search/:searchId/image", async (request, reply) => {
  const params = request.params as { searchId: string };
  const search = await prisma.search.findUnique({
    where: { id: params.searchId },
    select: { imageBase64: true, imageMimeType: true }
  });
  if (!search || !search.imageBase64 || !search.imageMimeType) {
    return reply.code(404).send({ error: "image_not_found" });
  }
  const bytes = Buffer.from(search.imageBase64, "base64");
  reply.header("Cache-Control", "public, max-age=300");
  return reply.type(search.imageMimeType).send(bytes);
});

app.get("/api/v1/search/:searchId", async (request, reply) => {
  const params = request.params as { searchId: string };
  const search = await prisma.search.findUnique({
    where: { id: params.searchId },
    include: {
      results: {
        include: { listing: true },
        orderBy: { rankPosition: "asc" }
      }
    }
  });
  if (!search) return reply.code(404).send({ error: "search_not_found" });
  const results = search.results.map((result) => ({
    id: result.id,
    search_id: result.searchId,
    listing_id: `${result.listing.platform}-${result.listing.platformListingId}`,
    relevance_score: Number(result.relevanceScore?.toString() ?? "0"),
    rank_position: result.rankPosition ?? 0,
    created_at: result.createdAt.toISOString(),
    listing: {
      listing_id: `${result.listing.platform}-${result.listing.platformListingId}`,
      platform_listing_id: result.listing.platformListingId,
      platform: result.listing.platform,
      platform_listing_url: result.listing.platformListingUrl,
      brand: result.listing.brand ?? "",
      category: (result.listing.category ?? "accessory") as
        | "watch"
        | "jewelry"
        | "bag"
        | "shoes"
        | "apparel"
        | "accessory",
      subcategory: result.listing.subcategory ?? "",
      title: result.listing.title ?? "",
      description: result.listing.description ?? "",
      price_usd: Number(result.listing.priceUsd?.toString() ?? "0"),
      original_currency: result.listing.originalCurrency ?? "USD",
      original_price: Number(result.listing.originalPrice?.toString() ?? "0"),
      condition: (result.listing.condition ?? "good") as
        | "new_with_tags"
        | "like_new"
        | "excellent"
        | "good"
        | "fair"
        | "poor",
      condition_raw: result.listing.conditionRaw ?? "",
      images: result.listing.images,
      size: result.listing.size,
      color: result.listing.color,
      material: result.listing.material,
      seller_rating: result.listing.sellerRating ? Number(result.listing.sellerRating.toString()) : null,
      seller_sales_count: result.listing.sellerSalesCount,
      seller_verified: result.listing.sellerVerified,
      authentication_status: (result.listing.authenticationStatus ?? "unverified") as
        | "platform_authenticated"
        | "seller_claimed"
        | "unverified",
      authentication_badge: result.listing.authenticationBadge,
      listed_at: result.listing.listedAt?.toISOString() ?? new Date().toISOString(),
      scraped_at: result.listing.scrapedAt.toISOString(),
      is_available: result.listing.isAvailable,
      shipping_available_us: Boolean(result.listing.shippingAvailableUs),
      location_country: result.listing.locationCountry,
      platform_fees_buyer_pct: result.listing.platformFeesBuyerPct
        ? Number(result.listing.platformFeesBuyerPct.toString())
        : null,
      trust_score: result.listing.trustScore
    }
  }));

  return {
    search: {
      id: search.id,
      user_id: search.userId,
      image_url: search.imageUrl,
      query_text: search.queryText,
      image_analysis: search.imageAnalysis,
      constructed_query: search.constructedQuery,
      result_count: search.resultCount,
      created_at: search.createdAt.toISOString(),
      status: serializeStatus(search.status),
      error_message: search.errorMessage
    },
    results,
    disclaimer: TRUST_DISCLAIMER,
    marketplaces_covered: new Set(results.map((entry) => entry.listing.platform)).size
  };
});

app.get("/api/v1/listings/:listingId", async (request, reply) => {
  const params = request.params as { listingId: string };
  const [platform, ...rest] = params.listingId.split("-");
  const platformListingId = rest.join("-");
  if (!platform || !platformListingId) return reply.code(404).send({ error: "listing_not_found" });
  const listing = await prisma.listing.findUnique({
    where: {
      platform_platformListingId: { platform, platformListingId }
    }
  });
  if (!listing) return reply.code(404).send({ error: "listing_not_found" });
  return { listing, disclaimer: TRUST_DISCLAIMER };
});

app.get("/api/v1/user/profile", { preHandler: authGuard }, async (request: any, reply) => {
  const user = await prisma.user.findUnique({ where: { id: request.user.sub } });
  if (!user) return reply.code(404).send({ error: "user_not_found" });
  return {
    id: user.id,
    email: user.email,
    subscription_tier: user.subscriptionTier,
    preferences: user.preferences
  };
});

app.put("/api/v1/user/preferences", { preHandler: authGuard }, async (request: any, reply) => {
  const parsed = PREFERENCES_SCHEMA.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
  const user = await prisma.user.update({
    where: { id: request.user.sub },
    data: { preferences: parsed.data.preferences as Prisma.InputJsonValue }
  });
  return { ok: true, preferences: user.preferences };
});

app.get("/api/v1/user/saved-searches", { preHandler: authGuard }, async (request: any) => {
  const rows = await prisma.savedSearch.findMany({
    where: { userId: request.user.sub },
    orderBy: { createdAt: "desc" }
  });
  return rows.map((row) => ({
    id: row.id,
    user_id: row.userId,
    name: row.name,
    query_text: row.queryText,
    image_url: row.imageUrl,
    image_analysis: row.imageAnalysis,
    price_alert_threshold: row.priceAlertThreshold ? Number(row.priceAlertThreshold.toString()) : null,
    alert_enabled: row.alertEnabled,
    last_alerted_at: row.lastAlertedAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString()
  }));
});

app.post("/api/v1/user/saved-searches", { preHandler: authGuard }, async (request: any, reply) => {
  const parsed = SAVE_SEARCH_SCHEMA.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
  const saved = await prisma.savedSearch.create({
    data: {
      userId: request.user.sub as string,
      name: parsed.data.name ?? null,
      queryText: parsed.data.query_text ?? null,
      imageUrl: parsed.data.image_url ?? null,
      imageAnalysis:
        parsed.data.image_analysis !== undefined
          ? (parsed.data.image_analysis as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      priceAlertThreshold: parsed.data.price_alert_threshold ?? null,
      alertEnabled: parsed.data.alert_enabled
    }
  });
  return reply.code(201).send({
    id: saved.id,
    user_id: saved.userId,
    name: saved.name,
    query_text: saved.queryText,
    image_url: saved.imageUrl,
    image_analysis: saved.imageAnalysis,
    price_alert_threshold: saved.priceAlertThreshold ? Number(saved.priceAlertThreshold.toString()) : null,
    alert_enabled: saved.alertEnabled,
    last_alerted_at: saved.lastAlertedAt,
    created_at: saved.createdAt
  });
});

app.delete("/api/v1/user/saved-searches/:id", { preHandler: authGuard }, async (request: any, reply) => {
  const params = request.params as { id: string };
  const deleted = await prisma.savedSearch.deleteMany({
    where: { id: params.id, userId: request.user.sub }
  });
  if (deleted.count === 0) return reply.code(404).send({ error: "saved_search_not_found" });
  return { ok: true };
});

app.put(
  "/api/v1/user/saved-searches/:id/alert",
  { preHandler: authGuard },
  async (request: any, reply) => {
    const parsed = ALERT_UPDATE_SCHEMA.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const params = request.params as { id: string };
    const updated = await prisma.savedSearch.updateMany({
      where: { id: params.id, userId: request.user.sub },
      data: {
        alertEnabled: parsed.data.alert_enabled,
        priceAlertThreshold:
          parsed.data.price_alert_threshold !== undefined ? parsed.data.price_alert_threshold : undefined
      }
    });
    if (updated.count === 0) return reply.code(404).send({ error: "saved_search_not_found" });
    return prisma.savedSearch.findUnique({ where: { id: params.id } });
  }
);

app.get("/api/v1/admin/marketplace-status", async () => {
  const marketplaces = await prisma.marketplaceConfig.findMany({
    orderBy: { platform: "asc" }
  });
  return {
    marketplaces,
    active_count: marketplaces.filter((config) => config.isActive).length
  };
});

app.get("/api/v1/admin/worker-status", async () => {
  const heartbeat = await getWorkerHeartbeat();
  return {
    worker_online: Boolean(heartbeat),
    heartbeat
  };
});

app.get("/api/v1/admin/metrics", async () => {
  const metrics = await getMetricsSnapshot();
  const queueCounts = searchQueue ? await searchQueue.getJobCounts() : null;
  const dlqCounts = searchDlq ? await searchDlq.getJobCounts() : null;
  return {
    metrics,
    queue: queueCounts,
    dlq: dlqCounts,
    timestamp: new Date().toISOString()
  };
});

const port = Number(process.env.PORT ?? 3000);
ensureMarketplaceConfigs()
  .then(() => app.listen({ host: "0.0.0.0", port }))
  .then(() => app.log.info(`maisonDeux API running on port ${port}`))
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
