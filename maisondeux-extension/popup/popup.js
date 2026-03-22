/**
 * @file popup/popup.js
 * @description Controls the browser-action popup UI. Requests the current
 * product from the background service worker and renders deal comparisons.
 */

/* global chrome */

const $loading = document.getElementById('loading');
const $noProduct = document.getElementById('no-product');
const $deals = document.getElementById('deals');
const $currentProduct = document.getElementById('current-product');
const $dealList = document.getElementById('deal-list');
const $settingsBtn = document.getElementById('settings-btn');

// Open the settings page.
$settingsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Request the current product from the background worker.
chrome.runtime.sendMessage({ type: 'GET_CURRENT_PRODUCT' }, (response) => {
  $loading.classList.add('hidden');

  if (!response?.product) {
    $noProduct.classList.remove('hidden');
    return;
  }

  renderProduct(response.product);
  $deals.classList.remove('hidden');
});

// Listen for deal results pushed from the background.
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'DEAL_RESULTS') {
    renderDeals(message.payload.listings);
  }
});

/**
 * Render the currently detected product.
 * @param {Object} product
 */
function renderProduct(product) {
  $currentProduct.innerHTML = `
    <div class="product-card">
      <span class="product-brand">${esc(product.brand)}</span>
      <span class="product-title">${esc(product.title)}</span>
      <span class="product-price">${esc(product.currency)} ${product.price.toFixed(2)}</span>
      <span class="product-platform">${esc(product.platform)}</span>
    </div>
  `;
}

/**
 * Render a list of deal comparisons.
 * @param {Object[]} listings
 */
function renderDeals(listings) {
  if (!listings.length) {
    $dealList.innerHTML = '<li class="no-deals">No better deals found.</li>';
    return;
  }

  $dealList.innerHTML = listings
    .map(
      (l) => `
    <li class="deal-item">
      <a href="${esc(l.url)}" target="_blank" rel="noopener">
        <span class="deal-platform">${esc(l.platform)}</span>
        <span class="deal-price">${esc(l.currency)} ${l.price.toFixed(2)}</span>
      </a>
    </li>
  `
    )
    .join('');
}

/**
 * Minimal HTML escaping.
 * @param {string} s
 * @returns {string}
 */
function esc(s) {
  const el = document.createElement('span');
  el.textContent = s || '';
  return el.innerHTML;
}
