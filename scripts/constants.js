// ── Shared Constants ─────────────────────────────────────────
// Single source of truth for values used across content.js, popup.js,
// and background.js. Loaded as the first content script, via <script>
// in popup.html, and via importScripts() in the service worker.

var MAX_HISTORY        = 20;      // Default max prompt history entries stored
var MAX_RETRIES        = 30;      // Injection retries for slow-loading SPAs
var RETRY_INTERVAL     = 1_000;   // ms between injection retries (safety-net polling)
var SUBMIT_DELAY       = 100;     // ms before submitting after filling input
var SETTLE_CAP_MS      = 300;     // Max settle wait after the input is detected
var GRID_STAGGER_MS    = 200;     // ms between grid iframe navigations
var TAB_LOAD_TIMEOUT   = 10_000;  // Max wait for a tab to reach "complete" status
var INJECT_TIMEOUT_MS  = 15_000;  // Per-tab safety timeout for query injection
var GRID_DATA_PREFIX   = "gridData_";  // local storage key prefix, suffixed with the grid tab id
var GRID_DATA_WAIT_MS  = 5_000;   // Max wait for the background to write a grid tab's payload
// Per-service delivery status the worker keeps for its own bookkeeping (it
// backs "retry this service"): "pending" is set the moment a service is
// queued, the content script's fill result promotes it to "filled" or
// "submitted", and anything else lands on "failed". Not shown in the UI.
var SEND_STATUS_KEY     = "sendStatus"; // storage.session key holding the live status
var FOLLOWUP_POS_KEY    = "followUpBar"; // storage.local: { [origin]: { left, top, collapsed } }
// Host access is optional and asked for per service. The worker mirrors the
// granted match patterns into storage.local because content scripts cannot
// read chrome.permissions themselves. See scripts/permissions.js.
var GRANTED_ORIGINS_KEY = "grantedOrigins";
// storage.session: a send parked while Chrome asks the user for site access.
var PENDING_SEND_KEY      = "pendingSend";
var PENDING_SEND_MAX_AGE_MS = 5 * 60_000; // Don't resume a send the user walked away from

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
