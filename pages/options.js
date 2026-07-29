/**
 * ============================================================
 *  Puchne — Options Page Script
 * ============================================================
 *
 *  Manages the full settings page:
 *   - Enable/disable individual AI services
 *   - Toggle auto-submit & tab grouping
 *   - Configure page load delay
 *   - Clear history & reset defaults
 *   - Open Chrome's keyboard shortcut settings
 *
 *  All settings auto-save on change (no "Save" button needed).
 * ============================================================
 */

// ── DOM References ───────────────────────────────────────────
const serviceListEl = document.getElementById("serviceList");
const autoSubmitEl = document.getElementById("autoSubmit");
const useSidebarEl = document.getElementById("useSidebar");
const groupTabsEl = document.getElementById("groupTabs");
const delayMsEl = document.getElementById("delayMs");
const historyLimitEl = document.getElementById("historyLimit");
const clearHistoryBtn = document.getElementById("clearHistory");
const resetAllBtn = document.getElementById("resetAll");
const gridViewEl = document.getElementById("gridView");
const modeGridBtn = document.getElementById("modeGridBtn");
const modeTabsBtn = document.getElementById("modeTabsBtn");
const groupTabsRow = document.getElementById("groupTabsRow");
const openShortcutsBtn = document.getElementById("openShortcuts");
const toastEl = document.getElementById("toast");
const darkModeEl = document.getElementById("darkMode");
const showRecentsEl = document.getElementById("showRecents");
const showShortcutHintEl = document.getElementById("showShortcutHint");
const showFollowUpInputEl = document.getElementById("showFollowUpInput");
const currentShortcutBadge = document.getElementById("currentShortcutBadge");
const selectionShortcutBadge = document.getElementById("selectionShortcutBadge");
const overlayPositionEl = document.getElementById("overlayPosition");
const overlayPositionContainer = document.getElementById("overlayPositionContainer");
const overlayPositionTrigger = document.getElementById("overlayPositionTrigger");
const overlayPositionLabel = document.getElementById("overlayPositionLabel");
const overlayPositionOptions = document.getElementById("overlayPositionOptions");
const showToolNamesEl = document.getElementById("chipDisplay");
const chipDisplayContainer = document.getElementById("chipDisplayContainer");
const chipDisplayTrigger = document.getElementById("chipDisplayTrigger");
const chipDisplayLabel = document.getElementById("chipDisplayLabel");
const chipDisplayOptions = document.getElementById("chipDisplayOptions");
const hoverExpandEl        = document.getElementById("hoverExpand");
const hoverExpandRow       = document.getElementById("hoverExpandRow");
const hoverExpandMinEl        = document.getElementById("hoverExpandMin");
const hoverExpandMinRow       = document.getElementById("hoverExpandMinRow");
const hoverExpandMinContainer = document.getElementById("hoverExpandMinContainer");
const hoverExpandMinTrigger   = document.getElementById("hoverExpandMinTrigger");
const hoverExpandMinLabel     = document.getElementById("hoverExpandMinLabel");
const hoverExpandMinOptions   = document.getElementById("hoverExpandMinOptions");
const hoverExpandDelayEl      = document.getElementById("hoverExpandDelay");
const hoverExpandDelayRow     = document.getElementById("hoverExpandDelayRow");
const hoverExpandDelayContainer = document.getElementById("hoverExpandDelayContainer");
const hoverExpandDelayTrigger = document.getElementById("hoverExpandDelayTrigger");
const hoverExpandDelayLabel   = document.getElementById("hoverExpandDelayLabel");
const hoverExpandDelayOptions = document.getElementById("hoverExpandDelayOptions");
const askDirectEl = document.getElementById("askDirect");
const askPanelBtn = document.getElementById("askPanelBtn");
const askDirectBtn = document.getElementById("askDirectBtn");
const askTargetModeEl = document.getElementById("askTargetMode");
const askTargetModeRow = document.getElementById("askTargetModeRow");
const askTargetModeContainer = document.getElementById("askTargetModeContainer");
const askTargetModeTrigger = document.getElementById("askTargetModeTrigger");
const askTargetModeLabel = document.getElementById("askTargetModeLabel");
const askTargetModeOptions = document.getElementById("askTargetModeOptions");
const askTargetIdsRow = document.getElementById("askTargetIdsRow");
const askToolPickerEl = document.getElementById("askToolPicker");
const askToolPickerHintEl = document.getElementById("askToolPickerHint");
const cookieConsentEl = document.getElementById("cookieConsent");
const cookieConsentRow = document.getElementById("cookieConsentRow");
const cookieConsentContainer = document.getElementById("cookieConsentContainer");
const cookieConsentTrigger = document.getElementById("cookieConsentTrigger");
const cookieConsentLabel = document.getElementById("cookieConsentLabel");
const cookieConsentOptions = document.getElementById("cookieConsentOptions");
const mainContainer = document.querySelector(".container");
const confirmModal = document.getElementById("confirmModal");
const cancelResetBtn = document.getElementById("cancelReset");
const confirmResetBtn = document.getElementById("confirmReset");

// Preview References
const mockOverlay = document.getElementById("mockOverlay");
const mockHistory = document.getElementById("mockHistory");
const mockShortcut = document.getElementById("mockShortcut");

// Custom Provider Add Form References
const customAddNameEl = document.getElementById("customAddName");
const customAddUrlEl = document.getElementById("customAddUrl");
const customAddSelectorEl = document.getElementById("customAddSelector");
const customAddButtonSelEl = document.getElementById("customAddButtonSel");
const customAddInputTypeEl = document.getElementById("customAddInputType");
const customAddSubmitTypeEl = document.getElementById("customAddSubmitType");
const customAddTestBtn = document.getElementById("customAddTestBtn");
const customAddSubmitBtn = document.getElementById("customAddSubmitBtn");
const customAddStatusEl = document.getElementById("customAddStatus");

// ── Animated row wrappers (set up in DOMContentLoaded) ───────
let hoverExpandWrap, hoverExpandMinWrap, hoverExpandDelayWrap,
    cookieConsentWrap, groupTabsWrap, askTargetModeWrap, askTargetIdsWrap;

// ── State ────────────────────────────────────────────────────
let allServices = [];
let enabledServiceIds = [];
let customSelectors = {}; // { [serviceId]: { selector?, buttonSel? } }
let customProviders = []; // [{ id, name, url, selector, buttonSel, inputType, submitType, isCustom: true }]
// The tools a direct "Ask Puchne" send goes to, when it isn't just using
// whatever is enabled.
let askTargetIds = [];
// Services whose host permission has been granted. Puchne ships with none:
// each site is asked for the first time it is switched on. This page is a
// full tab, so it can call chrome.permissions itself rather than going
// through the access window the popup and overlay use.
let grantedIds = [];

// ── Default Settings ─────────────────────────────────────────
const DEFAULTS = {
  enabledServices: ["chatgpt", "claude", "gemini"],
  autoSubmit: true,
  useSidebar: false,
  gridView: true,
  hoverExpand: true,
  hoverExpandMin: 2,
  hoverExpandDelay: 200,
  groupTabs: false,
  delayMs: 2000,
  historyLimit: 20,
  // Prompt history is on by default: it never leaves this device, and
  // off-by-default meant most people never discovered recents at all.
  enableHistory: true,
  showRecents: true,
  showShortcutHint: true,
  showFollowUpInput: true,
  overlayPosition: "center",
  // "Ask Puchne" from the right-click menu or the selection shortcut:
  // "panel" fills the prompt box, "direct" skips it and sends.
  askAction: "panel",
  askTargetMode: "enabled",
  askTargetIds: [],
  chipDisplay: "logo-name",
  theme: "dark",
  cookieConsent: "accept",
  customSelectors: {},
  customProviders: [],
};

/**
 * Wraps a setting row in a collapsible container for smooth show/hide animation.
 * Sets no-transition initially so the page load state renders instantly.
 */
function makeCollapsible(row) {
  const wrap = document.createElement("div");
  wrap.className = "row-collapse-wrap";
  row.parentNode.insertBefore(wrap, row);
  wrap.appendChild(row);
  return wrap;
}

// ── Initialization ───────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // Wrap animated rows before any state updates so initial render is instant
  hoverExpandWrap      = makeCollapsible(hoverExpandRow);
  hoverExpandMinWrap   = makeCollapsible(hoverExpandMinRow);
  hoverExpandDelayWrap = makeCollapsible(hoverExpandDelayRow);
  cookieConsentWrap    = makeCollapsible(cookieConsentRow);
  groupTabsWrap        = makeCollapsible(groupTabsRow);
  askTargetModeWrap    = makeCollapsible(askTargetModeRow);
  askTargetIdsWrap     = makeCollapsible(askTargetIdsRow);

  // Disable transitions for initial state so page load doesn't animate
  [hoverExpandWrap, hoverExpandMinWrap, hoverExpandDelayWrap,
   cookieConsentWrap, groupTabsWrap, askTargetModeWrap,
   askTargetIdsWrap].forEach(w => w.style.transition = "none");

  // Fetch service registry from the background worker
  allServices = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "getServices" }, (res) => {
      if (chrome.runtime.lastError) { resolve([]); return; }
      resolve(res?.services || []);
    });
  });

  grantedIds = await readGrantedServiceIds();

  // Load saved settings
  const stored = await chrome.storage.sync.get("settings");
  const settings = { ...DEFAULTS, ...(stored.settings || {}) };

  enabledServiceIds = settings.enabledServices;
  customSelectors = settings.customSelectors || {};
  customProviders = settings.customProviders || [];
  autoSubmitEl.checked = settings.autoSubmit;
  useSidebarEl.checked = settings.useSidebar || false;
  updateOverlayPositionState();
  gridViewEl.checked = settings.gridView || false;
  updateModeButtons();
  hoverExpandEl.checked = settings.hoverExpand !== false;
  const savedHoverExpandMin = String(settings.hoverExpandMin ?? 2);
  hoverExpandMinEl.value = savedHoverExpandMin;
  updateHoverExpandMinLabel(savedHoverExpandMin);
  updateHoverExpandMinSelected(savedHoverExpandMin);
  const savedHoverExpandDelay = String(settings.hoverExpandDelay ?? DEFAULTS.hoverExpandDelay);
  hoverExpandDelayEl.value = savedHoverExpandDelay;
  updateHoverExpandDelayLabel(savedHoverExpandDelay);
  updateHoverExpandDelaySelected(savedHoverExpandDelay);
  groupTabsEl.checked = settings.groupTabs;
  updateGroupTabsState();
  updateHoverExpandState();
  // Cookie consent setting
  const savedCookieConsent = settings.cookieConsent || "accept";
  cookieConsentEl.value = savedCookieConsent;
  updateCookieConsentLabel(savedCookieConsent);
  updateCookieConsentSelected(savedCookieConsent);
  updateCookieConsentState();

  // Ask Puchne (context menu / selection shortcut)
  askDirectEl.checked = settings.askAction === "direct";
  askTargetIds = Array.isArray(settings.askTargetIds) ? settings.askTargetIds : [];
  const savedAskTargetMode = settings.askTargetMode || "enabled";
  askTargetModeEl.value = savedAskTargetMode;
  updateAskTargetModeLabel(savedAskTargetMode);
  updateAskTargetModeSelected(savedAskTargetMode);
  updateAskButtons();
  updateAskState();

  // Re-enable transitions after initial state is painted
  requestAnimationFrame(() => requestAnimationFrame(() => {
    [hoverExpandWrap, hoverExpandMinWrap, hoverExpandDelayWrap,
     cookieConsentWrap, groupTabsWrap, askTargetModeWrap,
     askTargetIdsWrap].forEach(w => w.style.transition = "");
  }));

  delayMsEl.value = settings.delayMs;
  historyLimitEl.value = settings.historyLimit || 20;
  showRecentsEl.checked = settings.showRecents !== false;
  showShortcutHintEl.checked = settings.showShortcutHint !== false;
  showFollowUpInputEl.checked = settings.showFollowUpInput !== false;

  // Init chipDisplay
  const savedChipDisplay = settings.chipDisplay || "logo-name";
  showToolNamesEl.value = savedChipDisplay;
  updateChipDisplayLabel(savedChipDisplay);
  // Restore overlay position separately
  overlayPositionEl.value = settings.overlayPosition || "center";
  overlayPositionLabel.textContent = settings.overlayPosition ? settings.overlayPosition.charAt(0).toUpperCase() + settings.overlayPosition.slice(1) : "Center";
  updateSelectedOption(settings.overlayPosition || "center");

  // Apply saved theme
  const savedTheme = settings.theme || "dark";
  applyTheme(document.documentElement, savedTheme);
  darkModeEl.checked = savedTheme === "dark";
  darkModeEl.addEventListener("change", () => {
    const theme = darkModeEl.checked ? "dark" : "light";
    applyTheme(document.documentElement, theme);
    renderServices();
    renderAskToolPicker();
    save();
    updatePreview();
  });


  showRecentsEl.addEventListener("change", () => {
    save();
    updatePreview();
  });
  showShortcutHintEl.addEventListener("change", () => {
    save();
    updatePreview();
  });
  showFollowUpInputEl.addEventListener("change", () => {
    save();
  });

  // Render the service list
  renderServices();

  // Attach event listeners
  autoSubmitEl.addEventListener("change", save);
  useSidebarEl.addEventListener("change", () => {
    chrome.runtime.sendMessage({ action: "setSidebarMode", useSidebar: useSidebarEl.checked });
    updateOverlayPositionState();
    save();
    updatePreview();
  });
  gridViewEl.addEventListener("change", () => {
    updateModeButtons();
    updateGroupTabsState();
    updateCookieConsentState();
    updateHoverExpandState();
    save();
  });
  modeGridBtn.addEventListener("click", () => {
    gridViewEl.checked = true;
    updateModeButtons();
    updateGroupTabsState();
    updateCookieConsentState();
    updateHoverExpandState();
    save();
  });
  modeTabsBtn.addEventListener("click", () => {
    gridViewEl.checked = false;
    updateModeButtons();
    updateGroupTabsState();
    updateCookieConsentState();
    updateHoverExpandState();
    save();
  });
  // The mode row itself is clickable (see initClickableRows), so the hidden
  // checkbox is the single place the two buttons and the row agree on.
  askDirectEl.addEventListener("change", () => {
    updateAskButtons();
    updateAskState();
    save();
  });
  askPanelBtn.addEventListener("click", () => {
    askDirectEl.checked = false;
    askDirectEl.dispatchEvent(new Event("change"));
  });
  askDirectBtn.addEventListener("click", () => {
    askDirectEl.checked = true;
    askDirectEl.dispatchEvent(new Event("change"));
  });
  hoverExpandEl.addEventListener("change", () => {
    updateHoverExpandState();
    save();
  });
  groupTabsEl.addEventListener("change", save);
  delayMsEl.addEventListener("change", save);
  historyLimitEl.addEventListener("change", save);

  clearHistoryBtn.addEventListener("click", clearHistory);
  resetAllBtn.addEventListener("click", () => showModal(true));
  cancelResetBtn.addEventListener("click", () => showModal(false));
  confirmResetBtn.addEventListener("click", performReset);
  openShortcutsBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  });

  // Init custom selects
  initCustomSelect();
  initChipDisplaySelect();
  initCookieConsentSelect();
  initHoverExpandMinSelect();
  initHoverExpandDelaySelect();
  initAskTargetModeSelect();
  initAddCustomProvider();

  // Init custom number spinners
  initNumSpinners();

  // Make setting rows clickable
  initClickableRows();

  // Initialize sidebar tabs
  initTabs();

  // Initial preview update
  updatePreview();

  // Close modal on backdrop click
  confirmModal.addEventListener("click", (e) => {
    if (e.target === confirmModal) {
      showModal(false);
    }
  });

  // Load live shortcut & check if we need to scroll+blink
  loadCurrentShortcut();
  checkShortcutHighlight();
  checkSelectorRequest();

  // Listen for re-triggering while page is already open
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.highlightShortcut?.newValue === true) {
      checkShortcutHighlight();
    }

    if (area === "local" && changes.editSelectorFor?.newValue) {
      checkSelectorRequest();
    }

    // Sync settings changed externally (e.g. from the Grid tab)
    if (area === "sync" && changes.settings) {
      const newSettings = changes.settings.newValue || {};
      const isChecked = newSettings.hoverExpand !== false;
      if (hoverExpandEl.checked !== isChecked) {
        hoverExpandEl.checked = isChecked;
        updateHoverExpandState();
      }

      // Granting a site elsewhere switches that service on; keep the
      // toggles here from drifting out of step with it.
      if (Array.isArray(newSettings.enabledServices)) {
        enabledServiceIds = newSettings.enabledServices;
        syncServiceToggles();
      }
    }
  });

  // A grant or revoke can also come from the popup's access window or from
  // Chrome's own extension menu.
  chrome.permissions.onAdded.addListener(syncAccessState);
  chrome.permissions.onRemoved.addListener(syncAccessState);
});


// ── Host Access ──────────────────────────────────────────────

/** The services whose site access is currently granted. */
async function readGrantedServiceIds() {
  const granted = await readGrantedOrigins();
  return allServices.filter((s) => isServiceGranted(s, granted)).map((s) => s.id);
}

/** Re-reads the granted set and repaints the access buttons in place. */
async function syncAccessState() {
  grantedIds = await readGrantedServiceIds();
  allServices.forEach((service) => {
    const btn = serviceListEl.querySelector(
      `.service-item[data-service-id="${service.id}"] .access-btn`
    );
    if (btn) updateAccessBtn(btn, service);
  });
  // The picker draws the same distinction, in chip form.
  renderAskToolPicker();
}

/** Mirrors enabledServiceIds onto the rendered toggles. */
function syncServiceToggles() {
  allServices.forEach((service) => {
    const checkbox = serviceListEl.querySelector(
      `.service-item[data-service-id="${service.id}"] .toggle input`
    );
    if (checkbox) checkbox.checked = enabledServiceIds.includes(service.id);
  });
}

const LOCK_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;
const CHECK_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

function updateAccessBtn(btn, service) {
  const granted = grantedIds.includes(service.id);
  btn.classList.toggle("granted", granted);
  btn.innerHTML = granted
    ? `${CHECK_ICON}<span>Allowed</span>`
    : `${LOCK_ICON}<span>Allow access</span>`;
  btn.title = granted
    ? `Puchne can use ${service.name} — click to withdraw access`
    : `Let Puchne open ${service.name} and type your prompt into it`;
}

/**
 * Asks Chrome for a service's sites. Must be called straight out of a click:
 * anything awaited first spends the user gesture and the request is refused.
 *
 * @param {Object} service
 * @param {(granted: boolean) => void} done
 */
function requestServiceAccess(service, done) {
  chrome.permissions.request({ origins: servicePatterns(service) }, (granted) => {
    if (chrome.runtime.lastError || !granted) {
      showToast(`${service.name} needs site access to be used`);
      done(false);
      return;
    }
    if (!grantedIds.includes(service.id)) grantedIds.push(service.id);
    done(true);
  });
}

/**
 * The access button: grants, or withdraws. Withdrawing also switches the
 * service off — leaving it on would only queue up failed deliveries.
 */
function toggleServiceAccess(service, checkbox, btn) {
  if (!grantedIds.includes(service.id)) {
    requestServiceAccess(service, (granted) => {
      if (!granted) return;
      updateAccessBtn(btn, service);
      checkbox.checked = true;
      toggleService(service.id, true);
      showToast(`${service.name} allowed`);
    });
    return;
  }

  chrome.permissions.remove({ origins: servicePatterns(service) }, (removed) => {
    if (chrome.runtime.lastError || !removed) {
      showToast("Chrome wouldn't withdraw that access");
      return;
    }
    grantedIds = grantedIds.filter((id) => id !== service.id);
    updateAccessBtn(btn, service);
    if (checkbox.checked) {
      checkbox.checked = false;
      toggleService(service.id, false);
    }
    showToast(`${service.name} access withdrawn`);
  });
}

function initCustomSelect() {
  overlayPositionTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    chipDisplayContainer.classList.remove("open");
    cookieConsentContainer.classList.remove("open");
    hoverExpandMinContainer.classList.remove("open");
    hoverExpandDelayContainer.classList.remove("open");
    askTargetModeContainer.classList.remove("open");
    overlayPositionContainer.classList.toggle("open");
  });

  overlayPositionOptions.querySelectorAll(".option").forEach(option => {
    option.addEventListener("click", () => {
      const val = option.getAttribute("data-value");
      overlayPositionEl.value = val;
      overlayPositionLabel.textContent = option.textContent;
      updateSelectedOption(val);
      overlayPositionContainer.classList.remove("open");
      save();
      updatePreview();
    });
  });

  window.addEventListener("click", () => {
    overlayPositionContainer.classList.remove("open");
  });
}

function updateSelectedOption(val) {
  overlayPositionOptions.querySelectorAll(".option").forEach(opt => {
    if (opt.getAttribute("data-value") === val) {
      opt.classList.add("selected");
    } else {
      opt.classList.remove("selected");
    }
  });
}

function initChipDisplaySelect() {
  chipDisplayTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    overlayPositionContainer.classList.remove("open");
    cookieConsentContainer.classList.remove("open");
    hoverExpandMinContainer.classList.remove("open");
    hoverExpandDelayContainer.classList.remove("open");
    askTargetModeContainer.classList.remove("open");
    chipDisplayContainer.classList.toggle("open");
  });

  chipDisplayOptions.querySelectorAll(".option").forEach(option => {
    option.addEventListener("click", () => {
      const val = option.getAttribute("data-value");
      showToolNamesEl.value = val;
      updateChipDisplayLabel(val);
      updateChipDisplaySelected(val);
      chipDisplayContainer.classList.remove("open");
      save();
      updatePreview();
    });
  });

  window.addEventListener("click", () => {
    chipDisplayContainer.classList.remove("open");
  });

  // Mark initial selected option
  updateChipDisplaySelected(showToolNamesEl.value || "logo-name");
}

function updateChipDisplayLabel(val) {
  const labels = { "none": "None", "logo": "Logo only", "name": "Name only", "logo-name": "Name with Logo" };
  chipDisplayLabel.textContent = labels[val] || "Name with Logo";
}

function updateChipDisplaySelected(val) {
  chipDisplayOptions.querySelectorAll(".option").forEach(opt => {
    opt.classList.toggle("selected", opt.getAttribute("data-value") === val);
  });
}

function initNumSpinners() {
  document.querySelectorAll(".num-spin").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const baseStep = parseFloat(input.step) || 1;
      const step = e.altKey ? Math.max(1, baseStep / 10)
                 : e.shiftKey ? baseStep * 10
                 : baseStep;
      const min = parseFloat(input.min);
      const max = parseFloat(input.max);
      let val = parseFloat(input.value) || 0;
      val = btn.classList.contains("up") ? val + step : val - step;
      if (!isNaN(min)) val = Math.max(min, val);
      if (!isNaN(max)) val = Math.min(max, val);
      input.value = val;
      input.dispatchEvent(new Event("change"));
    });
  });
}

function initClickableRows() {
  // Handle setting rows (Dark mode, Show recents, Auto-submit, Group tabs)
  document.querySelectorAll(".setting-row").forEach(row => {
    row.addEventListener("click", (e) => {
      const checkbox = row.querySelector('input[type="checkbox"]');
      if (!checkbox) return;
      
      // If we clicked the checkbox itself or the slider, let the browser handle it
      if (e.target.closest("input") || e.target.closest(".slider") || e.target.closest("button") || e.target.closest(".custom-select") || e.target.closest(".input-group")) {
        return;
      }

      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event("change"));
    });
  });
}


function updateModeButtons() {
  const isGrid = gridViewEl.checked;
  modeGridBtn.classList.toggle("active", isGrid);
  modeTabsBtn.classList.toggle("active", !isGrid);
}

function updateGroupTabsState() {
  groupTabsWrap.classList.toggle("collapsed", gridViewEl.checked);
}

function updateOverlayPositionState() {
  const disabled = useSidebarEl.checked;
  const row = overlayPositionContainer.closest(".setting-row");
  if (row) {
    row.style.opacity = disabled ? "0.45" : "1";
    row.style.pointerEvents = disabled ? "none" : "";
  }
}

function updateCookieConsentState() {
  cookieConsentWrap.classList.toggle("collapsed", !gridViewEl.checked);
}

function updateHoverExpandState() {
  const isGrid = gridViewEl.checked;
  hoverExpandWrap.classList.toggle("collapsed", !isGrid);

  const showSub = isGrid && hoverExpandEl.checked;
  hoverExpandMinWrap.classList.toggle("collapsed", !showSub);
  hoverExpandDelayWrap.classList.toggle("collapsed", !showSub);
}

function initHoverExpandMinSelect() {
  hoverExpandMinTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    overlayPositionContainer.classList.remove("open");
    chipDisplayContainer.classList.remove("open");
    cookieConsentContainer.classList.remove("open");
    hoverExpandDelayContainer.classList.remove("open");
    askTargetModeContainer.classList.remove("open");
    hoverExpandMinContainer.classList.toggle("open");
  });

  hoverExpandMinOptions.querySelectorAll(".option").forEach(option => {
    option.addEventListener("click", () => {
      const val = option.getAttribute("data-value");
      hoverExpandMinEl.value = val;
      updateHoverExpandMinLabel(val);
      updateHoverExpandMinSelected(val);
      hoverExpandMinContainer.classList.remove("open");
      save();
    });
  });

  window.addEventListener("click", () => {
    hoverExpandMinContainer.classList.remove("open");
  });

  updateHoverExpandMinSelected(hoverExpandMinEl.value || "2");
}

function updateHoverExpandMinLabel(val) {
  const labels = { "2": "2 or more", "3": "3 or more", "4": "4 or more" };
  hoverExpandMinLabel.textContent = labels[val] || "2 or more";
}

function updateHoverExpandMinSelected(val) {
  hoverExpandMinOptions.querySelectorAll(".option").forEach(opt => {
    opt.classList.toggle("selected", opt.getAttribute("data-value") === val);
  });
}

function initHoverExpandDelaySelect() {
  hoverExpandDelayTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    overlayPositionContainer.classList.remove("open");
    chipDisplayContainer.classList.remove("open");
    cookieConsentContainer.classList.remove("open");
    hoverExpandMinContainer.classList.remove("open");
    askTargetModeContainer.classList.remove("open");
    hoverExpandDelayContainer.classList.toggle("open");
  });

  hoverExpandDelayOptions.querySelectorAll(".option").forEach(option => {
    option.addEventListener("click", () => {
      const val = option.getAttribute("data-value");
      hoverExpandDelayEl.value = val;
      updateHoverExpandDelayLabel(val);
      updateHoverExpandDelaySelected(val);
      hoverExpandDelayContainer.classList.remove("open");
      save();
    });
  });

  window.addEventListener("click", () => {
    hoverExpandDelayContainer.classList.remove("open");
  });

  updateHoverExpandDelaySelected(hoverExpandDelayEl.value || "0");
}

function updateHoverExpandDelayLabel(val) {
  const labels = {
    "0": "Instant (0s)",
    "200": "0.2 seconds",
    "500": "0.5 seconds",
    "1000": "1.0 second",
    "1500": "1.5 seconds",
    "2000": "2.0 seconds"
  };
  hoverExpandDelayLabel.textContent = labels[val] || "1.5 seconds";
}

function updateHoverExpandDelaySelected(val) {
  hoverExpandDelayOptions.querySelectorAll(".option").forEach(opt => {
    opt.classList.toggle("selected", opt.getAttribute("data-value") === val);
  });
}

function initCookieConsentSelect() {
  cookieConsentTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    overlayPositionContainer.classList.remove("open");
    chipDisplayContainer.classList.remove("open");
    hoverExpandMinContainer.classList.remove("open");
    hoverExpandDelayContainer.classList.remove("open");
    askTargetModeContainer.classList.remove("open");
    cookieConsentContainer.classList.toggle("open");
  });

  cookieConsentOptions.querySelectorAll(".option").forEach(option => {
    option.addEventListener("click", () => {
      const val = option.getAttribute("data-value");
      cookieConsentEl.value = val;
      updateCookieConsentLabel(val);
      updateCookieConsentSelected(val);
      cookieConsentContainer.classList.remove("open");
      save();
    });
  });

  window.addEventListener("click", () => {
    cookieConsentContainer.classList.remove("open");
  });

  updateCookieConsentSelected(cookieConsentEl.value || "accept");
}

function updateCookieConsentLabel(val) {
  const labels = { "accept": "Accept All", "reject": "Reject All", "off": "Off (Manual)" };
  cookieConsentLabel.textContent = labels[val] || "Accept All";
}

function updateCookieConsentSelected(val) {
  cookieConsentOptions.querySelectorAll(".option").forEach(opt => {
    opt.classList.toggle("selected", opt.getAttribute("data-value") === val);
  });
}

// ── Ask Puchne (context menu / selection shortcut) ───────────

function updateAskButtons() {
  const isDirect = askDirectEl.checked;
  askDirectBtn.classList.toggle("active", isDirect);
  askPanelBtn.classList.toggle("active", !isDirect);
}

/**
 * "Send to" only means anything for a direct send, and the tool picker only
 * for a direct send aimed at a specific set — so each row follows the one
 * above it.
 */
function updateAskState() {
  const isDirect = askDirectEl.checked;
  askTargetModeWrap.classList.toggle("collapsed", !isDirect);

  const showPicker = isDirect && askTargetModeEl.value === "custom";
  askTargetIdsWrap.classList.toggle("collapsed", !showPicker);
  if (showPicker) renderAskToolPicker();
}

function initAskTargetModeSelect() {
  askTargetModeTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    overlayPositionContainer.classList.remove("open");
    chipDisplayContainer.classList.remove("open");
    cookieConsentContainer.classList.remove("open");
    hoverExpandMinContainer.classList.remove("open");
    hoverExpandDelayContainer.classList.remove("open");
    askTargetModeContainer.classList.toggle("open");
  });

  askTargetModeOptions.querySelectorAll(".option").forEach(option => {
    option.addEventListener("click", () => {
      const val = option.getAttribute("data-value");
      askTargetModeEl.value = val;
      updateAskTargetModeLabel(val);
      updateAskTargetModeSelected(val);
      askTargetModeContainer.classList.remove("open");
      updateAskState();
      save();
    });
  });

  window.addEventListener("click", () => {
    askTargetModeContainer.classList.remove("open");
  });

  updateAskTargetModeSelected(askTargetModeEl.value || "enabled");
}

function updateAskTargetModeLabel(val) {
  const labels = { "enabled": "Enabled tools", "custom": "Specific tools" };
  askTargetModeLabel.textContent = labels[val] || "Enabled tools";
}

function updateAskTargetModeSelected(val) {
  askTargetModeOptions.querySelectorAll(".option").forEach(opt => {
    opt.classList.toggle("selected", opt.getAttribute("data-value") === val);
  });
}

/**
 * Renders one chip per AI tool. A tool Puchne has no site access to is drawn
 * dashed and asks for that access when picked — sending to it would fail
 * otherwise, and the right-click menu has no surface to explain why.
 */
function renderAskToolPicker() {
  askToolPickerEl.innerHTML = "";

  if (allServices.length === 0) {
    const empty = document.createElement("p");
    empty.className = "tool-picker-hint";
    empty.textContent = "No AI tools available yet — add one under AI Tools.";
    askToolPickerEl.appendChild(empty);
    updateAskPickerHint();
    return;
  }

  const isDark = document.documentElement.dataset.theme === "dark";

  allServices.forEach((service) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "tool-chip";
    chip.dataset.serviceId = service.id;

    const picked = askTargetIds.includes(service.id);
    const granted = grantedIds.includes(service.id);
    chip.classList.toggle("active", picked);
    chip.classList.toggle("needs-access", !granted);
    chip.title = granted
      ? service.name
      : `${service.name} — picking it asks for site access first`;

    const icon = (isDark && service.iconPathDark) ? service.iconPathDark : service.iconPath;
    chip.innerHTML = `
      <img src="../${icon}" class="tool-chip-icon" alt="" />
      <span>${service.name}</span>
      ${granted ? "" : `<svg class="tool-chip-lock" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`}
    `;

    chip.addEventListener("click", () => {
      if (askTargetIds.includes(service.id)) {
        askTargetIds = askTargetIds.filter((id) => id !== service.id);
        renderAskToolPicker();
        save();
        return;
      }

      // Straight out of the click — anything awaited first spends the user
      // gesture and Chrome refuses the request.
      if (!grantedIds.includes(service.id)) {
        requestServiceAccess(service, (granted) => {
          if (!granted) return;
          askTargetIds.push(service.id);
          syncAccessState();
          renderAskToolPicker();
          save();
        });
        return;
      }

      askTargetIds.push(service.id);
      renderAskToolPicker();
      save();
    });

    askToolPickerEl.appendChild(chip);
  });

  updateAskPickerHint();
}

/** Says what a send will actually do when nothing has been picked. */
function updateAskPickerHint() {
  const nothingPicked = askTargetIds.filter((id) =>
    allServices.some((s) => s.id === id)
  ).length === 0;
  askToolPickerHintEl.textContent = nothingPicked
    ? "Nothing picked yet — sends go to your enabled AI tools until you choose."
    : "";
}


// ── Service List Rendering ───────────────────────────────────

function renderServices() {
  serviceListEl.innerHTML = "";

  allServices.forEach((service) => {
    const item = document.createElement("div");
    item.className = "service-item";
    item.dataset.serviceId = service.id;

    // ── Main row ──────────────────────────────────────────────
    const row = document.createElement("div");
    row.className = "service-row";

    const info = document.createElement("div");
    info.className = "service-info";
    const isDark = document.documentElement.dataset.theme === "dark";
    const icon = (isDark && service.iconPathDark) ? service.iconPathDark : service.iconPath;
    const customBadgeHtml = service.isCustom ? `<span class="custom-badge">CUSTOM</span>` : "";
    info.innerHTML = `
      <img src="../${icon}" class="service-icon" />
      <div>
        <p class="name">${service.name} ${customBadgeHtml}</p>
        <p class="url">${service.url}</p>
      </div>
    `;

    const controls = document.createElement("div");
    controls.className = "service-controls";

    // Expand / selector-editor toggle button
    const expandBtn = document.createElement("button");
    expandBtn.className = "expand-btn";
    expandBtn.title = "Custom CSS selectors";
    expandBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`;
    const hasCustom = customSelectors[service.id] &&
      (customSelectors[service.id].selector || customSelectors[service.id].buttonSel);
    if (hasCustom || service.isCustom) expandBtn.classList.add("has-custom");

    // Site access, granted per service the first time it is used.
    const accessBtn = document.createElement("button");
    accessBtn.className = "access-btn";
    updateAccessBtn(accessBtn, service);

    const toggle = document.createElement("label");
    toggle.className = "toggle";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = enabledServiceIds.includes(service.id);
    checkbox.addEventListener("change", () => {
      // Switching a service on is the moment its site access is worth
      // asking for. It stays off until Chrome says yes.
      if (checkbox.checked && !grantedIds.includes(service.id)) {
        checkbox.checked = false;
        requestServiceAccess(service, (granted) => {
          if (!granted) return;
          checkbox.checked = true;
          updateAccessBtn(accessBtn, service);
          toggleService(service.id, true);
        });
        return;
      }
      toggleService(service.id, checkbox.checked);
    });
    const slider = document.createElement("span");
    slider.className = "slider";
    toggle.appendChild(checkbox);
    toggle.appendChild(slider);

    accessBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleServiceAccess(service, checkbox, accessBtn);
    });

    controls.appendChild(accessBtn);
    controls.appendChild(expandBtn);
    controls.appendChild(toggle);
    row.appendChild(info);
    row.appendChild(controls);

    // Row click expands/collapses the selector editor (not expand btn or toggle)
    row.addEventListener("click", (e) => {
      if (e.target.closest(".toggle") || e.target.closest(".expand-btn")) return;
      const isOpen = editor.classList.toggle("open");
      expandBtn.classList.toggle("open", isOpen);
    });

    // ── Selector editor (collapsible) ─────────────────────────
    const editor = document.createElement("div");
    editor.className = "selector-editor";

    const editorFooter = document.createElement("div");
    editorFooter.className = "selector-editor-footer";

    const testBtn = document.createElement("button");
    testBtn.className = "selector-test-btn";
    testBtn.textContent = "Test service";
    testBtn.title = "Open the service in a background tab and check if selectors resolve";
    testBtn.addEventListener("click", () => runServiceTest(service, editor, testBtn));

    const editorInner = document.createElement("div");
    editorInner.className = "selector-editor-inner";

    if (service.isCustom) {
      const nameField = document.createElement("div");
      nameField.className = "selector-field";
      nameField.innerHTML = `
        <label for="sel-name-${service.id}">Name</label>
        <input class="selector-input" id="sel-name-${service.id}" type="text" value="${escapeAttr(service.name)}" />
      `;
      const urlField = document.createElement("div");
      urlField.className = "selector-field";
      urlField.innerHTML = `
        <label for="sel-url-${service.id}">URL</label>
        <input class="selector-input" id="sel-url-${service.id}" type="url" value="${escapeAttr(service.url)}" />
      `;
      const rowTop = document.createElement("div");
      rowTop.className = "custom-form-row";
      rowTop.appendChild(nameField);
      rowTop.appendChild(urlField);

      const inputField = document.createElement("div");
      inputField.className = "selector-field";
      inputField.innerHTML = `
        <label for="sel-input-${service.id}">Input selector</label>
        <input class="selector-input" id="sel-input-${service.id}" type="text" value="${escapeAttr(service.selector || '')}" />
      `;
      const btnField = document.createElement("div");
      btnField.className = "selector-field";
      btnField.innerHTML = `
        <label for="sel-btn-${service.id}">Submit button selector <span class="optional-tag">(optional)</span></label>
        <input class="selector-input" id="sel-btn-${service.id}" type="text" value="${escapeAttr(service.buttonSel || '')}" />
      `;
      const rowMiddle = document.createElement("div");
      rowMiddle.className = "custom-form-row";
      rowMiddle.appendChild(inputField);
      rowMiddle.appendChild(btnField);

      const typeField = document.createElement("div");
      typeField.className = "selector-field";
      typeField.innerHTML = `
        <label for="sel-type-${service.id}">Input Type</label>
        <select class="selector-input" id="sel-type-${service.id}">
          <option value="textarea" ${service.inputType === 'textarea' ? 'selected' : ''}>Textarea</option>
          <option value="contenteditable" ${service.inputType === 'contenteditable' ? 'selected' : ''}>Contenteditable</option>
          <option value="prosemirror" ${service.inputType === 'prosemirror' ? 'selected' : ''}>ProseMirror</option>
        </select>
      `;
      const submitField = document.createElement("div");
      submitField.className = "selector-field";
      submitField.innerHTML = `
        <label for="sel-submit-${service.id}">Submit Type</label>
        <select class="selector-input" id="sel-submit-${service.id}">
          <option value="auto">Auto</option>
          <option value="enter" ${service.submitType === 'enter' ? 'selected' : ''}>Simulate Enter Key</option>
          <option value="button" ${service.submitType === 'button' ? 'selected' : ''}>Click Submit Button</option>
          <option value="both" ${service.submitType === 'both' ? 'selected' : ''}>Both (Button + Enter)</option>
        </select>
      `;
      const rowBottom = document.createElement("div");
      rowBottom.className = "custom-form-row";
      rowBottom.appendChild(typeField);
      rowBottom.appendChild(submitField);

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "selector-delete-btn";
      deleteBtn.textContent = "Delete provider";
      deleteBtn.addEventListener("click", () => deleteCustomProvider(service.id));

      editorFooter.appendChild(testBtn);
      editorFooter.appendChild(deleteBtn);

      editorInner.appendChild(rowTop);
      editorInner.appendChild(rowMiddle);
      editorInner.appendChild(rowBottom);
      editorInner.appendChild(editorFooter);
      editor.appendChild(editorInner);

      editor.querySelectorAll(".selector-input").forEach((inp) => {
        inp.addEventListener("change", () => {
          updateCustomProvider(service.id, editor);
        });
      });
    } else {
      const custom = customSelectors[service.id] || {};

      const inputField = document.createElement("div");
      inputField.className = "selector-field";
      inputField.innerHTML = `
        <label for="sel-input-${service.id}">Input selector</label>
        <input class="selector-input" id="sel-input-${service.id}" type="text"
          placeholder="${escapeAttr(service.selector)}"
          value="${escapeAttr(custom.selector || '')}" />
      `;

      const btnField = document.createElement("div");
      btnField.className = "selector-field";
      btnField.innerHTML = `
        <label for="sel-btn-${service.id}">Submit button selector</label>
        <input class="selector-input" id="sel-btn-${service.id}" type="text"
          placeholder="${escapeAttr(service.buttonSel || 'Not applicable')}"
          value="${escapeAttr(custom.buttonSel || '')}" />
      `;

      const resetLink = document.createElement("button");
      resetLink.className = "selector-reset";
      resetLink.textContent = "Reset to defaults";
      resetLink.addEventListener("click", () => {
        delete customSelectors[service.id];
        editor.querySelector(`#sel-input-${service.id}`).value = "";
        editor.querySelector(`#sel-btn-${service.id}`).value = "";
        expandBtn.classList.remove("has-custom");
        save();
      });

      editorFooter.appendChild(testBtn);
      editorFooter.appendChild(resetLink);

      editorInner.appendChild(inputField);
      editorInner.appendChild(btnField);
      editorInner.appendChild(editorFooter);
      editor.appendChild(editorInner);

      editor.querySelector(`#sel-input-${service.id}`).addEventListener("change", () => {
        updateCustomSelector(service.id, editor, expandBtn);
      });
      editor.querySelector(`#sel-btn-${service.id}`).addEventListener("change", () => {
        updateCustomSelector(service.id, editor, expandBtn);
      });
    }

    // Expand button toggles the editor panel
    expandBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = editor.classList.toggle("open");
      expandBtn.classList.toggle("open", isOpen);
    });

    item.appendChild(row);
    item.appendChild(editor);
    serviceListEl.appendChild(item);
  });
}

/**
 * Reads custom selector inputs for a service, updates state, and saves.
 */
function updateCustomSelector(serviceId, editor, expandBtn) {
  const selectorVal = editor.querySelector(`#sel-input-${serviceId}`).value.trim();
  const buttonSelVal = editor.querySelector(`#sel-btn-${serviceId}`).value.trim();

  if (selectorVal || buttonSelVal) {
    customSelectors[serviceId] = {};
    if (selectorVal) customSelectors[serviceId].selector = selectorVal;
    if (buttonSelVal) customSelectors[serviceId].buttonSel = buttonSelVal;
    expandBtn.classList.add("has-custom");
  } else {
    delete customSelectors[serviceId];
    expandBtn.classList.remove("has-custom");
  }
  save();
}

/**
 * Opens the service in a background tab, checks that the configured
 * selectors resolve, then closes the tab and reports the result.
 */
async function runServiceTest(service, editor, btn) {
  const selectorVal =
    editor.querySelector(`#sel-input-${service.id}`).value.trim() ||
    service.selector;
  const buttonSelVal =
    editor.querySelector(`#sel-btn-${service.id}`).value.trim() ||
    service.buttonSel || "";

  const urlVal = editor.querySelector(`#sel-url-${service.id}`)?.value?.trim() || service.url;
  const inputTypeVal = editor.querySelector(`#sel-type-${service.id}`)?.value || service.inputType;

  btn.disabled = true;
  btn.className = "selector-test-btn loading";
  btn.textContent = "Testing…";

  let result;
  try {
    result = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: "testService",
          url: urlVal,
          selector: selectorVal,
          buttonSel: buttonSelVal,
          inputType: inputTypeVal,
          waitMs: service.waitMs,
        },
        (res) => {
          if (chrome.runtime.lastError) { resolve({ ok: false, error: chrome.runtime.lastError.message }); return; }
          resolve(res);
        }
      );
    });
  } catch (err) {
    result = { ok: false, error: err.message };
  }

  if (result?.inputFound) {
    btn.className = "selector-test-btn success";
    if (buttonSelVal && result.buttonFound === false) {
      btn.textContent = "Input ✓  Button ✗";
    } else if (buttonSelVal && result.buttonFound) {
      btn.textContent = "Input ✓  Button ✓";
    } else {
      btn.textContent = "Input found ✓";
    }
  } else {
    btn.className = "selector-test-btn failure";
    const fullError = result?.error || "Not found";
    const msg = fullError.length > 60 ? fullError.slice(0, 57) + "..." : fullError;
    btn.textContent = `✗ ${msg}`;
    btn.title = fullError;
  }

  setTimeout(() => {
    btn.disabled = false;
    btn.className = "selector-test-btn";
    btn.textContent = "Test service";
  }, 4000);
}

function updateCustomProvider(serviceId, editor) {
  const provider = customProviders.find((p) => p.id === serviceId);
  if (!provider) return;
  const nameVal = editor.querySelector(`#sel-name-${serviceId}`)?.value?.trim();
  const urlVal = editor.querySelector(`#sel-url-${serviceId}`)?.value?.trim();
  const inputSelVal = editor.querySelector(`#sel-input-${serviceId}`)?.value?.trim();
  const btnSelVal = editor.querySelector(`#sel-btn-${serviceId}`)?.value?.trim();
  const inputTypeVal = editor.querySelector(`#sel-type-${serviceId}`)?.value;
  const submitTypeVal = editor.querySelector(`#sel-submit-${serviceId}`)?.value;

  if (nameVal) provider.name = nameVal;
  if (urlVal) provider.url = urlVal;
  if (inputSelVal !== undefined) provider.selector = inputSelVal;
  if (btnSelVal !== undefined) provider.buttonSel = btnSelVal;
  if (inputTypeVal) provider.inputType = inputTypeVal;
  if (submitTypeVal) {
    provider.submitType = submitTypeVal === "auto" ? (btnSelVal ? "button" : "enter") : submitTypeVal;
  }
  save();
}

async function deleteCustomProvider(serviceId) {
  customProviders = customProviders.filter((p) => p.id !== serviceId);
  enabledServiceIds = enabledServiceIds.filter((id) => id !== serviceId);
  askTargetIds = askTargetIds.filter((id) => id !== serviceId);
  delete customSelectors[serviceId];
  await _doSave();
  allServices = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "getServices" }, (res) => {
      resolve(res?.services || []);
    });
  });
  renderServices();
  renderAskToolPicker();
  showToast("Custom provider deleted");
}

function initAddCustomProvider() {
  if (!customAddSubmitBtn) return;

  const addRowEl = document.getElementById("customAddRow");
  const addToggleBtn = document.getElementById("customAddToggleBtn");
  const addExpandBtn = document.getElementById("customAddExpandBtn");
  const addEditorEl = document.getElementById("customAddEditor");

  const toggleOpen = () => {
    if (!addEditorEl) return;
    const isOpen = addEditorEl.classList.toggle("open");
    if (addExpandBtn) addExpandBtn.classList.toggle("open", isOpen);
  };

  if (addRowEl) {
    addRowEl.addEventListener("click", (e) => {
      if (e.target.closest("#customAddEditor")) return;
      toggleOpen();
    });
  }
  if (addToggleBtn) {
    addToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleOpen();
    });
  }
  if (addExpandBtn) {
    addExpandBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleOpen();
    });
  }

  customAddTestBtn.addEventListener("click", async () => {
    const urlVal = customAddUrlEl.value.trim();
    const selectorVal = customAddSelectorEl.value.trim();
    const buttonSelVal = customAddButtonSelEl.value.trim();
    const inputTypeVal = customAddInputTypeEl.value || "textarea";

    if (!urlVal || !selectorVal) {
      setAddStatus("Please enter URL and Input CSS Selector first.", "error");
      return;
    }

    customAddTestBtn.disabled = true;
    customAddTestBtn.className = "selector-test-btn loading";
    customAddTestBtn.textContent = "Testing…";
    setAddStatus("Opening page in background tab to test selectors...", "");

    let result;
    try {
      result = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            action: "testService",
            url: urlVal,
            selector: selectorVal,
            buttonSel: buttonSelVal,
            inputType: inputTypeVal,
            waitMs: 2500,
          },
          (res) => {
            if (chrome.runtime.lastError) { resolve({ ok: false, error: chrome.runtime.lastError.message }); return; }
            resolve(res);
          }
        );
      });
    } catch (err) {
      result = { ok: false, error: err.message };
    }

    customAddTestBtn.disabled = false;
    if (result?.inputFound) {
      customAddTestBtn.className = "selector-test-btn success";
      if (buttonSelVal && result.buttonFound === false) {
        customAddTestBtn.textContent = "Input ✓ Button ✗";
        setAddStatus("Input selector found, but submit button selector was not found on page.", "error");
      } else if (buttonSelVal && result.buttonFound) {
        customAddTestBtn.textContent = "Input ✓ Button ✓";
        setAddStatus("Success: both input and submit button found on page!", "success");
      } else {
        customAddTestBtn.textContent = "Input found ✓";
        setAddStatus("Success: input selector found on page!", "success");
      }
    } else {
      customAddTestBtn.className = "selector-test-btn failure";
      customAddTestBtn.textContent = "Test failed";
      setAddStatus(result?.error ? `Test failed: ${result.error}` : "Input selector not found on page.", "error");
    }
  });

  customAddSubmitBtn.addEventListener("click", async () => {
    const nameVal = customAddNameEl.value.trim();
    const urlVal = customAddUrlEl.value.trim();
    const selectorVal = customAddSelectorEl.value.trim();
    const buttonSelVal = customAddButtonSelEl.value.trim();
    const inputTypeVal = customAddInputTypeEl.value || "textarea";
    const submitTypeChoice = customAddSubmitTypeEl.value || "auto";

    if (!nameVal) {
      setAddStatus("Please provide a name for the provider.", "error");
      customAddNameEl.focus();
      return;
    }
    if (!urlVal) {
      setAddStatus("Please provide a URL for the chat interface.", "error");
      customAddUrlEl.focus();
      return;
    }
    if (!selectorVal) {
      setAddStatus("Please provide a CSS selector for the input element.", "error");
      customAddSelectorEl.focus();
      return;
    }

    try {
      new URL(urlVal);
    } catch {
      setAddStatus("Please enter a valid URL (e.g. https://chat.mistral.ai/chat).", "error");
      customAddUrlEl.focus();
      return;
    }

    const submitTypeVal = submitTypeChoice === "auto" ? (buttonSelVal ? "button" : "enter") : submitTypeChoice;
    const newId = "custom_" + Date.now().toString(36);
    const newProvider = {
      id: newId,
      name: nameVal,
      url: urlVal,
      selector: selectorVal,
      buttonSel: buttonSelVal,
      inputType: inputTypeVal,
      submitType: submitTypeVal,
      waitMs: 2500,
      iconPath: "icons/services/custom.svg",
      iconPathDark: "icons/services/custom.svg",
      isCustom: true,
    };

    customProviders.push(newProvider);
    await _doSave();

    // Reload allServices registry from background
    allServices = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "getServices" }, (res) => {
        resolve(res?.services || []);
      });
    });

    // Clear form fields and close editor
    customAddNameEl.value = "";
    customAddUrlEl.value = "";
    customAddSelectorEl.value = "";
    customAddButtonSelEl.value = "";
    customAddInputTypeEl.value = "textarea";
    customAddSubmitTypeEl.value = "auto";
    setAddStatus("", "");
    addEditorEl?.classList.remove("open");
    addExpandBtn?.classList.remove("open");

    // Ask for host access immediately for a seamless UX
    requestServiceAccess(newProvider, (granted) => {
      if (granted && !enabledServiceIds.includes(newId)) {
        enabledServiceIds.push(newId);
        save();
      }
      renderServices();
      renderAskToolPicker();
      showToast(`Added ${nameVal}`);
    });
  });
}

function setAddStatus(msg, type) {
  if (!customAddStatusEl) return;
  customAddStatusEl.textContent = msg;
  customAddStatusEl.className = "custom-form-status" + (type ? " " + type : "");
}


/**
 * Escapes a string for use in an HTML attribute value.
 */
function escapeAttr(str) {
  return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}


/**
 * Toggle a service and save immediately.
 */
function toggleService(id, enabled) {
  if (enabled && !enabledServiceIds.includes(id)) {
    enabledServiceIds.push(id);
  } else if (!enabled) {
    enabledServiceIds = enabledServiceIds.filter((s) => s !== id);
  }
  save();
}


// ── Persistence ──────────────────────────────────────────────

let _saveTimer;

/**
 * Debounced entry point — batches rapid successive saves into one
 * chrome.storage.sync.set call after a short idle period.
 */
function save() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_doSave, 300);
}

/**
 * Performs the actual write to chrome.storage.sync and trims history.
 */
async function _doSave() {
  // Keys this page doesn't own (serviceOrder, set by chip drag-and-drop in
  // the overlay and popup) must survive the write.
  const stored = await chrome.storage.sync.get("settings");

  const settings = {
    ...(stored.settings || {}),
    enabledServices: enabledServiceIds,
    autoSubmit: autoSubmitEl.checked,
    useSidebar: useSidebarEl.checked,
    gridView: gridViewEl.checked,
    hoverExpand: hoverExpandEl.checked,
    hoverExpandMin: parseInt(hoverExpandMinEl.value, 10) || 2,
    hoverExpandDelay: isNaN(parseInt(hoverExpandDelayEl.value, 10)) ? 0 : parseInt(hoverExpandDelayEl.value, 10),
    groupTabs: groupTabsEl.checked,
    delayMs: parseInt(delayMsEl.value, 10) || DEFAULTS.delayMs,
    historyLimit: parseInt(historyLimitEl.value, 10) || DEFAULTS.historyLimit,
    enableHistory: showRecentsEl.checked,
    showRecents: showRecentsEl.checked,
    theme: darkModeEl.checked ? "dark" : "light",
    showShortcutHint: showShortcutHintEl.checked,
    showFollowUpInput: showFollowUpInputEl.checked,
    overlayPosition: overlayPositionEl.value,
    askAction: askDirectEl.checked ? "direct" : "panel",
    askTargetMode: askTargetModeEl.value || "enabled",
    askTargetIds,
    chipDisplay: showToolNamesEl.value,
    cookieConsent: cookieConsentEl.value || "accept",
    customSelectors,
    customProviders,
  };

  await chrome.storage.sync.set({ settings });

  // Trim stored history to the new limit immediately
  const historyData = await chrome.storage.local.get("promptHistory");
  const history = historyData.promptHistory || [];
  if (history.length > settings.historyLimit) {
    await chrome.storage.local.set({
      promptHistory: history.slice(0, settings.historyLimit),
    });
  }

  showToast("Settings saved");
}


/**
 * Clears the prompt history from local storage.
 */
async function clearHistory() {
  await chrome.storage.local.remove("promptHistory");
  showToast("History cleared");
}


/**
 * Shows or hides the reset confirmation modal.
 */
function showModal(show) {
  if (show) {
    confirmModal.classList.add("show");
  } else {
    confirmModal.classList.remove("show");
  }
}

/**
 * Resets all settings to defaults and refreshes the page.
 */
async function performReset() {
  showModal(false);
  
  await chrome.storage.sync.set({ settings: DEFAULTS });
  await chrome.storage.local.remove("promptHistory");
  showToast("All settings reset");
  setTimeout(() => location.reload(), 800);
}


// ── Toast ────────────────────────────────────────────────────

let toastTimer;

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove("show");
  }, 2000);
}


// ── Shortcut Helpers ─────────────────────────────────────────

/**
 * Reads the actual shortcut registered in Chrome and populates
 * the badge in the Keyboard Shortcut section.
 */
async function loadCurrentShortcut() {
  try {
    const commands = await chrome.commands.getAll();
    const cmd = commands.find((c) => c.name === "_execute_action");
    const selCmd = commands.find((c) => c.name === "ask-selection");
    if (currentShortcutBadge) {
      currentShortcutBadge.textContent = cmd?.shortcut ? cmd.shortcut.replace(/\+/g, " + ") : "Not set";
    }
    if (selectionShortcutBadge) {
      selectionShortcutBadge.textContent = selCmd?.shortcut ? selCmd.shortcut.replace(/\+/g, " + ") : "Not set";
    }
  } catch {
    if (currentShortcutBadge) currentShortcutBadge.textContent = "Unavailable";
    if (selectionShortcutBadge) selectionShortcutBadge.textContent = "Unavailable";
  }
}


/**
 * Checks whether the popup asked us to highlight the shortcut section.
 * If it did, scroll to it, animate a 1-second blink, then clear the flag.
 */
async function checkShortcutHighlight() {
  const data = await chrome.storage.local.get("highlightShortcut");
  if (!data.highlightShortcut) return;

  // Clear the flag immediately so it doesn't re-trigger on refresh
  await chrome.storage.local.remove("highlightShortcut");

  // Activate the shortcut tab so the user can see the highlight
  switchTab("shortcut");
  history.pushState(null, null, "#shortcut");

  const section = document.getElementById("section-shortcut");
  if (!section) return;

  // Scroll the section into view, centered
  section.scrollIntoView({ behavior: "smooth", block: "center" });

  // Wait for scroll to settle, then blink
  setTimeout(() => {
    section.classList.remove("highlight-blink"); // Force reset
    void section.offsetWidth; // Trigger reflow
    section.classList.add("highlight-blink");
    
    // Remove the class after animation so it can replay if triggered again
    section.addEventListener("animationend", () => {
      section.classList.remove("highlight-blink");
    }, { once: true });
  }, 400);
}

/**
 * Handles an "edit this service's selector" deep link: opens that service's
 * selector editor, scrolls to it and flashes it, so the user lands on the
 * exact field to fix rather than on the settings page in general.
 */
async function checkSelectorRequest() {
  const data = await chrome.storage.local.get("editSelectorFor");
  const serviceId = data.editSelectorFor;
  if (!serviceId) return;

  // Clear the flag immediately so it doesn't re-trigger on refresh
  await chrome.storage.local.remove("editSelectorFor");

  switchTab("tools");
  history.pushState(null, null, "#tools");

  const item = serviceListEl.querySelector(`.service-item[data-service-id="${serviceId}"]`);
  if (!item) return;

  item.querySelector(".selector-editor")?.classList.add("open");
  item.querySelector(".expand-btn")?.classList.add("open");
  item.scrollIntoView({ behavior: "smooth", block: "center" });

  // Wait for the scroll to settle, then blink and focus the input selector
  setTimeout(() => {
    item.classList.remove("highlight-blink"); // Force reset
    void item.offsetWidth;                    // Trigger reflow
    item.classList.add("highlight-blink");
    item.addEventListener("animationend", () => {
      item.classList.remove("highlight-blink");
    }, { once: true });
    item.querySelector(".selector-input")?.focus();
  }, 400);
}

function switchTab(tabId) {
  // Update nav buttons active class
  document.querySelectorAll(".nav-item").forEach(item => {
    if (item.getAttribute("data-target") === tabId) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  // Update content sections active class
  document.querySelectorAll(".settings-content .section").forEach(sec => {
    if (sec.id === `section-${tabId}`) {
      sec.classList.add("active");
    } else {
      sec.classList.remove("active");
    }
  });
}

function initTabs() {
  const navItems = document.querySelectorAll(".nav-item");
  
  navItems.forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const tabId = item.getAttribute("data-target");
      switchTab(tabId);
      // Update hash without jumping
      history.pushState(null, null, "#" + tabId);
    });
  });

  // Handle back/forward buttons or hash change
  window.addEventListener("hashchange", () => {
    const hash = window.location.hash.substring(1);
    if (hash && ["tools", "appearance", "behavior", "ask", "shortcut", "maintenance"].includes(hash)) {
      switchTab(hash);
    }
  });

  // Check initial hash
  const initialHash = window.location.hash.substring(1);
  if (initialHash && ["tools", "appearance", "behavior", "ask", "shortcut", "maintenance"].includes(initialHash)) {
    switchTab(initialHash);
  } else {
    switchTab("tools");
  }
}

function applyNonSidebarPosition() {
  const pos = overlayPositionEl.value || "center";
  const previewBox = mockOverlay.parentElement;
  const boxH = previewBox ? previewBox.clientHeight : 240;
  const overlayH = mockOverlay.offsetHeight;

  switch (pos) {
    case "top":
      mockOverlay.style.top = "20px";
      mockOverlay.style.transform = "translateY(0)";
      break;
    case "center":
      mockOverlay.style.top = "50%";
      mockOverlay.style.transform = "translateY(-50%)";
      break;
    case "bottom":
      mockOverlay.style.top = (boxH - overlayH - 20) + "px";
      mockOverlay.style.transform = "translateY(0)";
      break;
  }
}

function updatePreview() {
  if (!mockOverlay) return;

  const isDark = darkModeEl.checked;
  const isSidebar = useSidebarEl.checked;

  if (isSidebar) {
    // Cancel any in-progress exit animation
    mockOverlay.classList.remove("sidebar-exiting", "overlay-entering");
    // Sidebar mode: dock to the right edge, full height
    // CSS @keyframes mock-sidebar-in handles the slide-in animation
    mockOverlay.classList.add("sidebar-mode");
    mockOverlay.style.top = "";
    mockOverlay.style.transform = "";
  } else if (mockOverlay.classList.contains("sidebar-mode")) {
    // Slide the sidebar panel out, then restore floating position
    mockOverlay.classList.add("sidebar-exiting");
    mockOverlay.addEventListener("animationend", () => {
      // Bail if sidebar was re-enabled while animation was running
      if (useSidebarEl.checked) return;
      mockOverlay.classList.remove("sidebar-mode", "sidebar-exiting");
      applyNonSidebarPosition();
      // Fade the floating card back in
      mockOverlay.classList.add("overlay-entering");
      mockOverlay.addEventListener("animationend", () => {
        mockOverlay.classList.remove("overlay-entering");
      }, { once: true });
    }, { once: true });
  } else {
    // Already in non-sidebar mode — just reposition
    applyNonSidebarPosition();
  }

  // History
  mockHistory.classList.toggle("collapsed", !showRecentsEl.checked);

  // Shortcut Hint
  if (mockShortcut) {
    mockShortcut.parentElement.classList.toggle("collapsed", !showShortcutHintEl.checked);
  }

  // Chip Display
  const chipMode = showToolNamesEl.value || "logo-name";
  const mockChipsContainer = mockOverlay.querySelector(".mock-chips");
  const mockChips = mockOverlay.querySelectorAll(".mock-chip");
  
  if (mockChipsContainer) {
    mockChipsContainer.classList.toggle("collapsed", chipMode === "none");
  }

  mockChips.forEach(chip => {
    const chipText = chip.querySelector(".chip-text");
    const icon = chip.querySelector(".mock-service-icon");
    if (chipMode === "logo") {
      if (chipText) chipText.style.display = "none";
      if (icon) icon.style.display = "block";
      chip.style.width = "";
      chip.style.height = "";
      chip.style.padding = "";
      chip.style.borderRadius = "";
    } else if (chipMode === "name") {
      if (chipText) chipText.style.display = "inline";
      if (icon) icon.style.display = "none";
      chip.style.width = "";
      chip.style.height = "";
      chip.style.padding = "";
      chip.style.borderRadius = "";
    } else if (chipMode === "logo-name") {
      if (chipText) chipText.style.display = "inline";
      if (icon) icon.style.display = "block";
      chip.style.width = "";
      chip.style.height = "";
      chip.style.padding = "";
      chip.style.borderRadius = "";
    }
  });

  // Dynamic ChatGPT icon for theme consistency
  const chatgptMockIcon = mockOverlay.querySelector("img[src*='chatgpt']");
  if (chatgptMockIcon) {
    chatgptMockIcon.src = isDark ? "../icons/services/chatgpt_light.png" : "../icons/services/chatgpt_dark.png";
  }

  // Theme
  mockOverlay.style.background = isDark ? "#202124" : "#ffffff";
  mockOverlay.style.color = isDark ? "#e8eaed" : "#202124";
  mockOverlay.style.borderColor = isDark ? "#3c4043" : "#dadce0";
}
