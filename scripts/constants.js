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

// ── Theme ────────────────────────────────────────────────────
// The stored preference is one of "system" | "light" | "dark"; the
// stylesheets only ever see a resolved "light" | "dark". Keeping the two
// apart is what lets every surface go on reading data-theme without caring
// that "system" exists.
var THEME_DEFAULT = "system";

/**
 * Resolves a stored preference to the theme actually painted.
 * "system" follows the OS; anything unrecognised falls back to it too.
 * @param {string} [pref]
 * @returns {"dark"|"light"}
 */
function resolveTheme(pref) {
  if (pref === "dark" || pref === "light") return pref;
  // matchMedia is missing in the service worker, which has nothing to paint.
  if (typeof matchMedia !== "function") return "dark";
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Applies a theme to an element by setting data-theme="dark"|"light".
 * Works for document.documentElement (popup/options pages) and
 * shadow-host container elements (content overlay).
 *
 * The raw preference is kept alongside it in data-theme-pref so a surface
 * can tell "dark because the user asked" from "dark because the OS is".
 *
 * @param {HTMLElement} element
 * @param {"system"|"dark"|"light"} [pref]
 * @returns {"dark"|"light"} the resolved theme that was applied
 */
function applyTheme(element, pref) {
  const preference = pref || THEME_DEFAULT;
  const resolved = resolveTheme(preference);
  element.dataset.themePref = preference;
  element.dataset.theme = resolved;
  return resolved;
}

/**
 * Calls back when the OS light/dark setting changes, so a surface sitting on
 * "system" can repaint without being reopened.
 * @param {(theme: "dark"|"light") => void} handler
 * @returns {() => void} unsubscribe
 */
function watchSystemTheme(handler) {
  if (typeof matchMedia !== "function") return () => {};
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const listener = (e) => handler(e.matches ? "dark" : "light");
  mq.addEventListener("change", listener);
  return () => mq.removeEventListener("change", listener);
}

// ── Motion ───────────────────────────────────────────────────

/**
 * Whether the user has asked for reduced motion. The stylesheets handle their
 * own transitions with a media query; this is for the animations JS drives
 * itself (FLIP reorders, grid swaps), which CSS can't reach.
 * @returns {boolean}
 */
function prefersReducedMotion() {
  if (typeof matchMedia !== "function") return false;
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}
