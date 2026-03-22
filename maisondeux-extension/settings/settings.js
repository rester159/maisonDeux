/**
 * @file settings/settings.js
 * @description MaisonDeux options page. Persists platforms, API keys,
 * credentials, and preferences to chrome.storage.sync.
 */

/* global chrome */

const KEY_FIELDS = [
  'ebay_app_id', 'ebay_cert_id', 'serpapi_key', 'anthropic_key', 'condition_report_key',
  'therealreal_api_key', 'vestiaire_api_key', 'shopgoodwill_access_token',
];

const DEFAULTS = {
  platforms: ['therealreal', 'ebay', 'poshmark', 'vestiaire', 'grailed', 'mercari', 'shopgoodwill'],
  currency: 'USD',
  minRelevance: 50,
};

const $platforms = document.querySelectorAll('input[name="platform"]');
const $currency = document.getElementById('currency');
const $minRelevance = document.getElementById('min-relevance');
const $relevanceValue = document.getElementById('relevance-value');
const $saveBtn = document.getElementById('save-btn');
const $status = document.getElementById('status');
const $closeBtn = document.getElementById('close-btn');

$closeBtn.addEventListener('click', () => window.close());

// ---- Load ----

chrome.storage.sync.get(null, (settings) => {
  // Platforms.
  const platforms = settings.platforms || DEFAULTS.platforms;
  $platforms.forEach((cb) => { cb.checked = platforms.includes(cb.value); });

  // Currency.
  $currency.value = settings.currency || DEFAULTS.currency;

  // Relevance.
  const rel = settings.minRelevance ?? DEFAULTS.minRelevance;
  $minRelevance.value = rel;
  $relevanceValue.textContent = rel;

  // API keys — fill in if saved.
  for (const field of KEY_FIELDS) {
    const el = document.getElementById(field);
    if (el && settings[field]) el.value = settings[field];
  }
});

$minRelevance.addEventListener('input', () => {
  $relevanceValue.textContent = $minRelevance.value;
});

// ---- Save ----

$saveBtn.addEventListener('click', () => {
  const platforms = [...$platforms].filter((cb) => cb.checked).map((cb) => cb.value);
  const currency = $currency.value;
  const minRelevance = parseInt($minRelevance.value, 10);

  const settings = { platforms, currency, minRelevance };

  // Save API keys.
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
});
