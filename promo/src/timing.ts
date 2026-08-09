/**
 * The whole edit in one table. Every scene reads its window from here so the
 * running order can be re-cut in one place without touching any scene code.
 */

export const FPS = 30;

/** Seconds → frames. */
export const s = (seconds: number) => Math.round(seconds * FPS);

/** Frames a scene spends cross-fading into the one before it. */
export const CROSSFADE = s(0.4);

type SceneName = 'hook' | 'logo' | 'overlay' | 'grid' | 'features' | 'cta';

const RUNNING_ORDER: [SceneName, number][] = [
  ['hook', 5], // the copy-paste treadmill
  ['logo', 4], // logo + tagline
  ['overlay', 8.5], // Ctrl+Shift+X → chips → prompt → send
  ['grid', 7.5], // every answer side by side + follow-up
  ['features', 5.5], // three feature cards
  ['cta', 5], // privacy + install
];

export type SceneWindow = {from: number; durationInFrames: number};

const build = () => {
  const out = {} as Record<SceneName, SceneWindow>;
  let cursor = 0;
  for (const [name, seconds] of RUNNING_ORDER) {
    const durationInFrames = s(seconds);
    out[name] = {from: cursor, durationInFrames};
    cursor += durationInFrames;
  }
  return {scenes: out, total: cursor};
};

const built = build();

export const SCENES = built.scenes;

/** Total length of the film, plus a beat so the last frame isn't a hard cut. */
export const TOTAL_FRAMES = built.total + s(0.4);
