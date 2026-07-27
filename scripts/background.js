// Import shared constants (must be first statement in MV3 service worker).
// Use an extension-root-absolute path ("/scripts/...") so resolution does not
// depend on the worker's subfolder location.
importScripts("/scripts/constants.js");

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
    delayMs: 2000,
    enableHistory: true,
    showRecents: true,
    showFollowUpInput: true,
    customSelectors: {},
  };

  const stored = await chrome.storage.sync.get("settings");
  return { ...defaults, ...(stored.settings || {}) };
}


/**
 * Resolves service definitions by id, merging in the user's custom selectors.
 * @param {Object} settings
 * @param {string[]} [ids] — defaults to the enabled set
 * @returns {Array} service definitions ready to inject with
 */
function resolveTargets(settings, ids) {
  const wanted = new Set(ids || settings.enabledServices);
  return AI_SERVICES
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


// ── Delivery Status ──────────────────────────────────────────
// The popup, side panel and overlay all render the same per-service
// delivery list. It lives in storage.session (it is meaningless after a
// browser restart) and is published here as each service progresses, so
// the surfaces just subscribe rather than each tracking their own copy.

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
  if (!result || !result.ok) {
    return { status: "failed", error: describeError(result) };
  }
  // A content script that filled but was told not to submit stops at "filled".
  return { status: result.submitted === false ? "filled" : "submitted", error: null };
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
  // activeSessionTabs used to be persisted in storage.local; drop the
  // orphaned key left behind by pre-session-storage versions.
  await chrome.storage.local.remove("activeSessionTabs");
});

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
          files: ["scripts/constants.js", "scripts/prompt-panel.js", "scripts/content.js"]
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


chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "getServices") {
    // Return the full service registry so popup/options can render it
    sendResponse({ services: AI_SERVICES });
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

        const results = [];
        for (const target of targets) {
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
      files: ["scripts/constants.js", "scripts/prompt-panel.js", "scripts/content.js"],
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
 * Re-runs one service from the current delivery status — the "Retry" action
 * on a failed row. Reuses the tab/frame the first attempt used when it is
 * still around, so a retry doesn't pile up duplicate tabs.
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

  await markService(serviceId, { status: "pending", error: null });

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
 */
async function handleMulticast(query) {
  const settings = await getSettings();

  // Only the services the user has turned on, with custom selectors merged in
  const targets = resolveTargets(settings);

  if (targets.length === 0) {
    console.warn("[Puchne] No services enabled — nothing to do.");
    return;
  }

  // ── Grid View mode: open all services in a single tab as iframes ──
  if (settings.gridView) {
    const gridUrl = chrome.runtime.getURL("pages/grid.html");
    const gridTab = await chrome.tabs.create({ url: gridUrl, active: true });
    await startSendStatus(query, targets, "grid", { gridTabId: gridTab.id });

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

  await startSendStatus(query, targets, "tabs");

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

    // 2. Fire all injections in parallel and track their completion.
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
 * loading status. Times out after 30s to avoid hanging forever.
 */
function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    const TIMEOUT = TAB_LOAD_TIMEOUT;
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        console.warn(`[Puchne] Tab ${tabId} load timed out after 10s`);
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
      if (tab?.status === "complete" && !resolved) {
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timer);
        resolved = true;
        resolve();
      }
    });
  });
}


/**
 * Ensures the content script is injected into a tab before messaging.
 * Silently succeeds if already injected.
 */
async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["scripts/constants.js", "scripts/prompt-panel.js", "scripts/content.js"],
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
  const activeTabs = activeSessionTabs?.length ? activeSessionTabs : tabsFromSender;

  if (!activeTabs || activeTabs.length === 0) {
    console.warn("[Puchne] No active session tabs provided for follow-up.");
    return;
  }

  console.log(`[Puchne] Follow-up Target services: ${activeTabs.map(t => t.target.name).join(", ")}`);

  // A follow-up is its own send, so it gets its own status record.
  await startSendStatus(query, activeTabs.map((t) => t.target), "tabs");
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
