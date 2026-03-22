/**
 * @file logger.js
 * @description Ring-buffer logger with configurable severity levels.
 * Stores up to {@link MAX_ENTRIES} log entries in memory for debugging
 * without impacting performance or leaking to the console in production.
 */

/** @enum {number} Log severity levels. */
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const LEVEL_LABELS = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

/** Maximum number of entries kept in the ring buffer. */
const MAX_ENTRIES = 200;

/**
 * @typedef {Object} LogEntry
 * @property {string} level  - Human-readable level name.
 * @property {string} msg    - Log message.
 * @property {number} ts     - Unix-ms timestamp.
 * @property {*}      [data] - Optional structured data.
 */

class Logger {
  /** @param {number} [minLevel=LogLevel.DEBUG] Minimum severity to record. */
  constructor(minLevel = LogLevel.DEBUG) {
    /** @type {LogEntry[]} */
    this._buffer = [];
    this._minLevel = minLevel;
  }

  /**
   * Set the minimum log level at runtime.
   * @param {number} level - One of {@link LogLevel}.
   */
  setLevel(level) {
    this._minLevel = level;
  }

  /**
   * Append a log entry to the ring buffer.
   * @param {number} level
   * @param {string} msg
   * @param {*}      [data]
   */
  _log(level, msg, data) {
    if (level < this._minLevel) return;

    const entry = {
      level: LEVEL_LABELS[level],
      msg,
      ts: Date.now(),
      ...(data !== undefined && { data }),
    };

    this._buffer.push(entry);

    // Trim to ring-buffer size.
    if (this._buffer.length > MAX_ENTRIES) {
      this._buffer.shift();
    }
  }

  /** @param {string} msg @param {*} [data] */
  debug(msg, data) { this._log(LogLevel.DEBUG, msg, data); }

  /** @param {string} msg @param {*} [data] */
  info(msg, data) { this._log(LogLevel.INFO, msg, data); }

  /** @param {string} msg @param {*} [data] */
  warn(msg, data) { this._log(LogLevel.WARN, msg, data); }

  /** @param {string} msg @param {*} [data] */
  error(msg, data) { this._log(LogLevel.ERROR, msg, data); }

  /**
   * Return a copy of all buffered entries.
   * @returns {LogEntry[]}
   */
  getEntries() {
    return [...this._buffer];
  }

  /** Clear the buffer. */
  clear() {
    this._buffer = [];
  }
}

/** Singleton logger instance shared across the extension. */
const logger = new Logger();
export default logger;
