/**
 * @file settings/settings.js
 * @description Logic for the MaisonDeux options page. Persists user
 * preferences to chrome.storage.sync and broadcasts changes to listeners.
 */

/* global chrome */

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

// ---- Load saved settings ----

chrome.storage.sync.get(DEFAULTS, (settings) => {
  // Platforms.
  $platforms.forEach((cb) => {
    cb.checked = settings.platforms.includes(cb.value);
  });

  // Currency.
  $currency.value = settings.currency;

  // Relevance.
  $minRelevance.value = settings.minRelevance;
  $relevanceValue.textContent = settings.minRelevance;
});

// Live-update the relevance label.
$minRelevance.addEventListener('input', () => {
  $relevanceValue.textContent = $minRelevance.value;
});

// ---- Save ----

$saveBtn.addEventListener('click', () => {
  const platforms = [...$platforms].filter((cb) => cb.checked).map((cb) => cb.value);
  const currency = $currency.value;
  const minRelevance = parseInt($minRelevance.value, 10);

  const settings = { platforms, currency, minRelevance };

  chrome.storage.sync.set(settings, () => {
    // Show saved confirmation.
    $status.classList.remove('hidden');
    setTimeout(() => $status.classList.add('hidden'), 2000);

    // Broadcast to background.
    chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      payload: settings,
    });
  });
});
