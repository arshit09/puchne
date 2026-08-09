/**
 * ============================================================
 *  Puchne promo — design tokens
 * ============================================================
 *
 *  Copied verbatim from the extension so the video and the app
 *  cannot drift apart:
 *
 *    styles/overlay.css   → the overlay palette + radii
 *    styles/popup.css     → the popup palette
 *    styles/grid.css      → the grid palette
 *
 *  If a colour changes in the extension, change it here too.
 * ============================================================
 */

/** Same stack the extension uses (`--font`). */
export const FONT = 'system-ui, -apple-system, sans-serif';

export type Palette = {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgHover: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  accentLight: string;
  accentText: string;
  border: string;
};

/** Google dark-mode palette — `:host([data-theme="dark"])` in overlay.css. */
export const dark: Palette = {
  bgPrimary: '#202124',
  bgSecondary: '#303134',
  bgTertiary: '#3c4043',
  bgHover: '#5f6368',
  textPrimary: '#e8eaed',
  textSecondary: '#bdc1c6',
  textMuted: '#9aa0a6',
  accent: '#fb923c',
  accentHover: '#f97316',
  accentLight: 'rgba(249, 115, 22, 0.20)',
  accentText: '#fb923c',
  border: '#3c4043',
};

/** Google light-mode palette — `:host` in overlay.css. */
export const light: Palette = {
  bgPrimary: '#ffffff',
  bgSecondary: '#f1f3f4',
  bgTertiary: '#e8eaed',
  bgHover: '#dadce0',
  textPrimary: '#202124',
  textSecondary: '#5f6368',
  textMuted: '#80868b',
  accent: '#fb923c',
  accentHover: '#f97316',
  accentLight: 'rgba(251, 146, 60, 0.15)',
  accentText: '#c2410c',
  border: '#dadce0',
};

/** `--radius`, `--radius-sm`, `--radius-xs`. */
export const radius = {
  lg: 14,
  md: 8,
  sm: 6,
  pill: 999,
} as const;

/** The stage every scene is composed on; other formats scale this box. */
export const STAGE = {width: 1920, height: 1080} as const;

/** A browser window at 1:1 CSS pixels — scaled up to fill the stage. */
export const VIEWPORT = {width: 1600, height: 900} as const;

export type Service = {
  id: string;
  name: string;
  icon: string;
};

/** The built-in tools, in the order the panel lists them. */
export const SERVICES: Service[] = [
  {id: 'chatgpt', name: 'ChatGPT', icon: 'icons/services/chatgpt_dark.png'},
  {id: 'claude', name: 'Claude', icon: 'icons/services/claude.png'},
  {id: 'gemini', name: 'Gemini', icon: 'icons/services/gemini.png'},
  {id: 'copilot', name: 'Copilot', icon: 'icons/services/copilot.png'},
  {id: 'deepseek', name: 'DeepSeek', icon: 'icons/services/deepseek.png'},
  {id: 'perplexity', name: 'Perplexity', icon: 'icons/services/perplexity.png'},
  {id: 'grok', name: 'Grok', icon: 'icons/services/grok.svg'},
];

export const APP_ICON = 'icons/app/icon-128.png';

/** The prompt used throughout the video (same one as the README hero shot). */
export const PROMPT = "Explain quantum computing like I'm 12 — one analogy, no jargon.";
export const FOLLOW_UP = 'Now in three bullet points.';
