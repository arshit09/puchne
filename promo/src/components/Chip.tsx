import React from 'react';
import {Img, staticFile} from 'remotion';
import {radius, type Palette, type Service} from '../theme';

/**
 * `.chip` from styles/panel.css, overlay variant (15px label, 20px icon).
 * Off is an outline on `--bg-secondary`; on is `--accent` border over
 * `--accent-light` fill, and the icon loses its greyscale filter.
 */
export const Chip: React.FC<{
  service: Service;
  palette: Palette;
  active: boolean;
  /** 0 → 1 flip progress, so switching a tool on can land with a small pop. */
  activation?: number;
  fontSize?: number;
}> = ({service, palette, active, activation = active ? 1 : 0, fontSize = 15}) => {
  const on = activation > 0.5;
  // A 4% overshoot at the halfway point of the flip. The real chips have
  // `transition: none`; this is the one liberty the video takes, and it is
  // gone within four frames.
  const pop = 1 + 0.04 * Math.sin(Math.PI * Math.min(1, activation));

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        padding: '8px 14px',
        minWidth: 44,
        borderRadius: radius.pill,
        border: `2px solid ${on ? palette.accent : palette.border}`,
        background: on ? palette.accentLight : palette.bgSecondary,
        color: on ? palette.textPrimary : palette.textSecondary,
        fontSize,
        fontWeight: 400,
        whiteSpace: 'nowrap',
        transform: `scale(${pop})`,
      }}
    >
      <Img
        src={staticFile(service.icon)}
        style={{
          width: 20,
          height: 20,
          flexShrink: 0,
          objectFit: 'contain',
          filter: on ? 'none' : 'grayscale(1) opacity(0.55)',
        }}
      />
      {service.name}
    </div>
  );
};
