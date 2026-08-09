import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {popAt, ramp} from '../anim';
import {Caption} from '../components/Caption';
import {CopyIcon} from '../components/Icons';
import {dark, FONT, PROMPT, radius, SERVICES} from '../theme';

const P = dark;

const CARD_W = 330;
const CARD_H = 208;
const GAP = 34;
const ROW = SERVICES.slice(0, 4);
const ROW_W = ROW.length * CARD_W + (ROW.length - 1) * GAP;
const ROW_X = (1920 - ROW_W) / 2;
const ROW_Y = 552;

/** When each tab lands, and when the prompt finishes being pasted into it. */
const LAND = [20, 34, 48, 62];
const PASTE = [34, 48, 62, 76];

const cardX = (i: number) => ROW_X + i * (CARD_W + GAP);

const TabCard: React.FC<{index: number}> = ({index}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = popAt({frame, fps, start: LAND[index]});
  const service = ROW[index];
  const pasted = ramp(frame, PASTE[index], 8);

  return (
    <div
      style={{
        position: 'absolute',
        left: cardX(index),
        top: ROW_Y + (index % 2 === 0 ? 0 : 22),
        width: CARD_W,
        height: CARD_H,
        opacity: pop,
        transform: `translateY(${(1 - pop) * 40}px) scale(${0.9 + 0.1 * pop})`,
        background: P.bgSecondary,
        border: `1px solid ${P.border}`,
        borderRadius: radius.lg,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
      }}
    >
      {/* Tab strip stand-in */}
      <div
        style={{
          height: 38,
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '0 14px',
          background: P.bgTertiary,
          borderBottom: `1px solid ${P.border}`,
        }}
      >
        <Img
          src={staticFile(service.icon)}
          style={{width: 17, height: 17, objectFit: 'contain'}}
        />
        <span style={{fontSize: 14, color: P.textSecondary, fontFamily: FONT}}>
          {service.name}
        </span>
      </div>

      <div style={{flex: 1, padding: 16, display: 'flex', flexDirection: 'column'}}>
        <div style={{display: 'flex', flexDirection: 'column', gap: 9, flex: 1}}>
          {[86, 70, 54].map((w, i) => (
            <div
              key={i}
              style={{
                height: 8,
                width: `${w}%`,
                borderRadius: 4,
                background: P.bgHover,
                opacity: 0.35,
              }}
            />
          ))}
        </div>
        {/* The same prompt, pasted again. */}
        <div
          style={{
            height: 36,
            borderRadius: 999,
            border: `1px solid ${pasted > 0.5 ? P.border : P.bgTertiary}`,
            background: P.bgTertiary,
            display: 'flex',
            alignItems: 'center',
            padding: '0 14px',
            fontSize: 13,
            fontFamily: FONT,
            color: P.textMuted,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          <span style={{opacity: pasted}}>
            {PROMPT.slice(0, 30)}
            {pasted > 0.5 ? '…' : ''}
          </span>
        </div>
      </div>
    </div>
  );
};

/** The clipboard pill that has to be dragged from tab to tab. */
const ClipboardPill: React.FC = () => {
  const frame = useCurrentFrame();
  const visible = ramp(frame, 16, 6) * (1 - ramp(frame, 80, 8));
  const stops = [16, ...PASTE];
  const xs = [cardX(0), cardX(0), cardX(1), cardX(2), cardX(3)].map(
    (x) => x + CARD_W / 2,
  );
  const x = interpolate(frame, stops, xs, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // A little hop between each drop.
  const hop = PASTE.reduce((acc, at) => {
    const t = frame - (at - 12);
    if (t < 0 || t > 12) return acc;
    return acc + Math.sin((t / 12) * Math.PI) * 26;
  }, 0);

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: ROW_Y - 70 - hop,
        transform: 'translateX(-50%)',
        opacity: visible,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 22px',
        borderRadius: 999,
        background: P.bgSecondary,
        border: `1px solid ${P.border}`,
        color: P.textSecondary,
        fontFamily: FONT,
        fontSize: 19,
        whiteSpace: 'nowrap',
        boxShadow: '0 10px 26px rgba(0,0,0,0.45)',
      }}
    >
      <CopyIcon size={19} color={P.textMuted} />
      Copy · Paste · Repeat
    </div>
  );
};

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const dim = ramp(frame, 86, 14);
  const closing = ramp(frame, 92, 12);

  return (
    <AbsoluteFill style={{background: P.bgPrimary}}>
      {/* A soft accent glow so the frame isn't flat black. */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(1100px 620px at 50% 32%, rgba(251,146,60,0.10), transparent 70%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 236,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: 1 - dim,
        }}
      >
        <Caption
          palette={P}
          kicker="Today"
          title="One question. Four tabs."
          sub="Ask ChatGPT. Copy it. Open Claude. Paste it. Open Gemini…"
          progress={ramp(frame, 6, 14)}
        />
      </div>

      <div style={{opacity: 1 - dim * 0.75, filter: `blur(${dim * 5}px)`}}>
        {ROW.map((_, i) => (
          <TabCard key={i} index={i} />
        ))}
        <ClipboardPill />
      </div>

      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          opacity: closing,
        }}
      >
        <div
          style={{
            fontFamily: FONT,
            fontSize: 68,
            fontWeight: 700,
            letterSpacing: '-0.025em',
            color: P.textPrimary,
            transform: `translateY(${(1 - closing) * 24}px)`,
          }}
        >
          There is a faster way.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
