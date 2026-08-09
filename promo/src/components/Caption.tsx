import React from 'react';
import {FONT, type Palette} from '../theme';

/**
 * The caption band. Kicker uses the panel's `.section-label` treatment so the
 * titles feel like they came out of the same UI.
 */
export const Caption: React.FC<{
  kicker?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  palette: Palette;
  progress: number;
  align?: 'left' | 'center';
  size?: number;
}> = ({
  kicker,
  title,
  sub,
  palette,
  progress,
  align = 'center',
  size = 52,
}) => (
  <div
    style={{
      fontFamily: FONT,
      textAlign: align,
      opacity: progress,
      transform: `translateY(${(1 - progress) * 18}px)`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: align === 'center' ? 'center' : 'flex-start',
      gap: 10,
    }}
  >
    {kicker ? (
      <div
        style={{
          fontSize: 17,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          color: palette.accent,
        }}
      >
        {kicker}
      </div>
    ) : null}
    <div
      style={{
        fontSize: size,
        fontWeight: 700,
        letterSpacing: '-0.02em',
        lineHeight: 1.12,
        color: palette.textPrimary,
      }}
    >
      {title}
    </div>
    {sub ? (
      <div
        style={{
          fontSize: 25,
          lineHeight: 1.45,
          color: palette.textSecondary,
          maxWidth: 1000,
        }}
      >
        {sub}
      </div>
    ) : null}
  </div>
);
