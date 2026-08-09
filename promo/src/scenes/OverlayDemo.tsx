import React from 'react';
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {clickScale, path, popAt, pulse, ramp, typed} from '../anim';
import {ArticlePage} from '../components/ArticlePage';
import {BrowserFrame, PAGE_HEIGHT} from '../components/BrowserFrame';
import {Caption} from '../components/Caption';
import {KeyCaps} from '../components/KeyCaps';
import {Pointer} from '../components/Pointer';
import {PuchnePanel} from '../components/PuchnePanel';
import {dark, FONT, PROMPT, radius, SERVICES, STAGE, VIEWPORT} from '../theme';

const P = dark;

const PANEL_W = 1000;
const PANEL_H = 387; // measured from the panel's own box model
const PANEL_X = (VIEWPORT.width - PANEL_W) / 2;
const PANEL_Y = (PAGE_HEIGHT - PANEL_H) / 2;

/** Beats, in local frames. */
const T = {
  keysIn: 6,
  keyPress: [12, 16, 20],
  keysOut: 36,
  backdrop: 22,
  panelIn: 24,
  chipClicks: [54, 64, 74],
  promptClick: 102,
  typeStart: 106,
  sendClick: 202,
  statusIn: 208,
} as const;

/** Chip centres inside the page, measured off the panel's layout. */
const CHIP_POS = [
  {x: 391, y: 331},
  {x: 513, y: 331},
  {x: 631, y: 331},
];
const PROMPT_BOX = {x: 700, y: 440};
const SEND_BTN = {x: 1236, y: 471};

const CHIP_IDS = ['chatgpt', 'claude', 'gemini'];

export const OverlayDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const backdrop = ramp(frame, T.backdrop, 10);
  const panelIn = popAt({frame, fps, start: T.panelIn});
  const keysOpacity = ramp(frame, T.keysIn, 6) * (1 - ramp(frame, T.keysOut, 8));

  const pressed = T.keyPress.map((at) =>
    frame >= at && frame < 30 ? 1 : 0,
  );

  const activation: Record<string, number> = {};
  CHIP_IDS.forEach((id, i) => {
    activation[id] = ramp(frame, T.chipClicks[i], 6);
  });

  const promptText = typed(PROMPT, frame, T.typeStart, 0.85);
  const typingDone = promptText.length === PROMPT.length;

  const cursor = path(frame, [
    [0, 1430, 690],
    [T.chipClicks[0] - 8, 1430, 690],
    [T.chipClicks[0], CHIP_POS[0].x, CHIP_POS[0].y],
    [T.chipClicks[1], CHIP_POS[1].x, CHIP_POS[1].y],
    [T.chipClicks[2], CHIP_POS[2].x, CHIP_POS[2].y],
    [T.promptClick, PROMPT_BOX.x, PROMPT_BOX.y],
    [T.sendClick - 8, PROMPT_BOX.x, PROMPT_BOX.y],
    [T.sendClick, SEND_BTN.x, SEND_BTN.y],
    [T.sendClick + 40, SEND_BTN.x + 90, SEND_BTN.y + 80],
  ]);

  const status = ramp(frame, T.statusIn, 8);

  return (
    <AbsoluteFill style={{background: P.bgPrimary}}>
      {/* The browser, scaled so 1600×900 CSS pixels fill the 1920×1080 stage. */}
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
          tabTitle="Quantum computing, explained"
          url="example.com/quantum-computing-explained"
          iconHighlight={pulse(frame, T.keyPress[2], 16, 6)}
        >
          {/* Host page, pushed back once the overlay opens. */}
          <div
            style={{
              width: '100%',
              height: '100%',
              filter: `blur(${backdrop * 3}px)`,
              transform: `scale(${1 - backdrop * 0.012})`,
            }}
          >
            <ArticlePage />
          </div>

          {/* Backdrop */}
          <AbsoluteFill
            style={{background: `rgba(0,0,0,${0.55 * backdrop})`}}
          />

          {/* Keyboard shortcut */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 128,
              display: 'flex',
              justifyContent: 'center',
              opacity: keysOpacity,
              zIndex: 40,
            }}
          >
            <KeyCaps
              keys={['Ctrl', 'Shift', 'X']}
              pressed={pressed}
              palette={P}
              size={24}
            />
          </div>

          {/* The overlay itself */}
          <div
            style={{
              position: 'absolute',
              left: PANEL_X,
              top: PANEL_Y,
              width: PANEL_W,
              opacity: Math.min(1, panelIn * 1.6),
              transform: `translateY(${(1 - panelIn) * 16}px) scale(${
                0.94 + 0.06 * panelIn
              })`,
            }}
          >
            <PuchnePanel
              palette={P}
              activation={activation}
              prompt={promptText}
              frame={frame}
              showCaret={frame >= T.promptClick && !typingDone}
              focused={frame >= T.promptClick}
              sendScale={clickScale(frame, T.sendClick)}
              width={PANEL_W}
            />

            {/* What the panel reports once the send lands. */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                transform: `translate(-50%, ${(1 - status) * 10}px)`,
                bottom: -64,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 18px',
                borderRadius: radius.pill,
                background: P.bgSecondary,
                border: `1px solid ${P.accent}`,
                color: P.textPrimary,
                fontFamily: FONT,
                fontSize: 15,
                whiteSpace: 'nowrap',
                opacity: status,
              }}
            >
              {CHIP_IDS.map((id) => {
                const service = SERVICES.find((s) => s.id === id)!;
                return (
                  <Img
                    key={id}
                    src={staticFile(service.icon)}
                    style={{width: 18, height: 18, objectFit: 'contain'}}
                  />
                );
              })}
              Opening 3 tools…
            </div>
          </div>

          <Pointer
            x={cursor.x}
            y={cursor.y}
            frame={frame}
            clicks={[...T.chipClicks, T.promptClick, T.sendClick]}
            accent={P.accent}
          />
        </BrowserFrame>
      </div>

      {/* Lower-third captions, over a scrim so they stay readable. */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(to top, rgba(32,33,36,0.92) 0%, rgba(32,33,36,0) 32%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 96,
          bottom: 68,
          width: 1100,
          height: 130,
          fontFamily: FONT,
        }}
      >
        {[
          {
            at: 4,
            hold: 42,
            kicker: 'Anywhere',
            title: (
              <>
                Puchne opens on <em>any</em> page
              </>
            ),
          },
          {at: 58, hold: 30, kicker: 'Pick', title: 'Choose who answers'},
          {at: 118, hold: 62, kicker: 'Once', title: 'Type it a single time'},
          {at: 198, hold: 34, kicker: 'Send', title: 'All of them, together'},
        ].map((c) => (
          <div
            key={c.at}
            style={{position: 'absolute', left: 0, bottom: 0, width: 1100}}
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
