# Puchne — launch promo

The launch film, built with [Remotion](https://www.remotion.dev/): the video is
a React app, and every frame is rendered from the same design tokens the
extension ships with.

**36 seconds, six scenes:**

| # | Scene | What it shows |
|---|-------|---------------|
| 1 | The old way | One prompt, copy-pasted across four tabs |
| 2 | Puchne | Logo, tagline, the Gujarati origin of the name |
| 3 | Ask once | `Ctrl + Shift + X` on a real page → chips → prompt → send |
| 4 | Compare | Grid view answering in parallel, then a follow-up to all of them |
| 5 | And then some | Right-click menu, custom tools, grid vs. real tabs |
| 6 | Install | Privacy promise, repo, licence |

## Run it

```bash
npm install
```

Open the editor — scrub the timeline, tweak a scene, see it live:

```bash
npm run studio
```

Render the master cut to `out/puchne-launch.mp4`:

```bash
npm run render
```

Other outputs:

```bash
npm run render:square
```

```bash
npm run render:vertical
```

```bash
npm run render:gif
```

`render:gif` produces a half-size, every-other-frame GIF — small enough to drop
straight into the README. `npm run still` grabs a poster frame.

The square (1080×1080) and vertical (1080×1920) cuts letterbox the same 16:9
stage and fill the spare space with the wordmark, so there is one timeline to
maintain rather than three.

**Know the trade-off before you post the vertical one.** At 9:16 the stage only
fills about a third of the frame, so the chips and the prompt text end up small
on a phone — it works as a teaser, not as a UI walkthrough. Square holds up
fine. A vertical cut that really reads would need per-scene layouts (panel
centred and enlarged, captions stacked above it, the grid re-flowed to one
column), which is a bigger job than letterboxing and deliberately not done here.

## How it stays on-brand

`src/theme.ts` is a copy of the extension's CSS custom properties — the Google
dark palette, the `#fb923c` accent, `--radius` 14 / 8 / 6, and the `system-ui`
font stack. Every component is built to the real thing's box model:

- `components/PuchnePanel.tsx` → `styles/panel.css`, overlay variant
  (`.modal-container` + `.pb-panel[data-variant="overlay"]`)
- `components/Chip.tsx` → `.chip` / `.chip.active`, including the greyscale
  filter on inactive service icons
- `components/GridView.tsx` → `pages/grid.html` + `styles/grid.css`, bottom bar
  and all
- `public/icons/` is copied from the extension's `icons/`

If a colour, radius or layout changes in the extension, change it in
`src/theme.ts` (and the component that mirrors that stylesheet) so the film does
not drift away from the product.

**One deliberate liberty:** the real chips have `transition: none`; the video
gives them a 4% pop as they switch on, because a hard cut reads as a glitch at
30fps. Everything else matches.

## Structure

```
src/
  index.ts        registerRoot — the Remotion entry point
  Root.tsx        the three compositions (16:9, 1:1, 9:16)
  LaunchPromo.tsx the stage: scales 1920×1080 into any format, places scenes
  timing.ts       the running order — re-cut the film from this one table
  theme.ts        design tokens copied from the extension
  anim.ts         easing, springs, typing, pointer paths
  components/     UI rebuilt from the extension's stylesheets
  scenes/         one file per scene
tools/
  make-music.mjs  synthesises the score from timing.ts
public/
  icons/          copied from the extension
  music.mp3       the score
```

To re-cut, edit the seconds in `RUNNING_ORDER` in `src/timing.ts`; every scene
reads its window from there. Beat timings inside a scene live in that scene's
`T` object.

## The music

`public/music.mp3` is an original score, synthesised sample by sample by
[tools/make-music.mjs](tools/make-music.mjs) — no samples, no library, no
licence to clear.

```bash
npm run music
```

That rewrites `public/music.wav`; re-encode it with the ffmpeg Remotion already
ships:

```bash
npx remotion ffmpeg -i public/music.wav -codec:a libmp3lame -b:a 192k -y public/music.mp3
```

The `.wav` is an intermediate and is gitignored; the `.mp3` is committed so
`npm run render` works on a fresh clone.

**It is cut to the film, not laid under it.** The script reads the scene table
straight out of `src/timing.ts`, so re-cut the film, re-run `npm run music`, and
the score follows. What lands where:

- **Chord changes on every cut.** Am → F → C → G → Am → F → C. The turn to F
  hits the privacy line at 30.5s; the final C resolves half a beat before the
  logo lockup at 32.5s.
- **A riser into each cut** and a low impact on it.
- **The pulse.** Every scene boundary falls on a beat at 120bpm (5.0s, 9.0s,
  17.5s, 25.0s, 30.5s, 35.5s → beats 10, 18, 35, 50, 61, 71), so a single
  four-on-the-floor runs from the demo to the feature cards without drifting.
  It is sparse and half-time before that, and gone for the closing.
- **Notes on the clicks** — a bell tone on each of the three chip clicks, a
  brighter one on the send, another on the follow-up send.
- **A dynamic arc**: about −18 dBFS RMS under the problem statement, −15 while
  the product is on screen, easing back for the closing. Peaks at −1 dBFS.

If you replace it with a licensed track instead, keep `<Audio>` in
`src/LaunchPromo.tsx` pointing at the new file — that is the only wiring.

## Note on the mock answers

The answers streaming in the grid scene are illustrative placeholder copy, not
real output from any of the tools. Keep it that way if you edit them.
