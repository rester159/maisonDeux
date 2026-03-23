/**
 * @file utils/analytics.js
 * Lightweight analytics for MaisonDeux extension.
 * Tracks events in chrome.storage.local and sends batches to the API.
 */

const ANALYTICS_KEY = 'maisondeux_analytics';
const ANALYTICS_QUEUE_KEY = 'maisondeux_analytics_queue';

// Track an event.
function trackEvent(category, action, label = '', value = 0) {
  const event = {
    category, // e.g., 'product', 'filter', 'favorite', 'condition_report'
    action,   // e.g., 'detected', 'saved', 'generated', 'clicked'
    label,    // e.g., platform name, brand, etc.
    value,
    ts: Date.now(),
  };

  // Append to queue.
  chrome.storage.local.get(ANALYTICS_QUEUE_KEY, (data) => {
    const queue = data[ANALYTICS_QUEUE_KEY] || [];
    queue.push(event);
    // Keep max 500 events.
    if (queue.length > 500) queue.splice(0, queue.length - 500);
    chrome.storage.local.set({ [ANALYTICS_QUEUE_KEY]: queue });
  });

  // Update aggregate counters.
  chrome.storage.local.get(ANALYTICS_KEY, (data) => {
    const stats = data[ANALYTICS_KEY] || { daily: {}, weekly: {}, monthly: {}, totals: {} };
    const now = new Date();
    const dayKey = now.toISOString().slice(0, 10); // 2026-03-23
    const weekKey = `${now.getFullYear()}-W${String(Math.ceil((now.getDate() + new Date(now.getFullYear(), now.getMonth(), 1).getDay()) / 7)).padStart(2, '0')}`;
    const monthKey = now.toISOString().slice(0, 7); // 2026-03

    const eventKey = `${category}.${action}`;

    // Daily.
    if (!stats.daily[dayKey]) stats.daily[dayKey] = {};
    stats.daily[dayKey][eventKey] = (stats.daily[dayKey][eventKey] || 0) + 1;
    stats.daily[dayKey]._sessions = stats.daily[dayKey]._sessions || 1;

    // Monthly.
    if (!stats.monthly[monthKey]) stats.monthly[monthKey] = {};
    stats.monthly[monthKey][eventKey] = (stats.monthly[monthKey][eventKey] || 0) + 1;

    // Totals.
    stats.totals[eventKey] = (stats.totals[eventKey] || 0) + 1;

    // Prune old data (keep 90 days).
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffKey = cutoff.toISOString().slice(0, 10);
    for (const k of Object.keys(stats.daily)) {
      if (k < cutoffKey) delete stats.daily[k];
    }

    chrome.storage.local.set({ [ANALYTICS_KEY]: stats });
  });
}

// Get analytics summary for the dashboard.
function getAnalyticsSummary(callback) {
  chrome.storage.local.get([ANALYTICS_KEY, ANALYTICS_QUEUE_KEY], (data) => {
    callback({
      stats: data[ANALYTICS_KEY] || {},
      recentEvents: (data[ANALYTICS_QUEUE_KEY] || []).slice(-100),
    });
  });
}

// Flush event queue to API (called periodically).
async function flushAnalytics(apiUrl) {
  return new Promise((resolve) => {
    chrome.storage.local.get(ANALYTICS_QUEUE_KEY, async (data) => {
      const queue = data[ANALYTICS_QUEUE_KEY] || [];
      if (!queue.length) { resolve(); return; }

      try {
        await fetch(`${apiUrl}/api/analytics/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: queue }),
        });
        // Clear queue on success.
        chrome.storage.local.set({ [ANALYTICS_QUEUE_KEY]: [] });
      } catch (e) {
        console.warn('[MaisonDeux] Analytics flush failed:', e.message);
      }
      resolve();
    });
  });
}
