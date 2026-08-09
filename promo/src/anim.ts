import {Easing, interpolate, spring} from 'remotion';

/** The extension's own easing curve — `cubic-bezier(0.2, 0.8, 0.2, 1)` from grid.css. */
export const EASE_OUT = Easing.bezier(0.2, 0.8, 0.2, 1);
/** Material standard curve, used by the grid's cell buttons. */
export const EASE_STD = Easing.bezier(0.4, 0, 0.2, 1);

/** 0 → 1 over `duration` frames starting at `start`, clamped at both ends. */
export const ramp = (
  frame: number,
  start: number,
  duration: number,
  easing = EASE_OUT,
) =>
  interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });

/** Fade in, hold, fade out — for anything that appears and leaves again. */
export const pulse = (
  frame: number,
  start: number,
  hold: number,
  fade = 8,
) => {
  const inP = ramp(frame, start, fade);
  const outP = 1 - ramp(frame, start + fade + hold, fade);
  return Math.min(inP, outP);
};

/** A spring that starts at `start` instead of frame 0. */
export const springAt = ({
  frame,
  fps,
  start,
  damping = 200,
  mass = 1,
  stiffness = 120,
}: {
  frame: number;
  fps: number;
  start: number;
  damping?: number;
  mass?: number;
  stiffness?: number;
}) =>
  spring({
    frame: frame - start,
    fps,
    config: {damping, mass, stiffness},
  });

/** A springy overshoot for things that should feel physical (cards, the logo). */
export const popAt = ({
  frame,
  fps,
  start,
}: {
  frame: number;
  fps: number;
  start: number;
}) =>
  spring({
    frame: frame - start,
    fps,
    config: {damping: 12, mass: 0.6, stiffness: 110},
  });

/**
 * How much of `text` has been typed by `frame`. Speeds are per frame, so 0.9
 * at 30fps is a brisk-but-readable ~27 characters a second.
 */
export const typed = (
  text: string,
  frame: number,
  start: number,
  charsPerFrame = 0.9,
) => {
  const chars = Math.floor(Math.max(0, frame - start) * charsPerFrame);
  return text.slice(0, Math.min(text.length, chars));
};

/** True while a text caret should be visible (blinks at ~1.7Hz). */
export const caretOn = (frame: number) => frame % 18 < 11;

export type Keyframe = [frame: number, x: number, y: number];

/** Interpolates a pointer path through a list of [frame, x, y] stops. */
export const path = (frame: number, stops: Keyframe[]) => {
  const frames = stops.map((k) => k[0]);
  const opts = {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_STD,
  } as const;
  return {
    x: interpolate(frame, frames, stops.map((k) => k[1]), opts),
    y: interpolate(frame, frames, stops.map((k) => k[2]), opts),
  };
};

/** A short squash on click — 1 → 0.88 → 1 across ~9 frames. */
export const clickScale = (frame: number, at: number) =>
  interpolate(frame, [at - 1, at + 3, at + 8], [1, 0.88, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT,
  });
