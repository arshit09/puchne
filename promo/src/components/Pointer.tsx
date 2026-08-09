import React from 'react';
import {interpolate} from 'remotion';
import {PointerIcon} from './Icons';

/**
 * The on-screen cursor. `clicks` are frame numbers; each one throws a short
 * accent ripple so the viewer can see where the click landed.
 */
export const Pointer: React.FC<{
  x: number;
  y: number;
  frame: number;
  clicks?: number[];
  opacity?: number;
  accent?: string;
}> = ({x, y, frame, clicks = [], opacity = 1, accent = '#fb923c'}) => {
  const ripple = clicks
    .map((at) => {
      const t = frame - at;
      if (t < 0 || t > 16) return null;
      const p = t / 16;
      return {
        key: at,
        size: interpolate(p, [0, 1], [8, 60]),
        alpha: interpolate(p, [0, 1], [0.55, 0]),
      };
    })
    .filter(Boolean) as {key: number; size: number; alpha: number}[];

  const press = clicks.some((at) => frame >= at && frame < at + 5) ? 0.9 : 1;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        opacity,
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      {ripple.map((r) => (
        <div
          key={r.key}
          style={{
            position: 'absolute',
            left: -r.size / 2 + 2,
            top: -r.size / 2 + 2,
            width: r.size,
            height: r.size,
            borderRadius: '50%',
            border: `2px solid ${accent}`,
            opacity: r.alpha,
          }}
        />
      ))}
      <div style={{transform: `scale(${press})`, transformOrigin: 'top left'}}>
        <PointerIcon size={24} />
      </div>
    </div>
  );
};
