/**
 * @file settings/settings.js
 * @description MaisonDeux options page. Persists platforms, API keys,
 * credentials, and preferences to chrome.storage.sync AND Neon DB.
 */

/* global chrome */

const API_BASE = 'https://maisondeux-api.up.railway.app'; // TODO: update with actual deployed URL

const KEY_FIELDS = [
  'openai_key', 'anthropic_key', 'ebay_app_id', 'ebay_cert_id',
  'serpapi_key', 'condition_report_key',
  'therealreal_api_key', 'vestiaire_api_key', 'shopgoodwill_access_token',
];

const DEFAULTS = {
  platforms: ['therealreal', 'ebay', 'poshmark', 'vestiaire', 'grailed', 'mercari', 'shopgoodwill'],
  currency: 'USD',
  minRelevance: 50,
  ai_provider: 'openai',
  ai_model: 'gpt-4o',
};

const $platforms = document.querySelectorAll('input[name="platform"]');
const $currency = document.getElementById('currency');
const $minRelevance = document.getElementById('min-relevance');
const $relevanceValue = document.getElementById('relevance-value');
const $saveBtn = document.getElementById('save-btn');
const $status = document.getElementById('status');
const $closeBtn = document.getElementById('close-btn');
const $aiProvider = document.getElementById('ai_provider');
const $aiModel = document.getElementById('ai_model');

$closeBtn.addEventListener('click', () => window.close());

// Model options per provider.
const MODEL_OPTIONS = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o (Recommended)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Faster/Cheaper)' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  ],
  anthropic: [
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku (Faster)' },
  ],
};

function updateModelOptions() {
  const provider = $aiProvider.value;
  const currentModel = $aiModel.value;
  $aiModel.innerHTML = '';
  for (const opt of MODEL_OPTIONS[provider] || []) {
    const el = document.createElement('option');
    el.value = opt.value;
    el.textContent = opt.label;
    $aiModel.appendChild(el);
  }
  // Preserve selection if still valid.
  const valid = MODEL_OPTIONS[provider]?.some(o => o.value === currentModel);
  if (valid) $aiModel.value = currentModel;
}

$aiProvider.addEventListener('change', updateModelOptions);

// ---- Device ID (stable across reinstalls via Neon) ----

async function getDeviceId() {
  return new Promise((resolve) => {
    chrome.storage.local.get('deviceId', (data) => {
      if (data.deviceId) return resolve(data.deviceId);
      const id = crypto.randomUUID();
      chrome.storage.local.set({ deviceId: id }, () => resolve(id));
    });
  });
}

// ---- Load from DB then local ----

async function loadSettings() {
  const localSettings = await new Promise((resolve) => {
    chrome.storage.sync.get(null, resolve);
  });

  applyToForm(localSettings);

  // Try to restore from DB (in case extension was reinstalled).
  try {
    const deviceId = await getDeviceId();
    const res = await fetch(`${API_BASE}/api/extension-settings/${deviceId}`);
    if (res.ok) {
      const { found, settings } = await res.json();
      if (found) {
        const merged = { ...localSettings };
        if (!merged.openai_key && settings.openaiKey) merged.openai_key = settings.openaiKey;
        if (!merged.ebay_app_id && settings.ebayAppId) merged.ebay_app_id = settings.ebayAppId;
        if (!merged.ebay_cert_id && settings.ebayCertId) merged.ebay_cert_id = settings.ebayCertId;
        if (!merged.serpapi_key && settings.serpapiKey) merged.serpapi_key = settings.serpapiKey;
        if (!merged.anthropic_key && settings.anthropicKey) merged.anthropic_key = settings.anthropicKey;
        chrome.storage.sync.set(merged);
        applyToForm(merged);
        console.log('[MaisonDeux][settings] Restored keys from cloud');
      }
    }
  } catch (err) {
    console.warn('[MaisonDeux][settings] Cloud sync failed (offline?):', err.message);
  }
}

function applyToForm(settings) {
  const platforms = settings.platforms || DEFAULTS.platforms;
  $platforms.forEach((cb) => { cb.checked = platforms.includes(cb.value); });

  $currency.value = settings.currency || DEFAULTS.currency;

  const rel = settings.minRelevance ?? DEFAULTS.minRelevance;
  $minRelevance.value = rel;
  $relevanceValue.textContent = rel;

  // AI provider/model.
  $aiProvider.value = settings.ai_provider || DEFAULTS.ai_provider;
  updateModelOptions();
  $aiModel.value = settings.ai_model || DEFAULTS.ai_model;

  // API keys.
  for (const field of KEY_FIELDS) {
    const el = document.getElementById(field);
    if (el && settings[field]) el.value = settings[field];
  }
}

loadSettings();

$minRelevance.addEventListener('input', () => {
  $relevanceValue.textContent = $minRelevance.value;
});

// ---- Save (local + cloud) ----

$saveBtn.addEventListener('click', async () => {
  const platforms = [...$platforms].filter((cb) => cb.checked).map((cb) => cb.value);
  const currency = $currency.value;
  const minRelevance = parseInt($minRelevance.value, 10);
  const ai_provider = $aiProvider.value;
  const ai_model = $aiModel.value;

  const settings = { platforms, currency, minRelevance, ai_provider, ai_model };

  for (const field of KEY_FIELDS) {
    const el = document.getElementById(field);
    if (el) settings[field] = el.value.trim();
  }

  chrome.storage.sync.set(settings, () => {
    $status.classList.remove('hidden');
    setTimeout(() => $status.classList.add('hidden'), 2000);

    chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      payload: settings,
    });
  });

  // Also save to cloud DB.
  try {
    const deviceId = await getDeviceId();
    await fetch(`${API_BASE}/api/extension-settings/${deviceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        openaiKey: settings.openai_key || '',
        ebayAppId: settings.ebay_app_id || '',
        ebayCertId: settings.ebay_cert_id || '',
        serpapiKey: settings.serpapi_key || '',
        anthropicKey: settings.anthropic_key || '',
        preferences: { platforms, currency, minRelevance, ai_provider, ai_model },
      }),
    });
    console.log('[MaisonDeux][settings] Saved to cloud');
  } catch (err) {
    console.warn('[MaisonDeux][settings] Cloud save failed:', err.message);
  }
});
