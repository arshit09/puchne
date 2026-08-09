import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {ramp} from '../anim';
import {CROSSFADE, type SceneWindow} from '../timing';

const Fade: React.FC<{
  durationInFrames: number;
  children: React.ReactNode;
}> = ({durationInFrames, children}) => {
  const frame = useCurrentFrame();
  const opacity = Math.min(
    ramp(frame, 0, CROSSFADE),
    1 - ramp(frame, durationInFrames, CROSSFADE),
  );
  return <AbsoluteFill style={{opacity}}>{children}</AbsoluteFill>;
};

/**
 * Places a scene on the timeline and cross-fades it with its neighbours: each
 * scene runs CROSSFADE frames past its slot and fades out over the next one,
 * which is already fading in underneath.
 */
export const Scene: React.FC<{
  window: SceneWindow;
  name: string;
  children: React.ReactNode;
}> = ({window: w, name, children}) => (
  <Sequence
    from={w.from}
    durationInFrames={w.durationInFrames + CROSSFADE}
    name={name}
    layout="none"
  >
    <Fade durationInFrames={w.durationInFrames}>{children}</Fade>
  </Sequence>
);
