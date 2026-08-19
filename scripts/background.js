// Import shared modules (must be the first statement in an MV3 service
// worker). Extension-root-absolute paths ("/scripts/...") so resolution does
// not depend on the worker's subfolder location.
importScripts("/scripts/constants.js", "/scripts/permissions.js");

/**
 * ============================================================
 *  Puchne — Background Service Worker
 * ============================================================
 *
 *  This is the "brain" of the extension. It:
 *   1. Listens for the "multicast" message from the popup
 *   2. Opens a new tab for each enabled AI service
 *   3. Waits for each tab to finish loading
 *   4. Injects the query into each tab via content scripts
 *
 *  All AI service definitions (URLs, selectors, etc.) live in
 *  the AI_SERVICES registry below. To add a new AI, just add
 *  an entry — no other changes needed.
 * ============================================================
 */

// ── AI Service Registry ──────────────────────────────────────
// Each service defines:
//   id          — Unique key (used in storage for enable/disable)
//   name        — Human-readable label
//   url         — The page to open
//   origins     — Match patterns this service needs. They are all optional
//                 permissions, requested the first time the service is used,
//                 so adding a provider never widens the install prompt.
//   inputType   — "textarea" | "contenteditable" | "prosemirror"
//   selector    — CSS selector for the input element
//   submitType  — How to submit: "enter" (simulate Enter key),
//                 "button" (click a send button), or "both"
//   buttonSel   — (optional) CSS selector for the send button
//   waitMs      — Settle window after the input is found, before typing
//                 (capped at SETTLE_CAP_MS by the content script)
//
// NOTE: AI sites update their DOM frequently. If a service stops
// working, updating the `selector` / `buttonSel` here usually
// fixes it. Contributions welcome!
// ──────────────────────────────────────────────────────────────

const AI_SERVICES = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    url: "https://chatgpt.com/",
    origins: ["https://chatgpt.com/*", "https://chat.openai.com/*"],
    inputType: "prosemirror",
    // Primary ID first; fallback to data-testid, then any visible ProseMirror editor
    selector: '#prompt-textarea, [data-testid="prompt-textarea"], div.ProseMirror[contenteditable="true"]',
    submitType: "button",
    buttonSel: '#composer-submit-button, [data-testid="send-button"], button[aria-label*="send" i]',
    waitMs: 2500,
    iconPath: 'icons/services/chatgpt_dark.png',
    iconPathDark: 'icons/services/chatgpt_light.png',
    loginSelector: '[data-testid="login-button"], a[href*="/auth/login"]'
  },
  {
    id: "claude",
    name: "Claude",
    url: "https://claude.ai/new",
    origins: ["https://claude.ai/*"],
    inputType: "prosemirror",
    // Class-based first (most specific), then generic contenteditable
    selector: 'div.ProseMirror[contenteditable="true"], [data-testid="chat-input"], [contenteditable="true"]',
    submitType: "button",
    buttonSel: 'button[aria-label="Send message"], [aria-label="Send Message"], button[aria-label*="send" i], button:has(path[d^="M208.49"])',
    waitMs: 2500,
    iconPath: 'icons/services/claude.png',
    loginSelector: 'a[href*="/login"], .login-btn, button[class*="login" i]'
  },
  {
    id: "gemini",
    name: "Gemini",
    url: "https://gemini.google.com/app",
    origins: ["https://gemini.google.com/*"],
    inputType: "contenteditable",
    // Quill class first; fallback to rich-textarea role, then generic contenteditable
    selector: '.ql-editor[contenteditable="true"], [data-testid="user-prompt-text-area"], [contenteditable="true"][role="textbox"]',
    submitType: "button",
    buttonSel: 'button[aria-label="Send message"], button[aria-label*="send" i], [data-testid="send-button"]',
    waitMs: 2500,
    iconPath: 'icons/services/gemini.png',
    loginSelector: 'a[href*="accounts.google.com"], .sign-in-button, button[class*="sign-in" i]'
  },
  {
    id: "copilot",
    name: "Copilot",
    url: "https://copilot.microsoft.com/",
    origins: ["https://copilot.microsoft.com/*"],
    inputType: "textarea",
    // ID first; fallback to name attribute, aria role, then placeholder heuristic
    selector: '#userInput, textarea[name="userInput"], [data-testid="user-input"], textarea[placeholder*="message" i]',
    submitType: "enter",
    waitMs: 2500,
    iconPath: 'icons/services/copilot.png',
    loginSelector: 'button#mectrl_main_trigger, a.login-button, [aria-label*="sign in" i]'
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    url: "https://chat.deepseek.com/",
    origins: ["https://chat.deepseek.com/*"],
    inputType: "textarea",
    // Specific ID first; generic textarea as final fallback
    selector: 'textarea#chat-input, textarea[placeholder*="message" i], textarea',
    submitType: "enter",
    waitMs: 2500,
    iconPath: 'icons/services/deepseek.png',
    loginSelector: 'a[href*="/login"], button[class*="login" i]'
  },
  {
    id: "perplexity",
    name: "Perplexity",
    url: "https://www.perplexity.ai/",
    origins: ["https://www.perplexity.ai/*"],
    inputType: "contenteditable",
    // ID first; fallback to data-testid, then placeholder heuristic
    selector: '#ask-input, [data-testid="ask-input"], textarea[placeholder*="ask" i]',
    submitType: "button",
    buttonSel: 'button[aria-label="Submit"], button[aria-label*="submit" i], button[aria-label*="send" i]',
    waitMs: 2500,
    iconPath: 'icons/services/perplexity.png',
    loginSelector: 'a[href*="/login"], button[class*="login" i], button[class*="sign-in" i]'
  },
  {
    id: "grok",
    name: "Grok",
    url: "https://grok.com/",
    origins: ["https://grok.com/*"],
    inputType: "prosemirror",
    selector: 'div.ProseMirror[aria-label="Ask Grok anything"], textarea[aria-label="Ask Grok anything"], [contenteditable="true"][aria-label="Ask Grok anything"]',
    submitType: "button",
    buttonSel: 'button[data-testid="chat-submit"], button[aria-label="Submit"]',
    waitMs: 2500,
    iconPath: 'icons/services/grok.svg',
    loginSelector: 'button[class*="sign-in" i], a[href*="/login"]'
  }
];

// Export the registry so other parts of the extension can import it
// (popup reads it via message passing)
// ──────────────────────────────────────────────────────────────


/**
 * Returns the user's settings merged with sane defaults.
 * Defaults: all original 5 services enabled, auto-submit ON,
 * group tabs ON, delay = 2000ms.
 *
 * Prompt history defaults ON: it is stored only in this profile's local
 * storage and never leaves the device, and off-by-default meant most people
 * never found out recents existed.
 */
async function getSettings() {
  const defaults = {
    enabledServices: ["chatgpt", "claude", "gemini"],
    autoSubmit: true,
    useSidebar: false,
    gridView: true,
    hoverExpand: true,
    hoverExpandMin: 2,
    hoverExpandDelay: 200,
    groupTabs: false,
    cycleTabs: false,
    delayMs: 2000,
    enableHistory: true,
    showRecents: true,
    showFollowUpInput: true,
    // "system" follows the OS light/dark setting; see resolveTheme in
    // scripts/constants.js.
    theme: THEME_DEFAULT,
    // "Ask Puchne" (context menu / selection shortcut): open the panel with
    // the text filled in, or skip the panel and send it straight away.
    askAction: "panel",
    askTargetMode: "enabled",
    askTargetIds: [],
    customSelectors: {},
    customProviders: [],
  };

  const stored = await chrome.storage.sync.get("settings");
  return { ...defaults, ...(stored.settings || {}) };
}

/**
 * Returns all service definitions: built-in AI_SERVICES plus user customProviders.
 * @param {Object} [settings]
 * @returns {Array}
 */
function getRegistry(settings) {
  const custom = (settings?.customProviders || []).map((p) => ({
    ...p,
    iconPath: p.iconPath || "icons/services/custom.svg",
    iconPathDark: p.iconPathDark || p.iconPath || "icons/services/custom.svg",
    isCustom: true,
  }));
  return [...AI_SERVICES, ...custom];
}

/**
 * Resolves service definitions by id, merging in the user's custom selectors.
 * @param {Object} settings
 * @param {string[]} [ids] — defaults to the enabled set
 * @returns {Array} service definitions ready to inject with
 */
function resolveTargets(settings, ids) {
  const wanted = new Set(ids || settings.enabledServices);
  return getRegistry(settings)
    .filter((s) => wanted.has(s.id))
    .map((s) => {
      const custom = settings.customSelectors?.[s.id];
      if (!custom) return s;
      return {
        ...s,
        ...(custom.selector  ? { selector:  custom.selector  } : {}),
        ...(custom.buttonSel ? { buttonSel: custom.buttonSel } : {}),
      };
    });
}


// ── Host Access ──────────────────────────────────────────────
// No site is granted at install time; each one is asked for the first time
// its service is used. Three things have to follow the answer:
//
//   1. the storage.local mirror content scripts read (they have no
//      chrome.permissions API of their own),
//   2. the dynamically registered content scripts — with no static
//      "content_scripts" block, this is what puts the follow-up bar on an
//      allowed AI page,
//   3. any send that was parked while Chrome asked the question.

// The panel is part of this list because the overlay is built from it.
const CONTENT_SCRIPT_FILES = [
  "scripts/constants.js",
  "scripts/permissions.js",
  "scripts/prompt-panel.js",
  "scripts/content.js",
];

// One registration covers every allowed host; its matches are rewritten
// whenever the granted set changes.
const SERVICE_SCRIPT_ID = "puchne-service-hosts";

/** The host patterns the user has granted. */
async function grantedOrigins() {
  try {
    const permissions = await chrome.permissions.getAll();
    return permissions.origins || [];
  } catch (err) {
    console.warn("[Puchne] Could not read granted permissions:", err);
    return [];
  }
}

// A single grant fires both permissions.onAdded and the page's own
// "accessGranted" message, so the sync below runs twice in quick succession.
// Serializing it keeps two overlapping registrations from racing on the same
// script id.
let hostAccessQueue = Promise.resolve();

/**
 * Republishes everything derived from the granted host set. Safe to call
 * repeatedly — both the mirror write and the script registration are
 * idempotent.
 */
function syncHostAccess() {
  hostAccessQueue = hostAccessQueue
    .then(async () => {
      const granted = await grantedOrigins();
      await chrome.storage.local.set({ [GRANTED_ORIGINS_KEY]: granted });
      await registerServiceScripts(granted);
    })
    .catch((err) => console.warn("[Puchne] Host access sync failed:", err));
  return hostAccessQueue;
}

/**
 * Registers (or narrows, or drops) the content script that runs on allowed
 * AI hosts. Without it, a page load on an allowed service would never mount
 * the follow-up bar — only tabs Puchne opens itself get injected.
 * @param {string[]} granted
 */
async function registerServiceScripts(granted) {
  const settings = await getSettings();
  const registry = getRegistry(settings);
  const matches = [];
  for (const service of registry) {
    if (isServiceGranted(service, granted)) matches.push(...servicePatterns(service));
  }

  let existing = [];
  try {
    existing = await chrome.scripting.getRegisteredContentScripts({ ids: [SERVICE_SCRIPT_ID] });
  } catch {
    // Nothing registered yet (or the API refused the lookup) — treat as none.
  }

  try {
    if (matches.length === 0) {
      if (existing.length > 0) {
        await chrome.scripting.unregisterContentScripts({ ids: [SERVICE_SCRIPT_ID] });
      }
      return;
    }

    const script = {
      id: SERVICE_SCRIPT_ID,
      matches,
      js: CONTENT_SCRIPT_FILES,
      runAt: "document_idle",
      allFrames: false, // Grid sub-frames are injected on demand instead
      persistAcrossSessions: true,
    };

    if (existing.length > 0) {
      await chrome.scripting.updateContentScripts([script]);
    } else {
      await chrome.scripting.registerContentScripts([script]);
    }
  } catch (err) {
    console.warn("[Puchne] Content script registration failed:", err);
  }
}

/**
 * Injects into pages that were already open when access was granted, so a
 * fresh grant doesn't need a manual reload before the panel works there.
 * @param {string[]} origins — the patterns that were just granted
 */
async function injectIntoOpenTabs(origins) {
  for (const pattern of origins || []) {
    let tabs = [];
    try {
      tabs = await chrome.tabs.query({ url: pattern });
    } catch {
      continue; // Not a queryable pattern — nothing to back-fill.
    }
    for (const tab of tabs) {
      if (!tab.id) continue;
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: CONTENT_SCRIPT_FILES,
        });
      } catch (err) {
        console.log(`[Puchne] Back-fill inject (tab ${tab.id}):`, err.message);
      }
    }
  }
}

/** Splits targets into the ones Puchne may drive and the ones it may not. */
async function partitionTargets(targets) {
  return partitionByAccess(targets, await grantedOrigins());
}

/**
 * Opens the access prompt for a set of services. chrome.permissions.request
 * needs an extension page and a user gesture — neither exists in a worker or
 * a content script — so the ask is handed to pages/permissions.html.
 *
 * @param {string[]} serviceIds
 * @param {{query: string, targetIds?: string[]}|null} [pendingSend] — a send to
 *        run once granted. `targetIds` pins it to an explicit set of services;
 *        without it the send goes to whatever is enabled at resume time.
 */
async function openAccessWindow(serviceIds, pendingSend) {
  const settings = await getSettings();
  const registry = getRegistry(settings);
  const ids = (serviceIds || []).filter((id) => registry.some((s) => s.id === id));
  if (ids.length === 0) return;

  if (pendingSend?.query) {
    await chrome.storage.session.set({
      [PENDING_SEND_KEY]: {
        query: pendingSend.query,
        serviceIds: ids,
        targetIds: pendingSend.targetIds || null,
        at: Date.now(),
      },
    });
  } else {
    await chrome.storage.session.remove(PENDING_SEND_KEY);
  }

  const base = chrome.runtime.getURL("pages/permissions.html");
  const url = `${base}?ids=${encodeURIComponent(ids.join(","))}`;

  // Re-use an open prompt rather than stacking a second window on top of it.
  const existing = await chrome.tabs.query({ url: `${base}*` });
  if (existing.length > 0) {
    await chrome.tabs.update(existing[0].id, { url, active: true });
    await chrome.windows.update(existing[0].windowId, { focused: true });
    return;
  }

  await chrome.windows.create({ url, type: "popup", width: 480, height: 620 });
}

/**
 * Runs after Chrome confirms a grant: switches the services on (asking for a
 * site is a statement of intent to use it) and releases any parked send.
 * @param {string[]} serviceIds
 */
async function handleAccessGranted(serviceIds) {
  await syncHostAccess();

  const stored = await chrome.storage.sync.get("settings");
  const settings = stored.settings || {};
  const registry = getRegistry(settings);
  const ids = (serviceIds || []).filter((id) => registry.some((s) => s.id === id));
  if (ids.length > 0) {
    const stored = await chrome.storage.sync.get("settings");
    const settings = stored.settings || {};
    const enabled = new Set(settings.enabledServices || ["chatgpt", "claude", "gemini"]);
    const before = enabled.size;
    ids.forEach((id) => enabled.add(id));
    if (enabled.size !== before) {
      await chrome.storage.sync.set({ settings: { ...settings, enabledServices: [...enabled] } });
    }
  }

  await resumePendingSend();
}

/**
 * Sends the prompt the user typed before the access prompt interrupted them.
 * Anything older than PENDING_SEND_MAX_AGE_MS is dropped — by then they have
 * moved on, and firing a forgotten prompt at six tabs is worse than losing it.
 */
async function resumePendingSend() {
  const stored = await chrome.storage.session.get(PENDING_SEND_KEY);
  const pending = stored[PENDING_SEND_KEY];
  if (!pending?.query) return;

  await chrome.storage.session.remove(PENDING_SEND_KEY);
  if (Date.now() - (pending.at || 0) > PENDING_SEND_MAX_AGE_MS) return;

  // Deliberately not awaited, for the same reason the "multicast" handler
  // doesn't: in tab mode the send only settles once every tab has loaded and
  // been injected, and the access window must close on the grant, not on that.
  handleMulticast(pending.query, pending.targetIds || undefined).then(
    () => console.log("[Puchne] Resumed the send that was waiting on access."),
    (err) => console.warn("[Puchne] Resumed send failed:", err)
  );
}

chrome.permissions.onAdded.addListener(async (permissions) => {
  await syncHostAccess();
  await injectIntoOpenTabs(permissions.origins || []);
});

chrome.permissions.onRemoved.addListener(() => syncHostAccess());


// ── Delivery Status ──────────────────────────────────────────
// Per-service bookkeeping for the send in flight: which service is where,
// and why one failed. No surface renders it — it exists so the worker can
// re-run a single service (see retryService) and so the toolbar badge knows
// whether anything failed. It lives in storage.session because it is
// meaningless after a browser restart.

// Injections finish concurrently, so every read-modify-write of the status
// record is serialized through one queue to stop them clobbering each other.
let sendStatusQueue = Promise.resolve();

/**
 * Runs `fn` against the stored status and writes back whatever it returns.
 * Returning undefined leaves the record untouched.
 * @param {(status: object|null) => object|null|undefined} fn
 */
function withSendStatus(fn) {
  sendStatusQueue = sendStatusQueue
    .then(async () => {
      const stored = await chrome.storage.session.get(SEND_STATUS_KEY);
      const next = await fn(stored[SEND_STATUS_KEY] || null);
      if (next === undefined) return;
      await chrome.storage.session.set({ [SEND_STATUS_KEY]: next });
    })
    .catch((err) => console.warn("[Puchne] Send status update failed:", err));
  return sendStatusQueue;
}

/** Publishes a fresh all-pending status record for a new send. */
function startSendStatus(query, targets, mode, extra = {}) {
  const status = {
    id: Date.now(),
    query,
    mode,
    startedAt: Date.now(),
    ...extra,
    services: targets.map((t) => ({
      id: t.id,
      name: t.name,
      url: t.url,
      iconPath: t.iconPath,
      iconPathDark: t.iconPathDark,
      status: "pending",
    })),
  };
  return withSendStatus(() => status);
}

/** Patches one service's entry in the current status record. */
function markService(serviceId, patch) {
  return withSendStatus((status) => {
    if (!status) return undefined;
    const svc = status.services.find((s) => s.id === serviceId);
    if (!svc) return undefined;
    Object.assign(svc, patch);
    return status;
  });
}

/** Maps an injection result onto the state the user sees. */
function stateFromResult(result) {
  // needsPermission is cleared on every write: a row that failed for want of
  // access must stop offering "Grant access" once it has been granted.
  if (!result || !result.ok) {
    return { status: "failed", error: describeError(result), needsPermission: false };
  }
  // A content script that filled but was told not to submit stops at "filled".
  return {
    status: result.submitted === false ? "filled" : "submitted",
    error: null,
    needsPermission: false,
  };
}

/**
 * Marks the services Puchne isn't allowed to open. They get their own state
 * (needsPermission) so a retry doesn't pointlessly re-run a send that can
 * only be fixed by granting the site.
 * @param {Array} blocked — service definitions
 */
function markBlocked(blocked) {
  return Promise.all(
    blocked.map((service) =>
      markService(service.id, {
        status: "failed",
        needsPermission: true,
        error: `Puchne doesn't have access to ${service.name} yet.`,
      })
    )
  );
}

/**
 * Turns an internal error string into something worth showing a user —
 * a bare "timeout" next to a red badge explains nothing.
 */
function describeError(result) {
  const raw = result?.error || "Unknown error";
  if (raw === "timeout") return "Timed out — the page never responded.";
  if (raw === "frame not found") return "The embedded frame never loaded.";
  if (raw === "iframe blocked") return "This site refused to load in the grid. Open it in a tab instead.";
  if (raw.startsWith("Input not found")) return "Couldn't find the prompt box — the site's layout may have changed.";
  if (raw.includes("Could not establish connection")) return "Puchne couldn't reach the page.";
  if (raw.includes("Could not fill")) return "Found the prompt box but couldn't type into it.";
  return raw;
}


// ── Message Listener ─────────────────────────────────────────
// The popup sends { action: "multicast", query: "..." }
// We also handle { action: "getServices" } for the popup/options

// ── Sidebar Mode ─────────────────────────────────────────────
// When useSidebar is ON, clicking the icon opens the side panel
// (Chrome handles this automatically via openPanelOnActionClick).
// When OFF, the icon click fires onClicked and we toggle the overlay.

async function applySidebarMode(useSidebar) {
  if (!chrome.sidePanel?.setPanelBehavior) return; // Chrome < 116
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: !!useSidebar });
  } catch (err) {
    console.warn("[Puchne] sidePanel.setPanelBehavior failed:", err);
  }
}

// Initialize on service-worker startup
(async () => {
  await openSessionStorageToContentScripts();
  // Permissions can be revoked from Chrome's own UI while the worker is
  // asleep, so the mirror and the registered scripts are re-derived here
  // rather than trusted from the last run.
  await syncHostAccess();
  const settings = await getSettings();
  await applySidebarMode(settings.useSidebar);
})();

/**
 * Lets content scripts read storage.session. They use it to check for an
 * active session locally, so a page load on a service host doesn't have to
 * wake this worker just to be told "no session". The access level resets on
 * browser restart, hence the call on every worker startup.
 */
async function openSessionStorageToContentScripts() {
  if (!chrome.storage.session?.setAccessLevel) return; // Chrome < 102
  try {
    await chrome.storage.session.setAccessLevel({
      accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS",
    });
  } catch (err) {
    console.warn("[Puchne] storage.session setAccessLevel failed:", err);
  }
}

// Set default settings on first install
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    const settings = await getSettings();
    await chrome.storage.sync.set({ settings });
  }
  if (details.reason === "update") {
    await migrateThemeToSystem();
  }
  // activeSessionTabs used to be persisted in storage.local; drop the
  // orphaned key left behind by pre-session-storage versions.
  await chrome.storage.local.remove("activeSessionTabs");
});

/**
 * Moves existing installs onto the new "system" theme default.
 *
 * The old page wrote theme on every settings save, so nearly everyone has a
 * literal "dark" stored whether they chose it or not — storage simply cannot
 * tell a deliberate choice from a written-through default. This flips them
 * once and records that it has, so anyone who then picks light or dark keeps
 * it for good.
 */
async function migrateThemeToSystem() {
  const { themeSystemMigrated } = await chrome.storage.local.get("themeSystemMigrated");
  if (themeSystemMigrated) return;

  const stored = await chrome.storage.sync.get("settings");
  const settings = stored.settings;
  if (settings) {
    await chrome.storage.sync.set({ settings: { ...settings, theme: THEME_DEFAULT } });
  }
  await chrome.storage.local.set({ themeSystemMigrated: true });
}

// ── Tab-scoped Data Cleanup ──────────────────────────────────
// A grid tab's payload lives for as long as the tab does, so a reload
// re-renders the same layout. Drop it once the tab is gone, and drop the
// closed tab from the follow-up session list at the same time.
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(`${GRID_DATA_PREFIX}${tabId}`);
  pruneSessionTab(tabId);
});

// Tabs closed while the browser was shut down never fire onRemoved, so
// sweep any payloads whose tab no longer exists on startup.
// (activeSessionTabs needs no sweep — storage.session dies with the browser.)
chrome.runtime.onStartup.addListener(async () => {
  const all = await chrome.storage.local.get(null);
  const stale = Object.keys(all).filter((k) => k.startsWith(GRID_DATA_PREFIX));
  if (stale.length > 0) await chrome.storage.local.remove(stale);
});

// Closing a tab group fires onRemoved once per tab in quick succession, so
// serialize the read-modify-write to keep concurrent prunes from clobbering
// each other.
let sessionPruneQueue = Promise.resolve();

/**
 * Removes a closed tab from the follow-up session list so follow-ups are
 * never sent to a dead tab id. Drops the key entirely once the last
 * session tab is gone.
 * @param {number} tabId
 * @returns {Promise<void>}
 */
function pruneSessionTab(tabId) {
  sessionPruneQueue = sessionPruneQueue
    .then(async () => {
      const { activeSessionTabs } = await chrome.storage.session.get("activeSessionTabs");
      if (!activeSessionTabs) return;

      const remaining = activeSessionTabs.filter((t) => t.tabId !== tabId);
      if (remaining.length === activeSessionTabs.length) return;

      if (remaining.length === 0) {
        await chrome.storage.session.remove("activeSessionTabs");
      } else {
        await chrome.storage.session.set({ activeSessionTabs: remaining });
      }
    })
    .catch((err) => console.warn("[Puchne] Session tab prune failed:", err));
  return sessionPruneQueue;
}

// ── Action Click Listener ────────────────────────────────────
// When the extension icon is clicked, tell the content script to
// toggle the UI overlay. If the content script isn't found (e.g.
// on an already-open tab after install), we try to inject it.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  // Skip internal browser pages
  if (tab.url?.startsWith("chrome://") || tab.url?.startsWith("edge://") || tab.url?.startsWith("about:")) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { action: "toggleOverlay" }, { frameId: 0 });
  } catch (err) {
    // If connection fails, the script might not be injected yet
    if (err.message.includes("Could not establish connection")) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: CONTENT_SCRIPT_FILES
        });
        // Try again after injection
        await chrome.tabs.sendMessage(tab.id, { action: "toggleOverlay" }, { frameId: 0 });
      } catch (injectErr) {
        console.warn("[Puchne] Manual injection failed:", injectErr);
      }
    } else {
      console.error("[Puchne] Toggle overlay failed:", err);
    }
  }
});


// ── Context Menus & Selection Shortcut ───────────────────────
function setupContextMenus() {
  if (!chrome.contextMenus) return;
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "puchne-ask-selection",
      title: "Ask Puchne",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: "puchne-ask-page",
      title: "Ask Puchne",
      contexts: ["page", "frame"],
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  setupContextMenus();
});
setupContextMenus();

function formatPagePrompt(title, url, text) {
  const t = title || "this page";
  const u = url || "";
  return text
    ? `About this page (${t} - ${u}):\n\n${text}\n\nCan you summarize and explain key points from this page?`
    : `Explain this page: ${t} (${u})`;
}

async function getPagePromptText(tabId, frameId, tab) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { action: "getPageContext" }, { frameId });
    if (res) {
      return formatPagePrompt(res.title || tab.title, res.url || tab.url, res.text || "");
    }
  } catch {
    // ignore
  }
  return formatPagePrompt(tab?.title || "this page", tab?.url || "", "");
}

async function openPromptInOptionsOrWindow(promptText) {
  await chrome.storage.session.set({ pendingPrompt: promptText });
  await openOptionsPage();
}

/**
 * Entry point for both "Ask Puchne" surfaces — the context menu and the
 * selection shortcut. Settings › Ask Puchne decides which of the two shapes
 * it takes: open the panel with the text already in the box, or skip the
 * panel and deliver it straight to the chosen AI tools.
 */
async function handleAskPuchne(tab, promptText) {
  const settings = await getSettings();
  if (settings.askAction === "direct") {
    await sendPromptDirect(tab, promptText, settings);
    return;
  }
  await triggerPromptOnTab(tab, promptText, settings);
}

/**
 * The services a direct "Ask Puchne" send goes to: either an explicit set
 * picked in settings, or whatever is enabled. A custom set that has gone
 * stale (every service in it deleted) falls back to the enabled ones rather
 * than sending nowhere.
 * @param {Object} settings
 * @returns {string[]}
 */
function askTargetIds(settings) {
  if (settings.askTargetMode === "custom") {
    const registry = getRegistry(settings);
    const chosen = (settings.askTargetIds || []).filter((id) =>
      registry.some((s) => s.id === id)
    );
    if (chosen.length > 0) return chosen;
  }
  return settings.enabledServices;
}

/**
 * Sends the prompt without showing the panel. Nothing to send to, or no site
 * access at all, falls back to the panel — silently dropping the text after a
 * right-click would look like the menu item did nothing.
 */
async function sendPromptDirect(tab, promptText, settings) {
  const ids = askTargetIds(settings);
  const targets = resolveTargets(settings, ids);
  if (targets.length === 0) {
    await triggerPromptOnTab(tab, promptText, settings);
    return;
  }

  const { allowed } = await partitionTargets(targets);
  if (allowed.length === 0) {
    // Chrome only asks for sites from an extension page with a user gesture,
    // so the ask is handed to the access window and the send waits behind it.
    await openAccessWindow(ids, { query: promptText, targetIds: ids });
    return;
  }

  // The panel records every prompt it sends; a direct send never opens one,
  // so recents would quietly skip these.
  await addToHistory(promptText, settings);

  // Not awaited, for the same reason the "multicast" handler doesn't: in tab
  // mode this only settles once every tab has loaded and been injected.
  handleMulticast(promptText, ids).then(
    () => console.log("[Puchne] Ask Puchne sent directly."),
    (err) => console.warn("[Puchne] Direct Ask Puchne send failed:", err)
  );
}

/**
 * Prepends a prompt to the locally stored history, in the same shape and
 * order the panel writes (newest first, no duplicates, trimmed to the limit).
 */
async function addToHistory(query, settings) {
  if (settings.enableHistory === false) return;
  try {
    const { promptHistory } = await chrome.storage.local.get("promptHistory");
    const entries = (promptHistory || [])
      .map((h) => (typeof h === "string" ? { text: h, timestamp: Date.now() } : h))
      .filter((h) => h.text !== query);
    entries.unshift({ text: query, timestamp: Date.now() });
    await chrome.storage.local.set({
      promptHistory: entries.slice(0, settings.historyLimit || MAX_HISTORY),
    });
  } catch (err) {
    console.warn("[Puchne] Could not record prompt history:", err);
  }
}

async function triggerPromptOnTab(tab, promptText, preloadedSettings) {
  if (!tab || !tab.id) return;

  const settings = preloadedSettings || (await getSettings());
  if (settings.useSidebar && chrome.sidePanel?.open) {
    await chrome.storage.session.set({ pendingPrompt: promptText });
    try {
      await chrome.sidePanel.open({ tabId: tab.id });
      return;
    } catch (err) {
      try {
        await chrome.sidePanel.open({ windowId: tab.windowId });
        return;
      } catch (e) {
        // Fall back to overlay
      }
    }
  }

  if (tab.url?.startsWith("chrome://") || tab.url?.startsWith("edge://") || tab.url?.startsWith("about:")) {
    await openPromptInOptionsOrWindow(promptText);
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { action: "openOverlayWithPrompt", promptText }, { frameId: 0 });
  } catch (err) {
    if (err.message?.includes("Could not establish connection")) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: CONTENT_SCRIPT_FILES,
        });
        await chrome.tabs.sendMessage(tab.id, { action: "openOverlayWithPrompt", promptText }, { frameId: 0 });
      } catch (injectErr) {
        console.warn("[Puchne] Manual injection for openOverlayWithPrompt failed:", injectErr);
        await openPromptInOptionsOrWindow(promptText);
      }
    } else {
      console.error("[Puchne] openOverlayWithPrompt failed:", err);
      await openPromptInOptionsOrWindow(promptText);
    }
  }
}

if (chrome.contextMenus?.onClicked) {
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab || !tab.id) return;
    let promptText = "";
    if (info.menuItemId === "puchne-ask-selection" && info.selectionText) {
      promptText = info.selectionText.trim();
    } else if (info.menuItemId === "puchne-ask-page") {
      promptText = await getPagePromptText(tab.id, info.frameId || 0, tab);
    }
    if (!promptText) return;
    await handleAskPuchne(tab, promptText);
  });
}

if (chrome.commands?.onCommand) {
  chrome.commands.onCommand.addListener(async (command, tab) => {
    if (command === "ask-selection" && tab && tab.id) {
      let promptText = "";
      try {
        const res = await chrome.tabs.sendMessage(tab.id, { action: "getSelectionOrPage" }, { frameId: 0 });
        if (res && res.selectionText) {
          promptText = res.selectionText;
        } else if (res) {
          promptText = formatPagePrompt(res.title || tab.title, res.url || tab.url, res.text || "");
        }
      } catch (err) {
        promptText = formatPagePrompt(tab.title || "this page", tab.url || "", "");
      }
      if (promptText) {
        await handleAskPuchne(tab, promptText);
      }
    }
  });
}


chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "getServices") {
    (async () => {
      const settings = await getSettings();
      sendResponse({ services: getRegistry(settings) });
    })();
    return true;
  }

  if (message.action === "getPermissionState") {
    (async () => {
      const origins = await grantedOrigins();
      const settings = await getSettings();
      const registry = getRegistry(settings);
      sendResponse({
        grantedOrigins: origins,
        grantedIds: registry.filter((s) => isServiceGranted(s, origins)).map((s) => s.id),
      });
    })();
    return true;
  }

  // Sent by any surface that can't ask Chrome itself — the overlay and the
  // popup, from a locked chip or a send that needs a site first.
  if (message.action === "requestServiceAccess") {
    openAccessWindow(message.serviceIds, message.pendingSend).then(
      () => sendResponse({ ok: true }),
      (err) => sendResponse({ ok: false, error: err.message })
    );
    return true;
  }

  // Sent by pages/permissions.html once Chrome has confirmed the grant.
  if (message.action === "accessGranted") {
    handleAccessGranted(message.serviceIds).then(
      () => sendResponse({ ok: true }),
      (err) => sendResponse({ ok: false, error: err.message })
    );
    return true;
  }

  if (message.action === "cancelPendingSend") {
    chrome.storage.session.remove(PENDING_SEND_KEY).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.action === "setSidebarMode") {
    applySidebarMode(message.useSidebar).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.action === "multicast") {
    console.log("[Puchne] Starting multicast for query:", message.query);
    // We await this so the service worker stays alive and we can report completion
    handleMulticast(message.query).then(() => {
      console.log("[Puchne] Multicast completed.");
    });
    sendResponse({ ok: true });
    return true;
  }

  if (message.action === "followUpMulticast") {
    console.log("[Puchne] Starting follow-up multicast for query:", message.query);
    handleFollowUpMulticast(message.query, message.tabs).then(() => {
      console.log("[Puchne] Follow-up Multicast completed.");
    });
    sendResponse({ ok: true });
    return true;
  }

  if (message.action === "amIInActiveSession") {
    (async () => {
      const sessionData = await chrome.storage.session.get("activeSessionTabs");
      const activeSessionTabs = sessionData.activeSessionTabs || [];
      const senderTabId = _sender.tab?.id;
      
      const isInSession = senderTabId && activeSessionTabs.some(t => t.tabId === senderTabId);
      sendResponse({ isInSession, activeSessionTabs });
    })();
    return true;
  }

  if (message.action === "openOptions") {
    openOptionsPage().then(() => sendResponse({ ok: true }));
    return true; // keep message channel open for async sendResponse
  }

  if (message.action === "testService") {
    (async () => {
      const { url, selector, buttonSel, waitMs } = message;
      let tab;
      try {
        // Opening the tab would work without access; injecting the test into
        // it would not, so say why instead of reporting a mystery failure.
        const settings = await getSettings();
        const registry = getRegistry(settings);
        const service = registry.find((s) => s.url === url) || { name: "this custom site", url };
        if (!isServiceGranted(service, await grantedOrigins())) {
          sendResponse({ ok: false, error: `Allow access to ${service.name} first.` });
          return;
        }

        tab = await chrome.tabs.create({ url, active: false });
        await waitForTabLoad(tab.id);
        await ensureContentScript(tab.id);
        // Wait for the page's dynamic content to render (cap at 5s)
        await new Promise((r) => setTimeout(r, Math.min(waitMs || 2500, 5000)));
        const result = await new Promise((resolve) => {
          const timer = setTimeout(
            () => resolve({ ok: false, error: "timeout" }),
            10_000
          );
          chrome.tabs.sendMessage(
            tab.id,
            { action: "testSelector", selector, buttonSel, inputType: message.inputType },
            (res) => {
              clearTimeout(timer);
              if (chrome.runtime.lastError) {
                resolve({ ok: false, error: chrome.runtime.lastError.message });
              } else {
                resolve(res || { ok: false, error: "No response" });
              }
            }
          );
        });
        sendResponse(result);
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      } finally {
        if (tab?.id) {
          try { await chrome.tabs.remove(tab.id); } catch {}
        }
      }
    })();
    return true;
  }

  if (message.action === "injectGridQueries") {
    (async () => {
      try {
        const { tabId, targets, query, autoSubmit, cookieConsent, delayMs, failedIds, followUp } = message;

        // A follow-up is a new send, so it gets its own status record; the
        // initial send already has one from handleMulticast.
        if (followUp) {
          await startSendStatus(query, targets, "grid", { gridTabId: tabId });
        }

        // Cells whose iframe never loaded can't be injected into at all.
        for (const id of failedIds || []) {
          await markService(id, { status: "failed", error: describeError({ error: "iframe blocked" }) });
        }

        // Access can be revoked between opening the grid and a follow-up.
        const { allowed, blocked } = await partitionTargets(targets);
        await markBlocked(blocked);

        const results = [];
        for (const target of allowed) {
          const response = await injectIntoGridFrame(tabId, target, query, {
            autoSubmit, cookieConsent, delayMs,
          });
          console.log(`[Puchne Grid] ${target.name}:`, response);
          await markService(target.id, stateFromResult(response));
          results.push({ service: target.name, ...response });
        }

        sendResponse({ ok: true, results });
      } catch (err) {
        console.error("[Puchne Grid] injectGridQueries failed:", err);
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  // Recovery actions for a service that failed. The delivery list that used
  // to offer them is gone, so nothing calls these today — they are kept as
  // the entry points for whatever surfaces failures next.
  if (message.action === "retryService") {
    retryService(message.serviceId).then(
      (res) => sendResponse(res),
      (err) => sendResponse({ ok: false, error: err.message })
    );
    return true;
  }

  if (message.action === "openServiceTab") {
    (async () => {
      const service = AI_SERVICES.find((s) => s.id === message.serviceId);
      if (!service) { sendResponse({ ok: false, error: "unknown service" }); return; }
      await chrome.tabs.create({ url: service.url, active: true });
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message.action === "editServiceSelector") {
    (async () => {
      // The options page picks this up on load and opens that service's editor.
      await chrome.storage.local.set({ editSelectorFor: message.serviceId });
      await openOptionsPage();
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message.action === "getShortcut") {
    (async () => {
      try {
        const commands = await chrome.commands.getAll();
        const cmd = commands.find((c) => c.name === "_execute_action");
        sendResponse({ shortcut: cmd?.shortcut || "" });
      } catch (err) {
        sendResponse({ shortcut: "" });
      }
    })();
    return true;
  }
});


/**
 * Focuses the existing options tab if there is one, otherwise opens it.
 */
async function openOptionsPage() {
  const optionsUrl = chrome.runtime.getURL("pages/options.html");
  const existingTabs = await chrome.tabs.query({ url: optionsUrl });
  if (existingTabs.length > 0) {
    await chrome.tabs.update(existingTabs[0].id, { active: true });
    await chrome.windows.update(existingTabs[0].windowId, { focused: true });
  } else {
    chrome.runtime.openOptionsPage();
  }
}


/**
 * Finds the grid sub-frame hosting `target`, makes sure the content script
 * (and optionally the cookie dismisser) is in it, and fills the query.
 * Shared by the initial grid send, grid follow-ups, and retries.
 *
 * @param {number} tabId — the grid tab
 * @param {Object} target — service definition
 * @param {string} query
 * @param {{autoSubmit: boolean, cookieConsent?: string, delayMs?: number}} opts
 * @returns {Promise<{ok: boolean, filled?: boolean, submitted?: boolean, error?: string}>}
 */
async function injectIntoGridFrame(tabId, target, query, { autoSubmit, cookieConsent, delayMs }) {
  const frames = await chrome.webNavigation.getAllFrames({ tabId });
  const frame = frames.find(
    (f) => f.frameId !== 0 && f.url && f.url.startsWith(new URL(target.url).origin)
  );
  if (!frame) {
    console.warn(`[Puchne Grid] No frame found for ${target.name}`);
    return { ok: false, error: "frame not found" };
  }

  if (cookieConsent && cookieConsent !== "off") {
    try {
      // Set the mode before injecting the dismisser script
      await chrome.scripting.executeScript({
        target: { tabId, frameIds: [frame.frameId] },
        func: (mode) => { window.__promptBlastCookieMode = mode; },
        args: [cookieConsent],
      });
      await chrome.scripting.executeScript({
        target: { tabId, frameIds: [frame.frameId] },
        files: ["scripts/cookie-dismiss.js"],
      });
    } catch (err) {
      console.log(`[Puchne Grid] Cookie dismiss inject for ${target.name}:`, err.message);
    }
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frame.frameId] },
      files: CONTENT_SCRIPT_FILES,
    });
  } catch (err) {
    console.log(`[Puchne Grid] Script inject for ${target.name}:`, err.message);
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, error: "timeout" }), INJECT_TIMEOUT_MS);
    chrome.tabs.sendMessage(
      tabId,
      {
        action: "fillQuery",
        query,
        autoSubmit,
        waitMs: delayMs ?? target.waitMs,
        inputType: target.inputType,
        selector: target.selector,
        submitType: target.submitType,
        buttonSel: target.buttonSel,
      },
      { frameId: frame.frameId },
      (res) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(res || { ok: false, error: "no response" });
        }
      }
    );
  });
}


/**
 * Re-runs one service from the current send-status record. Reuses the
 * tab/frame the first attempt used when it is still around, so a retry
 * doesn't pile up duplicate tabs.
 *
 * @param {string} serviceId
 */
async function retryService(serviceId) {
  const stored = await chrome.storage.session.get(SEND_STATUS_KEY);
  const status = stored[SEND_STATUS_KEY];
  if (!status) return { ok: false, error: "Nothing to retry." };

  const entry = status.services.find((s) => s.id === serviceId);
  if (!entry) return { ok: false, error: "Unknown service." };

  const settings = await getSettings();
  const target = resolveTargets(settings, [serviceId])[0];
  if (!target) return { ok: false, error: "Unknown service." };

  // Retrying without access would just reopen the tab and fail on injection.
  if (!isServiceGranted(target, await grantedOrigins())) {
    await markBlocked([target]);
    return { ok: false, error: `No access to ${target.name}.` };
  }

  await markService(serviceId, { status: "pending", error: null, needsPermission: false });

  let result;
  try {
    if (status.mode === "grid" && status.gridTabId) {
      result = await injectIntoGridFrame(status.gridTabId, target, status.query, {
        autoSubmit: settings.autoSubmit,
        cookieConsent: "off", // consent was handled on the first pass
        delayMs: 0,
      });
    } else {
      let tabId = entry.tabId;
      if (tabId) {
        try { await chrome.tabs.get(tabId); } catch { tabId = null; }
      }
      if (!tabId) {
        const tab = await chrome.tabs.create({ url: target.url, active: false });
        tabId = tab.id;
        await markService(serviceId, { tabId });
        await waitForTabLoad(tabId);
      }
      await ensureContentScript(tabId);
      result = await injectQuery(
        tabId, target, status.query, settings.autoSubmit, settings.delayMs ?? target.waitMs
      );
    }
  } catch (err) {
    // A closed grid tab, a revoked permission — anything here has to land the
    // row back on "failed" rather than leaving it stuck showing "pending".
    result = { ok: false, error: err.message };
  }

  await markService(serviceId, stateFromResult(result));
  return result;
}


/**
 * Core function: opens tabs and dispatches the query to each
 * enabled AI service, respecting user settings.
 *
 * @param {string} query
 * @param {string[]} [ids] — an explicit service set (a direct "Ask Puchne"
 *        send uses this); defaults to the enabled services.
 */
async function handleMulticast(query, ids) {
  const settings = await getSettings();

  // Only the services the user has turned on, with custom selectors merged in
  const allTargets = resolveTargets(settings, ids);

  if (allTargets.length === 0) {
    console.warn("[Puchne] No services enabled — nothing to do.");
    return;
  }

  // The surfaces ask for access before sending, so this normally passes
  // everything through. It still matters when a permission was revoked
  // between composing and sending: those services are recorded as failed
  // rather than silently dropped, and the toolbar badge flags it.
  const { allowed: targets, blocked } = await partitionTargets(allTargets);

  if (targets.length === 0) {
    await startSendStatus(query, allTargets, settings.gridView ? "grid" : "tabs");
    await markBlocked(blocked);
    console.warn("[Puchne] No enabled service has host access — nothing sent.");
    return;
  }

  // ── Grid View mode: open all services in a single tab as iframes ──
  if (settings.gridView) {
    const gridUrl = chrome.runtime.getURL("pages/grid.html");
    const gridTab = await chrome.tabs.create({ url: gridUrl, active: true });
    await startSendStatus(query, allTargets, "grid", { gridTabId: gridTab.id });
    await markBlocked(blocked);

    // Keyed by tab id so the payload survives a reload of the grid page;
    // it is dropped again in chrome.tabs.onRemoved.
    await chrome.storage.local.set({
      [`${GRID_DATA_PREFIX}${gridTab.id}`]: {
        query,
        autoSubmit: settings.autoSubmit,
        cookieConsent: settings.cookieConsent || "accept",
        delayMs: settings.delayMs,
        targets: targets.map((t) => ({
          id: t.id,
          name: t.name,
          url: t.url,
          inputType: t.inputType,
          selector: t.selector,
          submitType: t.submitType,
          buttonSel: t.buttonSel,
          waitMs: t.waitMs,
          iconPath: t.iconPath,
          iconPathDark: t.iconPathDark,
        })),
      },
    });
    console.log("[Puchne] Opened grid view tab.");
    return;
  }

  await startSendStatus(query, allTargets, "tabs");
  await markBlocked(blocked);

  // Open all tabs in parallel for speed
  const tabPromises = targets.map((service) =>
    chrome.tabs.create({ url: service.url, active: false })
  );
  const tabs = await Promise.all(tabPromises);

  // Record which tab each service landed in, so a retry can reuse it.
  await Promise.all(tabs.map((t, i) => markService(targets[i].id, { tabId: t.id })));

  // Save active session tabs for follow-up queries. storage.session is the
  // right lifetime here: tab ids are recycled after a browser restart, so a
  // persisted list would attach the follow-up bar to unrelated tabs.
  const activeSessionTabs = tabs.map((t, idx) => ({ tabId: t.id, target: targets[idx] }));
  await chrome.storage.session.set({ activeSessionTabs });

  // Group the tabs if the setting is enabled
  if (settings.groupTabs && chrome.tabs.group) {
    try {
      const ids = tabs.map((t) => t.id);
      const groupId = await chrome.tabs.group({ tabIds: ids });
      await chrome.tabGroups.update(groupId, {
        title: "Puchne",
        color: "blue",
        collapsed: false,
      });
    } catch (err) {
      console.warn("[Puchne] Tab grouping failed:", err);
    }
  }

  // Handle tab activation & injection
  if (tabs.length > 0) {
    console.log(`[Puchne] Target services: ${targets.map(t => t.name).join(", ")}`);

    // 1. Activate the first tab immediately so the user knows work has started
    chrome.tabs.update(tabs[0].id, { active: true });

    // 2. Wake every tab before a single character is typed. Sites that only
    //    start loading once their tab is viewed — and tabs the browser has
    //    suspended — are rendered by the time step 3 goes looking for their
    //    prompt box, instead of stalling it until one of the timeouts fires.
    //    Awaited on purpose: nothing may switch tabs mid-injection.
    if (settings.cycleTabs) await cycleThroughTabs(tabs);

    // 3. Fire all injections in parallel and track their completion.
    const injectionPromises = tabs.map(async (tab, index) => {
      const service = targets[index];
      try {
        await waitForTabLoad(tab.id);
        await ensureContentScript(tab.id);
        // Trigger login check only for puchne-opened tabs, after page fully loads
        chrome.tabs.sendMessage(tab.id, { action: "checkLogin" }, () => void chrome.runtime.lastError);
        console.log(`[Puchne] Injecting into ${service.name}...`);
        const result = await injectQuery(tab.id, service, query, settings.autoSubmit, settings.delayMs ?? service.waitMs);
        await markService(service.id, stateFromResult(result));
        return result;
      } catch (err) {
        console.warn(`[Puchne] Pipeline failed for ${service.name}:`, err);
        await markService(service.id, { status: "failed", error: describeError({ error: err.message }) });
      }
    });

    // 4. Wait until every tab has finished its work (keeps the service worker alive).
    console.log("[Puchne] Waiting for all tabs to process query and submit...");
    const results = await Promise.allSettled(injectionPromises);

    // 5. Report failures via the extension badge.
    const failures = results.filter(
      (r) => r.status === "rejected" || (r.status === "fulfilled" && r.value && !r.value.ok)
    );
    if (failures.length > 0) {
      chrome.action.setBadgeText({ text: "!" });
      chrome.action.setBadgeBackgroundColor({ color: "#e74c3c" });
      setTimeout(() => chrome.action.setBadgeText({ text: "" }), 10_000);
      console.warn(`[Puchne] ${failures.length}/${results.length} service(s) failed.`);
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
    console.log("[Puchne] All background processing complete.");
  }
}


/**
 * Returns a promise that resolves once a tab reaches "complete"
 * loading status. Times out after TAB_LOAD_TIMEOUT (10s) to avoid
 * hanging forever.
 */
function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    const TIMEOUT = TAB_LOAD_TIMEOUT;
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        console.warn(`[Puchne] Tab ${tabId} load timed out after ${TIMEOUT}ms`);
        resolved = true;
        resolve();
      }
    }, TIMEOUT);

    function listener(id, changeInfo) {
      if (id === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timer);
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }
    }

    chrome.tabs.onUpdated.addListener(listener);

    chrome.tabs.get(tabId, (tab) => {
      if (resolved) return;
      // A missing tab (the user closed it mid-send) sets lastError, which has
      // to be read or Chrome logs it. Nothing is ever going to load there, so
      // resolve now instead of burning the full timeout waiting on it.
      if (chrome.runtime.lastError || !tab || tab.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timer);
        resolved = true;
        resolve();
      }
    });
  });
}


/**
 * Visits every tab Puchne opened, in the order it opened them, and lands the
 * user back on the first one.
 *
 * This runs the moment the tabs exist, before any prompt is typed into them.
 * Some AI sites only start loading their chat once the tab is actually looked
 * at, and browsers that suspend background tabs never let them get that far.
 * One visit each is enough to wake them, so injection finds a rendered page
 * with a real input box rather than a blank shell. The dwell matters: firing
 * the activations in one burst would switch away again before the page
 * painted, which is the whole point of the feature.
 *
 * Callers await this. Injection must not begin part-way through the walk, or
 * a tab would be switched away from while its editor is being filled.
 *
 * The tabs all live in the window the send started in and that window is
 * already frontmost, so activating is enough — nothing here focuses a window.
 *
 * @param {chrome.tabs.Tab[]} tabs — in creation order
 */
async function cycleThroughTabs(tabs) {
  if (!tabs || tabs.length < 2) return; // Nothing to cycle through

  console.log(`[Puchne] Cycling through ${tabs.length} tab(s)...`);
  for (const tab of tabs) {
    try {
      await chrome.tabs.update(tab.id, { active: true });
    } catch (err) {
      // The user closed this one mid-send; the rest of the cycle still stands.
      console.log(`[Puchne] Cycle skipped tab ${tab.id}:`, err.message);
      continue;
    }
    await new Promise((resolve) => setTimeout(resolve, CYCLE_DWELL_MS));
  }

  try {
    await chrome.tabs.update(tabs[0].id, { active: true });
  } catch (err) {
    console.log("[Puchne] Cycle could not return to the first tab:", err.message);
  }
  console.log("[Puchne] Tab cycle complete.");
}


/**
 * Ensures the content script is injected into a tab before messaging.
 * Silently succeeds if already injected.
 */
async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: CONTENT_SCRIPT_FILES,
    });
  } catch (err) {
    // Script already injected or tab is restricted — both are fine
    console.log(`[Puchne] ensureContentScript (tab ${tabId}):`, err.message);
  }
}


/**
 * Sends a message to the content script in `tabId` with a timeout.
 * If the content script never responds (e.g., page throttled), we
 * resolve after INJECT_TIMEOUT_MS so Promise.allSettled doesn't hang.
 */
function injectQuery(tabId, service, query, autoSubmit, waitMs) {
  // INJECT_TIMEOUT_MS is defined in constants.js

  return new Promise((resolve) => {
    // Safety timeout: resolve even if the tab never responds
    const timer = setTimeout(() => {
      console.warn(`[Puchne] ${service.name} timed out after ${INJECT_TIMEOUT_MS}ms`);
      resolve({ ok: false, error: "timeout" });
    }, INJECT_TIMEOUT_MS);

    chrome.tabs.sendMessage(
      tabId,
      {
        action: "fillQuery",
        query,
        autoSubmit,
        waitMs,
        inputType: service.inputType,
        selector: service.selector,
        submitType: service.submitType,
        buttonSel: service.buttonSel,
      },
      (response) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          console.warn(
            `[Puchne] Could not reach ${service.name}:`,
            chrome.runtime.lastError.message
          );
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          console.log(`[Puchne] ${service.name}:`, response);
          resolve(response);
        }
      }
    );
  });
}

/**
 * Sends a follow-up query to the currently active session tabs.
 */
async function handleFollowUpMulticast(query, tabsFromSender) {
  const settings = await getSettings();

  // The sender's list is a snapshot taken when its page loaded; the stored
  // session list is pruned in chrome.tabs.onRemoved, so prefer it.
  const { activeSessionTabs } = await chrome.storage.session.get("activeSessionTabs");
  const sessionTabs = activeSessionTabs?.length ? activeSessionTabs : tabsFromSender;

  if (!sessionTabs || sessionTabs.length === 0) {
    console.warn("[Puchne] No active session tabs provided for follow-up.");
    return;
  }

  // A follow-up is its own send, so it gets its own status record.
  await startSendStatus(query, sessionTabs.map((t) => t.target), "tabs");

  // A session outlives the permission that created it — access revoked in
  // between leaves the tab open but no longer injectable.
  const granted = await grantedOrigins();
  const activeTabs = sessionTabs.filter((t) => isServiceGranted(t.target, granted));
  await markBlocked(
    sessionTabs.filter((t) => !isServiceGranted(t.target, granted)).map((t) => t.target)
  );
  if (activeTabs.length === 0) {
    console.warn("[Puchne] No session tab still has host access — follow-up not sent.");
    return;
  }

  console.log(`[Puchne] Follow-up Target services: ${activeTabs.map(t => t.target.name).join(", ")}`);
  await Promise.all(activeTabs.map((t) => markService(t.target.id, { tabId: t.tabId })));

  // Activate the first tab immediately
  chrome.tabs.update(activeTabs[0].tabId, { active: true });

  const injectionPromises = activeTabs.map(async (t) => {
    try {
      await ensureContentScript(t.tabId);
      console.log(`[Puchne] Injecting follow-up into ${t.target.name}...`);
      // Use waitMs = 0 because the tabs are already loaded
      const result = await injectQuery(t.tabId, t.target, query, settings.autoSubmit, 0);
      await markService(t.target.id, stateFromResult(result));
      return result;
    } catch (err) {
      console.warn(`[Puchne] Follow-up pipeline failed for ${t.target.name}:`, err);
      await markService(t.target.id, { status: "failed", error: describeError({ error: err.message }) });
    }
  });

  console.log("[Puchne] Waiting for all tabs to process follow-up query...");
  const results = await Promise.allSettled(injectionPromises);

  const failures = results.filter(
    (r) => r.status === "rejected" || (r.status === "fulfilled" && r.value && !r.value.ok)
  );
  if (failures.length > 0) {
    chrome.action.setBadgeText({ text: "!" });
    chrome.action.setBadgeBackgroundColor({ color: "#e74c3c" });
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), 10_000);
    console.warn(`[Puchne] ${failures.length}/${results.length} follow-up service(s) failed.`);
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}
