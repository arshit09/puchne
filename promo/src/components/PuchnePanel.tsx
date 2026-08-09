import React from 'react';
import {Img, staticFile} from 'remotion';
import {caretOn} from '../anim';
import {APP_ICON, FONT, radius, SERVICES, type Palette} from '../theme';
import {Chip} from './Chip';
import {ArrowRightIcon, GearIcon, KeyboardIcon} from './Icons';

/** `.section-label` — 0.7rem, 600, uppercase, 0.08em tracking. */
const SectionLabel: React.FC<{children: React.ReactNode; palette: Palette}> = ({
  children,
  palette,
}) => (
  <div
    style={{
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: palette.textMuted,
      marginBottom: 8,
    }}
  >
    {children}
  </div>
);

/**
 * The compose panel — `.pb-panel[data-variant="overlay"]` inside
 * `.modal-container`, rebuilt at 1:1 CSS pixels.
 */
export const PuchnePanel: React.FC<{
  palette: Palette;
  /** Ids of the tools switched on, mapped to 0→1 flip progress. */
  activation: Record<string, number>;
  prompt: string;
  /** Frame number, only used to blink the caret. */
  frame: number;
  showCaret?: boolean;
  /** Scale applied to the send button, for the click squash. */
  sendScale?: number;
  /** Whether the prompt box shows its focused (accent) border. */
  focused?: boolean;
  width?: number;
}> = ({
  palette,
  activation,
  prompt,
  frame,
  showCaret = false,
  sendScale = 1,
  focused = true,
  width = 1000,
}) => {
  return (
    <div
      style={{
        width,
        boxSizing: 'border-box',
        background: palette.bgPrimary,
        color: palette.textPrimary,
        border: `1px solid ${palette.border}`,
        borderRadius: radius.lg,
        padding: 32,
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        lineHeight: 1.5,
        fontFamily: FONT,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
          <Img src={staticFile(APP_ICON)} style={{width: 26, height: 26}} />
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: palette.textPrimary,
              margin: 0,
            }}
          >
            Puchne
          </h1>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 7,
            border: `1px solid ${palette.border}`,
            borderRadius: radius.sm,
            color: palette.textSecondary,
          }}
        >
          <GearIcon size={18} color={palette.textSecondary} />
        </div>
      </div>

      {/* ── Tools ──────────────────────────────────────────── */}
      <SectionLabel palette={palette}>Send to</SectionLabel>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 12,
          minHeight: 44,
        }}
      >
        {SERVICES.map((service) => (
          <Chip
            key={service.id}
            service={service}
            palette={palette}
            active={(activation[service.id] ?? 0) > 0.5}
            activation={activation[service.id] ?? 0}
          />
        ))}
      </div>

      {/* ── Prompt ─────────────────────────────────────────── */}
      <SectionLabel palette={palette}>Your prompt</SectionLabel>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 8,
          background: palette.bgSecondary,
          border: `1px solid ${focused ? palette.accent : palette.border}`,
          borderRadius: radius.lg,
          padding: '8px 8px 8px 16px',
        }}
      >
        <div
          style={{
            flex: 1,
            minHeight: 84,
            padding: '8px 0',
            color: prompt ? palette.textPrimary : palette.textMuted,
            fontSize: 18,
            lineHeight: 1.5,
          }}
        >
          {prompt || 'Ask every AI at once…'}
          {showCaret && caretOn(frame) ? (
            <span
              style={{
                display: 'inline-block',
                width: 2,
                height: 20,
                marginLeft: 1,
                verticalAlign: '-3px',
                background: palette.accent,
              }}
            />
          ) : null}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: palette.accent,
            color: '#fff',
            flexShrink: 0,
            marginBottom: 4,
            transform: `scale(${sendScale})`,
            // `.send-btn:disabled` — nothing to send yet.
            opacity: prompt ? 1 : 0.35,
          }}
        >
          <ArrowRightIcon size={22} color="#fff" />
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 8,
          marginTop: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: palette.textMuted,
            padding: '5px 12px',
            borderRadius: radius.sm,
            letterSpacing: '0.02em',
          }}
        >
          <KeyboardIcon size={14} color={palette.textMuted} />
          <span style={{fontWeight: 500}}>Shortcut:</span> Ctrl + Shift + X
        </div>
      </div>
    </div>
  );
};
