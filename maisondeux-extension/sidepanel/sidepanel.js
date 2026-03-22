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

// ---- State ----
let isActive = true;
let currentProduct = null;
let allResults = []; // all scored results received so far
let searchComplete = false;
let platformsSearched = 0;
let totalPlatforms = 0;
let currentProductAttrs = null; // { brand, color, model, material }
let filtersAutoSet = false;

// ---- Init ----

// Load saved active state.
chrome.storage.local.get('maisondeux_active', (data) => {
  isActive = data.maisondeux_active !== false; // default true
  $toggle.checked = isActive;
  updateView();
});

// Ask background for current product and any existing results.
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

  // Build attribute pills from ALL product text (title + description + condition).
  $productAttrs.innerHTML = '';
  const titleText = [
    product.brand,
    product.productName || product.title,
    product.description,
    product.conditionText || product.condition,
    product.categoryText || product.category,
  ].filter(Boolean).join(' ');

  const pills = [];

  // Price pill.
  if (priceVal > 0) pills.push({ label: `$${priceVal.toLocaleString()}`, type: 'price' });

  // Color — prefer structured data from page.
  const colors = product.color || product.attrs?.colors?.[0] || [...scanTitle(titleText, FILTER_COLORS)][0] || null;
  if (colors) pills.push({ label: colors, type: 'color' });

  // Model — prefer structured data from page.
  const model = product.model || [...scanTitle(titleText, FILTER_MODELS)][0] || null;
  if (model) pills.push({ label: model, type: 'model' });

  // Material — prefer structured data from page.
  const material = product.material || product.attrs?.materials?.[0] || [...scanTitle(titleText, FILTER_MATERIALS)][0] || null;
  if (material) pills.push({ label: material, type: 'material' });

  // Hardware — detect from structured data or description.
  const hwRaw = product.hardware || [...scanTitle(titleText, FILTER_HARDWARE)][0] || null;
  const hardware = hwRaw ? (hwRaw.toLowerCase().includes('gold') ? 'Gold' : hwRaw.toLowerCase().includes('silver') ? 'Silver' : hwRaw.toLowerCase().includes('palladium') ? 'Palladium' : hwRaw.toLowerCase().includes('ruthenium') ? 'Ruthenium' : hwRaw.toLowerCase().includes('rose') ? 'Rose Gold' : hwRaw) : null;

  // Condition.
  const condition = product.conditionText || product.condition || product.attrs?.conditions?.[0] || [...scanTitle(titleText, FILTER_CONDITIONS)][0] || null;
  if (condition) pills.push({ label: condition, type: 'condition' });

  // Category.
  const category = product.category || product.categoryText || product.attrs?.categories?.[0] || null;
  if (category) pills.push({ label: category, type: 'category' });

  // Use structured attributes first, normalize brand.
  const brand = normalizeBrand(product.brand || [...scanTitle(titleText, FILTER_BRANDS)][0] || null);

  // Build details line: Brand · Model · Color · Material · Size · Price
  const detailParts = [];
  if (brand) detailParts.push(`<strong>${esc(brand)}</strong>`);
  if (model) detailParts.push(esc(model));
  if (colors) detailParts.push(esc(colors));
  if (material) detailParts.push(esc(material));
  if (product.size) detailParts.push(esc(product.size));
  if (hardware) detailParts.push(esc(hardware) + ' HW');
  if (priceVal > 0) detailParts.push(`<strong>$${priceVal.toLocaleString()}</strong>`);
  $details.innerHTML = detailParts.join(' · ');

  // Render remaining attribute pills (material, condition, category — skip what's in details).
  for (const pill of pills) {
    // Skip brand/model/color/price — already in details line.
    if (['price', 'color', 'model'].includes(pill.type)) continue;
    const chip = document.createElement('span');
    chip.className = `sp-chip sp-chip-${pill.type}`;
    chip.textContent = pill.label;
    $productAttrs.appendChild(chip);
  }

  // Store detected attributes for auto-setting filters after results arrive.
  currentProductAttrs = { brand: (brand || '').toLowerCase(), color: (colors || '').toLowerCase(), model: (model || '').toLowerCase(), material: (material || '').toLowerCase() };
  filtersAutoSet = false;
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

  // Step 1: Apply relevance filter.
  const minScore = parseFloat(filterEls.relevance.value) || 0;
  let filtered = allResults.filter((r) => (r.relevanceScore ?? r.score ?? 1.0) >= minScore);

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
          if (keywordList) scanTitle(r.title || '', keywordList).forEach((v) => available.add(v));
          if (key === 'condition' && r.condition) available.add(r.condition);
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

  // Auto-set filters on first results if not already done.
  if (!filtersAutoSet && currentProductAttrs && allResults.length > 0) {
    filtersAutoSet = true;
    if (filterEls.brand && currentProductAttrs.brand) filterEls.brand.value = currentProductAttrs.brand;
    if (filterEls.color && currentProductAttrs.color) filterEls.color.value = currentProductAttrs.color;
    if (filterEls.model && currentProductAttrs.model) filterEls.model.value = currentProductAttrs.model;
    if (filterEls.material && currentProductAttrs.material) filterEls.material.value = currentProductAttrs.material;
    // Re-filter with auto-set values.
    return renderResults();
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

  a.innerHTML = `
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
  `;

  return a;
}

// Inline keyword lists for title scanning.
const FILTER_COLORS = ['black','noir','white','blanc','beige','brown','marron','red','rouge','pink','rose','blue','bleu','green','vert','grey','gray','gold','silver','orange','yellow','purple','navy','cream','ivory','tan','nude','burgundy','cognac','chocolate','camel','taupe','bordeaux','teal','coral','rust','olive','khaki','charcoal','champagne'];
const FILTER_MATERIALS = ['leather','canvas','suede','silk','denim','tweed','nylon','velvet','satin','wool','cashmere','cotton','patent','lambskin','caviar','calfskin','clemence','togo','epsom','swift','barenia','evercolor','box calf','chamonix','veau','chevre','goatskin','exotic','python','crocodile','alligator','ostrich','gg supreme','monogram','damier','epi','vernis','empreinte','coated canvas','raffia','straw','rubber','pvc','nappa'];
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
  'jacquard','jaquard','soho','gg marmont','ophidia','dionysus','jackie','bamboo','horsebit','blondie','attache','gucci gg',
  // More
  'antigona','pandora','nightingale','shark','papier','motorcity','knife',
  'phantom','seau sangle','cabas','ava','triomphe','teen triomphe',
  'flamenco','puzzle','hammock','gate','basket',
  'mini kelly','kelly pochette','birkin 25','birkin 30','birkin 35','picotin','picotin lock',
  'chanel 19','classic double flap','jumbo','maxi','east west',
];
const FILTER_HARDWARE = ['gold hardware','gold-plated hardware','gold-plated','ghw','silver hardware','shw','palladium hardware','phw','ruthenium hardware','rhw','rose gold hardware','rghw'];
const FILTER_CONDITIONS = ['new','like new','excellent','very good','good','fair','pre-owned','used','nwt','nwot'];

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

function scanTitle(title, keywords) {
  const lower = (title || '').toLowerCase();
  const found = new Set();
  for (const kw of keywords) {
    const regex = new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    if (regex.test(lower)) {
      const display = DISPLAY_NAMES[kw] || kw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      found.add(display);
    }
  }
  return found;
}

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
  const lower = brand.toLowerCase().trim();
  return CANONICAL_BRANDS[lower] || brand.trim();
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
  const searchText = [r[key], r.title, r.condition].filter(Boolean).join(' ').toLowerCase();
  return searchText.includes(filterVal);
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
