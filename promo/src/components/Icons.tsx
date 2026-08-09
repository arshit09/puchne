import React from 'react';

/**
 * The extension's inline SVGs, redrawn here so the video uses the same glyphs
 * as the real UI (Feather-style, 2px round strokes).
 */

type IconProps = {size?: number; color?: string; strokeWidth?: number};

const base = (size: number, color: string, strokeWidth: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: color,
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const GearIcon: React.FC<IconProps> = ({
  size = 18,
  color = 'currentColor',
  strokeWidth = 2,
}) => (
  <svg {...base(size, color, strokeWidth)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

/** The send button's arrow. */
export const ArrowRightIcon: React.FC<IconProps> = ({
  size = 22,
  color = 'currentColor',
  strokeWidth = 2.4,
}) => (
  <svg {...base(size, color, strokeWidth)}>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

/** The grid follow-up bar's send glyph. */
export const SendIcon: React.FC<IconProps> = ({
  size = 14,
  color = 'currentColor',
  strokeWidth = 2,
}) => (
  <svg {...base(size, color, strokeWidth)}>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

/** Sits next to "Shortcut: Ctrl + Shift + X" in the panel footer. */
export const KeyboardIcon: React.FC<IconProps> = ({
  size = 14,
  color = 'currentColor',
  strokeWidth = 1.6,
}) => (
  <svg {...base(size, color, strokeWidth)}>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <line x1="6" y1="10" x2="6" y2="10" />
    <line x1="10" y1="10" x2="10" y2="10" />
    <line x1="14" y1="10" x2="14" y2="10" />
    <line x1="18" y1="10" x2="18" y2="10" />
    <line x1="7" y1="14" x2="17" y2="14" />
  </svg>
);

export const ExpandIcon: React.FC<IconProps> = ({
  size = 12,
  color = 'currentColor',
  strokeWidth = 2,
}) => (
  <svg {...base(size, color, strokeWidth)}>
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

export const CloseIcon: React.FC<IconProps> = ({
  size = 12,
  color = 'currentColor',
  strokeWidth = 2,
}) => (
  <svg {...base(size, color, strokeWidth)}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const LockIcon: React.FC<IconProps> = ({
  size = 20,
  color = 'currentColor',
  strokeWidth = 2,
}) => (
  <svg {...base(size, color, strokeWidth)}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export const PlusIcon: React.FC<IconProps> = ({
  size = 14,
  color = 'currentColor',
  strokeWidth = 2.2,
}) => (
  <svg {...base(size, color, strokeWidth)}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const CopyIcon: React.FC<IconProps> = ({
  size = 16,
  color = 'currentColor',
  strokeWidth = 2,
}) => (
  <svg {...base(size, color, strokeWidth)}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

/** The mouse pointer used for the on-screen cursor. */
export const PointerIcon: React.FC<{size?: number}> = ({size = 26}) => (
  <svg width={size} height={size * 1.35} viewBox="0 0 20 27" fill="none">
    <path
      d="M2 1.6 17.2 12.4h-7.1l-2.4 6.1L2 1.6Z"
      fill="#ffffff"
      stroke="#202124"
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
  </svg>
);
