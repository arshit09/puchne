import React from 'react';
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {ramp, springAt} from '../anim';
import {Caption} from '../components/Caption';
import {PlusIcon} from '../components/Icons';
import {APP_ICON, dark, FONT, radius, SERVICES} from '../theme';

const P = dark;

const CARD_W = 520;
const CARD_H = 470;
const GAP = 40;
const X0 = (1920 - (3 * CARD_W + 2 * GAP)) / 2;
const Y0 = 424;

const Card: React.FC<{
  index: number;
  title: string;
  body: string;
  children: React.ReactNode;
}> = ({index, title, body, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = springAt({
    frame,
    fps,
    start: 16 + index * 8,
    damping: 18,
    stiffness: 100,
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: X0 + index * (CARD_W + GAP),
        top: Y0,
        width: CARD_W,
        height: CARD_H,
        background: P.bgSecondary,
        border: `1px solid ${P.border}`,
        borderRadius: radius.lg,
        padding: 30,
        boxSizing: 'border-box',
        fontFamily: FONT,
        opacity: p,
        transform: `translateY(${(1 - p) * 34}px)`,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxShadow: '0 18px 44px rgba(0,0,0,0.3)',
      }}
    >
      <div
        style={{
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: '-0.015em',
          color: P.textPrimary,
        }}
      >
        {title}
      </div>
      <div style={{fontSize: 18, lineHeight: 1.5, color: P.textSecondary}}>
        {body}
      </div>
      <div
        style={{
          marginTop: 'auto',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}
      >
        {children}
      </div>
    </div>
  );
};

/** The right-click menu, with "Ask Puchne" sitting in it. */
const ContextMenuMock: React.FC = () => {
  const frame = useCurrentFrame();
  const highlight = ramp(frame, 40, 12);
  const rows = ['Back', 'Reload', 'Save as…'];

  return (
    <div
      style={{
        width: 280,
        background: P.bgPrimary,
        border: `1px solid ${P.border}`,
        borderRadius: radius.md,
        padding: '6px 0',
        boxShadow: '0 14px 34px rgba(0,0,0,0.45)',
        fontSize: 14,
      }}
    >
      {rows.map((r) => (
        <div key={r} style={{padding: '8px 14px', color: P.textMuted}}>
          {r}
        </div>
      ))}
      <div
        style={{
          height: 1,
          background: P.border,
          margin: '6px 0',
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '9px 14px',
          background: highlight > 0 ? P.accentLight : 'transparent',
          color: highlight > 0 ? P.accentText : P.textSecondary,
        }}
      >
        <Img src={staticFile(APP_ICON)} style={{width: 16, height: 16}} />
        Ask Puchne
        <span style={{marginLeft: 'auto', fontSize: 12, color: P.textMuted}}>
          Ctrl+Shift+S
        </span>
      </div>
      <div style={{padding: '8px 14px', color: P.textMuted}}>Inspect</div>
    </div>
  );
};

/** Adding a tool that isn't on the list. */
const CustomToolMock: React.FC = () => {
  const frame = useCurrentFrame();
  const p = ramp(frame, 46, 14);

  return (
    <div style={{width: 380, display: 'flex', flexDirection: 'column', gap: 12}}>
      <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
        {SERVICES.slice(4, 6).map((s) => (
          <div
            key={s.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '7px 13px',
              borderRadius: radius.pill,
              border: `2px solid ${P.border}`,
              background: P.bgTertiary,
              color: P.textSecondary,
              fontSize: 14,
            }}
          >
            <Img
              src={staticFile(s.icon)}
              style={{
                width: 18,
                height: 18,
                objectFit: 'contain',
                filter: 'grayscale(1) opacity(0.55)',
              }}
            />
            {s.name}
          </div>
        ))}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '7px 13px',
            borderRadius: radius.pill,
            border: `2px dashed ${P.accent}`,
            background: P.accentLight,
            color: P.accentText,
            fontSize: 14,
            opacity: 0.4 + 0.6 * p,
          }}
        >
          <PlusIcon size={14} color={P.accent} />
          Mistral
        </div>
      </div>

      {[
        {label: 'URL', value: 'https://chat.mistral.ai/chat'},
        {label: 'Input selector', value: 'textarea[name="message"]'},
      ].map((field) => (
        <div key={field.label} style={{display: 'flex', flexDirection: 'column', gap: 5}}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: P.textMuted,
            }}
          >
            {field.label}
          </span>
          <div
            style={{
              background: P.bgPrimary,
              border: `1px solid ${P.border}`,
              borderRadius: radius.sm,
              padding: '9px 12px',
              fontSize: 13,
              color: P.textSecondary,
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {field.value}
          </div>
        </div>
      ))}
    </div>
  );
};

/** Grid view or real tabs. */
const OutputMock: React.FC = () => {
  const frame = useCurrentFrame();
  const swap = ramp(frame, 52, 16);

  const Option: React.FC<{label: string; hint: string; on: boolean}> = ({
    label,
    hint,
    on,
  }) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: radius.md,
        border: `1px solid ${on ? P.accent : P.border}`,
        background: on ? P.accentLight : P.bgPrimary,
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          border: `2px solid ${on ? P.accent : P.textMuted}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {on ? (
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: P.accent,
            }}
          />
        ) : null}
      </div>
      <div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: on ? P.textPrimary : P.textSecondary,
          }}
        >
          {label}
        </div>
        <div style={{fontSize: 12.5, color: P.textMuted}}>{hint}</div>
      </div>
    </div>
  );

  return (
    <div style={{width: 380, display: 'flex', flexDirection: 'column', gap: 12}}>
      <Option
        label="Grid view"
        hint="Every tool in one tab"
        on={swap < 0.5}
      />
      <Option
        label="New tabs"
        hint="Real tabs, filed into one group"
        on={swap >= 0.5}
      />
      <div
        style={{
          display: 'flex',
          gap: 6,
          marginTop: 4,
          opacity: swap,
        }}
      >
        {SERVICES.slice(0, 3).map((s) => (
          <div
            key={s.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 8,
              background: P.bgTertiary,
              border: `1px solid ${P.border}`,
              borderBottom: `2px solid ${P.accent}`,
              fontSize: 12,
              color: P.textSecondary,
            }}
          >
            <Img
              src={staticFile(s.icon)}
              style={{width: 13, height: 13, objectFit: 'contain'}}
            />
            {s.name}
          </div>
        ))}
      </div>
    </div>
  );
};

export const Features: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{background: P.bgPrimary}}>
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(1200px 600px at 50% 0%, rgba(251,146,60,0.10), transparent 65%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 196,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Caption
          palette={P}
          kicker="And then some"
          title="Seven tools out of the box. Or your own."
          progress={ramp(frame, 2, 14)}
          size={54}
        />
      </div>

      <Card
        index={0}
        title="Ask from any page"
        body="Select text, right-click, Ask Puchne — or press Ctrl + Shift + S."
      >
        <ContextMenuMock />
      </Card>
      <Card
        index={1}
        title="Add your own tools"
        body="Give it a URL and an input selector, then test it in one click."
      >
        <CustomToolMock />
      </Card>
      <Card
        index={2}
        title="Grid or real tabs"
        body="One tab with every answer, or real tabs filed into a group."
      >
        <OutputMock />
      </Card>
    </AbsoluteFill>
  );
};
