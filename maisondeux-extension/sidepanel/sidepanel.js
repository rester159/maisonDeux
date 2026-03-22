/**
 * @file sidepanel/sidepanel.js
 * @description MaisonDeux side panel UI. Displays detected product info,
 * search status, and deal results from other platforms. Includes on/off
 * toggle and filter controls.
 */

/* global chrome */

// ---- DOM refs ----
const $toggle       = document.getElementById('toggle-active');
const $stateOff     = document.getElementById('state-off');
const $stateIdle    = document.getElementById('state-idle');
const $stateScanning = document.getElementById('state-scanning');
const $scanStatus   = document.getElementById('scan-status');
const $productCtx   = document.getElementById('product-context');
const $productPlatform = document.getElementById('product-platform');
const $productName  = document.getElementById('product-name');
const $productPrice = document.getElementById('product-price');
const $productAttrs = document.getElementById('product-attrs');
const $filterSection = document.getElementById('filter-section');
const $resultsSection = document.getElementById('results-section');
const $resultsSummary = document.getElementById('results-summary');
const $resultsList  = document.getElementById('results-list');
const $clearFilters = document.getElementById('clear-filters');
const $settingsBtn  = document.getElementById('settings-btn');
const filterEls = {
  color:     document.getElementById('filter-color'),
  size:      document.getElementById('filter-size'),
  material:  document.getElementById('filter-material'),
  condition: document.getElementById('filter-condition'),
  relevance: document.getElementById('filter-relevance'),
};

// ---- State ----
let isActive = true;
let currentProduct = null;
let allResults = []; // all scored results received so far
let searchComplete = false;
let platformsSearched = 0;
let totalPlatforms = 0;

// ---- Init ----

// Load saved active state.
chrome.storage.local.get('maisondeux_active', (data) => {
  isActive = data.maisondeux_active !== false; // default true
  $toggle.checked = isActive;
  updateView();
});

// Ask background for current product immediately.
chrome.runtime.sendMessage({ type: 'GET_CURRENT_PRODUCT' }, (response) => {
  if (response?.product) {
    showProduct(response.product);
    if (response.results) {
      allResults = response.results;
      searchComplete = response.searchComplete || false;
      renderResults();
    }
  }
});

// ---- Toggle on/off ----

$toggle.addEventListener('change', () => {
  isActive = $toggle.checked;
  chrome.storage.local.set({ maisondeux_active: isActive });
  chrome.runtime.sendMessage({ type: 'SET_ACTIVE', payload: { active: isActive } });
  updateView();
});

// ---- Settings ----
$settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());

// ---- Message listeners ----

chrome.runtime.onMessage.addListener((message) => {
  if (!isActive) return;

  switch (message.type) {
    case 'PRODUCT_DETECTED':
      showProduct(message.payload);
      break;

    case 'SEARCH_STARTED':
      totalPlatforms = message.payload?.platformCount || 7;
      platformsSearched = 0;
      searchComplete = false;
      allResults = [];
      showScanning();
      break;

    case 'DEAL_RESULTS': {
      const { listings, platform, complete } = message.payload;
      if (listings?.length) {
        allResults.push(...listings);
      }
      if (platform) platformsSearched++;
      $scanStatus.textContent = complete
        ? `Found ${allResults.length} deals across ${platformsSearched} platforms`
        : `Checked ${platformsSearched}/${totalPlatforms} platforms...`;

      if (complete) {
        searchComplete = true;
        $stateScanning.classList.add('hidden');
      }
      renderResults();
      break;
    }

    case 'DEALS_COUNT':
      $resultsSummary.textContent = `${message.payload.count} deals found`;
      break;
  }
});

// ---- Filters ----

Object.values(filterEls).forEach((el) => {
  el.addEventListener('change', () => {
    updateFilterStyles();
    renderResults();
  });
});

$clearFilters.addEventListener('click', (e) => {
  e.preventDefault();
  filterEls.color.value = '';
  filterEls.size.value = '';
  filterEls.material.value = '';
  filterEls.condition.value = '';
  filterEls.relevance.value = '0.5';
  updateFilterStyles();
  renderResults();
});

function updateFilterStyles() {
  let activeCount = 0;
  for (const [key, el] of Object.entries(filterEls)) {
    if (key === 'relevance') continue;
    const active = el.value !== '';
    el.classList.toggle('active', active);
    if (active) activeCount++;
  }
  $clearFilters.classList.toggle('hidden', activeCount === 0);
  $clearFilters.textContent = `Clear ${activeCount} filter${activeCount > 1 ? 's' : ''}`;
}

// ---- View updates ----

function updateView() {
  if (!isActive) {
    $stateOff.classList.remove('hidden');
    $stateIdle.classList.add('hidden');
    $stateScanning.classList.add('hidden');
    $productCtx.classList.add('hidden');
    $filterSection.classList.add('hidden');
    $resultsSection.classList.add('hidden');
    return;
  }

  $stateOff.classList.add('hidden');
  if (currentProduct) {
    $stateIdle.classList.add('hidden');
  } else {
    $stateIdle.classList.remove('hidden');
  }
}

function showProduct(product) {
  currentProduct = product;
  $stateIdle.classList.add('hidden');
  $productCtx.classList.remove('hidden');
  $productPlatform.textContent = product.platform || product.source || '';
  $productName.textContent = [product.brand, product.productName || product.title].filter(Boolean).join(' — ');
  $productPrice.textContent = `${product.currency || 'USD'} ${product.price || ''}`;

  // Attribute chips.
  $productAttrs.innerHTML = '';
  const attrs = product.attrs || {};
  const chipData = [
    ...(attrs.colors || []),
    ...(attrs.materials || []),
    ...(attrs.sizes || []),
    ...(attrs.hardware || []),
    ...(attrs.conditions || []),
    ...(attrs.categories || []),
  ];
  for (const val of chipData) {
    const chip = document.createElement('span');
    chip.className = 'sp-chip';
    chip.textContent = val;
    $productAttrs.appendChild(chip);
  }
}

function showScanning() {
  $stateScanning.classList.remove('hidden');
  $stateIdle.classList.add('hidden');
  $scanStatus.textContent = 'Scanning platforms...';
}

// ---- Render results ----

function renderResults() {
  if (!allResults.length) {
    if (searchComplete) {
      $resultsSection.classList.remove('hidden');
      $resultsList.innerHTML = '<div class="sp-no-results">No deals found on other platforms.</div>';
    }
    return;
  }

  $filterSection.classList.remove('hidden');
  $resultsSection.classList.remove('hidden');

  // Populate filter dropdowns from available values.
  populateFilterOptions();

  // Apply filters.
  const minScore = parseFloat(filterEls.relevance.value) || 0;
  let filtered = allResults.filter((r) => (r.relevanceScore || r.score || 0) >= minScore);

  for (const [key, el] of Object.entries(filterEls)) {
    if (key === 'relevance' || !el.value) continue;
    filtered = filtered.filter((r) => {
      const val = r.attrs?.[key] || r[key] || '';
      return val.toLowerCase().includes(el.value.toLowerCase());
    });
  }

  // Sort: relevance desc, then price asc.
  filtered.sort((a, b) => {
    const scoreA = a.relevanceScore || a.score || 0;
    const scoreB = b.relevanceScore || b.score || 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0);
  });

  // Group by platform.
  const groups = {};
  for (const r of filtered) {
    const p = r.platform || r.source || 'unknown';
    if (!groups[p]) groups[p] = [];
    groups[p].push(r);
  }

  $resultsSummary.textContent = searchComplete
    ? `${filtered.length} deal${filtered.length !== 1 ? 's' : ''} found`
    : `${filtered.length} deal${filtered.length !== 1 ? 's' : ''} so far...`;

  $resultsList.innerHTML = '';

  for (const [platform, listings] of Object.entries(groups)) {
    const group = document.createElement('div');
    group.className = 'sp-platform-group';

    group.innerHTML = `
      <div class="sp-platform-header">
        <span class="sp-platform-name">${esc(platform)}</span>
        <span class="sp-platform-count">${listings.length} result${listings.length > 1 ? 's' : ''}</span>
      </div>
    `;

    for (const listing of listings.slice(0, 10)) {
      group.appendChild(renderListing(listing));
    }

    $resultsList.appendChild(group);
  }
}

function renderListing(listing) {
  const a = document.createElement('a');
  a.className = 'sp-listing';
  a.href = listing.link || listing.url || '#';
  a.target = '_blank';
  a.rel = 'noopener';

  const score = listing.relevanceScore || listing.score || 0;
  const scoreLabel = score >= 0.85 ? 'Exact' : score >= 0.7 ? 'Very Similar' : score >= 0.5 ? 'Similar' : score >= 0.3 ? 'Related' : 'Weak';
  const scoreClass = score >= 0.85 ? 'high' : score >= 0.7 ? 'medium' : score >= 0.5 ? 'low' : 'weak';

  // Price delta.
  let savingsHtml = '';
  if (currentProduct?.price && listing.price) {
    const srcPrice = parseFloat(String(currentProduct.price).replace(/[^0-9.]/g, ''));
    const candPrice = parseFloat(String(listing.price).replace(/[^0-9.]/g, ''));
    if (srcPrice && candPrice) {
      const delta = srcPrice - candPrice;
      const pct = Math.round((Math.abs(delta) / srcPrice) * 100);
      if (delta > 0) {
        savingsHtml = `<span class="sp-savings cheaper">-$${Math.round(delta)} (${pct}% less)</span>`;
      } else if (delta < 0) {
        savingsHtml = `<span class="sp-savings pricier">+$${Math.round(Math.abs(delta))} more</span>`;
      }
    }
  }

  const priceText = listing.price || '';
  const imgSrc = listing.img || listing.imageUrl || '';

  a.innerHTML = `
    ${imgSrc ? `<img class="sp-listing-img" src="${esc(imgSrc)}" alt="" />` : '<div class="sp-listing-img"></div>'}
    <div class="sp-listing-info">
      <div class="sp-listing-title">${esc(listing.title || '')}</div>
      <div class="sp-listing-price-row">
        <span class="sp-listing-price">${esc(priceText)}</span>
        ${savingsHtml}
      </div>
      <div class="sp-listing-meta">
        <span class="sp-relevance ${scoreClass}">${scoreLabel} ${Math.round(score * 100)}%</span>
      </div>
    </div>
  `;

  return a;
}

function populateFilterOptions() {
  const values = { color: new Set(), size: new Set(), material: new Set(), condition: new Set() };
  for (const r of allResults) {
    if (r.attrs) {
      (r.attrs.colors || []).forEach((v) => values.color.add(v));
      (r.attrs.sizes || []).forEach((v) => values.size.add(v));
      (r.attrs.materials || []).forEach((v) => values.material.add(v));
      (r.attrs.conditions || []).forEach((v) => values.condition.add(v));
    }
    if (r.color) values.color.add(r.color);
    if (r.size) values.size.add(r.size);
    if (r.material) values.material.add(r.material);
    if (r.condition) values.condition.add(r.condition);
  }

  for (const [key, set] of Object.entries(values)) {
    const el = filterEls[key];
    const current = el.value;
    const firstOpt = el.options[0]; // "Any ..."
    el.innerHTML = '';
    el.appendChild(firstOpt);
    for (const v of [...set].sort()) {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      if (v === current) opt.selected = true;
      el.appendChild(opt);
    }
  }
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
