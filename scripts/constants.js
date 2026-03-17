// ── Shared Constants ─────────────────────────────────────────
// Single source of truth for values used across content.js and popup.js.
// Loaded as the first content script and via <script> in popup.html.

const MAX_HISTORY      = 5;    // Max prompt history entries stored
const MAX_RETRIES      = 30;   // Injection retries for slow-loading SPAs
const RETRY_INTERVAL   = 500;  // ms between injection retries
