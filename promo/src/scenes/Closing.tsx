import React from 'react';
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {popAt, pulse, ramp, springAt} from '../anim';
import {LockIcon} from '../components/Icons';
import {APP_ICON, dark, FONT, radius} from '../theme';

const P = dark;

/** Privacy claim first, then the install card. */
const PRIVACY_IN = 2;
const PRIVACY_HOLD = 40;
const LOCKUP_IN = 66;

const PrivacyBlock: React.FC<{progress: number}> = ({progress}) => (
  <AbsoluteFill
    style={{
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: FONT,
      opacity: progress,
      transform: `translateY(${(1 - progress) * 16}px)`,
    }}
  >
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 26,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 78,
          height: 78,
          borderRadius: '50%',
          border: `2px solid ${P.accent}`,
          background: P.accentLight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LockIcon size={34} color={P.accent} />
      </div>
      <div
        style={{
          fontSize: 66,
          fontWeight: 700,
          letterSpacing: '-0.025em',
          color: P.textPrimary,
        }}
      >
        No account. No server. No tracking.
      </div>
      <div
        style={{
          fontSize: 25,
          lineHeight: 1.5,
          color: P.textSecondary,
          maxWidth: 1080,
        }}
      >
        Puchne installs with access to <strong>no websites at all</strong>. You
        grant one site the first time you switch a tool on — and you can
        withdraw it whenever you like.
      </div>
    </div>
  </AbsoluteFill>
);

const Lockup: React.FC<{progress: number}> = ({progress}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const logo = popAt({frame, fps, start: LOCKUP_IN});
  const install = springAt({
    frame,
    fps,
    start: LOCKUP_IN + 18,
    damping: 20,
    stiffness: 90,
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT,
        opacity: progress,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 22,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 22}}>
          <Img
            src={staticFile(APP_ICON)}
            style={{
              width: 96,
              height: 96,
              transform: `scale(${0.6 + 0.4 * logo})`,
              filter: 'drop-shadow(0 12px 30px rgba(251,146,60,0.35))',
            }}
          />
          <span
            style={{
              fontSize: 92,
              fontWeight: 700,
              letterSpacing: '-0.035em',
              color: P.textPrimary,
            }}
          >
            Puchne
          </span>
        </div>

        <div style={{fontSize: 38, fontWeight: 600, color: P.textSecondary}}>
          One prompt. Every AI. <span style={{color: P.accent}}>At once.</span>
        </div>

        <div
          style={{
            marginTop: 22,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '16px 26px',
            borderRadius: radius.lg,
            background: P.bgSecondary,
            border: `1px solid ${P.border}`,
            opacity: install,
            transform: `translateY(${(1 - install) * 14}px)`,
          }}
        >
          <span
            style={{
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: 22,
              color: P.textPrimary,
            }}
          >
            github.com/arshit09/puchne
          </span>
          <span
            style={{
              padding: '5px 11px',
              borderRadius: radius.pill,
              background: P.accentLight,
              border: `1px solid ${P.accent}`,
              color: P.accentText,
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            MIT
          </span>
        </div>

        <div
          style={{
            fontSize: 18,
            color: P.textMuted,
            opacity: install,
            letterSpacing: '0.02em',
          }}
        >
          Load unpacked in chrome://extensions — free and open source
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const Closing: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{background: P.bgPrimary}}>
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(900px 700px at 50% 50%, rgba(251,146,60,0.16), transparent 68%)',
          opacity: ramp(frame, LOCKUP_IN, 20),
        }}
      />
      <PrivacyBlock progress={pulse(frame, PRIVACY_IN, PRIVACY_HOLD, 12)} />
      <Lockup progress={ramp(frame, LOCKUP_IN, 14)} />
    </AbsoluteFill>
  );
};
