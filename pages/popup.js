/**
 * ============================================================
 *  Puchne — Popup Script
 * ============================================================
 *
 *  Handles:
 *   - Loading the service list from background.js
 *   - Toggling individual services on/off (with persistence)
 *   - Sending the "multicast" command to background.js
 *   - Prompt history (last 5, stored locally)
 *   - Auto-submit toggle
 *   - Keyboard shortcut: Enter to send (Shift+Enter for newline)
 * ============================================================
 */

// ── DOM References ───────────────────────────────────────────
const promptInput = document.getElementById("promptInput");
const sendBtn = document.getElementById("sendBtn");
const serviceChipsEl = document.getElementById("serviceChips");
const historySection = document.getElementById("historySection");
const historyList = document.getElementById("historyList");
const settingsBtn = document.getElementById("settingsBtn");
const shortcutHint = document.getElementById("shortcutHint");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const iconMoon = document.getElementById("iconMoon");
const iconSun = document.getElementById("iconSun");

// ── State ────────────────────────────────────────────────────
let allServices = [];        // Full list from background.js
let enabledServiceIds = [];  // Which ones are currently active
let promptHistory = [];      // Last N prompts
let historyLimit = MAX_HISTORY; // Configurable cap
let enableHistory = false;   // Whether to record history
let chipDisplay = "logo-name"; // "logo-name" | "logo" | "name" | "none"
let showShortcutHint = true; // Shortcut hint visibility

// ── Initialization ───────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // 1. Fetch the service registry from background
  allServices = await getServices();

  // 2. Load saved settings
  const stored = await chrome.storage.sync.get("settings");
  const settings = stored.settings || {};
  enabledServiceIds = settings.enabledServices || ["chatgpt", "claude", "gemini"];
  applyServiceOrder(settings.serviceOrder);

  // Apply sidebar layout if the page is running in the side panel
  const isSidebar = settings.useSidebar || window.location.search.includes("mode=sidebar");
  if (isSidebar) {
    document.documentElement.dataset.mode = "sidebar";
  }
  historyLimit = settings.historyLimit || MAX_HISTORY;
  enableHistory = settings.enableHistory === true;
  chipDisplay = settings.chipDisplay || "logo-name";
  showShortcutHint = settings.showShortcutHint !== false;

  // 2b. Apply theme
  applyThemeToPage(settings.theme || "dark");
  themeToggleBtn.addEventListener("click", toggleTheme);

  // 3. Load prompt history
  const historyData = await chrome.storage.local.get("promptHistory");
  promptHistory = historyData.promptHistory || [];

  // 4. Render everything
  renderServiceChips();
  renderHistory();

  if (showShortcutHint) {
    updateShortcutHint();
  } else {
    shortcutHint.style.display = "none";
  }

  // 5. Focus the input
  promptInput.focus();
  document.body.classList.add("ready");
});


// ── Service Chips ────────────────────────────────────────────

/**
 * Sorts allServices by the user's saved drag order. Services missing from
 * the saved order (e.g. newly added ones) keep their registry position at
 * the end of the list.
 */
function applyServiceOrder(serviceOrder) {
  if (!serviceOrder) return;
  allServices.sort((a, b) => {
    const indexA = serviceOrder.indexOf(a.id);
    const indexB = serviceOrder.indexOf(b.id);
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
}

function renderServiceChips() {
  const mode = chipDisplay || "logo-name";
  serviceChipsEl.style.display = (mode === "none") ? "none" : "flex";
  serviceChipsEl.innerHTML = "";

  if (mode === "none") {
    updateSendButton();
    return;
  }

  const isDark = document.documentElement.dataset.theme === "dark";
  const showLogo = mode === "logo-name" || mode === "logo";
  const showName = mode === "logo-name" || mode === "name";

  let draggedChip = null;

  allServices.forEach((service) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.dataset.id = service.id;

    if (enabledServiceIds.includes(service.id)) {
      chip.classList.add("active");
    }

    const icon = (isDark && service.iconPathDark) ? service.iconPathDark : service.iconPath;
    chip.innerHTML = [
      showLogo ? `<img src="../${icon}" class="service-icon" />` : "",
      showName ? service.name : "",
    ].join("");
    chip.title = service.name;
    chip.addEventListener("click", () => toggleService(service.id));

    // ── Drag-to-reorder (mirrors the overlay's behaviour) ──
    chip.draggable = true;

    chip.addEventListener("dragstart", (e) => {
      draggedChip = chip;
      e.dataTransfer.setData("text/plain", service.id);
      e.dataTransfer.effectAllowed = "move";
      // setTimeout ensures the drag ghost looks normal before opacity is applied
      setTimeout(() => (chip.style.opacity = "0.5"), 0);
    });

    chip.addEventListener("dragend", () => {
      draggedChip = null;
      chip.style.opacity = "1";

      // Save the new order based on the DOM
      const newOrder = Array.from(serviceChipsEl.children).map((c) => c.dataset.id);
      allServices.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
      saveSettings();

      // Ensure no lingering inline styles
      Array.from(serviceChipsEl.children).forEach((c) => {
        c.style.transform = "";
        c.style.transition = "";
      });
    });

    chip.addEventListener("dragover", (e) => {
      e.preventDefault(); // allow drop
      e.dataTransfer.dropEffect = "move";
    });

    chip.addEventListener("dragenter", (e) => {
      e.preventDefault();
      if (!draggedChip || draggedChip === chip) return;

      const children = Array.from(serviceChipsEl.children);
      const firstRects = new Map();
      children.forEach((c) => firstRects.set(c, c.getBoundingClientRect()));

      const draggedIndex = children.indexOf(draggedChip);
      const targetIndex = children.indexOf(chip);
      if (draggedIndex < targetIndex) {
        chip.after(draggedChip);
      } else {
        chip.before(draggedChip);
      }

      // FLIP animation
      children.forEach((c) => {
        const first = firstRects.get(c);
        const last = c.getBoundingClientRect();
        const dx = first.left - last.left;
        const dy = first.top - last.top;
        if (dx === 0 && dy === 0) return;

        c.style.transition = "none";
        c.style.transform = `translate(${dx}px, ${dy}px)`;
        c.style.pointerEvents = "none";
        requestAnimationFrame(() => {
          c.style.transition = "transform 0.25s cubic-bezier(0.2, 0, 0, 1)";
          c.style.transform = "";
          setTimeout(() => (c.style.pointerEvents = ""), 250);
        });
      });
    });

    chip.addEventListener("drop", (e) => {
      e.preventDefault();
      // Reordering already happened in dragenter; dragend persists it
    });

    serviceChipsEl.appendChild(chip);
  });

  updateSendButton();
}


/**
 * Toggles a service on or off, updates the UI, and persists.
 */
function toggleService(id) {
  const index = enabledServiceIds.indexOf(id);
  if (index >= 0) {
    enabledServiceIds.splice(index, 1);
  } else {
    enabledServiceIds.push(id);
  }

  renderServiceChips();
  saveSettings();
}


// ── Prompt Submission ────────────────────────────────────────

async function handleSend() {
  const query = promptInput.value.trim();
  if (!query || enabledServiceIds.length === 0) return;

  // Disable UI to prevent double-sends
  sendBtn.disabled = true;
  promptInput.disabled = true;

  // Save auto-submit preference
  await saveSettings();

  // Save to prompt history
  addToHistory(query);

  chrome.runtime.sendMessage({ action: "multicast", query: query }, () => {
    // Close the popup after a beat if not in sidebar mode
    if (!isSidebarMode()) {
      setTimeout(() => window.close(), 300);
    } else {
      // Just reset the input
      promptInput.value = "";
      promptInput.disabled = false;
      updateSendButton();
      promptInput.focus();
    }
  });
}

function isSidebarMode() {
  return document.documentElement.dataset.mode === "sidebar";
}


// ── Event Listeners ──────────────────────────────────────────

// Send button click
sendBtn.addEventListener("click", handleSend);

// Enter to send, Shift+Enter for newline
promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

// Enable/disable send button based on input
promptInput.addEventListener("input", updateSendButton);

// Settings button opens the options page (via background, which reuses an existing tab)
settingsBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "openOptions" });
});


// ── Send Button State ────────────────────────────────────────

function updateSendButton() {
  const hasQuery = promptInput.value.trim().length > 0;
  const hasServices = enabledServiceIds.length > 0;
  sendBtn.disabled = !(hasQuery && hasServices);
}


// ── Prompt History ───────────────────────────────────────────

/**
 * Adds a prompt to history (deduplicates, caps at MAX_HISTORY).
 */
function addToHistory(query) {
  if (!enableHistory) return;
  // Remove duplicate if exists (handle both legacy string and {text} object formats)
  promptHistory = promptHistory.filter((h) =>
    typeof h === "string" ? h !== query : h.text !== query
  );
  // Add to front as {text, timestamp} object (matches overlay format)
  promptHistory.unshift({ text: query, timestamp: Date.now() });
  // Cap length
  promptHistory = promptHistory.slice(0, historyLimit);
  // Persist (don't re-render now — history updates on next popup open)
  chrome.storage.local.set({ promptHistory });
}


/**
 * Removes a single prompt from history and persists the change.
 */
function deleteFromHistory(prompt) {
  promptHistory = promptHistory.filter((h) =>
    typeof h === "string" ? h !== prompt : h.text !== prompt
  );
  chrome.storage.local.set({ promptHistory });
  renderHistory();
}


/**
 * Renders the recent prompts list. Clicking one re-fills the input;
 * the trailing button removes it.
 */
function renderHistory() {
  if (!enableHistory || promptHistory.length === 0) {
    historySection.classList.add("hidden");
    return;
  }

  historySection.classList.remove("hidden");
  historyList.innerHTML = "";

  promptHistory.forEach((entry) => {
    const prompt = typeof entry === "string" ? entry : entry.text;
    const timestamp = typeof entry === "string" ? null : entry.timestamp;

    const li = document.createElement("li");
    li.className = "history-item";
    li.title = prompt;

    const textWrapper = document.createElement("div");
    textWrapper.className = "history-item-content";
    textWrapper.addEventListener("click", () => {
      promptInput.value = prompt;
      promptInput.focus();
      updateSendButton();
    });

    const text = document.createElement("span");
    text.className = "history-item-text";
    text.textContent = prompt;
    textWrapper.appendChild(text);

    if (timestamp) {
      const time = document.createElement("span");
      time.className = "history-item-time";
      time.textContent = formatRelativeTime(timestamp);
      textWrapper.appendChild(time);
    }

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "history-delete-btn";
    deleteBtn.title = "Remove from recents";
    deleteBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteFromHistory(prompt);
    });

    li.appendChild(textWrapper);
    li.appendChild(deleteBtn);
    historyList.appendChild(li);
  });
}


// ── Persistence ──────────────────────────────────────────────

/**
 * Saves current settings to chrome.storage.sync.
 */
async function saveSettings() {
  const stored = await chrome.storage.sync.get("settings");
  const prev = stored.settings || {};
  return chrome.storage.sync.set({
    settings: {
      ...prev,
      enabledServices: enabledServiceIds,
      serviceOrder: allServices.map((s) => s.id),
      autoSubmit: prev.autoSubmit !== false,
      theme: document.documentElement.dataset.theme || "light",
    },
  });
}


/**
 * Formats a timestamp as a short relative string ("5m ago").
 */
function formatRelativeTime(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}


// ── Helpers ──────────────────────────────────────────────────

/**
 * Fetches the AI service registry from the background worker.
 */
function getServices() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "getServices" }, (response) => {
      resolve(response?.services || []);
    });
  });
}


/**
 * Reads the actual shortcut set by the user via chrome.commands
 * and updates the hint badge. Falls back to a readable default.
 */
async function updateShortcutHint() {
  try {
    const commands = await chrome.commands.getAll();
    // The _execute_action command controls the extension icon click / shortcut
    const cmd = commands.find((c) => c.name === "_execute_action");
    const shortcut = cmd?.shortcut || "";

    if (shortcut) {
      // Format: turn "Ctrl+Shift+A" into a nice display
      shortcutHint.textContent = shortcut.replace(/\+/g, " + ");
    } else {
      shortcutHint.textContent = "No shortcut set";
    }
  } catch {
    // commands API not available (shouldn't happen in MV3 popup).
    // Falls back to the manifest's suggested_key for _execute_action.
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    shortcutHint.textContent = isMac ? "⌃ ⇧ X" : "Ctrl + Shift + X";
  }

  // Make the badge clickable — open options and highlight the shortcut section
  shortcutHint.style.cursor = "pointer";
  shortcutHint.title = "Click to change shortcut";
  shortcutHint.addEventListener("click", async () => {
    // Signal the options page to highlight the shortcut section on load
    await chrome.storage.local.set({ highlightShortcut: true });
    chrome.runtime.openOptionsPage();
  });
}


// ── Theme ─────────────────────────────────────────────────────

/**
 * Applies a theme ("light" | "dark") to the popup document and
 * swaps the toggle button icon accordingly.
 */
function applyThemeToPage(theme) {
  applyTheme(document.documentElement, theme);
  if (theme === "dark") {
    iconMoon.style.display = "none";
    iconSun.style.display = "";
  } else {
    iconMoon.style.display = "";
    iconSun.style.display = "none";
  }
  renderServiceChips();
}

/**
 * Flips the current theme and persists it.
 */
async function toggleTheme() {
  const current = document.documentElement.dataset.theme || "light";
  const next = current === "dark" ? "light" : "dark";
  applyThemeToPage(next);
  // Persist alongside other settings
  const stored = await chrome.storage.sync.get("settings");
  const settings = stored.settings || {};
  await chrome.storage.sync.set({ settings: { ...settings, theme: next } });
}
