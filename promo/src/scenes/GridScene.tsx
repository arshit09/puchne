import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {clickScale, path, pulse, ramp, typed} from '../anim';
import {BrowserFrame, PAGE_HEIGHT} from '../components/BrowserFrame';
import {Caption} from '../components/Caption';
import {GridView} from '../components/GridView';
import {Pointer} from '../components/Pointer';
import {dark, FOLLOW_UP, FONT, SERVICES, STAGE, VIEWPORT} from '../theme';

const P = dark;

/** The three tools switched on in the previous scene. */
const PICKED = ['chatgpt', 'claude', 'gemini'].map(
  (id) => SERVICES.find((s) => s.id === id)!,
);

/** First pass — each tool opens with its own phrasing. */
const OPENERS = [
  "Think of a spinning coin: while it's in the air it isn't heads or tails yet.",
  'Picture a maze where you can try every path at the same time and keep only the one that works.',
  'A normal bit is a light switch. A qubit is a dimmer that only picks a side when you read it.',
];

/** Second pass, after the follow-up. */
const BULLETS = [
  '• A qubit holds both answers at once.\n• Interference cancels the wrong ones.',
  '• Try every path in parallel.\n• Keep the path that survives.',
  '• Not faster at everything.\n• Much faster at a few things.',
];

const T = {
  cellsIn: [0, 6, 12],
  wave1: [10, 18, 26],
  followUpClick: 104,
  typeStart: 108,
  sendClick: 152,
  wave2: [158, 166, 174],
} as const;

const BAR_Y = PAGE_HEIGHT - 24;

/** Where the grid's 48px bottom bar starts, in stage pixels. */
const SCALE = STAGE.width / VIEWPORT.width;
const BAR_TOP_ON_STAGE = (VIEWPORT.height - 48) * SCALE;

export const GridScene: React.FC = () => {
  const frame = useCurrentFrame();
  const secondWave = frame >= T.sendClick + 2;

  const cells = PICKED.map((service, i) => ({
    service,
    opener: secondWave ? BULLETS[i] : OPENERS[i],
    reveal: ramp(frame, T.cellsIn[i], 12),
    progress: secondWave
      ? ramp(frame, T.wave2[i], 55)
      : ramp(frame, T.wave1[i], 72),
  }));

  const followUp = typed(FOLLOW_UP, frame, T.typeStart, 0.8);
  const typingDone = followUp.length === FOLLOW_UP.length;
  const cleared = frame >= T.sendClick + 4;

  const cursor = path(frame, [
    [0, 1360, 300],
    [88, 1360, 300],
    [T.followUpClick, 700, BAR_Y],
    [T.sendClick - 8, 700, BAR_Y],
    [T.sendClick, 1074, BAR_Y],
    [T.sendClick + 40, 1150, BAR_Y - 60],
  ]);

  return (
    <AbsoluteFill style={{background: P.bgPrimary}}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: VIEWPORT.width,
          height: VIEWPORT.height,
          transform: `scale(${STAGE.width / VIEWPORT.width})`,
          transformOrigin: 'top left',
        }}
      >
        <BrowserFrame
          tabTitle="Puchne — Grid View"
          url="chrome-extension://puchne/pages/grid.html"
          favicon="icons/app/icon-48.png"
        >
          <GridView
            palette={P}
            cells={cells}
            columns={3}
            width={VIEWPORT.width}
            height={PAGE_HEIGHT}
            frame={frame}
            followUp={cleared ? '' : followUp}
            followUpFocused={frame >= T.followUpClick && !cleared}
            followUpCaret={
              frame >= T.followUpClick && !typingDone && !cleared
            }
            sendScale={clickScale(frame, T.sendClick)}
          />

          <Pointer
            x={cursor.x}
            y={cursor.y}
            frame={frame}
            clicks={[T.followUpClick, T.sendClick]}
            accent={P.accent}
          />
        </BrowserFrame>
      </div>

      {/* The scrim stops short of the follow-up bar — that bar is the point of
          the shot and must not be dimmed. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: BAR_TOP_ON_STAGE,
          background:
            'linear-gradient(to top, rgba(32,33,36,0.92) 0%, rgba(32,33,36,0) 34%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 96,
          bottom: STAGE.height - BAR_TOP_ON_STAGE + 38,
          width: 1200,
          height: 130,
          fontFamily: FONT,
        }}
      >
        {[
          {
            at: 12,
            hold: 56,
            kicker: 'Compare',
            title: 'Every answer, side by side',
          },
          {
            at: 96,
            hold: 44,
            kicker: 'Keep going',
            title: 'One follow-up box for all of them',
          },
          {
            at: 160,
            hold: 40,
            kicker: 'No retyping',
            title: 'Everyone answers again',
          },
        ].map((c) => (
          <div
            key={c.at}
            style={{position: 'absolute', left: 0, bottom: 0, width: 1200}}
          >
            <Caption
              palette={P}
              kicker={c.kicker}
              title={c.title}
              progress={pulse(frame, c.at, c.hold, 9)}
              align="left"
              size={46}
            />
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
