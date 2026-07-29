if (window.PuchneLoaded) {
  // Script already injected — bail out entirely to avoid duplicate
  // class definitions, listeners, and login-check overlays.
} else {
window.PuchneLoaded = true;

/**
 * ============================================================
 *  Puchne — Content Script
 * ============================================================
 *
 *  Runs on each AI website. There is no static "content_scripts"
 *  block — hosts are optional permissions, so the worker
 *  registers this script at runtime for the sites the user has
 *  allowed (registerServiceScripts) and injects it on demand
 *  everywhere else. Listens for the "fillQuery" message from
 *  the background worker, then:
 *    1. Finds the input element using the provided CSS selector
 *    2. Fills it with the user's query (handling textarea,
 *       contenteditable, and ProseMirror editors)
 *    3. Optionally submits the query (Enter key or button click)
 *
 *  Why is this complicated?
 *  ────────────────────────
 *  Modern AI chat UIs use React/Vue/Svelte with synthetic event
 *  systems. Simply setting `.value` won't trigger their state
 *  updates. We have to dispatch native DOM events so the
 *  framework "sees" the change. Contenteditable and ProseMirror
 *  editors need different handling altogether.
 * ============================================================
 */

// ── Configuration ────────────────────────────────────────────
// MAX_RETRIES, RETRY_INTERVAL, and SUBMIT_DELAY are defined in scripts/constants.js

// Last-resort selectors tried when the service's own selector finds nothing.
// Ordered from most-specific to most-generic so we grab the right element.
const GENERIC_INPUT_FALLBACKS = {
  textarea:        'textarea:not([aria-hidden="true"])',
  contenteditable: '[contenteditable="true"][role="textbox"]:not([aria-hidden="true"]), [contenteditable="true"]:not([aria-hidden="true"])',
  prosemirror:     'div.ProseMirror[contenteditable="true"], [contenteditable="true"][role="textbox"]:not([aria-hidden="true"])',
};

const GENERIC_BUTTON_FALLBACKS =
  'button[aria-label*="send" i], button[aria-label*="submit" i], [data-testid*="send"], [data-testid*="submit"]';

// ── Selection Extraction ─────────────────────────────────────
function getActiveSelectionText() {
  const activeEl = document.activeElement;
  if (
    activeEl &&
    (activeEl.tagName === "TEXTAREA" ||
      (activeEl.tagName === "INPUT" && /^(text|search|url|tel|password)$/i.test(activeEl.type))) &&
    typeof activeEl.selectionStart === "number" &&
    activeEl.selectionStart !== activeEl.selectionEnd
  ) {
    return activeEl.value.substring(activeEl.selectionStart, activeEl.selectionEnd).trim();
  }
  return (window.getSelection()?.toString() || "").trim();
}

// ── Message Listener ─────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === "getPageContext") {
      const title = document.title || "";
      const url = window.location.href || "";
      const text = (document.body?.innerText || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 2500);
      sendResponse({ title, url, text });
      return true;
    }

    if (message.action === "getSelectionOrPage") {
      const selectionText = getActiveSelectionText();
      const title = document.title || "";
      const url = window.location.href || "";
      const text = (document.body?.innerText || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 2500);
      sendResponse({ selectionText, title, url, text });
      return true;
    }

    if (message.action === "openOverlayWithPrompt") {
      if (window !== window.top) {
        sendResponse({ ok: false, error: "Not top frame" });
        return true;
      }
      openOverlayWithPrompt(message.promptText);
      sendResponse({ ok: true });
      return true;
    }

    if (message.action === "fillQuery") {
      fillAndSubmit(message)
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true; // keep the message channel open for async response
    }

    if (message.action === "toggleOverlay") {
      if (window !== window.top) {
        sendResponse({ ok: false, error: "Not top frame" });
        return true;
      }
      toggleOverlay();
      sendResponse({ ok: true });
      return true;
    }

    if (message.action === "checkLogin") {
      initLoginCheck();
      sendResponse({ ok: true });
      return true;
    }

    if (message.action === "testSelector") {
      (async () => {
        const { selector, buttonSel, inputType } = message;
        const inputEl = selector ? document.querySelector(selector) : null;
        if (!inputEl) {
          sendResponse({ ok: true, inputFound: false, buttonFound: null });
          return;
        }
        // Type a test string so button-activation logic fires
        try {
          if (inputType === "textarea") {
            fillTextarea(inputEl, "Puchne test");
          } else if (inputType === "prosemirror") {
            fillProseMirror(inputEl, "Puchne test");
          } else {
            fillContentEditable(inputEl, "Puchne test");
          }
        } catch {}
        // Give the page a moment to react (e.g. enable the send button)
        await new Promise((r) => setTimeout(r, 600));
        const buttonEl = buttonSel ? document.querySelector(buttonSel) : null;
        sendResponse({
          ok: true,
          inputFound: true,
          buttonFound: buttonSel ? !!buttonEl : null,
        });
      })();
      return true;
    }
});

// ── Overlay Implementation ───────────────────────────────────
let overlayInstance = null;

// The overlay's CSS lives in stylesheets, not JS templates: panel.css is the
// compose UI shared with the popup, overlay.css is this surface's own chrome.
// Both are fetched and parsed once per page and shared by every shadow root
// that adopts them, instead of re-parsing on each construction.
const PANEL_CSS_PATHS = ["styles/panel.css", "styles/overlay.css"];
let _panelSheetsPromise = null;

function getPanelSheets() {
  if (!_panelSheetsPromise) {
    _panelSheetsPromise = Promise.all(
      PANEL_CSS_PATHS.map(async (path) => {
        const res = await fetch(chrome.runtime.getURL(path));
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(await res.text());
        return sheet;
      })
    );
  }
  return _panelSheetsPromise;
}

/**
 * Styles a shadow root with the shared sheets. Falls back to <link> elements
 * if they can't be fetched (e.g. a host that blocks the request), so nothing
 * is ever rendered unstyled.
 * @param {ShadowRoot} shadow
 */
async function adoptPanelStyles(shadow) {
  try {
    shadow.adoptedStyleSheets = await getPanelSheets();
  } catch (err) {
    console.warn("[Puchne] Stylesheet fetch failed, linking instead:", err);
    _panelSheetsPromise = null;
    for (const path of PANEL_CSS_PATHS) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = chrome.runtime.getURL(path);
      shadow.appendChild(link);
    }
  }
}

async function toggleOverlay() {
  if (!overlayInstance) {
    overlayInstance = new PuchneOverlay();
    await overlayInstance.initPromise;
  }
  overlayInstance.toggle();
}

async function openOverlayWithPrompt(promptText) {
  if (!overlayInstance) {
    overlayInstance = new PuchneOverlay();
    await overlayInstance.initPromise;
  }
  await overlayInstance.show();
  overlayInstance.setPrompt(promptText);
}

class PuchneOverlay {
  constructor() {
    this.visible = false;
    this.container = null;
    this.shadow = null;
    this.panel = null;
    this.overlayPosition = "center";

    this.initPromise = this.init();
  }

  async init() {
    // 1. Create the backdrop container
    this.container = document.createElement("div");
    this.container.id = "prompt-blast-root";
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      z-index: 2147483647;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(4px);
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    `;

    // 2. Attach Shadow DOM and adopt the shared stylesheets
    this.shadow = this.container.attachShadow({ mode: "closed" });
    await adoptPanelStyles(this.shadow);

    // 3. Mount the shared compose panel inside this surface's modal card
    const modal = document.createElement("div");
    modal.className = "modal-container";
    this.shadow.appendChild(modal);

    this.panel = new PuchnePromptPanel({
      mount: modal,
      themeTarget: this.container,
      variant: "overlay",
      // Settings opens in another tab, so there is nothing left to look at here.
      onOpenSettings: () => this.hide(),
      // Deliberately stays open after a send, so a follow-up prompt doesn't
      // mean re-opening the overlay.
    });
    await this.panel.initPromise;

    this.applyPosition();
    this.setupListeners();

    document.body.appendChild(this.container);
  }

  /** Where the modal sits in the viewport — an overlay-only setting. */
  applyPosition() {
    if (!this.container) return;
    this.overlayPosition = this.panel?.settings?.overlayPosition || "center";
    switch (this.overlayPosition) {
      case "top":
        this.container.style.alignItems = "flex-start";
        this.container.style.paddingTop = "40px";
        this.container.style.paddingBottom = "0";
        break;
      case "bottom":
        this.container.style.alignItems = "flex-end";
        this.container.style.paddingTop = "0";
        this.container.style.paddingBottom = "40px";
        break;
      case "center":
      default:
        this.container.style.alignItems = "center";
        this.container.style.paddingTop = "0";
        this.container.style.paddingBottom = "0";
        break;
    }
  }

  setupListeners() {
    const modal = this.shadow.querySelector(".modal-container");

    // Close on backdrop click (but NOT when clicking inside the modal)
    this.container.addEventListener("click", (e) => {
      if (e.target === this.container) this.hide();
    });
    modal.addEventListener("click", (e) => e.stopPropagation());

    this.setupDrag(modal);

    // Close on Escape + focus trap within the overlay
    this.container.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        this.hide();
        return;
      }
      if (e.key === "Tab") {
        const focusable = [...this.shadow.querySelectorAll(
          'button, textarea, input, [tabindex]:not([tabindex="-1"])'
        )].filter((el) => !el.disabled && el.offsetParent !== null);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && this.shadow.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && this.shadow.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }

  /**
   * Drag-by-header, on Pointer Events rather than mouse events: one code path
   * covers mouse, touch and pen, and setPointerCapture keeps the drag alive
   * (and correctly terminated) even when the pointer leaves the window.
   * @param {HTMLElement} modal
   */
  setupDrag(modal) {
    const header = this.panel.$("panelHeader");
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;

    header.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.target.closest("button")) return;

      pointerId = e.pointerId;
      header.setPointerCapture(pointerId);
      header.classList.add("dragging");
      startX = e.clientX - currentX;
      startY = e.clientY - currentY;
      e.preventDefault();
    });

    header.addEventListener("pointermove", (e) => {
      if (pointerId === null || e.pointerId !== pointerId) return;
      currentX = e.clientX - startX;
      currentY = e.clientY - startY;
      modal.style.transform = `translate(${currentX}px, ${currentY}px)`;
    });

    const endDrag = (e) => {
      if (pointerId === null || e.pointerId !== pointerId) return;
      if (header.hasPointerCapture(pointerId)) header.releasePointerCapture(pointerId);
      header.classList.remove("dragging");
      pointerId = null;
    };

    header.addEventListener("pointerup", endDrag);
    header.addEventListener("pointercancel", endDrag);
  }

  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  async show() {
    this.visible = true;
    this.container.style.display = "flex";

    // Settings may have changed in the options page since the last open.
    await this.panel.refresh();
    this.applyPosition();

    setTimeout(() => this.panel.focusInput(), 50);
  }

  hide() {
    this.visible = false;
    this.container.style.display = "none";
  }

  setPrompt(text) {
    if (this.panel) {
      this.panel.setPrompt(text);
    }
  }
}


/**
 * Main entry point. Finds the input element (with retries),
 * fills it with the query, and optionally submits.
 *
 * @param {Object} params - Destructured from the message
 * @param {string} params.query       — The user's prompt
 * @param {string} params.inputType   — "textarea" | "contenteditable" | "prosemirror"
 * @param {string} params.selector    — CSS selector for the input
 * @param {boolean} params.autoSubmit — Whether to auto-press Enter / click Send
 * @param {string} params.submitType  — "enter" | "button" | "both"
 * @param {string} [params.buttonSel] — CSS selector for the send button
 * @param {number} [params.waitMs]    — Settle window after the input is found,
 *                                      capped at SETTLE_CAP_MS
 *
 * @returns {Promise<{ok: boolean, filled?: boolean, submitted?: boolean, error?: string}>}
 *   `filled` and `submitted` are what the worker records per service, so they
 *   distinguish "typed but never sent" from "sent".
 */
async function fillAndSubmit({
  query,
  inputType,
  selector,
  autoSubmit,
  submitType,
  buttonSel,
  waitMs = 0,
}) {
  // Step 1: Start looking for the input immediately. waitForElement is
  // MutationObserver-driven, so it resolves the moment the editor mounts —
  // sleeping waitMs first would only be dead time on top of that.
  // If the primary selector misses (site redesign), fall back to generic patterns.
  let matchedSel = selector;
  let element = await waitForElement(selector);
  if (!element) {
    const fallbackSel = GENERIC_INPUT_FALLBACKS[inputType] || GENERIC_INPUT_FALLBACKS.contenteditable;
    console.warn(`[Puchne] Primary selector failed ("${selector}"), trying generic fallback: ${fallbackSel}`);
    matchedSel = fallbackSel;
    element = await waitForElement(fallbackSel);
  }
  if (!element) {
    return { ok: false, error: `Input not found: ${selector}` };
  }

  // Step 2: Let the editor finish hydrating now that it exists. waitMs is a
  // post-detection settle capped at SETTLE_CAP_MS, not a floor before we look.
  if (waitMs > 0) {
    await sleep(Math.min(waitMs, SETTLE_CAP_MS));
    // Because we grab the editor the instant it mounts, hydration may have
    // replaced the node while we settled — re-resolve rather than fill a
    // detached element.
    if (!element.isConnected) {
      element = (await waitForElement(matchedSel)) || element;
    }
  }

  // Step 3: Focus the element (some sites need this to initialize)
  element.focus();
  await sleep(200);

  // Step 4: Fill the query based on the input type
  let filled = false;
  switch (inputType) {
    case "textarea":
      filled = fillTextarea(element, query);
      break;
    case "contenteditable":
      filled = fillContentEditable(element, query);
      break;
    case "prosemirror":
      filled = fillProseMirror(element, query);
      break;
    default:
      // Fallback: try textarea first, then contenteditable
      filled = fillTextarea(element, query) || fillContentEditable(element, query);
  }

  if (!filled) {
    return { ok: false, error: "Could not fill the input element" };
  }

  // Step 5: Submit if auto-submit is enabled
  if (!autoSubmit) {
    return { ok: true, filled: true, submitted: false };
  }

  // If we have a button selector, wait for it to be visible/enabled
  if (buttonSel && submitType !== "enter") {
    let btn = await waitForElement(buttonSel, true);
    let resolvedButtonSel = buttonSel;
    if (!btn) {
      console.warn(`[Puchne] Button selector failed ("${buttonSel}"), trying generic fallback`);
      btn = await waitForElement(GENERIC_BUTTON_FALLBACKS, true);
      resolvedButtonSel = GENERIC_BUTTON_FALLBACKS;
    }
    if (btn) {
      await sleep(SUBMIT_DELAY);
      await submit(element, submitType, resolvedButtonSel);
    } else {
      console.warn("[Puchne] Submit button NOT found after filling:", buttonSel);
      // Fallback: try enter key anyway
      await submit(element, "enter", null);
    }
  } else {
    await sleep(SUBMIT_DELAY);
    await submit(element, submitType, buttonSel);
  }

  return { ok: true, filled: true, submitted: true };
}


// ── Input Filling Strategies ─────────────────────────────────

/**
 * Fills a standard <textarea> or <input> element.
 * Uses the native setter to bypass React's synthetic event system.
 */
function fillTextarea(el, query) {
  try {
    // Use the native HTMLTextAreaElement/HTMLInputElement setter
    // so React/Vue/Angular detect the change
    const nativeSetter =
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype, "value"
      )?.set ||
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype, "value"
      )?.set;

    if (nativeSetter) {
      nativeSetter.call(el, query);
    } else {
      el.value = query;
    }

    // Dispatch events that frameworks listen for
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));

    return true;
  } catch (err) {
    console.error("[Puchne] fillTextarea failed:", err);
    return false;
  }
}


/**
 * Fills a contenteditable div (used by Claude, Gemini, etc.).
 * Sets innerHTML and fires the 'input' event so the framework
 * picks up the change.
 */
function fillContentEditable(el, query) {
  try {
    el.focus();

    // Clear existing content
    el.textContent = "";

    // Insert a text node (more reliable than innerHTML for editors)
    const textNode = document.createTextNode(query);
    el.appendChild(textNode);

    // Move cursor to end
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    // Notify the framework with multiple events
    el.dispatchEvent(new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: query,
    }));

    el.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: query,
    }));

    // Some sites also listen for 'textInput' or 'text'
    const textEvent = new CustomEvent("textInput", {
      bubbles: true,
      cancelable: true,
      detail: { data: query }
    });
    el.dispatchEvent(textEvent);

    return true;
  } catch (err) {
    console.error("[Puchne] fillContentEditable failed:", err);
    return false;
  }
}


/**
 * Fills a ProseMirror-based editor (used by ChatGPT).
 * ProseMirror doesn't respond to simple value changes;
 * we simulate keyboard input via DataTransfer.
 */
function fillProseMirror(el, query) {
  try {
    el.focus();

    // Clear existing content in a framework-friendly way
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      return fillTextarea(el, query);
    }

    // Focus and select all
    el.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    selection.removeAllRanges();
    selection.addRange(range);

    // Method 1: Use DataTransfer (clipboard-like paste)
    {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/plain", query);

      const pasteEvent = new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        inputType: "insertFromPaste",
        data: query,
        dataTransfer: dataTransfer,
      });

      el.dispatchEvent(pasteEvent);
    }

    // Method 2: Final fallback to setting text manually + events
    if (!el.textContent || el.textContent.trim() === "") {
      el.textContent = query;
      el.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: query,
      }));
    }

    return true;
  } catch (err) {
    console.error("[Puchne] fillProseMirror failed:", err);
    // Fall back to contenteditable method
    return fillContentEditable(el, query);
  }
}


// ── Submit Strategies ────────────────────────────────────────

/**
 * Submits the query using the configured strategy.
 *
 * @returns {Promise<void>} Resolves once the submit attempt has finished.
 */
async function submit(inputEl, submitType, buttonSel) {
  switch (submitType) {
    case "button":
      // Await the click (it retries for up to ~1.5s) so Enter is only used
      // as a fallback when the button truly never became clickable —
      // otherwise the prompt would be sent twice.
      if (!(await clickSubmitButton(buttonSel))) pressEnter(inputEl);
      break;
    case "both":
      await clickSubmitButton(buttonSel);
      pressEnter(inputEl);
      break;
    case "enter":
    default:
      pressEnter(inputEl);
      break;
  }
}


/**
 * Simulates pressing Enter on the given element.
 */
function pressEnter(el) {
  const keydownEvent = new KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
  });
  el.dispatchEvent(keydownEvent);

  const keypressEvent = new KeyboardEvent("keypress", {
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
  });
  el.dispatchEvent(keypressEvent);

  const keyupEvent = new KeyboardEvent("keyup", {
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
  });
  el.dispatchEvent(keyupEvent);
}


/**
 * Finds and clicks the send/submit button.
 * Retries a few times because some sites enable the button
 * only after detecting input (with a short delay).
 *
 * @returns {Promise<boolean>} True if the button was clicked, false if it
 *   never appeared/enabled within the retry window (~1.5s).
 */
async function clickSubmitButton(buttonSel) {
  if (!buttonSel) return false;

  const maxAttempts = 5;

  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    const btn = document.querySelector(buttonSel);
    if (btn && !btn.disabled) {
      btn.click();
      return true;
    }
    if (attempt < maxAttempts) await sleep(300);
  }

  return false;
}


// ── Utilities ────────────────────────────────────────────────

// Tracks all active waitForElement observers so they can be cleaned up on unload.
const _activeObservers = new Set();
window.addEventListener("pagehide", () => {
  for (const obs of _activeObservers) obs.disconnect();
  _activeObservers.clear();
}, { once: true });

/**
 * Waits for a DOM element matching `selector` to appear.
 *
 * @param {string} selector - CSS selector to wait for
 * @param {boolean} checkEnabled - If true, also ensures the element is not disabled
 * @returns {Promise<Element|null>}
 */
function waitForElement(selector, checkEnabled = false) {
  return new Promise((resolve) => {
    function getEl() {
      const el = document.querySelector(selector);
      if (el && (!checkEnabled || !el.disabled)) return el;
      return null;
    }

    // Check immediately
    const existing = getEl();
    if (existing) return resolve(existing);

    let retries = 0;

    function cleanup() {
      observer.disconnect();
      _activeObservers.delete(observer);
      clearInterval(fallback);
    }

    // MutationObserver: fast, event-driven detection
    const observer = new MutationObserver(() => {
      const el = getEl();
      if (el) {
        cleanup();
        resolve(el);
      }
    });

    _activeObservers.add(observer);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: checkEnabled,
      attributeFilter: checkEnabled ? ["disabled"] : undefined
    });

    // Fallback interval in case observer misses it
    const fallback = setInterval(() => {
      retries++;
      const el = getEl();
      if (el) {
        cleanup();
        resolve(el);
      } else if (retries >= MAX_RETRIES) {
        cleanup();
        resolve(null);
      }
    }, RETRY_INTERVAL);
  });
}


/**
 * Simple sleep utility.
 * @param {number} ms - Milliseconds to wait
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Login Detection & Notice ─────────────────────────────────

// How long the login toast stays up before dismissing itself.
const LOGIN_TOAST_MS = 12_000;

/**
 * A corner toast telling the user the current AI site needs a login.
 *
 * It is deliberately NOT a modal: the old implementation covered the whole
 * page and set document.body.style.overflow = "hidden", then restored it to
 * "" — wiping out whatever value the site had set for its own reasons. This
 * one is an inline card that never touches the host's layout or scroll
 * position, dismisses itself, and can be closed at any time.
 */
class PuchneLoginToast {
  constructor(service) {
    this.service = service;
    this.dismissTimer = null;
    this.initPromise = this.init();
  }

  async init() {
    // A zero-size fixed anchor: the toast inside it is itself position:fixed,
    // so the host page's flow and scrolling are untouched.
    this.container = document.createElement("div");
    this.container.id = "puchne-login-notice";
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 0;
      height: 0;
      z-index: 2147483646;
    `;

    this.shadow = this.container.attachShadow({ mode: "closed" });
    await adoptPanelStyles(this.shadow);

    const stored = await chrome.storage.sync.get("settings");
    this.container.dataset.theme = (stored.settings || {}).theme || "dark";

    this.shadow.appendChild(
      document.createRange().createContextualFragment(this.getHTML())
    );

    this.shadow.querySelector(".toast-close").addEventListener("click", () => this.hide());
    // Pausing on hover keeps the message readable for anyone who wants to read it.
    const card = this.shadow.querySelector(".login-toast");
    card.addEventListener("mouseenter", () => clearTimeout(this.dismissTimer));
    card.addEventListener("mouseleave", () => this.scheduleDismiss());
  }

  getHTML() {
    return `
      <div class="login-toast" role="status">
        <img class="toast-icon" src="${chrome.runtime.getURL(this.service.iconPath)}" alt="" />
        <div class="toast-body">
          <p class="toast-title">Sign in to ${this.service.name}</p>
          <p class="toast-text">Puchne can't send prompts here until you're signed in. Log in once and the next multicast will work.</p>
        </div>
        <button class="toast-close" title="Dismiss" aria-label="Dismiss">&times;</button>
      </div>
    `;
  }

  show() {
    if (!document.body.contains(this.container)) {
      document.body.appendChild(this.container);
    }
    this.scheduleDismiss();
  }

  scheduleDismiss() {
    clearTimeout(this.dismissTimer);
    this.dismissTimer = setTimeout(() => this.hide(), LOGIN_TOAST_MS);
  }

  hide() {
    clearTimeout(this.dismissTimer);
    const card = this.shadow.querySelector(".login-toast");
    if (!card) { this.container.remove(); return; }
    card.classList.add("leaving");
    card.addEventListener("animationend", () => this.container.remove(), { once: true });
  }
}

async function initLoginCheck() {
  // 1. Identify current service
  try {
    const response = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 2000);
      chrome.runtime.sendMessage({ action: "getServices" }, (res) => {
        clearTimeout(timeout);
        resolve(res);
      });
    });
    if (!response?.services) return;

    const currentHostname = window.location.hostname;
    const service = response.services.find((s) => {
      try {
        return currentHostname.includes(new URL(s.url).hostname);
      } catch {
        return false;
      }
    });

    if (!service) return;

    // 2. Wait to see if the input appears (user might be logged in).
    // Use MutationObserver so we react immediately instead of polling at fixed intervals.
    const loggedIn = await new Promise((resolve) => {
      if (document.querySelector(service.selector)) return resolve(true);
      const observer = new MutationObserver(() => {
        if (document.querySelector(service.selector)) {
          observer.disconnect();
          resolve(true);
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(false); }, 5000);
    });
    if (loggedIn) return;

    // 3. Check for login markers
    const loginMarkers = service.loginSelector ? service.loginSelector.split(',') : [];
    let loginMarkerFound = false;
    for (const sel of loginMarkers) {
      if (sel.trim() && document.querySelector(sel.trim())) {
        loginMarkerFound = true;
        break;
      }
    }

    // Secondary heuristic: look for "Log in" or "Sign in" buttons if input is missing
    if (!loginMarkerFound) {
      const loginTerms = ["log in", "sign in", "get started", "sign up"];
      const buttons = Array.from(document.querySelectorAll("button, a"));
      loginMarkerFound = buttons.some((btn) => {
        const text = btn.textContent.toLowerCase();
        return loginTerms.some((term) => text.includes(term)) && btn.offsetParent !== null; // element is visible
      });
    }

    if (loginMarkerFound) {
      const notice = new PuchneLoginToast(service);
      await notice.initPromise;
      notice.show();
    }
  } catch (err) {
    console.warn("[Puchne] Login check skip:", err);
  }
}

// Login check is triggered only by a "checkLogin" message from the background,
// which is sent exclusively to tabs opened by a Puchne search, after the page fully loads.

// ── Persistent Follow-Up Bar ─────────────────────────────────

/**
 * The persistent follow-up bar shown in every tab of an active session.
 *
 * Placement rules, learned the hard way:
 *   - It defaults to the bottom-RIGHT corner. Bottom-centre sat directly on
 *     top of ChatGPT's and Claude's own composers.
 *   - A dragged position is persisted per origin, so it stops re-centring
 *     itself on every navigation within the same site.
 *   - It collapses to a small pill in place, so hiding it no longer means a
 *     trip to the options page.
 */
class PuchneFollowUpBar {
  constructor(activeSessionTabs) {
    this.activeSessionTabs = activeSessionTabs;
    this.container = null;
    this.shadow = null;
    this.origin = window.location.origin;
    this.collapsed = false;
    this.position = null; // { left, top } once the user has dragged it
    this.init();
  }

  async init() {
    this.container = document.createElement("div");
    this.container.id = "puchne-follow-up-bar-root";
    this.container.style.cssText = `
      position: fixed;
      right: 24px;
      bottom: 24px;
      width: 520px;
      max-width: calc(100vw - 48px);
      z-index: 2147483647;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      pointer-events: none; /* Let clicks pass through outside the bar */
    `;

    this.shadow = this.container.attachShadow({ mode: "closed" });

    const stored = await chrome.storage.sync.get("settings");
    const theme = stored.settings?.theme || "dark";

    const style = document.createElement("style");
    style.textContent = this.getStyles(theme);
    this.shadow.appendChild(style);
    this.shadow.appendChild(
      document.createRange().createContextualFragment(this.getHTML())
    );

    this.setupListeners();
    this.attachToDOM();
    await this.restorePlacement();
  }

  // ── Placement persistence (per origin) ───────────────────────

  /**
   * Restores this origin's saved corner/offset and collapsed state. Anything
   * off-screen (window resized since, or a different monitor) is clamped back
   * into view rather than left unreachable.
   */
  async restorePlacement() {
    let saved = null;
    try {
      const data = await chrome.storage.local.get(FOLLOWUP_POS_KEY);
      saved = data[FOLLOWUP_POS_KEY]?.[this.origin] || null;
    } catch {
      // Storage unavailable — fall back to the default corner.
    }

    if (saved?.collapsed) this.setCollapsed(true, { persist: false });
    if (saved && typeof saved.left === "number" && typeof saved.top === "number") {
      this.position = { left: saved.left, top: saved.top };
      this.applyPosition();
    }

    window.addEventListener("resize", () => {
      if (this.position) this.applyPosition();
    });
  }

  applyPosition() {
    if (!this.position) return;
    const rect = this.container.getBoundingClientRect();
    const maxLeft = Math.max(0, window.innerWidth - rect.width);
    const maxTop = Math.max(0, window.innerHeight - rect.height);

    const left = Math.min(Math.max(0, this.position.left), maxLeft);
    const top = Math.min(Math.max(0, this.position.top), maxTop);

    this.container.style.right = "auto";
    this.container.style.bottom = "auto";
    this.container.style.left = `${left}px`;
    this.container.style.top = `${top}px`;
  }

  async savePlacement() {
    try {
      const data = await chrome.storage.local.get(FOLLOWUP_POS_KEY);
      const all = data[FOLLOWUP_POS_KEY] || {};
      all[this.origin] = { ...this.position, collapsed: this.collapsed };
      await chrome.storage.local.set({ [FOLLOWUP_POS_KEY]: all });
    } catch (err) {
      console.warn("[Puchne] Could not save follow-up bar placement:", err);
    }
  }

  // ── Collapse / expand ────────────────────────────────────────

  setCollapsed(collapsed, { persist = true } = {}) {
    this.collapsed = collapsed;
    const bar = this.shadow.getElementById("followUpForm");
    const pill = this.shadow.getElementById("followUpPill");
    if (bar) bar.classList.toggle("hidden", collapsed);
    if (pill) pill.classList.toggle("hidden", !collapsed);
    // The pill is much narrower than the bar; re-clamp so it stays on screen.
    if (this.position) requestAnimationFrame(() => this.applyPosition());
    if (persist) this.savePlacement();
  }

  attachToDOM() {
    if (!document.body.contains(this.container)) {
      document.body.appendChild(this.container);
    }

    // Set up a MutationObserver to ensure it stays in the DOM
    if (!this.observer) {
      this.observer = new MutationObserver(() => {
        if (document.body && !document.body.contains(this.container)) {
          document.body.appendChild(this.container);
        }
      });
      // Observe the whole documentElement in case the body itself gets replaced
      this.observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  getStyles(theme) {
    const isDark = theme === "dark";
    const bg = isDark ? "#3c4043" : "#e8eaed";
    const border = isDark ? "#5f6368" : "#dadce0";
    const text = isDark ? "#e8eaed" : "#202124";
    const muted = isDark ? "#9aa0a6" : "#80868b";
    const accent = "#fb923c";

    return `
      .hidden { display: none !important; }

      .follow-up-bar {
        display: flex;
        align-items: center;
        background: ${bg};
        border: 1px solid ${border};
        border-radius: 24px;
        padding: 6px 16px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        pointer-events: auto; /* Re-enable pointer events for the bar itself */
        transition: border-color 150ms ease;
      }
      .follow-up-bar:focus-within {
        border-color: ${accent};
      }
      .drag-handle {
        cursor: grab;
        padding: 4px;
        margin-right: 8px;
        margin-left: -8px;
        color: ${muted};
        opacity: 0.5;
        transition: opacity 150ms ease;
        display: flex;
        align-items: center;
        justify-content: center;
        touch-action: none; /* the pointer drag owns the gesture */
      }
      .drag-handle:hover {
        opacity: 1;
      }
      .drag-handle.dragging {
        cursor: grabbing;
        opacity: 1;
      }
      .logo {
        width: 20px;
        height: 20px;
        margin-right: 12px;
        opacity: 0.8;
      }
      .input-field {
        flex: 1;
        min-width: 0;
        background: transparent;
        border: none;
        outline: none;
        color: ${text};
        font-size: 14px;
        font-family: inherit;
      }
      .input-field::placeholder {
        color: ${muted};
      }
      .icon-btn {
        background: none;
        border: none;
        color: ${muted};
        cursor: pointer;
        padding: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: color 150ms ease, background 150ms ease;
      }
      .icon-btn:hover {
        color: ${text};
        background: rgba(128, 128, 128, 0.18);
      }
      .send-btn {
        background: none;
        border: none;
        color: ${accent};
        cursor: pointer;
        padding: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 150ms ease;
      }
      .send-btn:hover {
        transform: scale(1.1);
      }
      .send-btn.sending {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Collapsed state: a draggable pill that restores the bar on click. */
      .follow-up-pill {
        display: flex;
        align-items: center;
        gap: 6px;
        width: max-content;
        margin-left: auto;
        padding: 7px 12px;
        background: ${bg};
        border: 1px solid ${border};
        border-radius: 999px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        color: ${text};
        font-size: 13px;
        cursor: pointer;
        pointer-events: auto;
        touch-action: none;
      }
      .follow-up-pill:hover {
        border-color: ${accent};
      }
      .follow-up-pill img {
        width: 18px;
        height: 18px;
        opacity: 0.9;
      }
    `;
  }

  getHTML() {
    return `
      <form id="followUpForm" class="follow-up-bar">
        <div id="dragHandle" class="drag-handle" title="Drag to move">
          <svg width="12" height="20" viewBox="0 0 12 20" fill="currentColor">
            <circle cx="4" cy="4" r="1.5"></circle>
            <circle cx="8" cy="4" r="1.5"></circle>
            <circle cx="4" cy="10" r="1.5"></circle>
            <circle cx="8" cy="10" r="1.5"></circle>
            <circle cx="4" cy="16" r="1.5"></circle>
            <circle cx="8" cy="16" r="1.5"></circle>
          </svg>
        </div>
        <img class="logo" src="${chrome.runtime.getURL('icons/app/icon-48.png')}" alt="Puchne" title="Puchne Active Session" />
        <input type="text" id="followUpInput" class="input-field" placeholder="Ask a follow-up question to all Active AIs..." autocomplete="off">
        <button type="submit" id="sendBtn" class="send-btn" title="Send to all">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
        <button type="button" id="collapseBtn" class="icon-btn" title="Collapse to a pill">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 14 10 14 10 20"></polyline>
            <polyline points="20 10 14 10 14 4"></polyline>
          </svg>
        </button>
      </form>

      <div id="followUpPill" class="follow-up-pill hidden" title="Open the Puchne follow-up bar">
        <img src="${chrome.runtime.getURL('icons/app/icon-48.png')}" alt="" />
        <span>Follow up</span>
      </div>
    `;
  }

  setupListeners() {
    const form = this.shadow.getElementById("followUpForm");
    const input = this.shadow.getElementById("followUpInput");
    const sendBtn = this.shadow.getElementById("sendBtn");
    const collapseBtn = this.shadow.getElementById("collapseBtn");
    const pill = this.shadow.getElementById("followUpPill");

    collapseBtn.addEventListener("click", () => this.setCollapsed(true));

    // The pill is both a restore button and a drag handle, so a click only
    // expands when the pointer didn't actually travel.
    let pillDragged = false;
    pill.addEventListener("click", () => {
      if (pillDragged) { pillDragged = false; return; }
      this.setCollapsed(false);
      input.focus();
    });

    this.bindDrag(this.shadow.getElementById("dragHandle"));
    this.bindDrag(pill, () => { pillDragged = true; });

    // Stop propagation so host sites don't hijack the enter key
    input.addEventListener("keydown", (e) => e.stopPropagation());
    input.addEventListener("keyup", (e) => e.stopPropagation());
    input.addEventListener("keypress", (e) => e.stopPropagation());

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const query = input.value.trim();
      if (!query) return;

      sendBtn.disabled = true;
      sendBtn.classList.add("sending");
      input.disabled = true;

      chrome.runtime.sendMessage(
        { action: "followUpMulticast", query: query, tabs: this.activeSessionTabs },
        () => {
          void chrome.runtime.lastError;
          setTimeout(() => {
            sendBtn.classList.remove("sending");
            sendBtn.disabled = false;
            input.disabled = false;
            input.value = "";
          }, 300);
        }
      );
    });
  }

  /**
   * Pointer-Events drag with capture: works with mouse, touch and pen, and
   * survives the pointer leaving the window (which used to strand the bar
   * mid-drag with the mousemove/mouseup pair).
   * @param {HTMLElement} handle
   * @param {Function} [onMoved] — called once the drag actually travels
   */
  bindDrag(handle, onMoved) {
    let pointerId = null;
    let offsetX = 0;
    let offsetY = 0;
    let moved = false;

    handle.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();

      pointerId = e.pointerId;
      moved = false;
      handle.setPointerCapture(pointerId);
      handle.classList.add("dragging");

      const rect = this.container.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      this.position = { left: rect.left, top: rect.top };
      this.applyPosition();
    });

    handle.addEventListener("pointermove", (e) => {
      if (pointerId === null || e.pointerId !== pointerId) return;
      moved = true;
      this.position = { left: e.clientX - offsetX, top: e.clientY - offsetY };
      this.applyPosition();
    });

    const endDrag = (e) => {
      if (pointerId === null || e.pointerId !== pointerId) return;
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      handle.classList.remove("dragging");
      pointerId = null;
      if (moved) {
        onMoved?.();
        this.savePlacement();
      }
    };

    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
  }
}

// ── Initialization Check ──────────────────────────────────────
/**
 * Mounts the follow-up bar if this tab belongs to an active session.
 *
 * Reads storage.session directly first: that read is served by the browser
 * process, so an ordinary page load outside a session costs nothing. Only a
 * live session is worth waking the service worker for — the worker still has
 * the final say, since it alone knows this tab's id.
 */
async function initFollowUpBar() {
  try {
    const { activeSessionTabs } = await chrome.storage.session.get("activeSessionTabs");
    if (!activeSessionTabs?.length) return;
  } catch {
    // storage.session isn't readable here (older Chrome, or the worker hasn't
    // opened it to content scripts yet) — fall through and ask the worker.
  }

  chrome.runtime.sendMessage({ action: "amIInActiveSession" }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response && response.isInSession) {
      chrome.storage.sync.get("settings", (stored) => {
        const showFollowUpInput = stored.settings?.showFollowUpInput !== false;
        if (showFollowUpInput) {
          new PuchneFollowUpBar(response.activeSessionTabs);
        }
      });
    }
  });
}

initFollowUpBar();

} // end of PuchneLoaded guard
