// ── Shared Constants ─────────────────────────────────────────
// Single source of truth for values used across content.js, popup.js,
// and background.js. Loaded as the first content script, via <script>
// in popup.html, and via importScripts() in the service worker.

const MAX_HISTORY        = 20;      // Default max prompt history entries stored
const MAX_RETRIES        = 30;      // Injection retries for slow-loading SPAs
const RETRY_INTERVAL     = 1_000;   // ms between injection retries (safety-net polling)
const SUBMIT_DELAY       = 100;     // ms before submitting after filling input
const TAB_LOAD_TIMEOUT   = 10_000;  // Max wait for a tab to reach "complete" status
const INJECT_TIMEOUT_MS  = 15_000;  // Per-tab safety timeout for query injection

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
