import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {popAt, ramp, springAt} from '../anim';
import {APP_ICON, dark, FONT} from '../theme';

const P = dark;
const WORD = 'Puchne';

export const LogoReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const logo = popAt({frame, fps, start: 2});
  const glow = ramp(frame, 4, 26);
  const tagline = springAt({frame, fps, start: 40, damping: 20, stiffness: 90});
  const underline = ramp(frame, 52, 16);
  const origin = ramp(frame, 66, 14);

  return (
    <AbsoluteFill
      style={{
        background: P.bgPrimary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(760px 760px at 50% 46%, rgba(251,146,60,0.18), transparent 68%)',
          opacity: glow,
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 26,
          fontFamily: FONT,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 26}}>
          <Img
            src={staticFile(APP_ICON)}
            style={{
              width: 124,
              height: 124,
              opacity: Math.min(1, logo * 1.4),
              transform: `scale(${0.45 + 0.55 * logo}) rotate(${
                interpolate(logo, [0, 1], [-16, 0])
              }deg)`,
              filter: `drop-shadow(0 14px 34px rgba(251,146,60,${0.35 * glow}))`,
            }}
          />
          <div style={{display: 'flex'}}>
            {WORD.split('').map((letter, i) => {
              const p = springAt({
                frame,
                fps,
                start: 14 + i * 3,
                damping: 18,
                stiffness: 110,
              });
              return (
                <span
                  key={i}
                  style={{
                    fontSize: 116,
                    fontWeight: 700,
                    letterSpacing: '-0.035em',
                    color: P.textPrimary,
                    opacity: p,
                    transform: `translateY(${(1 - p) * 30}px)`,
                    display: 'inline-block',
                  }}
                >
                  {letter}
                </span>
              );
            })}
          </div>
        </div>

        <div
          style={{
            position: 'relative',
            opacity: tagline,
            transform: `translateY(${(1 - tagline) * 18}px)`,
          }}
        >
          <div
            style={{
              fontSize: 44,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              color: P.textSecondary,
            }}
          >
            One prompt. Every AI. <span style={{color: P.accent}}>At once.</span>
          </div>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              bottom: -14,
              height: 3,
              width: `${underline * 62}%`,
              borderRadius: 2,
              background: P.accent,
              opacity: 0.85,
            }}
          />
        </div>

        <div
          style={{
            marginTop: 26,
            fontSize: 22,
            color: P.textMuted,
            opacity: origin,
            letterSpacing: '0.02em',
          }}
        >
          પૂછવું — Gujarati for “to ask”
        </div>
      </div>
    </AbsoluteFill>
  );
};
