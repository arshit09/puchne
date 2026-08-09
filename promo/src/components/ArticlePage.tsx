import React from 'react';
import {FONT} from '../theme';

const BODY = [
  'Two things get called "quantum" in the same breath and they are not the same thing at all.',
  'The first is superposition: a bit that has not made up its mind yet, and does not have to until you look.',
  'The second is interference — the part that actually does the work, and the part every explainer skips.',
  'Most of the engineering effort goes into keeping the machine cold and still rather than on the calculation itself.',
  'So the race is not really about raw speed. It is about error correction: keeping a fragile state intact for long enough that the answer at the end still means something.',
];

/**
 * The host page the overlay opens on top of. Deliberately ordinary — the
 * point of the shot is that Puchne works on any page.
 */
export const ArticlePage: React.FC = () => (
  <div
    style={{
      width: '100%',
      height: '100%',
      background: '#ffffff',
      fontFamily: FONT,
      padding: '58px 0',
    }}
  >
    <div style={{width: 760, margin: '0 auto'}}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#9aa0a6',
          marginBottom: 14,
        }}
      >
        Science
      </div>
      <h1
        style={{
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: 46,
          lineHeight: 1.15,
          color: '#202124',
          margin: '0 0 26px',
        }}
      >
        Quantum computing, explained
      </h1>
      {BODY.map((line) => (
        <p
          key={line}
          style={{
            fontSize: 17,
            lineHeight: 1.75,
            color: '#3c4043',
            margin: '0 0 20px',
          }}
        >
          {line}
        </p>
      ))}
    </div>
  </div>
);
