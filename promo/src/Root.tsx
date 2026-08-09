import React from 'react';
import {Composition} from 'remotion';
import {LaunchPromo} from './LaunchPromo';
import {FPS, TOTAL_FRAMES} from './timing';

const shared = {
  component: LaunchPromo,
  durationInFrames: TOTAL_FRAMES,
  fps: FPS,
};

export const RemotionRoot: React.FC = () => (
  <>
    {/* The master cut — YouTube, the Chrome Web Store listing, the README. */}
    <Composition id="LaunchPromo" {...shared} width={1920} height={1080} />
    {/* Feed posts. */}
    <Composition id="LaunchPromoSquare" {...shared} width={1080} height={1080} />
    {/* Shorts / Reels / Stories. */}
    <Composition
      id="LaunchPromoVertical"
      {...shared}
      width={1080}
      height={1920}
    />
  </>
);
