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

const ICON_SUN = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="12" cy="12" r="5"/>
  <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
  <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
</svg>`;

const ICON_MONITOR = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="2" y="3" width="20" height="14" rx="2"/>
  <line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
</svg>`;

// The toggle is now a three-state cycle, so the button shows the state it is
// IN (not the one it switches to, which is what a two-state flip implies).
const THEME_CYCLE = ["system", "light", "dark"];
const THEME_UI = {
  system: { icon: ICON_MONITOR, label: "Theme: match system" },
  light:  { icon: ICON_SUN,     label: "Theme: light" },
  dark:   { icon: ICON_MOON,    label: "Theme: dark" },
};

let panel = null;

document.addEventListener("DOMContentLoaded", async () => {
  const stored = await chrome.storage.sync.get("settings");
  const settings = stored.settings || {};

  // Side panel and popup share this page; only the layout differs.
  if (settings.useSidebar || window.location.search.includes("mode=sidebar")) {
    document.documentElement.dataset.mode = "sidebar";
  }

  // Falls back rather than indexes blindly: an older build could have left
  // any string in here.
  const themePref = THEME_UI[settings.theme] ? settings.theme : THEME_DEFAULT;
  applyTheme(document.documentElement, themePref);

  panel = new PuchnePromptPanel({
    mount: document.getElementById("panelMount"),
    themeTarget: document.documentElement,
    variant: "popup",
    headerActions: [
      {
        id: "themeToggleBtn",
        title: THEME_UI[themePref].label,
        html: THEME_UI[themePref].icon,
        onClick: (btn) => cycleTheme(btn),
      },
    ],
  });

  await panel.initPromise;
  panel.focusInput();
  document.body.classList.add("ready");
});

/**
 * Steps to the next theme preference (system → light → dark → system),
 * repaints the panel (chips pick theme-specific service icons), and
 * persists the choice.
 */
async function cycleTheme(btn) {
  const current = document.documentElement.dataset.themePref || THEME_DEFAULT;
  const next = THEME_CYCLE[(THEME_CYCLE.indexOf(current) + 1) % THEME_CYCLE.length];

  panel.resolvedTheme = applyTheme(document.documentElement, next);
  btn.innerHTML = THEME_UI[next].icon;
  btn.title = THEME_UI[next].label;
  btn.setAttribute("aria-label", THEME_UI[next].label);

  // Keep the panel's own copy in step, so its system-theme watcher knows
  // whether it should still be following the OS.
  panel.theme = next;
  if (panel.settings) panel.settings.theme = next;
  panel.renderServiceChips(true);

  const stored = await chrome.storage.sync.get("settings");
  const settings = stored.settings || {};
  await chrome.storage.sync.set({ settings: { ...settings, theme: next } });
}
