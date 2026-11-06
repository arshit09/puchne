<p align="center">
  <img src="icons/app/icon-128.png" alt="Puchne" width="96" />
</p>

<h1 align="center">Puchne</h1>

<p align="center"><b>One prompt. Every AI. At once.</b></p>

Ask once and Puchne sends your prompt to **ChatGPT, Claude, Gemini, Copilot, DeepSeek, Perplexity and Grok** at the same time — so you compare answers instead of copy-pasting across tabs.

*Puchne comes from the Gujarati **પૂછવું** (Puchhvu) — "to ask".*

<p align="center">
  <img src="docs/screenshots/popup.png" alt="Puchne open in the middle of a web page, with ChatGPT, Claude and Gemini switched on and a prompt typed in" />
</p>

---

## Features

- **Multicast prompting** — one box, every AI tool you've switched on.
- **Grid view** — all the answers side by side in a single tab. Hover to enlarge a cell, re-open a closed one, or reset the layout.
- **New tabs mode** — prefer real tabs? Puchne opens them and files them into one Chrome tab group.
- **Follow-up bar** — keep going without retyping: one input sends your next question to every AI that's already open.
- **Ask from any page** — select text and hit `Ctrl+Shift+S` (or right-click → *Ask Puchne*). Review the prompt first, or fire it off directly — to all your tools or just the ones you pick.
- **Open anywhere** — `Ctrl+Shift+X` pops Puchne up on any page as a floating overlay, or dock it as a browser sidebar.
- **Add your own tools** — Mistral, Qwen, Kimi, a self-hosted UI: give it a URL and an input selector, then test it in one click.
- **Auto-submit or pre-fill** — let Puchne press Enter for you, or leave the prompt in the box to edit first.
- **Handles the friction** — dismisses cookie banners in grid frames and waits for slow pages before typing.
- **Recent prompts** — reuse anything you've asked before, kept on your device only.
- **Made to live in** — system / light / dark theme, full keyboard access, and it respects reduced motion.

## Ask from any page

Select some text anywhere, right-click, and **Ask Puchne** is sitting in the menu — same as `Ctrl+Shift+S`. It either opens the prompt panel with the selection filled in, or sends it straight to your tools; you choose which in Settings.

![Ask Puchne in the right-click menu](docs/screenshots/context-menu.png)

## Settings

Everything is on one page — right-click the Puchne icon and pick **Options**. Changes save as you make them.

**AI Tools** — switch tools on and off, grant or withdraw a site, override the CSS selectors Puchne types into, or add a tool that isn't on the list.

![Puchne settings — AI Tools](docs/screenshots/settings-ai-tools.png)

**Appearance** — theme, where the overlay sits on the page, whether it docks as a sidebar, how tools are labelled, and whether recent prompts are kept. The live preview updates as you change them.

![Puchne settings — Appearance](docs/screenshots/settings-appearance.png)

**Behavior** — grid view or new tabs, auto-submit, the follow-up bar, hover-to-expand and its delay, cookie handling, and how long to wait before typing.

![Puchne settings — Behavior](docs/screenshots/settings-behavior.png)

**Ask Puchne** — whether the right-click menu and `Ctrl+Shift+S` show the prompt first or send it straight away, and which tools that send reaches.

![Puchne settings — Ask Puchne](docs/screenshots/settings-ask-puchne.png)

## How it works

Puchne has no server and calls no AI APIs. It opens each AI site in your browser and types into the site's own prompt box, the way you would.

**The parts.** The service worker is the hub. Prompts reach it from the panel or Ask Puchne, it opens the sites, and a content script does the typing inside each one.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/diagrams/overview-dark.png">
  <img src="docs/diagrams/overview-light.png" alt="Diagram of Puchne's parts: the prompt panel and Ask Puchne feed the service worker, which uses storage, opens the access window and drives the grid tab or new tabs. Header rules allow the grid's iframes, and a content script types into each site.">
</picture>

**One send.** The worker can't type into a site until its iframe exists, so the job is saved first. Once the grid's iframes are ready, the worker injects the scripts into each one in turn.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/diagrams/one-send-dark.png">
  <img src="docs/diagrams/one-send-light.png" alt="Numbered flow of one send in grid view: you press send, the service worker picks the tools and saves the job, the grid tab builds cells, iframes load with header rules allowing them, the worker injects scripts, the content script types, and the result is saved.">
</picture>

**Typing.** Each site uses a different editor, so Puchne types in the way that editor expects. If a site changes its markup, generic selectors give it a second chance.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/diagrams/typing-dark.png">
  <img src="docs/diagrams/typing-light.png" alt="Flow of typing into a site: find the prompt box, try generic selectors if it isn't found, type in one of three ways (ProseMirror for ChatGPT, Claude and Grok; textarea for Copilot and DeepSeek; contenteditable for Gemini and Perplexity), then send and report back.">
</picture>

**First use of a site.** Your prompt waits while Chrome asks for the site, then sends itself once you allow it. A prompt left waiting for over 5 minutes is dropped.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/diagrams/site-access-dark.png">
  <img src="docs/diagrams/site-access-light.png" alt="Numbered flow for the first use of a site: the panel spots a locked tool, the prompt is parked, Chrome asks you, scripts are registered, and the prompt sends if it is under 5 minutes old.">
</picture>

**Grid vs tabs.** The two modes open sites differently but share the same typing code. Follow-ups skip straight to injection, because the sites are already open.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/diagrams/grid-vs-tabs-dark.png">
  <img src="docs/diagrams/grid-vs-tabs-light.png" alt="Comparison of grid view and new tabs. Grid view opens one tab of iframes and injects one by one. New tabs opens one tab per tool and injects in parallel. Both use the same typing code, and follow-ups from the footer box or floating bar go straight to injection.">
</picture>

Diagrams drawn with [Sketchy](https://github.com/ddkbs/sketchy).

## Privacy

Puchne installs with access to **no websites at all**. The first time you turn a tool on, Chrome asks for that one site — and you can withdraw it from Settings whenever you like. No account, no server, no tracking: your prompts go straight from your browser to the AI sites you chose.

## Install

```bash
git clone https://github.com/arshit09/puchne.git
```

1. Open `chrome://extensions/` and turn on **Developer mode**.
2. Click **Load unpacked** and select the cloned folder.
3. Optional — change the shortcut keys at `chrome://extensions/shortcuts`.

## Packaging

The repo root holds more than the extension — `promo/` is the Remotion project
behind the launch video, `website/` is the launch and documentation site, and
`docs/` is the screenshots and diagrams above. Don't zip the root by hand; run:

```powershell
pwsh tools/package.ps1
```

It writes `dist/puchne-<version>.zip` with only the files `manifest.json`
references, and refuses to produce a zip if anything else gets in.

## License

MIT — see [LICENSE](LICENSE). Contributions welcome: bug reports, selector fixes, UI polish.
