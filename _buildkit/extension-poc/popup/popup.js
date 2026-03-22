// Popup script — loads current product state from background
document.addEventListener("DOMContentLoaded", () => {
  chrome.runtime.sendMessage({ type: "GET_CURRENT_PRODUCT" }, (product) => {
    if (!product) return; // Show idle state

    document.getElementById("idle-state").style.display = "none";
    const container = document.getElementById("product-state");
    container.style.display = "block";
    container.innerHTML = `
      <div class="product-info">
        <div class="product-label">Currently viewing</div>
        <div class="product-name">${product.brand ? product.brand + " — " : ""}${product.productName || "Unknown"}</div>
        <div class="product-price">${product.price || ""}</div>
      </div>
      <div class="product-label">Searching across</div>
      <div class="platform-status" id="platform-status">
        <div class="platform-row">
          <span class="platform-name">Searching other platforms…</span>
        </div>
      </div>
    `;
  });
});
