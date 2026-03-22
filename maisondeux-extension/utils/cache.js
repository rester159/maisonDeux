/**
 * @file cache.js
 * @description LRU cache backed by chrome.storage.local.
 * Entries are evicted when the cache exceeds {@link maxEntries} or when their
 * TTL expires. Each entry stores a timestamp so stale data is never returned.
 */

/** Default maximum number of cached entries. */
const DEFAULT_MAX_ENTRIES = 500;

/** Default time-to-live in milliseconds (7 days). */
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Storage key for the entire cache map. */
const STORAGE_KEY = 'maisondeux_cache';

/**
 * @typedef {Object} CacheEntry
 * @property {*}      value     - The cached value.
 * @property {number} createdAt - Unix-ms when the entry was written.
 * @property {number} accessedAt - Unix-ms when the entry was last read.
 */

class LRUCache {
  /**
   * @param {Object}  [opts]
   * @param {number}  [opts.maxEntries=500]
   * @param {number}  [opts.ttlMs=604800000] TTL in milliseconds.
   */
  constructor({ maxEntries = DEFAULT_MAX_ENTRIES, ttlMs = DEFAULT_TTL_MS } = {}) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
    /** @type {Map<string, CacheEntry>|null} In-memory mirror, lazy-loaded. */
    this._map = null;
  }

  /**
   * Load the cache from storage into memory.
   * @returns {Promise<Map<string, CacheEntry>>}
   */
  async _load() {
    if (this._map) return this._map;
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const raw = result[STORAGE_KEY] || {};
    this._map = new Map(Object.entries(raw));
    return this._map;
  }

  /** Persist the in-memory map back to storage. */
  async _save() {
    const obj = Object.fromEntries(this._map);
    await chrome.storage.local.set({ [STORAGE_KEY]: obj });
  }

  /**
   * Retrieve a cached value. Returns `undefined` if missing or expired.
   * @param {string} key
   * @returns {Promise<*|undefined>}
   */
  async get(key) {
    const map = await this._load();
    const entry = map.get(key);
    if (!entry) return undefined;

    // Expired?
    if (Date.now() - entry.createdAt > this.ttlMs) {
      map.delete(key);
      await this._save();
      return undefined;
    }

    // Bump access time for LRU ordering.
    entry.accessedAt = Date.now();
    return entry.value;
  }

  /**
   * Store a value in the cache, evicting the least-recently-used entry if full.
   * @param {string} key
   * @param {*}      value
   */
  async set(key, value) {
    const map = await this._load();
    const now = Date.now();

    map.set(key, { value, createdAt: now, accessedAt: now });

    // Evict LRU entries if over capacity.
    while (map.size > this.maxEntries) {
      let oldestKey = null;
      let oldestAccess = Infinity;
      for (const [k, v] of map) {
        if (v.accessedAt < oldestAccess) {
          oldestAccess = v.accessedAt;
          oldestKey = k;
        }
      }
      if (oldestKey) map.delete(oldestKey);
    }

    await this._save();
  }

  /**
   * Remove a single entry.
   * @param {string} key
   */
  async delete(key) {
    const map = await this._load();
    map.delete(key);
    await this._save();
  }

  /** Clear the entire cache. */
  async clear() {
    this._map = new Map();
    await this._save();
  }
}

/** Singleton cache instance. */
const cache = new LRUCache();
export default cache;
