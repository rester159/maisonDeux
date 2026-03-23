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
const $productPlatformIcon = document.getElementById('product-platform-icon');
const $productNameText = document.getElementById('product-name-text');
const $productPrice = document.getElementById('product-price');
const $productAttrs = document.getElementById('product-attrs');
const $filterSection = document.getElementById('filter-section');
const $resultsSection = document.getElementById('results-section');
const $resultsSummary = document.getElementById('results-summary');
const $resultsList  = document.getElementById('results-list');
const $clearFilters = document.getElementById('clear-filters');
const $settingsBtn  = document.getElementById('settings-btn');
const filterEls = {
  brand:     document.getElementById('filter-brand'),
  store:     document.getElementById('filter-store'),
  color:     document.getElementById('filter-color'),
  model:     document.getElementById('filter-model'),
  material:  document.getElementById('filter-material'),
  condition: document.getElementById('filter-condition'),
  relevance: document.getElementById('filter-relevance'),
};
const $sortBy = document.getElementById('sort-by');
const $mainView = document.getElementById('main-view');
const $favoritesView = document.getElementById('favorites-view');
const $favoritesBtn = document.getElementById('favorites-btn');
const $favBackBtn = document.getElementById('fav-back-btn');
const $favoritesList = document.getElementById('favorites-list');
const $favCount = document.getElementById('fav-count');
const $deepCompareBtn = document.getElementById('deep-compare-btn');
const $saveSourceBtn = document.getElementById('save-source-btn');
const $srcCondToggle = document.getElementById('source-condition-toggle');

// ---- Analytics helper ----
function track(category, action, label = '', value = 0) {
  chrome.runtime.sendMessage({ type: 'TRACK_EVENT', payload: { category, action, label, value } });
}

// ---- State ----
let isActive = true;
let currentProduct = null;
let allResults = []; // all scored results received so far
let searchComplete = false;
let platformsSearched = 0;
let totalPlatforms = 0;
let currentProductAttrs = null; // { brand, color, model, material }
let filtersAutoSet = false;
let favorites = []; // array of saved items with condition reports

// ---- Init ----

// Load saved active state.
chrome.storage.local.get('maisondeux_active', (data) => {
  isActive = data.maisondeux_active !== false; // default true
  $toggle.checked = isActive;
  updateView();
});

// Show API connection status.
function updateApiStatus() {
  chrome.storage.sync.get(null, (settings) => {
    const $status = document.getElementById('api-status');
    const apis = [
      { key: 'anthropic_key', label: 'AI' },
      { key: 'ebay_app_id', label: 'eBay' },
    ];
    $status.innerHTML = apis.map(({ key, label }) => {
      const connected = !!(settings[key]);
      return `<span class="sp-api-dot ${connected ? 'connected' : 'disconnected'}" title="${label}: ${connected ? 'connected' : 'not set'}">${label}</span>`;
    }).join('');
  });
}
updateApiStatus();

// On panel open: ask background to re-inject content script, then get product data.
chrome.runtime.sendMessage({ type: 'REINJECT_CONTENT_SCRIPT' });

// Ask for current product after a short delay (content script needs time to run).
setTimeout(() => {
  chrome.runtime.sendMessage({ type: 'GET_CURRENT_PRODUCT' }, (response) => {
    console.log('[MaisonDeux][panel] GET_CURRENT_PRODUCT response:', response);
    if (response?.product) {
      showProduct(response.product);
      if (response.results && response.results.length) {
        allResults = response.results;
        searchComplete = response.searchComplete || false;
        console.log(`[MaisonDeux][panel] Loaded ${allResults.length} cached results`);
        renderResults();
      }
    }
  });
}, 600);

// ---- Toggle on/off ----

$toggle.addEventListener('change', () => {
  isActive = $toggle.checked;
  chrome.storage.local.set({ maisondeux_active: isActive });
  chrome.runtime.sendMessage({ type: 'SET_ACTIVE', payload: { active: isActive } });
  track('extension', isActive ? 'enabled' : 'disabled');
  updateView();
});

// ---- Settings ----
$settingsBtn.addEventListener('click', () => {
  // Open settings on the web dashboard (maisondeux.vip).
  // Falls back to Railway URL if domain isn't set up yet.
  chrome.tabs.create({ url: 'https://maisondeux.vip/settings' });
});

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
  if (el) el.addEventListener('change', () => {
    updateFilterStyles();
    renderResults();
  });
});

$sortBy.addEventListener('change', () => renderResults());

$clearFilters.addEventListener('click', (e) => {
  e.preventDefault();
  if (filterEls.brand) filterEls.brand.value = '';
  if (filterEls.store) filterEls.store.value = '';
  filterEls.color.value = '';
  filterEls.model.value = '';
  filterEls.material.value = '';
  filterEls.condition.value = '';
  filterEls.relevance.value = '0';
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
  // Don't reset if same product (avoids re-injection resetting filters).
  const newKey = (product.url || '') + (product.productName || product.title || '');
  const oldKey = currentProduct ? (currentProduct.url || '') + (currentProduct.productName || currentProduct.title || '') : '';
  if (newKey === oldKey && currentProduct && filtersAutoSet) {
    return; // Same product, filters already set — skip.
  }
  currentProduct = product;
  $stateIdle.classList.add('hidden');
  $productCtx.classList.remove('hidden');
  const platform = product.platform || product.source || '';
  const favicon = getPlatformFavicon(platform);
  if (favicon) {
    $productPlatformIcon.src = favicon;
    $productPlatformIcon.alt = platform;
    $productPlatformIcon.style.display = '';
  } else {
    $productPlatformIcon.style.display = 'none';
  }
  $productNameText.textContent = product.productName || product.title || '';

  // Format price.
  const priceVal = parseFloat(String(product.price || '').replace(/[^0-9.]/g, '')) || 0;
  const currency = product.currency || 'USD';

  // Build details row: brand · model · color · price
  const $details = document.getElementById('product-details');
  $details.innerHTML = '';

  // ---- ATTRIBUTE EXTRACTION ----
  // AI-classified products have clean fields. Otherwise minimal fallback.
  $productAttrs.innerHTML = '';
  const isAI = product._aiClassified === true;
  console.log('[MaisonDeux][panel] Product source:', isAI ? 'AI-classified' : 'heuristic');
  // ---- Extract attributes: trust product fields directly ----
  // AI-classified products already have clean brand/model/color/etc.
  // Content script + eBay Item Specifics also set these fields.
  // No more keyword scanning for the source product.

  const brand = normalizeBrand(product.brand) || null;
  const model = product.model || null;
  const color = product.color || null;
  const material = product.material || null;
  const hardware = product.hardware || null;
  const size = product.size || null;
  const category = product.category || product.categoryText || null;

  // Condition: clean up any label prefix.
  let rawCond = product.condition || product.conditionText || null;
  if (rawCond) rawCond = rawCond.replace(/^condition\s*:\s*/i, '').trim();
  const condition = rawCond ? (CONDITION_MAP[normalizeText(rawCond)] || rawCond) : null;

  console.log('[MaisonDeux][panel] Attrs:', { brand, model, color, material, hardware, condition, category });

  // Build pills — only what we know.
  const allPills = [];
  if (brand)    allPills.push({ label: brand, type: 'brand' });
  if (model)    allPills.push({ label: model, type: 'model' });
  if (color)    allPills.push({ label: color, type: 'color' });
  if (material) allPills.push({ label: material, type: 'material' });
  if (size)     allPills.push({ label: size, type: 'size' });
  if (hardware) allPills.push({ label: hardware + ' HW', type: 'hardware' });
  if (condition) allPills.push({ label: condition, type: 'condition' });
  if (category) allPills.push({ label: category, type: 'category' });

  // Details line: brand · price · store.
  const currSym = (product.currency === 'EUR') ? '€' : (product.currency === 'GBP') ? '£' : (product.currency === 'CHF') ? 'CHF ' : '$';
  const detailParts = [];
  if (brand) detailParts.push(brand);
  if (priceVal > 0) detailParts.push(`<strong>${currSym}${priceVal.toLocaleString()}</strong>`);
  const storeName = STORE_NAMES[product.platform] || product.platform || '';
  if (storeName) detailParts.push(storeName);
  $details.innerHTML = detailParts.join(' · ');

  for (const pill of allPills) {
    const chip = document.createElement('span');
    chip.className = `sp-chip sp-chip-${pill.type}`;
    chip.textContent = pill.label;
    $productAttrs.appendChild(chip);
  }

  // Source product condition report — reset on every new product.
  const $srcBtn = document.getElementById('source-condition-btn');
  const $srcReport = document.getElementById('source-condition-report');
  const $srcDot = document.getElementById('source-condition-dot');
  $srcReport.innerHTML = '';
  $srcReport.classList.add('hidden');
  $srcReport.dataset.loaded = '';
  $srcReport.dataset.report = '';
  $srcDot.className = 'sp-condition-dot sp-dot-pending';
  $srcDot.innerHTML = '&#128270;';
  $srcBtn.disabled = false;
  $srcBtn.classList.add('hidden');
  $srcCondToggle.classList.add('hidden');
  $srcCondToggle.classList.remove('open');

  // Save source button.
  $saveSourceBtn.innerHTML = isFavorite(product) ? '&#9829;' : '&#9825;';
  $saveSourceBtn.className = `sp-save-btn${isFavorite(product) ? ' saved' : ''}`;
  $saveSourceBtn.onclick = () => toggleFavorite(product);

  if (product.imageUrl || (product.imageUrls && product.imageUrls.length > 0)) {
    $srcBtn.classList.remove('hidden');
    $srcBtn.onclick = () => {
      // If already generated, just toggle visibility.
      if ($srcReport.dataset.loaded === 'true') {
        $srcReport.classList.toggle('hidden');
        $srcCondToggle.classList.toggle('open');
        return;
      }
      $srcBtn.disabled = true;
      $srcDot.innerHTML = '&#9203;'; // hourglass
      chrome.runtime.sendMessage({
        type: 'CONDITION_REPORT',
        payload: {
          imageUrl: product.imageUrl,
          imageUrls: product.imageUrls || [],
          title: product.productName || product.title,
          platform: product.platform,
        },
      }, (response) => {
        $srcBtn.disabled = false;
        if (response?.report) {
          $srcReport.innerHTML = renderConditionReport(response.report);
          // Color-code the dot based on condition match.
          const reportGrade = (response.report.overallGrade || '');
          const vendorCondition = (condition || '');
          console.log('[MaisonDeux][panel] Condition dot:', { reportGrade, vendorCondition });
          const dotClass = getConditionDotClass(reportGrade, vendorCondition);
          $srcDot.className = `sp-condition-dot ${dotClass}`;
          $srcDot.innerHTML = '&#9679;'; // filled circle
          // Store report on product for favorites.
          product._conditionReport = response.report;
        } else {
          $srcReport.innerHTML = `<div class="sp-report-error">${response?.error || 'No response'}</div>`;
          $srcDot.className = 'sp-condition-dot sp-dot-mismatch';
          $srcDot.innerHTML = '&#9679;';
        }
        $srcReport.dataset.loaded = 'true';
        $srcReport.classList.remove('hidden');
        $srcCondToggle.classList.remove('hidden');
        $srcCondToggle.classList.add('open');
      });
    };
  }

  // Condition toggle button — show/hide report without regenerating.
  $srcCondToggle.onclick = () => {
    if ($srcReport.dataset.loaded !== 'true') return;
    $srcReport.classList.toggle('hidden');
    $srcCondToggle.classList.toggle('open');
  };

  // Store detected attributes for auto-setting filters after results arrive.
  currentProductAttrs = {
    brand: (brand || '').toLowerCase(),
    store: (storeName || '').toLowerCase(),
    color: (color || '').toLowerCase(),
    model: (model || '').toLowerCase(),
    material: (material || '').toLowerCase(),
    condition: (condition || '').toLowerCase(),
  };
  filtersAutoSet = false;
  console.log('[MaisonDeux][panel] Auto-set attrs:', currentProductAttrs);
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

  $resultsSection.classList.remove('hidden');

  // Step 0: Exclude the current listing from results.
  const currentUrl = currentProduct?.url || '';
  const currentTitle = (currentProduct?.productName || currentProduct?.title || '').toLowerCase();
  let filtered = allResults.filter((r) => {
    const rUrl = r.link || r.url || '';
    const rTitle = (r.title || '').toLowerCase();
    // Exclude exact URL match or very similar title on same platform.
    if (currentUrl && rUrl === currentUrl) return false;
    if (rTitle && currentTitle && rTitle === currentTitle && r.platform === currentProduct?.platform) return false;
    return true;
  });

  // Step 1: Apply relevance filter.
  const minScore = parseFloat(filterEls.relevance.value) || 0;
  filtered = filtered.filter((r) => (r.relevanceScore ?? r.score ?? 1.0) >= minScore);

  // Step 2: Apply each active filter.
  const filterKeys = ['brand', 'store', 'color', 'model', 'material', 'condition'];
  for (const key of filterKeys) {
    const el = filterEls[key];
    if (!el || !el.value) continue;
    const filterVal = el.value.toLowerCase();
    filtered = filtered.filter((r) => matchesFilter(r, key, filterVal));
  }

  // Step 3: Populate filter dropdowns based on FILTERED results (cascading).
  // For each filter, show only values present in results filtered by OTHER active filters.
  for (const key of filterKeys) {
    const el = filterEls[key];
    if (!el) continue;

    // Get results filtered by all OTHER filters (not this one).
    let pool = allResults.filter((r) => (r.relevanceScore ?? r.score ?? 1.0) >= minScore);
    for (const otherKey of filterKeys) {
      if (otherKey === key) continue;
      const otherEl = filterEls[otherKey];
      if (!otherEl || !otherEl.value) continue;
      pool = pool.filter((r) => matchesFilter(r, otherKey, otherEl.value.toLowerCase()));
    }

    // Extract available values from this pool.
    const available = new Set();
    const keywordList = key === 'brand' ? FILTER_BRANDS
      : key === 'store' ? null
      : key === 'color' ? FILTER_COLORS
      : key === 'model' ? FILTER_MODELS
      : key === 'material' ? FILTER_MATERIALS
      : FILTER_CONDITIONS;

    for (const r of pool) {
      if (key === 'store') {
        // Store comes from the platform field, capitalized nicely.
        const store = STORE_NAMES[r.platform] || r.platform || '';
        if (store) available.add(store);
      } else {
        if (key === 'brand') {
          const b = normalizeBrand(r[key]) || normalizeBrand(r.brand);
          if (b) available.add(b);
          if (keywordList) scanTitle(r.title || '', keywordList).forEach((v) => available.add(normalizeBrand(v) || v));
        } else {
          if (r[key]) available.add(r[key]);
          // Scan both title AND description for attributes.
          const scanText = [r.title || '', r.condition || '', r.description || ''].join(' ');
          if (keywordList) scanTitle(scanText, keywordList).forEach((v) => available.add(v));
          if (key === 'condition' && r.condition) {
            const mapped = CONDITION_MAP[normalizeText(r.condition)];
            if (mapped) available.add(mapped);
            else available.add(r.condition);
          }
        }
      }
    }

    // Update dropdown options.
    const currentVal = el.value;
    const firstOpt = el.querySelector('option[value=""]');
    el.innerHTML = '';
    if (firstOpt) el.appendChild(firstOpt);

    const sorted = [...available].sort();
    for (const v of sorted) {
      const opt = document.createElement('option');
      opt.value = v.toLowerCase();
      opt.textContent = v;
      if (v.toLowerCase() === currentVal) opt.selected = true;
      el.appendChild(opt);
    }

    // Hide filter if no values available.
    el.style.display = sorted.length > 0 ? '' : 'none';
  }

  // Show/hide filter section.
  const anyFilterVisible = filterKeys.some((k) => {
    const el = filterEls[k];
    return el && el.style.display !== 'none' && el.options.length > 1;
  });
  $filterSection.classList.toggle('hidden', !anyFilterVisible);

  // Auto-set filters after dropdowns are populated.
  if (!filtersAutoSet && currentProductAttrs && allResults.length > 0) {
    // Check if dropdowns actually have options now.
    const brandOpts = filterEls.brand ? [...filterEls.brand.options].filter(o => o.value) : [];

    if (brandOpts.length > 0) {
      filtersAutoSet = true;

      function autoSet(el, targetVal) {
        if (!el || !targetVal) return false;
        const target = normalizeText(targetVal);
        for (const opt of el.options) {
          if (!opt.value) continue;
          const optNorm = normalizeText(opt.value);
          const optTextNorm = normalizeText(opt.textContent);
          // Match: exact, contains, or contained-by.
          if (optNorm === target || optTextNorm === target || optNorm.includes(target) || target.includes(optNorm)) {
            el.value = opt.value;
            return true;
          }
        }
        return false;
      }

      console.log('[MaisonDeux][panel] Dropdown options available:', brandOpts.map(o => o.value).join(', '));
      console.log('[MaisonDeux][panel] Auto-setting from:', JSON.stringify(currentProductAttrs));

      autoSet(filterEls.brand, currentProductAttrs.brand);
      autoSet(filterEls.color, currentProductAttrs.color);
      autoSet(filterEls.model, currentProductAttrs.model);
      autoSet(filterEls.material, currentProductAttrs.material);

      console.log('[MaisonDeux][panel] After auto-set — brand:', filterEls.brand?.value, 'model:', filterEls.model?.value);

      // Re-filter with auto-set values.
      updateFilterStyles();
      return renderResults();
    }
  }

  updateFilterStyles();

  // Sort based on selected sort option.
  const sortMode = $sortBy?.value || 'relevance';
  filtered.sort((a, b) => {
    switch (sortMode) {
      case 'price-asc':
        return parsePrice(a.price) - parsePrice(b.price);
      case 'price-desc':
        return parsePrice(b.price) - parsePrice(a.price);
      case 'savings': {
        const srcP = parsePrice(currentProduct?.price);
        const savA = srcP - parsePrice(a.price);
        const savB = srcP - parsePrice(b.price);
        return savB - savA; // Biggest savings first.
      }
      case 'relevance':
      default: {
        const sA = a.relevanceScore || a.score || 0;
        const sB = b.relevanceScore || b.score || 0;
        if (sB !== sA) return sB - sA;
        return parsePrice(a.price) - parsePrice(b.price);
      }
    }
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
  const wrapper = document.createElement('div');
  wrapper.className = 'sp-listing-wrapper';

  const score = listing.relevanceScore || listing.score || 0;
  const scoreLabel = score >= 0.85 ? 'Exact' : score >= 0.7 ? 'Very Similar' : score >= 0.5 ? 'Similar' : score >= 0.3 ? 'Related' : 'Weak';
  const scoreClass = score >= 0.85 ? 'high' : score >= 0.7 ? 'medium' : score >= 0.5 ? 'low' : 'weak';

  // Price delta.
  let savingsHtml = '';
  const srcPrice = parsePrice(currentProduct?.price);
  const candPrice = parsePrice(listing.priceValue || listing.price);
  if (srcPrice > 0 && candPrice > 0 && Math.abs(srcPrice - candPrice) > 1) {
    const delta = srcPrice - candPrice;
    const pct = Math.round((Math.abs(delta) / srcPrice) * 100);
    if (delta > 0) {
      savingsHtml = `<span class="sp-savings cheaper">▼ $${Math.round(delta).toLocaleString()} less (${pct}% off)</span>`;
    } else {
      savingsHtml = `<span class="sp-savings pricier">▲ $${Math.round(Math.abs(delta)).toLocaleString()} more (+${pct}%)</span>`;
    }
  }

  const priceText = listing.price || '';
  const imgSrc = listing.img || listing.imageUrl || '';
  const platform = listing.platform || listing.source || '';
  const faviconUrl = getPlatformFavicon(platform);

  const saved = isFavorite(listing);

  wrapper.innerHTML = `
    <a class="sp-listing" href="${esc(listing.link || listing.url || '#')}" target="_blank" rel="noopener">
      ${imgSrc ? `<img class="sp-listing-img" src="${esc(imgSrc)}" alt="" />` : '<div class="sp-listing-img"></div>'}
      <div class="sp-listing-info">
        <div class="sp-listing-title">
          ${faviconUrl ? `<img class="sp-platform-icon" src="${esc(faviconUrl)}" alt="${esc(platform)}" />` : ''}
          ${esc(listing.title || '')}
        </div>
        <div class="sp-listing-price-row">
          <span class="sp-listing-price">${esc(priceText)}</span>
          ${savingsHtml}
        </div>
        <div class="sp-listing-meta">
          <span class="sp-relevance ${scoreClass}">${scoreLabel} ${Math.round(score * 100)}%</span>
        </div>
      </div>
      <button class="sp-listing-save${saved ? ' saved' : ''}" title="Save to favorites">${saved ? '&#9829;' : '&#9825;'}</button>
    </a>
  `;

  const saveBtn = wrapper.querySelector('.sp-listing-save');
  saveBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(listing);
    saveBtn.innerHTML = isFavorite(listing) ? '&#9829;' : '&#9825;';
    saveBtn.classList.toggle('saved', isFavorite(listing));
    if (currentProduct) {
      $saveSourceBtn.innerHTML = isFavorite(currentProduct) ? '&#9829;' : '&#9825;';
      $saveSourceBtn.classList.toggle('saved', isFavorite(currentProduct));
    }
    track('listing', 'save_clicked', listing.platform || '');
  });

  return wrapper;
}

// Inline keyword lists for title scanning.
// Colors as { keyword: canonical English name } — all foreign terms map to English.
const COLOR_MAP = {
  'black': 'Black', 'noir': 'Black', 'nero': 'Black', 'schwarz': 'Black',
  'white': 'White', 'blanc': 'White', 'bianco': 'White',
  'beige': 'Beige', 'cream': 'Cream', 'ivory': 'Ivory', 'ecru': 'Beige',
  'brown': 'Brown', 'marron': 'Brown', 'chocolate': 'Brown', 'cognac': 'Cognac', 'camel': 'Camel', 'tan': 'Tan', 'taupe': 'Taupe',
  'red': 'Red', 'rouge': 'Red', 'rosso': 'Red', 'burgundy': 'Burgundy', 'bordeaux': 'Burgundy', 'wine': 'Burgundy', 'oxblood': 'Burgundy',
  'pink': 'Pink', 'rose': 'Pink', 'blush': 'Pink', 'coral': 'Coral', 'fuchsia': 'Pink', 'salmon': 'Pink',
  'blue': 'Blue', 'bleu': 'Blue', 'navy': 'Navy', 'cobalt': 'Blue', 'teal': 'Teal',
  'green': 'Green', 'vert': 'Green', 'olive': 'Olive', 'khaki': 'Khaki', 'emerald': 'Green', 'sage': 'Green',
  'grey': 'Grey', 'gray': 'Grey', 'gris': 'Grey', 'charcoal': 'Grey', 'slate': 'Grey',
  'gold': 'Gold', 'champagne': 'Gold', 'dore': 'Gold',
  'silver': 'Silver', 'argent': 'Silver',
  'orange': 'Orange', 'rust': 'Orange', 'terracotta': 'Orange',
  'yellow': 'Yellow', 'mustard': 'Yellow',
  'purple': 'Purple', 'violet': 'Purple', 'plum': 'Purple', 'lavender': 'Lavender', 'mauve': 'Purple',
  'nude': 'Nude', 'sand': 'Beige', 'natural': 'Beige',
  'multicolor': 'Multicolor', 'multi': 'Multicolor',
};
const FILTER_COLORS = Object.keys(COLOR_MAP);
const MATERIAL_MAP = {
  'leather': 'Leather', 'canvas': 'Canvas', 'suede': 'Suede', 'silk': 'Silk',
  'denim': 'Denim', 'tweed': 'Tweed', 'nylon': 'Nylon', 'velvet': 'Velvet',
  'satin': 'Satin', 'wool': 'Wool', 'cashmere': 'Cashmere', 'cotton': 'Cotton',
  'patent': 'Patent Leather', 'patent leather': 'Patent Leather',
  'lambskin': 'Lambskin', 'caviar': 'Caviar Leather', 'calfskin': 'Calfskin',
  'clemence': 'Clemence', 'togo': 'Togo', 'epsom': 'Epsom', 'swift': 'Swift',
  'barenia': 'Barenia', 'evercolor': 'Evercolor', 'box calf': 'Box Calf',
  'chamonix': 'Chamonix', 'veau': 'Calfskin', 'chevre': 'Chèvre', 'goatskin': 'Goatskin',
  'nappa': 'Nappa', 'exotic': 'Exotic', 'python': 'Python', 'crocodile': 'Crocodile',
  'alligator': 'Alligator', 'ostrich': 'Ostrich',
  'gg supreme': 'GG Supreme', 'monogram': 'Monogram Canvas', 'damier': 'Damier',
  'epi': 'Epi Leather', 'vernis': 'Vernis', 'empreinte': 'Empreinte',
  'coated canvas': 'Coated Canvas', 'raffia': 'Raffia', 'straw': 'Straw',
  'rubber': 'Rubber', 'pvc': 'PVC',
};
const FILTER_MATERIALS = Object.keys(MATERIAL_MAP);
const FILTER_BRANDS = [
  'chanel','louis vuitton','gucci','hermes','hermès','dior','prada','fendi','bottega veneta',
  'balenciaga','saint laurent','ysl','celine','céline','loewe','valentino','burberry',
  'versace','givenchy','miu miu','coach','michael kors','kate spade','tory burch',
  'cartier','tiffany','rolex','omega','ferragamo','goyard','bulgari','tod\'s',
  'jimmy choo','alexander mcqueen','stella mccartney','marc jacobs','off-white',
  'rick owens','chrome hearts',
];

const FILTER_MODELS = [
  'classic flap','boy','wallet on chain','woc','2.55','reissue','gabrielle','19','coco handle','deauville',
  'speedy','neverfull','alma','pochette','keepall','dauphine','capucines','twist','petite malle',
  'birkin','kelly','constance','evelyne','picotin','lindy','bolide','garden party',
  'lady dior','saddle','book tote','30 montaigne','bobby',
  'peekaboo','baguette','kan i','first','roma',
  'dionysus','marmont','jackie','bamboo','ophidia','horsebit',
  'puzzle','hammock','basket','flamenco','gate',
  'rockstud','roman stud',
  'city','le cagole','hourglass','neo classic',
  'luggage','belt bag','triomphe','teen','ava',
  'cassette','pouch','jodie','arco','padded',
  're-edition','galleria','double bag','cleo','matinee',
  'tb bag','lola','olympia','note',
  // Gucci
  'jacquard','jaquard','soho','gg marmont','ophidia','dionysus','jackie','bamboo','horsebit','blondie','attache',
  // More
  'antigona','pandora','nightingale','shark','papier','motorcity','knife',
  'phantom','seau sangle','cabas','ava','triomphe','teen triomphe',
  'flamenco','puzzle','hammock','gate','basket',
  'mini kelly','kelly pochette','birkin 25','birkin 30','birkin 35','picotin','picotin lock',
  'chanel 19','classic double flap','jumbo','maxi','east west',
];
const FILTER_HARDWARE = ['gold hardware','gold-plated hardware','gold-plated','ghw','silver hardware','shw','palladium hardware','phw','ruthenium hardware','rhw','rose gold hardware','rghw'];
const CONDITION_MAP = {
  'new': 'New', 'nwt': 'New', 'new with tags': 'New', 'brand new': 'New',
  'bnwt': 'New', 'bnib': 'New', 'never worn': 'New', 'deadstock': 'New',
  'unworn': 'New', 'unused': 'New',
  'like new': 'Excellent', 'mint': 'Excellent', 'pristine': 'Excellent',
  'excellent': 'Excellent', 'nwot': 'Excellent', 'new without tags': 'Excellent',
  'immaculate': 'Excellent', 'flawless': 'Excellent',
  'very good': 'Very Good', 'very good condition': 'Very Good', 'great': 'Very Good',
  'good': 'Good', 'gently used': 'Good', 'pre-owned': 'Good', 'pre owned': 'Good',
  'good condition': 'Good', 'preowned': 'Good',
  'fair': 'Fair', 'well worn': 'Fair', 'used': 'Fair', 'heavily used': 'Fair',
  'damaged': 'Fair', 'as is': 'Fair', 'shows wear': 'Fair',
};
const FILTER_CONDITIONS = Object.keys(CONDITION_MAP);

// Display names for keywords that need special capitalization.
const DISPLAY_NAMES = {
  'gg supreme': 'GG Supreme', 'gg marmont': 'GG Marmont', 'ysl': 'YSL',
  'louis vuitton': 'Louis Vuitton', 'michael kors': 'Michael Kors',
  'kate spade': 'Kate Spade', 'tory burch': 'Tory Burch', 'miu miu': 'Miu Miu',
  'jimmy choo': 'Jimmy Choo', 'marc jacobs': 'Marc Jacobs',
  'alexander mcqueen': 'Alexander McQueen', 'stella mccartney': 'Stella McCartney',
  'rick owens': 'Rick Owens', 'chrome hearts': 'Chrome Hearts',
  'off-white': 'Off-White', 'bottega veneta': 'Bottega Veneta',
  'saint laurent': 'Saint Laurent', 'christian dior': 'Christian Dior',
  'van cleef': 'Van Cleef & Arpels', 'dolce & gabbana': 'Dolce & Gabbana',
  'coated canvas': 'Coated Canvas', 'wallet on chain': 'Wallet On Chain', 'jaquard': 'Jacquard', 'gucci gg': 'Gucci GG',
  'hermès': 'Hermès', 'hermes': 'Hermès', 'céline': 'Celine', 'celine': 'Celine',
  'chloé': 'Chloé', 'chloe': 'Chloé', 'alaïa': 'Alaïa', 'alaia': 'Alaïa',
  'totême': 'Totême', 'toteme': 'Totême', 'comme des garçons': 'Comme des Garçons',
  'louis vuitton': 'Louis Vuitton', 'gucci': 'Gucci', 'chanel': 'Chanel',
  'dior': 'Dior', 'prada': 'Prada', 'fendi': 'Fendi', 'versace': 'Versace',
  'balenciaga': 'Balenciaga', 'valentino': 'Valentino', 'burberry': 'Burberry',
  'givenchy': 'Givenchy', 'loewe': 'Loewe', 'cartier': 'Cartier', 'rolex': 'Rolex',
  'bottega veneta': 'Bottega Veneta', 'saint laurent': 'Saint Laurent',
  'ferragamo': 'Ferragamo', 'coach': 'Coach', 'goyard': 'Goyard',
  // French colors → English
  'noir': 'Black', 'blanc': 'White', 'bleu': 'Blue', 'rouge': 'Red',
  'vert': 'Green', 'rose': 'Pink', 'marron': 'Brown',
  // Hermès leathers
  'clemence': 'Clemence', 'togo': 'Togo', 'epsom': 'Epsom', 'swift': 'Swift',
  'barenia': 'Barenia', 'evercolor': 'Evercolor', 'box calf': 'Box Calf',
  'chevre': 'Chèvre', 'chamonix': 'Chamonix', 'veau': 'Veau',
  // Models
  'picotin lock': 'Picotin Lock', 'picotin': 'Picotin',
  'classic flap': 'Classic Flap', 'classic double flap': 'Classic Double Flap',
};

// ========================================================================
// UNIVERSAL TEXT NORMALIZER & TERM RESOLUTION PIPELINE
// ========================================================================
//
// Pipeline:
// 1. Take raw text (any format — "CollectionNoir", "Gold-Plated", etc.)
// 2. Split into tokens using heuristics (spaces, underscores, commas,
//    camelCase, dashes, slashes, dots, parentheses)
// 3. Try matching single tokens + multi-token combos against all dicts
// 4. Unmatched tokens → stored for AI resolution
// 5. AI resolution → either maps to existing canonical term OR adds new
// 6. Learned mappings persist in chrome.storage.local
//
// ========================================================================

/** Master dictionary — ALL known terms across all categories. Built once. */
const MASTER_DICT = {};
function buildMasterDict() {
  for (const [k, v] of Object.entries(COLOR_MAP))     MASTER_DICT[normalizeText(k)] = { type: 'color', canonical: v };
  for (const [k, v] of Object.entries(MATERIAL_MAP))   MASTER_DICT[normalizeText(k)] = { type: 'material', canonical: v };
  for (const [k, v] of Object.entries(CONDITION_MAP))   MASTER_DICT[normalizeText(k)] = { type: 'condition', canonical: v };
  for (const b of FILTER_BRANDS)                        MASTER_DICT[normalizeText(b)] = { type: 'brand', canonical: DISPLAY_NAMES[b] || CANONICAL_BRANDS[b] || titleCase(b) };
  for (const m of FILTER_MODELS)                        MASTER_DICT[normalizeText(m)] = { type: 'model', canonical: DISPLAY_NAMES[m] || titleCase(m) };
  for (const h of FILTER_HARDWARE)                      MASTER_DICT[normalizeText(h)] = { type: 'hardware', canonical: titleCase(h) };
}

/** Loaded learned terms from chrome.storage.local. */
let learnedTerms = {}; // { normalizedTerm: { type, canonical, source } }

function loadLearnedTerms() {
  chrome.storage.local.get('learnedTerms', (data) => {
    learnedTerms = data.learnedTerms || {};
    console.log('[MaisonDeux][panel] Loaded', Object.keys(learnedTerms).length, 'learned terms');
  });
}

function saveLearnedTerms() {
  chrome.storage.local.set({ learnedTerms });
}

/** Record an unknown term for later AI resolution. */
let unknownTerms = {}; // { normalizedTerm: { raw, count, context } }

function recordUnknown(raw, context) {
  const norm = normalizeText(raw);
  if (norm.length < 2 || STOP_WORDS.has(norm)) return;
  if (MASTER_DICT[norm] || learnedTerms[norm]) return;
  if (!unknownTerms[norm]) {
    unknownTerms[norm] = { raw, count: 0, context: '' };
  }
  unknownTerms[norm].count++;
  if (context) unknownTerms[norm].context = context.slice(0, 100);
}

/** Common stop words to skip during tokenization. */
const STOP_WORDS = new Set([
  'the','a','an','and','or','of','in','on','at','to','for','with','by','from',
  'is','it','this','that','was','are','be','been','has','have','had','will',
  'can','may','do','does','did','not','no','but','all','any','some','each',
  'us','our','we','you','your','its','his','her','they','them','their',
  'free','shipping','sale','now','off','new','used','pre','owned',
  'authentic','original','genuine','real','100','lot','set','pair','size',
  'item','listing','buy','sell','price','offer','bid','auction',
  'condition','see','photo','photos','picture','pictures','image','images',
  'description','details','please','note','read',
  'very','great','super','ultra','extra','mini','small','medium','large',
  'bag','handbag','purse','tote','clutch','wallet','shoes','watch','ring',
  'necklace','bracelet','earring','sunglasses','scarf','belt','hat','coat',
  'top','bottom','dress','shirt','jacket','pants','skirt',
]);

/**
 * Normalize text for robust matching.
 * "CollectionNoir Clemence LeatherGold-Plated" →
 * "collection noir clemence leather gold plated"
 */
function normalizeText(text) {
  if (!text) return '';
  return text
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-zA-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(s) {
  return s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Tokenize raw text into candidate terms.
 * Splits on: spaces, commas, semicolons, pipes, slashes, dashes,
 * underscores, dots, parens, brackets. Also splits camelCase.
 * Returns both individual tokens AND sliding multi-token windows (2-4 words)
 * to catch multi-word terms like "wallet on chain" or "very good condition".
 */
function tokenize(rawText) {
  const normalized = normalizeText(rawText);
  const words = normalized.split(' ').filter(w => w.length > 1);

  const tokens = new Set();

  // Individual words.
  for (const w of words) tokens.add(w);

  // Multi-word windows (2, 3, 4 word combos).
  for (let windowSize = 2; windowSize <= 4 && windowSize <= words.length; windowSize++) {
    for (let i = 0; i <= words.length - windowSize; i++) {
      tokens.add(words.slice(i, i + windowSize).join(' '));
    }
  }

  return tokens;
}

/**
 * Full-scan a text blob and return all matched attributes.
 * Returns { brand, model, color, material, condition, hardware, unknown[] }
 */
function extractAttributes(rawText) {
  const normalized = normalizeText(rawText);
  const result = {
    brands: new Set(),
    models: new Set(),
    colors: new Set(),
    materials: new Set(),
    conditions: new Set(),
    hardware: new Set(),
    unknown: [],
  };

  // Phase 1: Match against master dict + learned terms (longest first).
  const allKnown = { ...MASTER_DICT, ...learnedTerms };
  const sortedKeys = Object.keys(allKnown).sort((a, b) => b.length - a.length);
  const consumed = new Set(); // Track matched regions to avoid double-counting.

  for (const key of sortedKeys) {
    if (normalized.includes(key)) {
      // Check we haven't already consumed this region via a longer match.
      let alreadyConsumed = false;
      for (const c of consumed) {
        if (c.includes(key)) { alreadyConsumed = true; break; }
      }
      if (alreadyConsumed) continue;

      consumed.add(key);
      const entry = allKnown[key];
      switch (entry.type) {
        case 'brand':     result.brands.add(entry.canonical); break;
        case 'model':     result.models.add(entry.canonical); break;
        case 'color':     result.colors.add(entry.canonical); break;
        case 'material':  result.materials.add(entry.canonical); break;
        case 'condition': result.conditions.add(entry.canonical); break;
        case 'hardware':  result.hardware.add(entry.canonical); break;
      }
    }
  }

  // Phase 2: Collect unmatched tokens (for later AI resolution).
  const tokens = tokenize(rawText);
  for (const token of tokens) {
    if (token.length < 3) continue;
    if (STOP_WORDS.has(token)) continue;
    if (consumed.has(token)) continue;

    // Check if this token is a substring of any consumed key.
    let partOfMatch = false;
    for (const c of consumed) {
      if (c.includes(token) || token.includes(c)) { partOfMatch = true; break; }
    }
    if (partOfMatch) continue;

    // Only record single-word unknowns (multi-word combos are noisy).
    if (!token.includes(' ') && !MASTER_DICT[token] && !learnedTerms[token]) {
      recordUnknown(token, rawText.slice(0, 200));
    }
  }

  return {
    brands: [...result.brands],
    models: [...result.models],
    colors: [...result.colors],
    materials: [...result.materials],
    conditions: [...result.conditions],
    hardware: [...result.hardware],
    unknown: Object.keys(unknownTerms).slice(0, 20),
  };
}

/**
 * Resolve unknown terms via AI. Called periodically or on demand.
 * Sends batch of unknown terms to Claude, gets back mappings.
 */
async function resolveUnknownTerms() {
  const unknowns = Object.entries(unknownTerms)
    .filter(([, v]) => v.count >= 1)
    .map(([norm, v]) => ({ normalized: norm, raw: v.raw, context: v.context }))
    .slice(0, 30);

  if (unknowns.length === 0) return;

  console.log('[MaisonDeux][panel] Resolving', unknowns.length, 'unknown terms');

  chrome.runtime.sendMessage({
    type: 'RESOLVE_TERMS',
    payload: { terms: unknowns },
  }, (response) => {
    if (!response?.resolved) return;

    for (const r of response.resolved) {
      const norm = normalizeText(r.term);
      if (r.type && r.canonical) {
        // Learned a new mapping!
        learnedTerms[norm] = { type: r.type, canonical: r.canonical, source: 'ai' };
        delete unknownTerms[norm];
        console.log('[MaisonDeux][panel] Learned:', r.term, '→', r.type, ':', r.canonical);
      } else if (r.skip) {
        // AI says this is noise — mark as stop word to avoid re-checking.
        delete unknownTerms[norm];
      }
    }

    saveLearnedTerms();
  });
}

/**
 * Scan text for keywords in a specific category.
 * Backward-compatible wrapper around extractAttributes.
 */
function scanTitle(title, keywords) {
  const normalized = normalizeText(title);
  const found = new Set();

  // Sort keywords longest-first so "very good" matches before "good".
  const sorted = [...keywords].sort((a, b) => b.length - a.length);

  for (const kw of sorted) {
    const kwNorm = normalizeText(kw);
    if (normalized.includes(kwNorm)) {
      const canonical = COLOR_MAP[kw] || MATERIAL_MAP[kw] || CONDITION_MAP[kw] || DISPLAY_NAMES[kw] || learnedTerms[kwNorm]?.canonical || titleCase(kw);
      if (!found.has(canonical)) found.add(canonical);
    }
  }

  // Also check learned terms for this category.
  const categoryType = keywords === FILTER_COLORS ? 'color'
    : keywords === FILTER_MATERIALS ? 'material'
    : keywords === FILTER_BRANDS ? 'brand'
    : keywords === FILTER_MODELS ? 'model'
    : keywords === FILTER_CONDITIONS ? 'condition'
    : keywords === FILTER_HARDWARE ? 'hardware'
    : null;

  if (categoryType) {
    for (const [norm, entry] of Object.entries(learnedTerms)) {
      if (entry.type === categoryType && normalized.includes(norm)) {
        found.add(entry.canonical);
      }
    }
  }

  return found;
}

// NOTE: buildMasterDict() and loadLearnedTerms() called at end of file
// after all dictionaries are defined.

// populateFilterOptions is now inline in renderResults for cascading behavior.


// Canonical brand mapping — all variations → single canonical name.
const CANONICAL_BRANDS = {
  'hermes': 'Hermès', 'hermès': 'Hermès', 'hermés': 'Hermès',
  'celine': 'Celine', 'céline': 'Celine',
  'chloe': 'Chloé', 'chloé': 'Chloé',
  'alaia': 'Alaïa', 'alaïa': 'Alaïa',
  'toteme': 'Totême', 'totême': 'Totême',
  'ysl': 'Saint Laurent', 'yves saint laurent': 'Saint Laurent', 'saint laurent': 'Saint Laurent',
  'christian dior': 'Dior', 'dior': 'Dior',
  'bottega': 'Bottega Veneta', 'bottega veneta': 'Bottega Veneta',
  'louis vuitton': 'Louis Vuitton', 'lv': 'Louis Vuitton', 'vuitton': 'Louis Vuitton',
  'miu miu': 'Miu Miu', 'jimmy choo': 'Jimmy Choo',
  'ferragamo': 'Ferragamo', 'salvatore ferragamo': 'Ferragamo',
  'alexander mcqueen': 'Alexander McQueen', 'mcqueen': 'Alexander McQueen',
  'off-white': 'Off-White', 'off white': 'Off-White',
  'rick owens': 'Rick Owens', 'chrome hearts': 'Chrome Hearts',
  'marc jacobs': 'Marc Jacobs', 'michael kors': 'Michael Kors',
  'kate spade': 'Kate Spade', 'tory burch': 'Tory Burch',
  'stella mccartney': 'Stella McCartney', 'dolce & gabbana': 'Dolce & Gabbana',
  'van cleef': 'Van Cleef & Arpels', 'comme des garcons': 'Comme des Garçons',
};

function normalizeBrand(brand) {
  if (!brand) return null;
  const norm = normalizeText(brand);
  // Try exact match first, then normalized match.
  return CANONICAL_BRANDS[brand.toLowerCase().trim()]
    || CANONICAL_BRANDS[norm]
    || brand.trim();
}

const STORE_NAMES = {
  ebay: 'eBay',
  therealreal: 'TheRealReal',
  poshmark: 'Poshmark',
  vestiaire: 'Vestiaire',
  grailed: 'Grailed',
  mercari: 'Mercari',
  shopgoodwill: 'ShopGoodwill',
  'google-shopping': 'Google Shopping',
};

function matchesFilter(r, key, filterVal) {
  if (key === 'store') {
    const store = (STORE_NAMES[r.platform] || r.platform || '').toLowerCase();
    return store.includes(filterVal);
  }
  const searchText = normalizeText([r[key], r.title, r.condition].filter(Boolean).join(' '));
  const filterNorm = normalizeText(filterVal);
  return searchText.includes(filterNorm);
}

function parsePrice(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  return parseFloat(String(val).replace(/[^0-9.]/g, '')) || 0;
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function renderConditionReport(report) {
  const gradeColor = (g) => {
    if (!g || g === 'N/A' || g === 'Not Visible') return '#999';
    if (g === 'Excellent' || g === 'New') return '#2e7d32';
    if (g === 'Very Good') return '#558b2f';
    if (g === 'Good') return '#f57f17';
    if (g === 'Fair') return '#e65100';
    return '#c62828';
  };

  const gradeEmoji = (g) => {
    if (!g || g === 'N/A' || g === 'Not Visible') return '—';
    if (g === 'Excellent' || g === 'New') return '●';
    if (g === 'Very Good') return '●';
    if (g === 'Good') return '●';
    if (g === 'Fair') return '●';
    return '●';
  };

  const sections = ['exterior', 'hardware', 'corners', 'edges', 'stitching', 'handles', 'interior', 'structure'];
  const sectionRows = sections.map((key) => {
    const s = report[key];
    if (!s) return '';
    return `<div class="sp-report-row">
      <div class="sp-report-row-header">
        <span class="sp-report-label">${key.charAt(0).toUpperCase() + key.slice(1)}</span>
        <span class="sp-report-grade" style="color:${gradeColor(s.grade)}">${gradeEmoji(s.grade)} ${s.grade || '—'}</span>
      </div>
      <div class="sp-report-notes">${esc(s.notes || '')}</div>
    </div>`;
  }).join('');

  // Authenticity section (new format).
  let authHtml = '';
  const auth = report.authenticitySignals;
  if (auth && typeof auth === 'object' && !Array.isArray(auth)) {
    const positive = (auth.positive || []).map((s) => `<li class="sp-auth-positive">${esc(s)}</li>`).join('');
    const concerns = (auth.concerns || []).map((s) => `<li class="sp-auth-concern">${esc(s)}</li>`).join('');
    const verdictColor = auth.verdict?.includes('Likely') ? '#2e7d32' : auth.verdict?.includes('Concerns') ? '#c62828' : '#666';
    authHtml = `
      <div class="sp-report-section sp-auth-section">
        <strong>Authenticity Assessment</strong>
        <div class="sp-auth-verdict" style="color:${verdictColor}">${esc(auth.verdict || 'Unable to Determine')}</div>
        ${positive ? `<div class="sp-auth-group"><span class="sp-auth-label">Positive signals:</span><ul>${positive}</ul></div>` : ''}
        ${concerns ? `<div class="sp-auth-group"><span class="sp-auth-label">Concerns:</span><ul>${concerns}</ul></div>` : ''}
      </div>`;
  } else if (Array.isArray(auth)) {
    // Legacy format.
    const items = auth.map((s) => `<li>${esc(s)}</li>`).join('');
    authHtml = items ? `<div class="sp-report-section"><strong>Authenticity:</strong><ul>${items}</ul></div>` : '';
  }

  // Missing images.
  const missing = (report.missingImages || []).map((m) => `<li>${esc(m)}</li>`).join('');

  return `
    <div class="sp-report">
      <div class="sp-report-header">
        <span class="sp-report-overall" style="color:${gradeColor(report.overallGrade)}">
          ${esc(report.overallGrade || 'Unknown')}
        </span>
        <span class="sp-report-confidence">${Math.round((report.confidenceScore || 0) * 100)}% confidence</span>
        ${report.imagesAnalyzed ? `<span class="sp-report-images">${report.imagesAnalyzed} images analyzed</span>` : ''}
      </div>
      <p class="sp-report-summary">${esc(report.summary || '')}</p>
      ${report.wearEstimate ? `<div class="sp-report-wear"><strong>Wear estimate:</strong> ${esc(report.wearEstimate)}</div>` : ''}
      <div class="sp-report-grid">${sectionRows}</div>
      ${authHtml}
      ${report.marketNotes ? `<div class="sp-report-section"><strong>Market Assessment:</strong><p>${esc(report.marketNotes)}</p></div>` : ''}
      ${missing ? `<div class="sp-report-section sp-report-missing"><strong>Missing views for better assessment:</strong><ul>${missing}</ul></div>` : ''}
    </div>
  `;
}

function getPlatformFavicon(platform) {
  const domains = {
    ebay: 'www.ebay.com',
    therealreal: 'www.therealreal.com',
    poshmark: 'poshmark.com',
    vestiaire: 'www.vestiairecollective.com',
    grailed: 'www.grailed.com',
    mercari: 'www.mercari.com',
    shopgoodwill: 'shopgoodwill.com',
    'google-shopping': 'www.google.com',
  };
  const domain = domains[platform];
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=16` : null;
}

// ---- Initialize term resolution system (must be after all dicts defined) ----
buildMasterDict();
loadLearnedTerms();

// ========================================================================
// CONDITION DOT LOGIC
// ========================================================================

function getConditionDotClass(aiGrade, vendorCondition) {
  if (!aiGrade) return 'sp-dot-pending';

  const GRADE_ORDER = { 'new': 5, 'excellent': 4, 'very good': 3, 'good': 2, 'fair': 1, 'poor': 0 };
  const aiLevel = GRADE_ORDER[aiGrade.toLowerCase()] ?? -1;

  if (!vendorCondition) return aiLevel >= 3 ? 'sp-dot-match' : 'sp-dot-partial';

  // Normalize vendor condition through CONDITION_MAP.
  const vendorNorm = (CONDITION_MAP[normalizeText(vendorCondition)] || vendorCondition).toLowerCase();
  const vendorLevel = GRADE_ORDER[vendorNorm] ?? -1;

  if (vendorLevel < 0 || aiLevel < 0) return 'sp-dot-partial';

  const diff = Math.abs(aiLevel - vendorLevel);
  if (diff === 0) return 'sp-dot-match'; // Green — exact match.
  if (diff === 1) return 'sp-dot-partial'; // Yellow — one tier off.
  return 'sp-dot-mismatch'; // Red — two+ tiers off.
}

// ========================================================================
// FAVORITES SYSTEM
// ========================================================================

// Load favorites from storage.
chrome.storage.local.get('maisondeux_favorites', (data) => {
  favorites = data.maisondeux_favorites || [];
  updateFavBadge();
});

function saveFavorites() {
  chrome.storage.local.set({ maisondeux_favorites: favorites });
  updateFavBadge();
}

function updateFavBadge() {
  $favoritesBtn.title = `My Favorites (${favorites.length})`;
}

function getFavKey(item) {
  return (item.link || item.url || '') + '|' + (item.title || item.productName || '');
}

function isFavorite(item) {
  const key = getFavKey(item);
  return favorites.some((f) => getFavKey(f) === key);
}

function toggleFavorite(item) {
  const key = getFavKey(item);
  const idx = favorites.findIndex((f) => getFavKey(f) === key);
  if (idx >= 0) {
    favorites.splice(idx, 1);
    track('favorite', 'removed', item.platform || '');
  } else {
    track('favorite', 'saved', item.platform || '');
    // Save a clean copy with essential fields.
    favorites.push({
      title: item.productName || item.title || '',
      brand: item.brand || '',
      price: item.price || item.priceValue || '',
      currency: item.currency || 'USD',
      platform: item.platform || item.source || '',
      link: item.link || item.url || '',
      img: item.img || item.imageUrl || '',
      color: item.color || '',
      material: item.material || '',
      model: item.model || '',
      condition: item.conditionText || item.condition || '',
      _conditionReport: item._conditionReport || null,
      savedAt: Date.now(),
    });
  }
  saveFavorites();
  // Update source button state.
  if (currentProduct) {
    $saveSourceBtn.innerHTML = isFavorite(currentProduct) ? '&#9829;' : '&#9825;';
    $saveSourceBtn.classList.toggle('saved', isFavorite(currentProduct));
  }
}

// ---- Favorites view ----

$favoritesBtn.addEventListener('click', () => {
  const isShowingFavs = !$favoritesView.classList.contains('hidden');
  if (isShowingFavs) {
    // Go back to main view.
    $favoritesView.classList.add('hidden');
    $mainView.classList.remove('hidden');
  } else {
    // Show favorites.
    $mainView.classList.add('hidden');
    $favoritesView.classList.remove('hidden');
    renderFavorites();
    track('navigation', 'favorites_opened');
  }
});

$favBackBtn.addEventListener('click', () => {
  $favoritesView.classList.add('hidden');
  $mainView.classList.remove('hidden');
});

document.getElementById('fav-sort')?.addEventListener('change', renderFavorites);
document.getElementById('fav-filter-brand')?.addEventListener('change', renderFavorites);
document.getElementById('fav-filter-store')?.addEventListener('change', renderFavorites);

function renderFavorites() {
  const sortMode = document.getElementById('fav-sort')?.value || 'order';
  const brandFilter = (document.getElementById('fav-filter-brand')?.value || '').toLowerCase();
  const storeFilter = (document.getElementById('fav-filter-store')?.value || '').toLowerCase();

  // Populate brand/store filter dropdowns.
  const brands = new Set();
  const stores = new Set();
  for (const f of favorites) {
    if (f.brand) brands.add(normalizeBrand(f.brand) || f.brand);
    if (f.platform) stores.add(STORE_NAMES[f.platform] || f.platform);
  }
  populateFavDropdown('fav-filter-brand', 'Any Brand', brands);
  populateFavDropdown('fav-filter-store', 'Any Store', stores);

  // Filter.
  let list = [...favorites];
  if (brandFilter) list = list.filter((f) => normalizeText(f.brand).includes(normalizeText(brandFilter)));
  if (storeFilter) list = list.filter((f) => (STORE_NAMES[f.platform] || f.platform || '').toLowerCase().includes(storeFilter));

  // Sort.
  switch (sortMode) {
    case 'price-asc': list.sort((a, b) => parsePrice(a.price) - parsePrice(b.price)); break;
    case 'price-desc': list.sort((a, b) => parsePrice(b.price) - parsePrice(a.price)); break;
    case 'brand': list.sort((a, b) => (a.brand || '').localeCompare(b.brand || '')); break;
  }

  $favCount.textContent = `${list.length} favorite${list.length !== 1 ? 's' : ''}`;
  $favoritesList.innerHTML = '';

  if (list.length === 0) {
    $favoritesList.innerHTML = '<div class="sp-no-results">No favorites saved yet.<br>Click ♡ on any listing to save it.</div>';
    return;
  }

  list.forEach((fav, idx) => {
    const card = document.createElement('div');
    card.className = 'sp-fav-card';
    card.draggable = true;
    card.dataset.idx = idx;

    const platform = fav.platform || '';
    const favicon = getPlatformFavicon(platform);
    const priceVal = parsePrice(fav.price);
    const hasCR = !!fav._conditionReport;
    const crDotClass = hasCR ? getConditionDotClass(fav._conditionReport.overallGrade, fav.condition) : 'sp-dot-pending';

    card.innerHTML = `
      <div class="sp-fav-card-header">
        <span class="sp-fav-card-title">${favicon ? `<img class="sp-platform-icon" src="${esc(favicon)}" style="vertical-align:middle;margin-right:3px" />` : ''}${esc(fav.title)}</span>
        <div class="sp-fav-card-actions">
          <button class="sp-fav-action-btn move-up" title="Move up">&#9650;</button>
          <button class="sp-fav-action-btn move-down" title="Move down">&#9660;</button>
          <button class="sp-fav-action-btn delete" title="Remove">&#10005;</button>
        </div>
      </div>
      <div class="sp-fav-card-body">
        ${fav.img ? `<img class="sp-fav-card-img" src="${esc(fav.img)}" alt="" />` : '<div class="sp-fav-card-img"></div>'}
        <div class="sp-fav-card-info">
          <div class="sp-fav-card-price">${priceVal > 0 ? '$' + priceVal.toLocaleString() : ''}</div>
          <div class="sp-fav-card-meta">
            ${[normalizeBrand(fav.brand), fav.color, fav.material, fav.condition].filter(Boolean).join(' · ')}
          </div>
          <div class="sp-fav-card-meta" style="color:#999">${STORE_NAMES[platform] || platform}</div>
        </div>
      </div>
      <div class="sp-fav-card-report">
        <button class="sp-condition-btn fav-cr-btn">
          <span class="sp-condition-dot ${crDotClass}">${hasCR ? '&#9679;' : '&#128270;'}</span>
          ${hasCR ? 'View Report' : 'Condition Report'}
        </button>
        <button class="sp-condition-toggle fav-cr-toggle ${hasCR ? '' : 'hidden'}">&#9660;</button>
      </div>
      <div class="fav-cr-content hidden"></div>
    `;

    // Wire buttons.
    card.querySelector('.move-up').onclick = () => moveFavorite(idx, -1);
    card.querySelector('.move-down').onclick = () => moveFavorite(idx, 1);
    card.querySelector('.delete').onclick = () => { favorites.splice(favorites.indexOf(fav), 1); saveFavorites(); renderFavorites(); };

    const crBtn = card.querySelector('.fav-cr-btn');
    const crToggle = card.querySelector('.fav-cr-toggle');
    const crContent = card.querySelector('.fav-cr-content');

    crBtn.onclick = () => {
      if (hasCR) {
        // Already have report — toggle visibility.
        crContent.innerHTML = renderConditionReport(fav._conditionReport);
        crContent.classList.toggle('hidden');
        crToggle.classList.toggle('open');
        return;
      }
      // Generate report.
      crBtn.disabled = true;
      crBtn.querySelector('.sp-condition-dot').innerHTML = '&#9203;';
      chrome.runtime.sendMessage({
        type: 'CONDITION_REPORT',
        payload: { imageUrl: fav.img, imageUrls: [], title: fav.title, platform: fav.platform },
      }, (response) => {
        crBtn.disabled = false;
        if (response?.report) {
          fav._conditionReport = response.report;
          saveFavorites();
          crContent.innerHTML = renderConditionReport(response.report);
          const dot = crBtn.querySelector('.sp-condition-dot');
          dot.className = `sp-condition-dot ${getConditionDotClass(response.report.overallGrade, fav.condition)}`;
          dot.innerHTML = '&#9679;';
          crBtn.childNodes[crBtn.childNodes.length - 1].textContent = ' View Report';
          crToggle.classList.remove('hidden');
        } else {
          crContent.innerHTML = `<div class="sp-report-error">${response?.error || 'Failed'}</div>`;
        }
        crContent.classList.remove('hidden');
        crToggle.classList.add('open');
      });
    };

    crToggle.onclick = () => {
      crContent.classList.toggle('hidden');
      crToggle.classList.toggle('open');
    };

    // Open listing link on card body click.
    card.querySelector('.sp-fav-card-body').style.cursor = 'pointer';
    card.querySelector('.sp-fav-card-body').onclick = () => {
      if (fav.link) window.open(fav.link, '_blank');
    };

    $favoritesList.appendChild(card);
  });
}

function moveFavorite(idx, dir) {
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= favorites.length) return;
  [favorites[idx], favorites[newIdx]] = [favorites[newIdx], favorites[idx]];
  saveFavorites();
  renderFavorites();
}

function populateFavDropdown(id, defaultText, values) {
  const el = document.getElementById(id);
  if (!el) return;
  const currentVal = el.value;
  el.innerHTML = `<option value="">${defaultText}</option>`;
  for (const v of [...values].sort()) {
    const opt = document.createElement('option');
    opt.value = v.toLowerCase();
    opt.textContent = v;
    if (v.toLowerCase() === currentVal) opt.selected = true;
    el.appendChild(opt);
  }
}

// ========================================================================
// DEEP COMPARISON (Full-screen view)
// ========================================================================

$deepCompareBtn.addEventListener('click', () => {
  if (!favorites.length) { alert('No favorites to compare.'); return; }
  // Store data in both compare_data and favorites, then open tab.
  const data = JSON.stringify(favorites);
  console.log('[MaisonDeux][panel] Saving compare data:', favorites.length, 'items');
  chrome.storage.local.set({ maisondeux_compare_data: data, maisondeux_favorites: favorites }, () => {
    // Verify data was saved.
    chrome.storage.local.get('maisondeux_compare_data', (check) => {
      console.log('[MaisonDeux][panel] Verified saved:', check.maisondeux_compare_data ? 'yes' : 'no');
      chrome.tabs.create({ url: chrome.runtime.getURL('compare/compare.html') });
    });
  });
  track('navigation', 'deep_compare_opened', '', favorites.length);
});
