import React from 'react';
import {FONT, radius, type Palette} from '../theme';

const Cap: React.FC<{
  label: string;
  pressed: number;
  palette: Palette;
  size: number;
}> = ({label, pressed, palette, size}) => (
  <div
    style={{
      fontFamily: FONT,
      fontSize: size,
      fontWeight: 600,
      letterSpacing: '0.02em',
      color: pressed > 0.5 ? '#ffffff' : palette.textPrimary,
      background:
        pressed > 0.5
          ? palette.accent
          : `linear-gradient(${palette.bgTertiary}, ${palette.bgSecondary})`,
      border: `1px solid ${pressed > 0.5 ? palette.accent : palette.border}`,
      borderRadius: radius.md,
      padding: `${size * 0.55}px ${size * 0.95}px`,
      boxShadow:
        pressed > 0.5
          ? 'inset 0 2px 4px rgba(0,0,0,0.25)'
          : `0 3px 0 ${palette.border}, 0 6px 14px rgba(0,0,0,0.35)`,
      transform: `translateY(${pressed * 3}px)`,
    }}
  >
    {label}
  </div>
);

/** Ctrl + Shift + X, pressed in sequence then held. */
export const KeyCaps: React.FC<{
  keys: string[];
  /** 0 → 1 per key. */
  pressed: number[];
  palette: Palette;
  size?: number;
}> = ({keys, pressed, palette, size = 22}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: size * 0.5}}>
    {keys.map((k, i) => (
      <React.Fragment key={k}>
        {i > 0 ? (
          <span
            style={{
              fontFamily: FONT,
              fontSize: size,
              color: palette.textMuted,
            }}
          >
            +
          </span>
        ) : null}
        <Cap label={k} pressed={pressed[i] ?? 0} palette={palette} size={size} />
      </React.Fragment>
    ))}
  </div>
);
