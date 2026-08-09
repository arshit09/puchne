# Puchne — website

The marketing and documentation site: nine static pages, one stylesheet, one
script. No framework, no build step, no CDN — open `index.html` in a browser and
it works.

## Pages

| File | What it is |
|------|------------|
| `index.html` | Landing page — hero, launch film, feature highlights, use-case teasers, privacy, FAQ |
| `features.html` | Every feature in detail, with a grid-vs-tabs comparison |
| `use-cases.html` | Ten use cases, each with a starter prompt and the setup that suits it |
| `install.html` | Download &amp; install manual — requirements, load unpacked, shortcuts, updating, browser support |
| `guide.html` | The how-to manual — first send, grid view, Ask Puchne, custom tools, selectors, keyboard reference |
| `settings.html` | Settings reference — every option and its default, section by section |
| `faq.html` | FAQ and troubleshooting |
| `privacy.html` | What is stored, where, and every permission explained |
| `404.html` | Not-found page |

## Run it locally

Any static server works. Two that need nothing installed globally:

```bash
python -m http.server 8000
```

```bash
npx serve .
```

Then open <http://localhost:8000>. Opening the files directly with `file://`
works too — every link is relative.

## Deploying

**GitHub Pages.** Settings → Pages → deploy from a branch, folder `/website`.
The `.nojekyll` file is there so Pages serves the folder as-is.

**Netlify / Vercel / Cloudflare Pages.** No build command; publish directory
`website`.

**Anywhere else.** Copy the folder onto any web host. `404.html` is picked up
automatically by GitHub Pages, Netlify and Cloudflare Pages.

## How it's put together

- `assets/css/site.css` — one stylesheet. The palette at the top is copied from
  the extension's `styles/popup.css` and `styles/overlay.css` (the Google light
  and dark palettes, the `#fb923c` accent, the `system-ui` font stack), the same
  way `promo/src/theme.ts` does it. **If a colour changes in the extension,
  change it here too.** One deliberate exception: `--text-caption`, a slightly
  darker grey for captions and small print, because the extension's muted grey
  sits under 4.5:1 on white and this site uses it for real sentences.
- `assets/js/site.js` — theme toggle, mobile nav, copy buttons on code blocks,
  scroll-spy for the docs sidebars, reveal-on-scroll. No dependencies.
- Each page carries its own header and footer markup. There are nine copies;
  that is the price of having no build step. If you edit the nav, edit them all.
- Light and dark both ship. The theme follows the OS until a visitor picks a
  side, and an inline snippet in every `<head>` applies the stored choice before
  first paint so there's no flash. That snippet also sets `class="js"`.

## Illustrations and motion

The site leans on pictures rather than paragraphs. Everything animated is built
from HTML and CSS — there are no GIFs, no Lottie, no SVG animation libraries and
no extra image files.

The reusable pieces live under `MOTION & ILLUSTRATIONS` in `site.css`:

| Class | What it draws |
|-------|---------------|
| `.stage` | The hero: a panel typing a prompt, rays fanning out, four tools answering |
| `.mock` + `.mock-bar` | A browser window frame — the shell for everything below |
| `.gridmock` | Grid view. **Hovering a column really does expand it**, same as the product |
| `.tabsmock` | Tabs sliding into a Chrome tab group |
| `.pagemock` | A page selection with the right-click menu popping in |
| `.extmock` | `chrome://extensions` — developer-mode switch, Load unpacked, a pointer |
| `.flow` / `.flow-arrow` | Numbered steps with a dot travelling between them |
| `.diagram` / `.node` | Where data goes, and where it doesn't (`.node.off`) |
| `.ln` | Skeleton answer lines; add `.anim` to a parent to make them stream |
| `.versus` | Two options side by side, both stretched to the same height |
| `.shot-grid` / `.shot-card` | Screenshot thumbnails, cropped to one ratio |
| `.tiles` / `.iconrows` | An icon and four words instead of a sentence |

**Tile grids use fixed column counts, never `auto-fit`.** `auto-fit` packs in as
many as will fit, which turned an eight-tile group into a row of seven plus a
lone orphan. Pick the modifier whose columns divide the tile count evenly at
every breakpoint: default `4 / 2 / 1` for 4 and 8 tiles, `.t6` → `3 / 2 / 1` for
6, `.t3` → `3 / 3 / 1` for 3. Add a tile and you must re-check the modifier.

**Screenshots go one per row, full width.** The sources are 1440px-wide captures
of a 1440px window, at 788, 768 and 1425px tall. That constrains the layout more
than it looks:

| Arrangement | Scale | 17px UI text becomes | Verdict |
|---|---|---|---|
| Three across (342px) | 3.7–4.2× down | ~4px | unreadable mush |
| Three across, 1:1 crop | none | 17px | sharp, but reads as an extreme close-up |
| **One per row (1070px)** | **1.35× down** | **~12.6px** | **whole window, still legible** |

More resolution would not have helped the first row: at a 342px display size the
text is doomed no matter how big the source is. The only variables are *how much
of the image you show* and *how large you show it* — you can have compact,
complete or sharp, and only two at a time. The site drops compact.

The box is `aspect-ratio: 2 / 1` with a top-anchored `cover`. Because 2:1 is
wider than all three natural ratios, the scale is always set by the width, so
nothing is ever cropped sideways and nothing is ever zoomed — only the bottom is
trimmed, which also makes every card the same height. Add a screenshot of the
same width and it lines up automatically.

**`.gm-cols` is deliberately unscoped.** Grid view is *side by side* — that is
the entire claim — so the flex row must apply to every mock that uses it, not
only to `.gridmock`. It was once scoped, and the comparison mock (which has no
`.gridmock` class) stacked its columns vertically, illustrating the opposite of
what the heading said.

Four rules keep this honest:

1. **The resting state is the base style; movement is added only inside
   `@media (prefers-reduced-motion: no-preference)`.** Turn motion off and every
   illustration still reads correctly — it just stops moving. Nothing is
   explained *only* while something animates.
2. **The mocks are `aria-hidden="true"`.** They are decoration, so each one sits
   next to a heading and a short icon list carrying the same meaning in text.
3. **Alignment is structural, never eyeballed.** The hero's connector column and
   its card column are both four equal rows with the same gap, stretched to the
   same height, so row *n* of the connector is centred on card *n* at every
   width — measured at 0.00px offset from 861px to 1440px. The trunk's insets
   are `calc((100% - 3 × gap) / 8)`, which is exactly half a row. Pointers live
   *inside* the element they point at, so they cannot drift when the container
   resizes. If you add a connector, derive it from the same grid — don't pick
   percentages that look about right, because they stop being right at the next
   breakpoint.
4. **Every loop runs on the same 9-second clock,** so two illustrations on
   screen together never fight. Within that loop the *finished* state holds for
   most of the time; a mock that spends a third of its loop empty reads as
   broken, not animated. The hero is the one exception where the empty phase
   carries meaning — the answers arrive after the send — so its skeleton lines
   use `lnDraw` while standalone mocks use `lnDrawEarly`.

Reveal-on-scroll (`data-reveal`) hides elements only while `class="js"` is on
`<html>`, and `site.js` has a 1.6-second failsafe that shows everything if the
IntersectionObserver never reports. Losing the entrance is fine; losing the
content is not.

## Assets

Copied in from the rest of the repo — re-copy after regenerating them:

| In `website/assets/` | Source |
|---------------------|--------|
| `img/screenshots/*.png` | `docs/screenshots/` |
| `img/screenshots/grid-view.png` | A frame from the launch film (`promo/out/puchne-launch.mp4` at ~20.7s) |
| `img/icons/*` | `icons/app/` and `icons/services/` |
| `video/puchne-launch.mp4`, `video/poster.png` | `promo/out/` |

The grid-view still comes from the promo film, where the answer text is
illustrative placeholder copy — the captions on the site say so, and they should
keep saying so unless it's replaced with a real screenshot.

## Editing checklist

- The version number appears on `install.html` (hero note and the "Load it into
  Chrome" step). Bump both with `manifest.json`.
- Screenshots have explicit `width`/`height` so the page doesn't jump while they
  load. Update those attributes if you replace an image with a different size.
- Every claim about what the extension stores or reaches is checked against the
  code (`scripts/background.js`, `manifest.json`, `rules/grid_headers.json`).
  Keep it that way — `privacy.html` is the page people will hold you to.
