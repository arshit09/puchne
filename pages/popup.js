/**
 * ============================================================
 *  Puchne — Popup / Side Panel Host
 * ============================================================
 *
 *  The compose UI is PuchnePromptPanel (scripts/prompt-panel.js),
 *  shared with the in-page overlay. This file is only the host:
 *  it mounts the panel, adds the theme toggle that belongs to
 *  this surface, and applies side-panel layout mode.
 * ============================================================
 */

const ICON_MOON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
</svg>`;

const ICON_SUN = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="5"/>
  <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
  <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
</svg>`;

let panel = null;

document.addEventListener("DOMContentLoaded", async () => {
  const stored = await chrome.storage.sync.get("settings");
  const settings = stored.settings || {};

  // Side panel and popup share this page; only the layout differs.
  if (settings.useSidebar || window.location.search.includes("mode=sidebar")) {
    document.documentElement.dataset.mode = "sidebar";
  }

  applyTheme(document.documentElement, settings.theme || "dark");

  panel = new PuchnePromptPanel({
    mount: document.getElementById("panelMount"),
    themeTarget: document.documentElement,
    variant: "popup",
    headerActions: [
      {
        id: "themeToggleBtn",
        title: "Toggle dark/light mode",
        html: (settings.theme || "dark") === "dark" ? ICON_SUN : ICON_MOON,
        onClick: (btn) => toggleTheme(btn),
      },
    ],
  });

  await panel.initPromise;
  panel.focusInput();
  document.body.classList.add("ready");
});

/**
 * Flips the theme, repaints the panel (chips pick theme-specific
 * service icons), and persists the choice.
 */
async function toggleTheme(btn) {
  const next = (document.documentElement.dataset.theme || "light") === "dark" ? "light" : "dark";
  applyTheme(document.documentElement, next);
  btn.innerHTML = next === "dark" ? ICON_SUN : ICON_MOON;

  panel.theme = next;
  if (panel.settings) panel.settings.theme = next;
  panel.renderServiceChips();

  const stored = await chrome.storage.sync.get("settings");
  const settings = stored.settings || {};
  await chrome.storage.sync.set({ settings: { ...settings, theme: next } });
}
