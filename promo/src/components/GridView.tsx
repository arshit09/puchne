import React from 'react';
import {Img, staticFile} from 'remotion';
import {caretOn} from '../anim';
import {APP_ICON, FONT, radius, type Palette, type Service} from '../theme';
import {CloseIcon, ExpandIcon, SendIcon} from './Icons';

/** Deterministic 0→1 from two ints — keeps the skeleton widths stable. */
const rand = (a: number, b: number) => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Enough lines to fill a tall column the way a real answer does. */
const LINE_COUNT = 16;

const AnswerBody: React.FC<{
  palette: Palette;
  service: Service;
  opener: string;
  /** 0 → 1 across the whole answer. */
  progress: number;
  frame: number;
  seed: number;
}> = ({palette, opener, progress, frame, seed}) => {
  // The opener types out over the first third, then the paragraph fills in.
  const openerChars = Math.floor(
    Math.min(1, progress / 0.34) * opener.length,
  );
  const bodyProgress = Math.max(0, (progress - 0.3) / 0.7);
  const streaming = progress < 1;

  return (
    <div
      style={{
        flex: 1,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* The prompt, echoed back the way every chat UI does. */}
      <div
        style={{
          alignSelf: 'flex-end',
          maxWidth: '78%',
          background: palette.bgSecondary,
          border: `1px solid ${palette.border}`,
          borderRadius: 14,
          padding: '8px 13px',
          fontSize: 12.5,
          lineHeight: 1.4,
          color: palette.textSecondary,
        }}
      >
        Explain quantum computing like I'm 12 — one analogy, no jargon.
      </div>

      <div
        style={{
          fontSize: 14.5,
          lineHeight: 1.6,
          color: palette.textPrimary,
          minHeight: 46,
          whiteSpace: 'pre-line', // the follow-up answers come back as bullets
        }}
      >
        {opener.slice(0, openerChars)}
        {streaming && openerChars > 0 && caretOn(frame) ? (
          <span
            style={{
              display: 'inline-block',
              width: 6,
              height: 12,
              marginLeft: 2,
              background: palette.textMuted,
              verticalAlign: '-1px',
            }}
          />
        ) : null}
      </div>

      {/* The rest of the answer, as filling lines. Every fifth line starts a
          new paragraph, so a column reads like prose rather than a barcode. */}
      <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
        {Array.from({length: LINE_COUNT}).map((_, i) => {
          const start = i / LINE_COUNT;
          const p = Math.max(0, Math.min(1, (bodyProgress - start) * LINE_COUNT));
          const endOfParagraph = i % 5 === 4;
          const full = endOfParagraph ? 34 + rand(seed, i) * 20 : 66 + rand(seed, i) * 32;
          return (
            <div
              key={i}
              style={{
                height: 9,
                width: `${full * p}%`,
                borderRadius: 4,
                background: palette.bgHover,
                opacity: 0.55,
                marginBottom: endOfParagraph ? 10 : 0,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

export type GridCell = {
  service: Service;
  opener: string;
  /** 0 → 1 entrance. */
  reveal: number;
  /** 0 → 1 answer stream. */
  progress: number;
};

/**
 * pages/grid.html rebuilt: a grid of cells over a bottom bar that carries the
 * follow-up input. The bar really is at the bottom — `.grid-header` comes
 * after `.grid-container` and has a `border-top`.
 */
export const GridView: React.FC<{
  palette: Palette;
  cells: GridCell[];
  columns: number;
  width: number;
  height: number;
  frame: number;
  followUp?: string;
  followUpFocused?: boolean;
  followUpCaret?: boolean;
  sendScale?: number;
  hoverExpand?: boolean;
}> = ({
  palette,
  cells,
  columns,
  width,
  height,
  frame,
  followUp = '',
  followUpFocused = false,
  followUpCaret = false,
  sendScale = 1,
  hoverExpand = true,
}) => {
  const BAR = 48;

  return (
    <div
      style={{
        width,
        height,
        background: palette.bgPrimary,
        fontFamily: FONT,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── Cells ──────────────────────────────────────────── */}
      <div
        style={{
          height: height - BAR,
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: 1,
          background: palette.border,
        }}
      >
        {cells.map((cell, i) => (
          <div
            key={cell.service.id}
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              background: palette.bgPrimary,
              overflow: 'hidden',
              minWidth: 0,
              minHeight: 0,
              opacity: cell.reveal,
              transform: `scale(${0.94 + 0.06 * cell.reveal})`,
            }}
          >
            {/* .cell-header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 12px',
                height: 34,
                flexShrink: 0,
                background: palette.bgSecondary,
                borderBottom: `1px solid ${palette.border}`,
              }}
            >
              <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                <Img
                  src={staticFile(cell.service.icon)}
                  style={{width: 16, height: 16, objectFit: 'contain'}}
                />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: palette.textPrimary,
                  }}
                >
                  {cell.service.name}
                </span>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                {[ExpandIcon, CloseIcon].map((Icon, n) => (
                  <div
                    key={n}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 4,
                      border: `1px solid ${palette.border}`,
                      borderRadius: radius.md,
                      color: palette.textSecondary,
                    }}
                  >
                    <Icon size={12} color={palette.textSecondary} />
                  </div>
                ))}
              </div>
            </div>

            <AnswerBody
              palette={palette}
              service={cell.service}
              opener={cell.opener}
              progress={cell.progress}
              frame={frame}
              seed={i + 1}
            />
          </div>
        ))}
      </div>

      {/* ── Bottom bar ─────────────────────────────────────── */}
      <div
        style={{
          height: BAR,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 20px',
          background: palette.bgSecondary,
          borderTop: `1px solid ${palette.border}`,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
          <Img src={staticFile(APP_ICON)} style={{width: 20, height: 20}} />
          <span
            style={{fontSize: 15, fontWeight: 600, color: palette.textPrimary}}
          >
            Puchne
          </span>
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            margin: '0 16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              maxWidth: 600,
              background: palette.bgTertiary,
              border: `1px solid ${
                followUpFocused ? palette.accent : palette.border
              }`,
              borderRadius: 20,
              padding: '4px 12px',
            }}
          >
            <div
              style={{
                flex: 1,
                fontSize: 13,
                lineHeight: 1.4,
                padding: '2px 0',
                color: followUp ? palette.textPrimary : palette.textMuted,
              }}
            >
              {followUp || 'Ask follow-up...'}
              {followUpCaret && caretOn(frame) ? (
                <span
                  style={{
                    display: 'inline-block',
                    width: 1.5,
                    height: 13,
                    marginLeft: 1,
                    verticalAlign: '-2px',
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
                padding: 4,
                borderRadius: '50%',
                color: sendScale === 1 ? palette.textSecondary : palette.accent,
                transform: `scale(${sendScale})`,
              }}
            >
              <SendIcon size={14} />
            </div>
          </div>
        </div>

        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          <div
            style={{
              fontSize: 12,
              color: palette.textSecondary,
              border: `1px solid ${palette.border}`,
              borderRadius: radius.sm,
              padding: '5px 10px',
            }}
          >
            Reset layout
          </div>
          <span style={{fontSize: 12, color: palette.textSecondary}}>
            Hover to Expand
          </span>
          <div
            style={{
              width: 32,
              height: 18,
              borderRadius: 999,
              background: hoverExpand ? palette.accent : palette.bgHover,
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 2,
                left: hoverExpand ? 16 : 2,
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: '#fff',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
