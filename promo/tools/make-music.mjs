#!/usr/bin/env node
/**
 * ============================================================
 *  Puchne promo — score generator
 * ============================================================
 *
 *  Writes public/music.wav: an original underscore synthesised
 *  from scratch, so the film ships with no licensing question
 *  attached to it.
 *
 *  It is built around the edit rather than laid under it. The
 *  scene table is READ OUT OF src/timing.ts, so the chord
 *  changes, risers and impacts land on the cuts by construction
 *  — re-cut the film and re-run this, and the score follows.
 *
 *  Every scene boundary happens to fall on a beat at 120bpm
 *  (5.0s, 9.0s, 17.5s, 25.0s, 30.5s, 35.5s → beats 10, 18, 35,
 *  50, 61, 71), so the pulse runs unbroken underneath.
 *
 *  Usage:  node tools/make-music.mjs
 * ============================================================
 */

import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const SR = 44100;
const BPM = 120;
const BEAT = 60 / BPM;

// ── The edit, read from the single source of truth ──────────
const timing = readFileSync(join(ROOT, 'src', 'timing.ts'), 'utf8');

const fpsMatch = timing.match(/export const FPS = (\d+)/);
if (!fpsMatch) throw new Error('Could not read FPS out of src/timing.ts');
const FPS = Number(fpsMatch[1]);

const order = [...timing.matchAll(/\['(\w+)',\s*([\d.]+)\]/g)].map((m) => [
  m[1],
  Number(m[2]),
]);
if (order.length < 2) {
  throw new Error(
    'Could not read RUNNING_ORDER out of src/timing.ts — has its shape changed?',
  );
}

const tailMatch = timing.match(/built\.total \+ s\(([\d.]+)\)/);
const TAIL = tailMatch ? Number(tailMatch[1]) : 0;

const cue = {};
let cursor = 0;
for (const [name, seconds] of order) {
  const frames = Math.round(seconds * FPS);
  cue[name] = {start: cursor, end: cursor + frames};
  cursor += frames;
}
const LAST_FRAME = cursor;
const TOTAL_FRAMES = cursor + Math.round(TAIL * FPS);

const N = Math.ceil((TOTAL_FRAMES / FPS + 0.9) * SR); // +tail for the ring-out
const L = new Float32Array(N);
const R = new Float32Array(N);
const SEND = new Float32Array(N); // reverb bus

const sec = (frame) => frame / FPS;
const idx = (t) => Math.round(t * SR);

// ── Notes ──────────────────────────────────────────────────
const SEMI = {C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2};
const hz = (name) => {
  const m = /^([A-G])(#?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`Bad note: ${name}`);
  const semis = SEMI[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) - 4) * 12;
  return 440 * 2 ** (semis / 12);
};

/**
 * Am - F - C - G - Am - F - C. The turn to F lands on the privacy line and
 * the final C resolves as the logo lockup arrives, half a beat ahead of it.
 */
const SECTIONS = [
  {from: cue.hook.start, to: cue.logo.start, chord: ['A2', 'E3', 'A3', 'C4'], bass: 'A1'},
  {from: cue.logo.start, to: cue.overlay.start, chord: ['F2', 'C3', 'F3', 'A3'], bass: 'F1'},
  {from: cue.overlay.start, to: cue.grid.start, chord: ['C3', 'G3', 'C4', 'E4'], bass: 'C2'},
  {from: cue.grid.start, to: cue.features.start, chord: ['G2', 'D3', 'G3', 'B3'], bass: 'G1'},
  {from: cue.features.start, to: cue.cta.start, chord: ['A2', 'E3', 'A3', 'C4'], bass: 'A1'},
  {from: cue.cta.start, to: cue.cta.start + 60, chord: ['F2', 'C3', 'F3', 'A3'], bass: 'F1'},
  {from: cue.cta.start + 60, to: TOTAL_FRAMES, chord: ['C3', 'G3', 'C4', 'E4'], bass: 'C2'},
];

/** Cuts that get a riser into them and an impact on them. */
const BOUNDARIES = [
  cue.logo.start,
  cue.overlay.start,
  cue.grid.start,
  cue.features.start,
  cue.cta.start,
];

/**
 * Moments inside a scene worth a note of their own. Frames are global; the
 * local numbers come from each scene's `T` table.
 */
const ACCENTS = [
  {frame: cue.overlay.start + 54, note: 'E5', gain: 0.05}, // ChatGPT chip
  {frame: cue.overlay.start + 64, note: 'G5', gain: 0.05}, // Claude chip
  {frame: cue.overlay.start + 74, note: 'C6', gain: 0.05}, // Gemini chip
  {frame: cue.overlay.start + 202, note: 'E6', gain: 0.08}, // send
  {frame: cue.grid.start + 152, note: 'D6', gain: 0.07}, // follow-up send
];

// ── Voices ─────────────────────────────────────────────────
let seed = 20260808;
const noise = () => {
  // xorshift, so a re-run produces a byte-identical file
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed / 0x80000000) % 1;
};

/** Warm, slightly hollow tone for the pad. */
const padOsc = (phase) =>
  Math.sin(phase) + 0.34 * Math.sin(2 * phase) + 0.13 * Math.sin(3 * phase);

const write = (i, l, r, send = 0) => {
  if (i < 0 || i >= N) return;
  L[i] += l;
  R[i] += r;
  SEND[i] += send;
};

// ── Pad: one chord per section, overlapping into the next ───
for (const s of SECTIONS) {
  const start = sec(s.from) - 0.5; // swell up into the cut
  const stop = sec(s.to) + 0.7; // and bleed past it
  const i0 = idx(start);
  const i1 = Math.min(N, idx(stop));
  const dur = (i1 - i0) / SR;

  s.chord.forEach((name, v) => {
    const f = hz(name);
    const spread = v / Math.max(1, s.chord.length - 1);
    const detune = (v % 2 ? 1 : -1) * 0.0018;
    let pa = 0;
    let pb = 0;
    const wa = (2 * Math.PI * f * (1 + detune)) / SR;
    const wb = (2 * Math.PI * f * (1 - detune)) / SR;

    for (let i = i0; i < i1; i++) {
      const t = (i - i0) / SR;
      // slow swell in, hold, release out
      const env =
        Math.min(1, t / 0.85) * Math.min(1, Math.max(0, (dur - t) / 1.0));
      pa += wa;
      pb += wb;
      const v0 = (padOsc(pa) + padOsc(pb)) * 0.5;
      const a = env * 0.042;
      write(i, v0 * a * (1 - spread * 0.5), v0 * a * (0.5 + spread * 0.5), v0 * a * 0.55);
    }
  });
}

// ── Sub bass: the root of each section ─────────────────────
for (const s of SECTIONS) {
  const i0 = idx(sec(s.from));
  const i1 = Math.min(N, idx(sec(s.to) + 0.5));
  const dur = (i1 - i0) / SR;
  const f = hz(s.bass);
  let p = 0;
  const w = (2 * Math.PI * f) / SR;
  for (let i = i0; i < i1; i++) {
    const t = (i - i0) / SR;
    const env =
      Math.min(1, t / 0.35) * Math.min(1, Math.max(0, (dur - t) / 0.6));
    p += w;
    const v = Math.sin(p) * 0.85 + Math.sin(2 * p) * 0.15;
    const a = env * 0.10;
    write(i, v * a, v * a);
  }
}

// ── Kick: four on the floor while the product is on screen ─
const kick = (t0, gain) => {
  const i0 = idx(t0);
  let p = 0;
  for (let i = i0; i < Math.min(N, i0 + Math.round(0.4 * SR)); i++) {
    const t = (i - i0) / SR;
    const f = 42 + 110 * Math.exp(-t * 30);
    p += (2 * Math.PI * f) / SR;
    const env = Math.exp(-t * 12);
    const v = Math.sin(p) * env * gain;
    write(i, v, v);
  }
};

/** A dry tick on the offbeats — keeps the busy scenes moving. */
const tick = (t0, gain) => {
  const i0 = idx(t0);
  let lp = 0;
  for (let i = i0; i < Math.min(N, i0 + Math.round(0.09 * SR)); i++) {
    const t = (i - i0) / SR;
    const n = noise();
    lp += 0.55 * (n - lp);
    const v = (n - lp) * Math.exp(-t * 55) * gain;
    write(i, v * 0.8, v, v * 0.3);
  }
};

for (let b = 0; b * BEAT < TOTAL_FRAMES / FPS; b++) {
  const t = b * BEAT;
  const f = t * FPS;

  // Half-time under the logo, full pulse from the demo to the feature cards.
  if (f >= cue.logo.start && f < cue.overlay.start) {
    if (b % 2 === 0) kick(t, 0.20);
  } else if (f >= cue.overlay.start && f < cue.cta.start) {
    kick(t, 0.30);
    if (f >= cue.grid.start) tick(t + BEAT / 2, 0.055);
  } else if (f < cue.logo.start && b % 4 === 0) {
    kick(t, 0.14); // sparse, unresolved — the "old way"
  }
}

// ── Arpeggio: enters with the product, drops out for the CTA ─
const ARP = [0, 1, 2, 3, 2, 1];
{
  const step = BEAT / 2; // eighth notes
  for (let k = 0; ; k++) {
    const t = k * step;
    const f = t * FPS;
    if (t > TOTAL_FRAMES / FPS) break;
    if (f < cue.overlay.start || f >= cue.cta.start) continue;

    const s = SECTIONS.find((x) => f >= x.from && f < x.to);
    if (!s) continue;

    const name = s.chord[ARP[k % ARP.length] % s.chord.length];
    const octave = f >= cue.grid.start && k % 4 === 0 ? 2 : 1; // lift in the grid
    const freq = hz(name) * octave;
    const gain = f >= cue.grid.start ? 0.052 : 0.038;

    const i0 = idx(t);
    let p = 0;
    const w = (2 * Math.PI * freq) / SR;
    for (let i = i0; i < Math.min(N, i0 + Math.round(0.45 * SR)); i++) {
      const tt = (i - i0) / SR;
      p += w;
      const env = Math.exp(-tt * 11) * Math.min(1, tt / 0.004);
      const v = (Math.sin(p) + 0.28 * Math.sin(3 * p)) * env * gain;
      const pan = (k % 2) * 0.4;
      write(i, v * (1 - pan), v * (0.6 + pan), v * 0.75);
    }
  }
}

// ── Risers and impacts on the cuts ─────────────────────────
const riser = (tCut, len = 1.1) => {
  const i0 = idx(tCut - len);
  const i1 = idx(tCut);
  let lp = 0;
  let p = 0;
  for (let i = Math.max(0, i0); i < Math.min(N, i1); i++) {
    const x = (i - i0) / (i1 - i0); // 0 → 1 at the cut
    const n = noise();
    lp += (0.02 + 0.5 * x * x) * (n - lp);
    const hp = n - lp;
    // a sine sweep riding with it
    p += (2 * Math.PI * (260 + 1500 * x * x)) / SR;
    const v = (hp * 0.75 + Math.sin(p) * 0.25) * x * x * 0.075;
    write(i, v, v * 0.9, v * 0.5);
  }
};

const impact = (tCut, gain = 1) => {
  const i0 = idx(tCut);
  let p = 0;
  let lp = 0;
  for (let i = i0; i < Math.min(N, i0 + Math.round(1.2 * SR)); i++) {
    const t = (i - i0) / SR;
    const f = 38 + 44 * Math.exp(-t * 9);
    p += (2 * Math.PI * f) / SR;
    const boom = Math.sin(p) * Math.exp(-t * 5.5) * 0.17 * gain;
    const n = noise();
    lp += 0.35 * (n - lp);
    const swish = (n - lp) * Math.exp(-t * 7) * 0.045 * gain;
    write(i, boom + swish, boom + swish * 0.8, swish * 1.4);
  }
};

for (const frame of BOUNDARIES) {
  riser(sec(frame));
  impact(sec(frame));
}
// The end of the film gets the impact without a riser — nothing follows it.
impact(sec(LAST_FRAME), 0.8);

// ── Accents on the clicks ──────────────────────────────────
for (const a of ACCENTS) {
  const i0 = idx(sec(a.frame));
  const f = hz(a.note);
  let p1 = 0;
  let p2 = 0;
  const w1 = (2 * Math.PI * f) / SR;
  const w2 = (2 * Math.PI * f * 2.76) / SR; // bell-ish inharmonic partial
  for (let i = i0; i < Math.min(N, i0 + Math.round(1.4 * SR)); i++) {
    const t = (i - i0) / SR;
    p1 += w1;
    p2 += w2;
    const v =
      (Math.sin(p1) * Math.exp(-t * 5) + Math.sin(p2) * Math.exp(-t * 13) * 0.3) *
      a.gain;
    write(i, v * 0.85, v, v * 1.1);
  }
}

// ── Reverb (Schroeder) on the send bus ─────────────────────
const reverb = (input) => {
  const out = new Float32Array(input.length);
  for (const [delay, fb] of [
    [1557, 0.807],
    [1617, 0.822],
    [1491, 0.789],
    [1422, 0.771],
  ]) {
    const buf = new Float32Array(delay);
    let p = 0;
    for (let i = 0; i < input.length; i++) {
      const y = buf[p];
      out[i] += y * 0.25;
      buf[p] = input[i] + y * fb;
      p = p + 1 === delay ? 0 : p + 1;
    }
  }
  for (const delay of [225, 556]) {
    const buf = new Float32Array(delay);
    let p = 0;
    for (let i = 0; i < out.length; i++) {
      const y = buf[p];
      const x = out[i];
      out[i] = y - x;
      buf[p] = x + y * 0.7;
      p = p + 1 === delay ? 0 : p + 1;
    }
  }
  return out;
};

const wet = reverb(SEND);
const OFFSET = Math.round(0.011 * SR); // Haas offset, widens the tail
for (let i = 0; i < N; i++) {
  L[i] += wet[i] * 0.26;
  R[i] += wet[Math.max(0, i - OFFSET)] * 0.26;
}

// ── Master: soft clip, normalise, fade ─────────────────────
let peak = 0;
for (let i = 0; i < N; i++) {
  L[i] = Math.tanh(L[i] * 1.2) * 0.86;
  R[i] = Math.tanh(R[i] * 1.2) * 0.86;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const gain = peak > 0 ? 0.89 / peak : 1;

// The fade has to be finished by the last frame of the composition, not by the
// end of this file — Remotion truncates the audio at the composition length,
// and a fade that is still running at that point gets chopped off mid-level.
const FADE_IN = idx(0.35);
const FADE_END = idx(TOTAL_FRAMES / FPS);
const FADE_START = idx(TOTAL_FRAMES / FPS - 1.6);
for (let i = 0; i < N; i++) {
  let g = gain;
  if (i < FADE_IN) g *= i / FADE_IN;
  if (i > FADE_START) {
    g *= Math.max(0, 1 - (i - FADE_START) / (FADE_END - FADE_START));
  }
  L[i] *= g;
  R[i] *= g;
}

// ── WAV out ────────────────────────────────────────────────
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + N * 4, 4);
buf.write('WAVE', 8);
buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20); // PCM
buf.writeUInt16LE(2, 22); // stereo
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write('data', 36);
buf.writeUInt32LE(N * 4, 40);

const pcm = (v) => Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
let o = 44;
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(pcm(L[i]), o);
  buf.writeInt16LE(pcm(R[i]), o + 2);
  o += 4;
}

const out = join(ROOT, 'public', 'music.wav');
writeFileSync(out, buf);
console.log(
  `Wrote ${out} — ${(N / SR).toFixed(2)}s, ${(buf.length / 1e6).toFixed(1)} MB`,
);
console.log(
  `Chord changes at: ${SECTIONS.map((s) => sec(s.from).toFixed(1) + 's').join(', ')}`,
);
