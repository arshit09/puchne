// ── Shared Constants ─────────────────────────────────────────
// Single source of truth for values used across content.js, popup.js,
// and background.js. Loaded as the first content script, via <script>
// in popup.html, and via importScripts() in the service worker.

var MAX_HISTORY        = 20;      // Default max prompt history entries stored
var MAX_RETRIES        = 30;      // Injection retries for slow-loading SPAs
var RETRY_INTERVAL     = 1_000;   // ms between injection retries (safety-net polling)
var SUBMIT_DELAY       = 100;     // ms before submitting after filling input
var TAB_LOAD_TIMEOUT   = 10_000;  // Max wait for a tab to reach "complete" status
var INJECT_TIMEOUT_MS  = 15_000;  // Per-tab safety timeout for query injection

/**
 * Applies a theme to an element by setting data-theme="dark"|"light".
 * Works for document.documentElement (popup/options pages) and
 * shadow-host container elements (content overlay).
 * @param {HTMLElement} element
 * @param {"dark"|"light"} theme
 */
function applyTheme(element, theme) {
  element.dataset.theme = theme;
}
