# Puchne — Audit & Recommendations

**Puchne is a Chrome extension that sends one prompt to seven AI chat sites at once and shows every answer side by side in a single tab.**

Audit date: **2026-08-12** · Version audited: **1.0.6**

---

## Verdict

Puchne is a genuinely well-built extension with an unusually honest architecture. Three things stand out and should be protected in every refactor below: the **optional-permissions model** — it installs with access to zero websites and asks for one origin at a time, which is rarer and harder than it looks and is the single strongest thing about the product; the **comments**, which consistently explain *why* rather than *what* and encode constraints (Chrome API rules, site quirks, bugs already fixed) that would otherwise be unrecoverable — `content.js`'s "Why is this complicated?" preamble and the note on why `activeSessionTabs` lives in session storage are worth more than most projects' documentation; and the **shared prompt panel**, one component rendering correctly into a popup, a side panel, and a closed shadow root on arbitrary third-party pages, with reduced-motion support, a working focus trap, and per-service icons that follow the system theme.

Three things stand between it and excellent. First, **the product is write-only**: it types into seven sites and then abandons the user to eyeballing seven scrolling panes. The tagline promises comparison and nothing in the codebase reads a single character back out of a cell — no copy, no export, no diff, no latency, no chaining. Second, **grid mode — the default — has no failure surface whatsoever**: the worker computes a complete per-service delivery record with human-written error copy, and the grid path returns before the badge code and renders none of it, so a prompt that fails to reach five of seven panes looks identical to complete success. Third, **the framing rules are a store-review and security liability**: eight static declarativeNetRequest rules delete both `X-Frame-Options` *and* the entire `Content-Security-Policy` header, permanently, from install, for every user, whether or not they ever open the grid.

Everything else on this list is downstream of those three.

---

## The short list

Ranked by impact ÷ effort. This is the section to act on first.

| # | Change | Why it matters | Effort |
|---|---|---|---|
| [3](#3-stop-fillprosemirror-from-submitting-the-previous-draft) | Fix `fillProseMirror` so it can't submit a stale draft | Silently sends the *wrong prompt* to ChatGPT, Claude and Grok and reports success | S |
| [118](#118-stop-reading-text-out-of-password-fields) | Drop `password` from the selection-capture regex | Ctrl+Shift+S can ship a credential to seven third parties | S |
| [29](#29-apply-one-destructive-action-pattern--and-stop-reset-all-eating-custom-providers) | Stop "Reset All" deleting custom providers silently | Destroys the most expensive data in the product, unannounced | S |
| [141](#141-flip-every-cta-to-the-chrome-web-store) | Point every install CTA at the store | All 12 currently say "not yet" and route users to Developer mode | M |
| [1](#1-give-grid-mode-a-failure-surface--today-it-has-none) | Render the send-status record in grid cells | The default mode cannot report any failure at all | M |
| [58](#58-send-the-prompt-to-each-cell-as-it-loads-not-after-the-slowest-one) | Drop the load barrier + parallelize grid injection | Turns a ~15s stagger into ~2s; the headline feature is the slowest path | M |
| [144](#144-fix-ogimage-and-the-share-cards) | Make `og:image` absolute | Every launch link renders as a bare URL today | S |
| [17](#17-delete-the-page-load-delay-setting) | Delete the Page Load Delay setting | It is clamped to 300ms — a control that lies at the exact moment users reach for it | S |
| [116](#116-scope-the-header-stripping-rules-to-the-grid-tab) | Scope the DNR rules to the grid tab, session-only | Removes standing security-header modification and the top review risk | M |
| [98](#98-label-every-control-on-the-options-page) | Give the 9 unlabelled options controls accessible names | Nine "checkbox, not checked" announcements with no context | S |
| [35](#35-read-the-answers-back-out-of-the-grid-frames) | Read answers out of the frames | Unblocks copy, export, diff, latency, chaining — the entire compare half | L |
| [21](#21-build-a-first-run-welcome) | Build a first-run welcome | Time-to-first-answer is ~6 actions with two places to quit | M |

---

## What to remove

The user asked specifically. These cost more than they earn.

| Remove | Where | Why |
|---|---|---|
| The `delayMs` / "Page Load Delay" setting | [options.html](pages/options.html), [options.js](pages/options.js), `DEFAULTS` | Clamped to `SETTLE_CAP_MS` (300ms) at [content.js](scripts/content.js); every value the UI permits produces the same wait. See [17](#17-delete-the-page-load-delay-setting). |
| `scripts/cookie-dismiss.js` in its current form | [cookie-dismiss.js](scripts/cookie-dismiss.js), its injection block, its setting, its `web_accessible_resources` entry | A blind auto-clicker running inside authenticated AI sessions; its `\|\| sel.includes('accept')` short-circuit bypasses the text test entirely. See [16](#16-rescope-or-delete-the-cookie-auto-dismisser). |
| Six over-configured settings: `hoverExpandMin`, `hoverExpandDelay`, `overlayPosition`, `chipDisplay`, `showShortcutHint`, `historyLimit` | [options.html](pages/options.html) | Each is a decision declined and handed to the user, costing a row, a save path, a docs entry and a support answer. See [33](#33-trim-the-settings-surface). |
| `prompt-panel.js` and `content.js` from `options.html` and `grid.html` | [options.html](pages/options.html), [grid.html](pages/grid.html) | ~2,300 lines parsed on every load; neither page references a symbol from either. `content.js` also installs a live message listener there. See [87](#87-remove-dead-scripts-from-optionshtml-and-gridhtml). |
| `http://*/*` from `optional_host_permissions` | [manifest.json](manifest.json) | Buys nothing but the "On all sites" escalation. Replace with `http://localhost/*` + `http://127.0.0.1/*`. See [119](#119-replace-http-with-localhost). |
| `pages/grid.html` and `scripts/cookie-dismiss.js` from `web_accessible_resources` | [manifest.json](manifest.json) | Neither needs web accessibility; listing `grid.html` lets any site iframe it. See [122](#122-trim-web_accessible_resources-and-turn-on-use_dynamic_url). |
| `tabGroups` from required `permissions` | [manifest.json](manifest.json) | Used in exactly one place behind a setting that defaults off and is hidden in the default mode. See [123](#123-move-tabgroups-to-optional_permissions). |
| The dead send-status subsystem — *or* its dead-ness | [background.js](scripts/background.js) | ~220 lines maintained on every send with one self-referential reader. Resurrect it (preferred, see [1](#1-give-grid-mode-a-failure-surface--today-it-has-none)) or delete it, but do not leave it. |
| `will-change: grid-template-columns/rows` | [grid.css](styles/grid.css) | `will-change` on a non-compositable layout property is a documented anti-pattern and makes the jank worse. |
| The redundant header double-click-to-maximize | [grid.js](pages/grid.js) | Third way to do the same thing; its `title` is the only place the feature is documented. |
| `--radius-xs`, and 6 of the 11 radius values | styles/ | Collapse to five steps. See [73](#73-collapse-the-radius-scale). |
| The committed `dist/*.zip` | repo root | Build output in git while publishing no releases is the worst of both. See [139](#139-automate-releases-and-single-source-the-version). |
| `enableHistory` **or** `showRecents` | [options.js](pages/options.js) | Both written from one checkbox, so they can never differ. Split them properly or delete one. |
| `prompt-blast` artifacts | [options.html](pages/options.html), [content.js](scripts/content.js), [cookie-dismiss.js](scripts/cookie-dismiss.js) | The GitHub link in Settings points at a repo that no longer exists; the overlay's DOM id is still `prompt-blast-root`. |
| The 512×512 service PNGs | [icons/services/](icons/services/) | 319 KB of the 433 KB package to draw 20px logos. See [94](#94-downscale-the-service-icons). |

**And two things not to build:** scheduled/recurring prompts (in web mode a scheduled send either hijacks the browser with seven tabs or silently fails; it only becomes coherent under API mode), and a repo-wide Prettier pass (it would destroy hand-aligned columns and make `git blame` useless the week after launch — add `.editorconfig` instead).

---

# Reliability & Trust

### 1. Give grid mode a failure surface — today it has none

**Impact:** Critical · **Effort:** M · **Type:** Add

**Today:** `gridView` defaults to `true`, and the grid path in `handleMulticast` ([background.js](scripts/background.js)) returns before ever reaching the badge code that flags failures; the `injectGridQueries` handler sets no badge either. Meanwhile the worker faithfully maintains a complete record — `startSendStatus` / `markService` / `stateFromResult` / `markBlocked`, with human-written error copy in `describeError` ("Couldn't find the prompt box — the site's layout may have changed.") — in `storage.session`, and [constants.js](scripts/constants.js) admits it: *"Not shown in the UI."* [grid.js](pages/grid.js) `console.log`s the injection results and discards them. A send that fails in five of seven panes is visually identical to complete success.

**Do this:** In `createCell` ([grid.js](pages/grid.js)), add a state dot to each `.cell-header`, driven by a `chrome.storage.session.onChanged` listener on `SEND_STATUS_KEY`. Render the four states the record already carries — pending / filled / submitted / failed(+needsPermission) — and put `describeError`'s existing sentence in the tooltip. Success should fade out; only failure persists. Also set the badge on the grid path from the `injectGridQueries` handler so the toolbar isn't blind in the default mode.

```js
// grid.js — the record already exists; it just needs a reader
chrome.storage.session.onChanged.addListener((changes) => {
  const rec = changes[SEND_STATUS_KEY]?.newValue;
  if (rec) for (const svc of rec.services) paintCellState(svc.id, svc.status, svc.error);
});
```

### 2. Wire the three orphaned recovery handlers into a "Last send" sheet

**Impact:** High · **Effort:** M · **Type:** Add

**Today:** [background.js](scripts/background.js) registers `retryService`, `openServiceTab` and `editServiceSelector` above a comment that reads, verbatim, *"The delivery list that used to offer them is gone, so nothing calls these today."* A repo-wide grep confirms zero callers. `retryService` is a complete 53-line implementation that reuses the original tab or grid frame and re-checks permission; `editServiceSelector` deep-links into Settings, and `checkSelectorRequest` in [options.js](pages/options.js) already implements the receiving end — switches tab, opens that service's editor, scrolls, blinks, focuses the input. The entire recovery flow exists and has no buttons.

**Do this:** Render one row per service from the same `SEND_STATUS_KEY` record: logo, state, `describeError`'s sentence, and three buttons — **Retry** → `retryService`, **Open in a tab** → `openServiceTab`, **Fix selector** → `editServiceSelector`. Mount the same component in three places: the grid banner (finding 1), the compose panel below Send (shown only when the last send had failures — the removed list's flaw was showing after *every* send), and the badge click target. Fix `openServiceTab` while you are there: it looks the service up in `AI_SERVICES` rather than `getRegistry(settings)`, so it cannot open a custom provider. Also replace the badge's bare `setTimeout` clear with `chrome.alarms` — a timer in an MV3 worker does not survive teardown, so the red `!` can stick indefinitely — and pass a `tabId` so it isn't global.

### 3. Stop `fillProseMirror` from submitting the previous draft

**Impact:** Critical · **Effort:** S · **Type:** Fix

**Today:** In [content.js](scripts/content.js), `fillProseMirror` dispatches a synthetic `InputEvent('input', { inputType: 'insertFromPaste' })`. ProseMirror derives state from its own MutationObserver and its `paste` handler, not from dispatched `input` events — an untrusted dispatched event mutates nothing, so this is a no-op. The fallback that actually works is gated on `if (!el.textContent || el.textContent.trim() === "")`. The function then returns `true` **unconditionally**. ChatGPT, Claude and Grok are all `inputType: "prosemirror"`.

**Do this:** If the composer holds anything at all — an unsent draft, a restored session draft, a stray character — method one does nothing, method two is skipped, and `fillAndSubmit` proceeds to click Send. The user's *old draft* is sent instead of the prompt they just typed, and the result is reported as `{ ok: true, filled: true, submitted: true }`. Replace the strategy with a real `ClipboardEvent('paste')` carrying `text/plain` (ProseMirror's own paste handler parses it, which also fixes newlines — see [7](#7-preserve-newlines-in-rich-editors)), keep the `textContent` write only as a last resort *after* an explicit `el.innerHTML = ''`, and then read back and verify before returning true. Add a canary case: pre-fill the composer with "stale", send "fresh", assert the submitted message is "fresh".

### 4. Stop reporting success you haven't verified

**Impact:** High · **Effort:** M · **Type:** Fix

**Today:** [content.js](scripts/content.js) `fillAndSubmit` returns `{ ok: true, filled: true, submitted: true }` on every path that reaches it. `submit()` returns void; when `clickSubmitButton` gives up after ~1.5s it falls back to `pressEnter`, which dispatches three untrusted `KeyboardEvent`s and cannot know whether anything listened. `waitForElement` applies no visibility or disabled test for inputs. So: rate-limited (composer disabled), a paywall or upgrade modal covering the editor, a logged-out page that still renders a composer, a send button that never enabled — all four are recorded as delivered.

**Do this:** Three changes in the same pass.
- **Gate the fill.** Before writing, reject when `el.disabled || el.readOnly || el.getAttribute('aria-disabled') === 'true' || el.closest('[inert]') || !el.getClientRects().length`, returning a specific error (`'input unavailable — the site may be rate-limiting you or asking you to sign in'`) that `describeError` can turn into a sentence.
- **Verify the submit.** ~1s after submitting, check whether the composer cleared or its text changed — on all seven sites a successful send empties the box, so "my prompt is still there" is a reliable proxy for "it didn't send". Propagate a real boolean out of `submit()` into `submitted`; `stateFromResult` already distinguishes `filled` from `submitted`.
- **Fix two adjacent correctness bugs.** `fillTextarea` resolves the native setter from `HTMLTextAreaElement.prototype` with an `||` fallback that never fires, so an `<input>` throws *Illegal invocation* — and the `default` branch then falls through to `fillContentEditable`, which happily sets `textContent` on an `<input>` and returns true. Pick the setter from the element's own constructor. And `submitType: "both"` (user-selectable for custom providers) clicks the button *and* presses Enter with no guard, guaranteeing a double-send — the `"button"` path was explicitly hardened against exactly this.

### 5. Give the content script a deadline inside the worker's

**Impact:** High · **Effort:** S · **Type:** Fix

**Today:** `MAX_RETRIES = 30` × `RETRY_INTERVAL = 1000` in [constants.js](scripts/constants.js) means one `waitForElement` polls for 30 seconds, and `fillAndSubmit` calls it twice for the input (primary, then generic fallback) — 60 seconds worst case. `INJECT_TIMEOUT_MS` is 15,000. So the worker abandons the service at 15s and records **"Timed out — the page never responded"**, which is actively wrong: the page responded fine, the selector missed. The message that would say so — *"Couldn't find the prompt box — the site's layout may have changed"* — is unreachable, because the only code path producing `Input not found` fires 45 seconds after anyone stopped listening. Meanwhile the abandoned script keeps a document-wide MutationObserver plus a 1Hz poll running, and may fill and submit into a tab the user has since navigated.

**Do this:** Pass an absolute deadline in the `fillQuery` message and split it — roughly 60% to the primary selector, 25% to the fallback, 15% reserved for fill and submit — with an `AbortController` so the observer and interval are torn down when the budget is spent. Raise `INJECT_TIMEOUT_MS` to ~20s, cap the primary wait at ~12s and the fallback at ~5s, and make sure `Input not found` can actually be returned before the caller gives up. This one change makes every selector-rot incident diagnosable.

### 6. Replace the first-match generic fallback with a scored heuristic

**Impact:** High · **Effort:** M · **Type:** Improve

**Today:** `GENERIC_INPUT_FALLBACKS` in [content.js](scripts/content.js) is `textarea:not([aria-hidden="true"])` and a pair of contenteditable selectors, resolved with a bare `document.querySelector` — first match in **document order**, with no visibility test. On a modern AI site that is often a hidden search box, a sidebar filter, or an off-screen mobile composer. The comment above it ("Ordered from most-specific to most-generic so we grab the right element") is also factually wrong: a comma-separated list returns the first match in document order, not the first list entry that matches — which quietly falsifies the ordering assumption in every chained registry selector too.

**Do this:** Collect all candidates matching `textarea, input[type=text], [contenteditable="true"]`, drop anything failing an `isUsable()` test (`getClientRects().length`, not disabled/readonly/aria-hidden/inert, width > 120px, height > 24px), then score: + normalised area, +40 if a button matching `/send|submit|ask/i` sits within 250px, +30 if placeholder/aria-label matches `/ask|message|prompt|chat/i`, +20 inside a `form` or `[role=main]`, −50 inside `nav`/`header`/`[role=search]`, −30 if the placeholder says "search" or "filter". Export the same function so the canary can assert the heuristic and the hard-coded selector agree on a live site — when they diverge, that is the earliest possible warning of a redesign.

### 7. Preserve newlines in rich editors

**Impact:** High · **Effort:** M · **Type:** Fix

**Today:** `fillContentEditable` in [content.js](scripts/content.js) clears the node and appends **one text node** containing the whole query; the ProseMirror path's only working branch does `el.textContent = query`. A single text node carries no block structure, so the editor's own DOM parser reconciles it into one paragraph — whether it drops, keeps or mangles the newlines is per-provider and unverified. Five of the seven providers (ChatGPT, Claude, Gemini, Perplexity, Grok) go through these paths; Copilot and DeepSeek are `textarea` and preserve `\n` natively via the value setter.

**Do this:** Stop writing raw text nodes into rich editors. Dispatch a real `ClipboardEvent('paste')` with a `DataTransfer` carrying `text/plain` — ProseMirror and Quill both implement paste handlers and will build the right block structure — and fall back to splitting on `\n` and inserting one block per line (`<p><br></p>` for blanks). Then read back and compare line counts, returning `filled: false` when they disagree, so a mangled multi-line prompt is visible rather than silent. Test with a three-paragraph prompt containing a fenced code block against all five.

### 8. Run the login check in grid mode, and tighten its heuristic

**Impact:** High · **Effort:** M · **Type:** Fix

**Today:** `checkLogin` is dispatched from exactly one line in [background.js](scripts/background.js) — inside the **tabs** branch. `injectIntoGridFrame` never sends it, so the well-made `PuchneLoginToast` in [content.js](scripts/content.js) is unreachable in the default mode, and every service's `loginSelector` feeds nothing else. A logged-out cell therefore fires `load`, enters `loadedTargets`, fails to find the composer, and is reported as *"Couldn't find the prompt box — the site's layout may have changed"* — which sends the user hunting a CSS selector when they needed to sign in. This is not rare: [cookie-dismiss.js](scripts/cookie-dismiss.js) states the cause itself — *"Iframes inside the chrome-extension:// grid page get a partitioned cookie jar"* — so a user signed in everywhere can open the grid and be signed out in every cell.

**Do this:** Move the login probe into the *failure* path of `fillAndSubmit`: when the selector search times out, test `loginSelector` plus the visible-button heuristic and return `{ ok: false, error: 'not signed in' }`. Add the case to `describeError`. Render it as a per-cell state — "Sign in to Claude ↗" opening a real popup window, plus "I've signed in — reload this cell" — because a toast inside a 400px iframe is the wrong shape. Tighten the fallback while you are there: require the login marker **and** the absence of any composer candidate **and** a prominent position, so a signed-in user on a slow-hydrating page doesn't get told they're logged out.

### 9. Match frames by origin, and prune session tabs on navigation

**Impact:** High · **Effort:** S · **Type:** Fix

**Today:** Two separate string-matching sloppinesses with real consequences.
- `injectIntoGridFrame` in [background.js](scripts/background.js) finds the target frame with `f.url.startsWith(new URL(target.url).origin)`. That is not an origin check — `"https://grok.community/x".startsWith("https://grok.com")` is true. It also breaks on every auth redirect (a logged-out Gemini frame lands on `accounts.google.com`), on Perplexity's www/apex drift, and it returns the *first* match, so two custom providers on one host both get injected into one frame — one cell typed into twice, the other blank, both reported successful.
- `handleFollowUpMulticast` filters `activeSessionTabs` only by `isServiceGranted` — the *service*, not the tab. `activeSessionTabs` is pruned only on `chrome.tabs.onRemoved`. Navigate a session tab to `claude.ai/settings` or a ChatGPT share page and the next follow-up is typed into whatever text field the generic fallbacks find there, and submitted. Host permissions bound the blast radius on unrelated origins, but same-origin navigation and users who granted "on all sites" are genuinely exposed.

**Do this:** Compare parsed origins (`new URL(f.url).origin === new URL(target.url).origin`), add an `authOrigins` field to the registry so a redirected frame is *found* and reported as "needs sign-in" rather than "never loaded", and stamp `iframe.name = "puchne-" + service.id` so cells can be resolved by frameId instead of URL. Add a `chrome.tabs.onUpdated` listener beside the `onRemoved` one that drops a session tab as soon as its URL stops matching `servicePatterns(target)`, and re-verify inside `handleFollowUpMulticast` before injecting. Related: every multicast **overwrites** `activeSessionTabs`, and the follow-up handler prefers the stored list over the sender's own tab — so a bar still mounted in a superseded session sends the user's follow-up to a *different* set of tabs. Scope the list per send id and have the bar carry its own.

### 10. Make re-injection idempotent and version-aware

**Impact:** High · **Effort:** S · **Type:** Fix

**Today:** [permissions.js](scripts/permissions.js) states the invariant explicitly — *"top-level declarations must stay `var`/`function` so a second injection into the same page cannot throw"* — and [prompt-panel.js](scripts/prompt-panel.js) breaks it with a top-level `class PuchnePromptPanel`. `ensureContentScript` injects all four `CONTENT_SCRIPT_FILES` on every follow-up, retry, test and grid injection, so re-running that file throws `Identifier 'PuchnePromptPanel' has already been declared` — swallowed by a catch commented "both are fine", which means the repair mechanism cannot actually repair anything. Separately, `content.js`'s guard is a plain boolean `window.PuchneLoaded` that lives in the isolated world and **survives an extension update**: after every store update, already-open AI tabs bail at the guard, register no new listener, and become permanently un-sendable until manually reloaded.

**Do this:** Wrap `prompt-panel.js` in the same `if (window.PuchnePanelLoaded) {} else { ... }` guard `content.js` uses, or `var PuchnePromptPanel = window.PuchnePromptPanel || class {...}`. Stamp the guard with `chrome.runtime.getManifest().version` and re-arm when it differs. Add a lint rule (or a two-line check in [package.ps1](tools/package.ps1)) that greps the content-script file list for top-level `class`/`const`/`let` — this invariant is documented in one file and violated in another, which is exactly what lint is for.

### 11. Key grid payloads by id, not tab id

**Impact:** High · **Effort:** M · **Type:** Fix

**Today:** One design causes three separate bugs. The payload is written to `gridData_<tabId>` in [background.js](scripts/background.js) **after** `chrome.tabs.create`, so `readGridData` in [grid.js](pages/grid.js) awaits a `get` and only *then* registers the `onChanged` listener — a write landing in that gap is never observed, and after `GRID_DATA_WAIT_MS` (5s) the page renders *"No services to display. Enable some AI services in Settings"*, blaming the user's settings for a timing accident. On reload, the payload survives and the full send runs again unconditionally — F5 on a stuck cell opens a brand-new conversation in every provider and re-asks the question, burning metered quota. And `chrome.runtime.onStartup` sweeps every `gridData_` key while restored tabs get fresh ids, so after a browser restart the grid tab is permanently dead — with `initHeaderControls()` sitting *after* the early return, so Reset layout, the Closed menu and the hover toggle are rendered but unwired on the one screen where recovery matters most.

**Do this:** Generate a payload id, `await chrome.storage.local.set({ ['gridData_' + id]: payload })` **before** `chrome.tabs.create`, and open `pages/grid.html#<id>`. The key is then guaranteed present at DOMContentLoaded, the 5s wait and the race disappear, and the payload survives reload *and* session restore because the id lives in the URL. Stamp `delivered: true` after the first successful send and skip the auto-send on any subsequent read, offering an explicit "Re-ask in all cells" button instead. Move `initHeaderControls()` above the empty-state return, and give `showEmpty` an action button ("Start a new grid") so the dead screen has an exit.

### 12. Move the registry into a data module with a remotely refreshable selector manifest

**Impact:** High · **Effort:** L · **Type:** Add

**Today:** `AI_SERVICES` is a frozen literal inside the 1,632-line service worker ([background.js](scripts/background.js)), and its own comment concedes the problem: *"AI sites update their DOM frequently. If a service stops working, updating the selector/buttonSel here usually fixes it. Contributions welcome!"* The rot is already visible in the data — ChatGPT needs three chained selectors and two send-button ids because its composer was rewritten from a textarea into ProseMirror, `chat.openai.com` is still carried alongside `chatgpt.com`, Grok moved from x.com. The only path from a fix to a user is a store submission with days of review latency. Five surfaces then fetch this static data over the message bus, each with its own promise wrapper and failure mode — [content.js](scripts/content.js) literally races a 2-second timer against the worker booting.

**Do this:** Move the array verbatim to `scripts/services.js`, loaded alongside `constants.js` in all six contexts, and move `getRegistry`/`resolveTargets` with it. Delete the `getServices` message handler and all five client wrappers (~60 lines and five async failure paths gone, and `openServiceTab`'s custom-provider blindness fixed for free). Then ship the volatile fields as data: `selectors.json` with `{schemaVersion, revision, updatedAt, services}`, bundled as the guaranteed fallback and refreshed by a `chrome.alarms` job (12h + on startup) from the GitHub Pages site the project already deploys. Resolution order: user `customSelectors` > cached remote > bundled default. **Hard constraint:** the remote manifest must never add or change `url` or `origins` — whitelist the mutable keys and drop anything else, or a compromised file becomes a supply-chain hole. Surface it as one settings row — "Keep AI tool selectors up to date (fetches a small file from GitHub; no prompt data leaves your device)" — with a last-updated line and a Check now button. This turns a multi-day outage into a 12-hour one.

### 13. Build the selector canary and a CI gate

**Impact:** High · **Effort:** L · **Type:** Add

**Today:** `.github/workflows/` contains exactly one file — a Pages deploy, path-filtered to `website/**`, so a change to `background.js` triggers nothing. There is no `package.json`, no linter, no test directory. [package.ps1](tools/package.ps1) has a genuinely good self-check (it re-opens the finished zip and fails if excluded paths leaked in or `manifest.json` isn't at the root) that nothing ever runs but the maintainer, by hand, on Windows. Every selector is verified by one method: a user complains.

**Do this:** Three tiers, cheapest first.
- **Unit tests** (`node --test`, zero deps): [permissions.js](scripts/permissions.js) is pure below `readGrantedOrigins` — table-drive `patternCovers` (`*.google.com` covers `gemini.google.com` but not `notgoogle.com`; `<all_urls>`; scheme mismatch) and assert `isServiceGranted` requires **both** ChatGPT origins. [grid.js](pages/grid.js)'s `computeLayout`/`placementFor`/`adjustFracs` are the second pure cluster.
- **CI** (`ci.yml`, push + PR, no path filter): lint, typecheck, test, plus a `tools/verify-manifest.mjs` asserting every path the manifest references exists and that `manifest.version` matches the version strings in [install.html](website/install.html).
- **The canary** (`selector-canary.yml`, nightly, matrix over the seven services, `fail-fast: false`): Playwright opens each `service.url`, asserts `service.selector` resolves and is visible, types a probe and asserts the button enables. Split anonymous (ChatGPT, Grok, Perplexity, Copilot) from login-required (Claude, Gemini, DeepSeek) — for the latter, either a stored `storageState` secret or degrade to asserting `loginSelector` still matches, which canaries the login path too. Open one auto-closing issue per failing service, labelled `selector-rot`, after two consecutive failures. Budget: about a day, and it is the difference between finding out in eight hours and eight days.

### 14. Detect selector rot locally and give the user a one-click report

**Impact:** Medium · **Effort:** M · **Type:** Add

**Today:** Breakage surfaces only through `describeError`, which nothing renders. The **Test service** button in [options.js](pages/options.js) exists and works — it opens the site in a background tab and reports Input ✓ / Button ✓ — but it must be found and pressed manually, per service, inside an editor whose only affordance is a chevron labelled `title="Custom CSS selectors"`. It also pre-sleeps a fixed ~2.5s and then does a single `querySelector`, while the real fill path waits far longer, so it produces false negatives on slow-hydrating SPAs.

**Do this:** Add a **Check all services** button to the AI Tools tab that runs the existing `testService` flow across every enabled service and reports a green/red table, plus a quiet automatic run after N consecutive failures for one service. Fix the test to use the same `waitForElement` path with a ~10s budget so it agrees with reality, and stop leaving "Puchne test" in the user's live account. When a service fails, offer **Report this** — a pre-filled GitHub issue with service id, extension version, the selector that missed, and the page URL, submitted by the user's own click. Explicitly do **not** add automatic breakage telemetry: silently posting "ChatGPT's selector failed for user X" would break the no-tracking promise for a benefit the issue link gets most of.

### 15. Resume parked sends from any grant path, and stop lying about what's pending

**Impact:** High · **Effort:** S · **Type:** Fix

**Today:** `resumePendingSend` in [background.js](scripts/background.js) is called from exactly one place — `handleAccessGranted`, reachable only via the `accessGranted` message from [permissions-page.js](pages/permissions-page.js). But [options.js](pages/options.js) calls `chrome.permissions.request` directly, and so does Chrome's own site-access menu; both reach only `chrome.permissions.onAdded`, which syncs the mirror and never touches `PENDING_SEND_KEY`. A user who closes the access window, walks to Settings, and grants there has done exactly what the product asked — and their prompt evaporates silently five minutes later. Expiry itself is a bare `return`. Two adjacent problems: `addToHistory` runs *before* the permission ask, so a declined prompt is filed under Recents as though it had been sent; and when a grant does land, the panel repaints to a normal enabled state while `resumePendingSend` fires in the background with no feedback — the user sees their prompt sitting in an enabled box with a live Send button while the same prompt is already being delivered, and pressing Enter sends it twice.

**Do this:** Call `resumePendingSend()` from the `onAdded` listener too — it removes the key before checking the TTL, so the two paths cannot double-send. On expiry, write the prompt back as `expiredPendingSend` and have the next panel open offer "Your prompt timed out waiting for permission — send it now?" with the text restored. Move `addToHistory` after the grant resolves. Broadcast a `pendingSendResumed` message so the panel can disable the box and show "Sending…" instead of inviting a duplicate.

### 16. Rescope or delete the cookie auto-dismisser

**Impact:** High · **Effort:** S · **Type:** Remove

**Today:** [cookie-dismiss.js](scripts/cookie-dismiss.js) runs inside the user's authenticated ChatGPT/Claude/Gemini sessions, by default (`cookieConsent` defaults to `"accept"`). Its core condition is `if (TEXT_PATTERN.test(text) || sel.includes('accept') || sel.includes('consent'))` — the `||` means eleven of the fifteen accept-selectors bypass the text test entirely, so anything matching `button[class*="accept" i]` is clicked whatever its label ("Accept invitation", "Accept and pay"). Strategy 3 clicks any visible button whose text matches `ok|okay|continue|agree|allow|got it` inside a `BANNER_CONTAINER` list that includes the bare `[role="dialog"]` and `[role="alertdialog"]` — which is what those sites use for delete confirmations, plan upgrades, terms acceptance and data-sharing consents. And the MutationObserver re-runs `tryDismiss` on every mutation without incrementing `attempts`, so a successful dismissal does not stop the clicking.

**Do this:** The honest recommendation is **delete it** — none of the seven built-in sites puts a cookie wall in front of the composer, so the feature solves a problem the product mostly doesn't have, by running a blind auto-clicker where a wrong click can cost real money or agree to something on the user's behalf. If you keep it: require *both* conditions (drop the `sel.includes` short-circuit), remove `ok|okay|continue|allow` from `ACCEPT_TEXT`, drop `[role="dialog"]`/`[role="alertdialog"]` from the container list and require the container's own text to match `/cookie|consent|privacy/i`, set a `done` flag that stops both the tick loop and the observer on first success, log every click for diagnosability, never run it after the prompt has been injected, and default it to **off**.

### 17. Delete the Page Load Delay setting

**Impact:** High · **Effort:** S · **Type:** Remove

**Today:** [options.html](pages/options.html) exposes *"Page Load Delay — Wait time (ms) before typing prompt"* as a number input, min 500, max 10000, step 500, default 2000, with spinners. It flows through `settings.delayMs` → `waitMs` → `await sleep(Math.min(waitMs, SETTLE_CAP_MS))` in [content.js](scripts/content.js), where `SETTLE_CAP_MS` is **300**. Every value the control permits produces an identical 300ms wait. The description is stale too — since the observer rewrite it is a post-detection settle, not a pre-wait.

**Do this:** Delete the row and the key. The cap is architecturally correct (detection is MutationObserver-driven), so a user-tunable pre-delay is obsolete — and a knob that lies in exactly the situation where a user reaches for it (a slow site missed the prompt, so they raise it to 8000 and nothing changes) is worse than no knob. If you want to keep something there, replace it with a real "Injection timeout" that maps to the deadline from [5](#5-give-the-content-script-a-deadline-inside-the-workers).

### 18. Fix the MV3 lifetime bugs and close the compatibility guards

**Impact:** Medium · **Effort:** S · **Type:** Fix

**Today:** Four small, load-bearing defects in [background.js](scripts/background.js) and friends.
- The badge clear is a bare `setTimeout(..., 10_000)` fired after the awaited work settles, so the worker is teardown-eligible and the timer neither keeps it alive nor survives it — the red `!` can persist until the next send. It is also global (no `tabId`) and has no `setTitle`, so a two-window user sees an error on both for a failure in one.
- `waitForTabLoad` removes its `chrome.tabs.onUpdated` listener on the success and already-complete paths but **not** on the timeout path, leaking one listener per timed-out tab for the worker's life. Its `chrome.tabs.get` callback has no `lastError` check, and its doc comment says 30s while `TAB_LOAD_TIMEOUT` is 10s.
- `chrome.tabGroups.update` is guarded on `chrome.tabs.group` — a *different* API — relying on the surrounding try/catch.
- [prompt-panel.js](scripts/prompt-panel.js) uses the deprecated `navigator.platform` for Mac detection.

**Do this:** `chrome.alarms.create('clearBadge', { delayInMinutes: 0.25 })` plus an `onAlarm` handler; clear the badge proactively at the start of every send and when the popup opens; pass `tabId` and add `chrome.action.setTitle` naming the failed services. Remove the listener in the timeout branch, add the `lastError` check, fix the stale comment. Guard on `chrome.tabGroups?.update`. Swap in `navigator.userAgentData?.platform ?? navigator.platform`. And state the browser position in the README rather than leaving it to be discovered: Chromium-only today, with Brave's Shields and Arc's sidebar as the two things to test before claiming support.

### 19. Detect offline and stop misdiagnosing it

**Impact:** Medium · **Effort:** S · **Type:** Add

**Today:** `navigator.onLine` appears nowhere in the codebase. With no network, `chrome.tabs.create` succeeds, the error page reaches `complete`, and in grid mode every iframe still fires `load` — so the cells sit showing Chrome's own network error page while the status record fills with "frame not found" and nothing renders any of it. The same silence covers a provider outage, a captive portal, and a corporate proxy blocking one host.

**Do this:** Check `navigator.onLine` in `handleMulticast` before creating any tab and refuse with one clear message — *"You're offline — Puchne can't reach any AI tools right now"* — rather than opening seven doomed surfaces. Add an `online` listener offering to retry the last send. Then distinguish the three cases at the grid level once [60](#60-detect-a-blocked-cell-and-give-it-a-real-reason-and-a-retry) lands: offline, all-providers-failed (network/proxy), one-provider-failed. Detect the Cloudflare interstitial specifically (title matching `/just a moment|checking your browser/i`, or `#challenge-form`) and say *"Cloudflare is checking your browser on chat.deepseek.com — open it once in a tab to clear the check"*, which is actionable where "timeout" is not.

---

# Core Flows & UX

### 20. Make the first icon click always do something

**Impact:** Critical · **Effort:** S · **Type:** Fix

**Today:** [manifest.json](manifest.json) declares `action` with no `default_popup`, so a click routes to `chrome.action.onClicked` in [background.js](scripts/background.js), which returns silently for `chrome://`, `edge://` and `about:` URLs and otherwise falls back to `chrome.scripting.executeScript` — which Chrome refuses on `chromewebstore.google.com`, the PDF viewer, other extensions' pages, and `file://`. The catch is a bare `console.warn`. So the most likely first interaction of all — clicking the pinned icon while still on the Web Store tab you just installed from — does nothing at all: no window, no overlay, no badge, no toast. `Ctrl+Shift+X` has the identical dead end. The same class of failure hits the right-click path: on a restricted page, `openPromptInOptionsOrWindow` writes `pendingPrompt` to session storage and opens the **options** page — but only `PuchnePromptPanel.checkPendingPrompt` reads that key, and [options.js](pages/options.js) never instantiates a panel, so the user lands on Settings with no prompt, no explanation, and no trace of what they asked.

**Do this:** In both silent exits, open a real surface: `chrome.sidePanel.open({ windowId: tab.windowId })`, falling back to `chrome.windows.create({ url: 'pages/popup.html?mode=window', type: 'popup', width: 420, height: 640 })`. `popup.html` already renders the full compose panel, so this is routing, not new UI. Route the restricted-page "Ask Puchne" path to the same surface and actually render the parked prompt there. Call `chrome.action.setTitle` on startup so the tooltip explains the shortcut.

### 21. Build a first-run welcome

**Impact:** Critical · **Effort:** M · **Type:** Add

**Today:** `chrome.runtime.onInstalled` in [background.js](scripts/background.js) writes default settings and removes a legacy key. That is the entire first-run experience — a grep for welcome/onboard/first-run finds one comment. The path to the first answer is: notice the install (Chrome hides new icons behind the puzzle piece) → find and pin it → discover the shortcut → meet a panel of seven **locked** chips with no explanation → type → hit a detached permission window that appeared from nowhere → grant → wait. Four gestures across three surfaces, two of them consent dialogs, before the product has demonstrated anything. The batching already exists and is unused for this: `servicesPatterns` unions the origins and [permissions-page.js](pages/permissions-page.js) fires one `chrome.permissions.request` for the whole set.

**Do this:** Add `pages/welcome.html`, opened from `onInstalled` when `details.reason === 'install'`. Three beats: (1) a short looping muted clip of the grid filling with answers — [promo/](promo/) already renders one and a `render:gif` script exists; (2) chips pre-selecting the three default services and **one** button, "Allow these 3 sites", calling the existing batched request; (3) a pre-filled example prompt and a large "Try it" that calls `handleMulticast` — first send with zero typing. Add a four-item checklist that ticks itself off from storage (pinned / granted / first send / tried the selection shortcut) and a link to `chrome://extensions/shortcuts`. This collapses four gestures to two and puts the demo before the ask.

### 22. Fix the consent flow: one surface, honest copy, and say that granting enables

**Impact:** High · **Effort:** M · **Type:** Flow

**Today:** Asking for access opens a **detached OS popup window** (`chrome.windows.create({ type: 'popup', width: 480, height: 620 })`) that steals focus from the tab the user was reading, explains the request, and then triggers Chrome's own harsher native dialog on top of it — two consents for one intent, in a window that has jumped out of the browser. The card's copy contradicts the behaviour: [permissions.html](pages/permissions.html) says *"Puchne asks for one site at a time"* while `servicesPatterns` unions every requested service into a single request, so a new user's very first ask covers four origins at once. It also overclaims: *"Nothing is read or sent anywhere else"* — but the grant permanently registers `content.js` on that origin with `persistAcrossSessions`, retroactively injects into every already-open tab of it, lets `getPageContext` read `document.body.innerText` on request, and makes the origin a valid DNR initiator. And `handleAccessGranted` adds every granted id to `enabledServices`, so tapping a padlocked chip out of curiosity permanently enrols that service in future multicasts — a second setting changed without being asked about.

**Do this:** When `useSidebar` is on, ask from the side panel directly — it is already an extension page — and skip the extra window. For the overlay, open [permissions.html](pages/permissions.html) as a tab in the current window rather than a detached popup. Rewrite the card to pre-state what Chrome will say and to be accurate: *"Puchne can open these sites, type your prompt into them, and — only when you use Ask Puchne — read the page you're on. Nothing is sent anywhere except the AI sites you pick. Chrome will say 'read and change your data' because that's how typing into a page works."* Add one line saying that allowing a site also turns that tool on. Mirror the wording in [privacy.html](website/privacy.html). Best case, [21](#21-build-a-first-run-welcome) means most users never see this window.

### 23. Explain Grid vs Tabs, allow a per-send override, and give failed cells an escape hatch

**Impact:** High · **Effort:** M · **Type:** Flow

**Today:** `gridView` defaults to `true` and the only control is a segmented pair in Settings › Behavior under a generic label; nothing anywhere describes what differs. And a great deal differs: grid depends on stripping framing headers and has no follow-up bar in the AI tab, while tabs mode gets `activeSessionTabs` and the follow-up bar but no side-by-side view. After a send there is no way to switch — the per-cell failure offers a bare `<a href="${service.url}">` that opens the site with the prompt **lost**, and [faq.html](website/faq.html) tells users the fix for a blank cell is "new tabs mode", which today means Settings → toggle → back to the popup → retype.

**Do this:** Replace the generic description with a two-line comparison naming the consequences (framing dependence, follow-up bar, tab groups). Put a small mode chip beside Send in [prompt-panel.js](scripts/prompt-panel.js) so the choice is visible and overridable at the moment it matters, and make the button state the outcome — "Send to 3 tools · Grid". Add **"Open all in tabs with this prompt"** to the grid header and **"Open in a tab with my prompt"** to each failed cell, both calling `handleMulticast(lastQuery, [ids])` with grid forced off — the function already accepts an explicit id list, and the grid page already holds `lastQuery` and `loadedTargets`.

### 24. Reuse tabs, groups and the grid tab; add "close this session"

**Impact:** High · **Effort:** M · **Type:** Fix

**Today:** `handleMulticast` in [background.js](scripts/background.js) unconditionally maps every target to `chrome.tabs.create` — there is no query for an already-open ChatGPT, so the tab holding the user's real conversation is ignored and duplicated. `chrome.tabs.group` is called with no `groupId`, so a fresh group titled "Puchne" is created every time. The grid branch likewise calls `chrome.tabs.create` unconditionally, while `openOptionsPage` and `openAccessWindow` both deliberately reuse — so the pattern exists and was not applied here. Nothing ever closes a session; `pruneSessionTab` only reacts to tabs the *user* closes. Five prompts leave five grid tabs, each holding seven live AI iframes and its own payload blob. And both branches immediately activate their new tab, yanking away whatever the user was reading — the page they were about to ask about — with no "open in background" option anywhere.

**Do this:** Query for an existing tab on the service's origin and reuse it (behind a "reuse open tabs" setting, default on, navigating to the service's `/new` URL so the prompt doesn't land mid-conversation). Reuse the previous session's `groupId` when it still exists. Reuse the front-most grid tab, or offer "send here" from the grid's own follow-up box — that is simultaneously the memory fix and the flow fix. Add **Close this session** to the follow-up bar and the popup, closing exactly the tabs in `activeSessionTabs`, and show the live session count on the badge. Add an "open in background" behaviour setting.

### 25. Add undo and target naming to direct sends and multicasts

**Impact:** High · **Effort:** M · **Type:** Add

**Today:** Both context-menu items are titled the bare string "Ask Puchne" regardless of configured targets, and `askTargetIds` can resolve to all seven enabled services with nothing displaying which. `sendPromptDirect` records history and fires `handleMulticast` with no acknowledgement, preview, confirmation or cancel path. `handleMulticast` opens every tab via `Promise.all` and the message handler responds `{ok:true}` before any of it settles, so [prompt-panel.js](scripts/prompt-panel.js) clears the textarea immediately. There is no abort token anywhere; the only cancel-shaped handler clears a *parked* send, not an in-flight one. A misclick costs seven tab closures — after the text has already been transmitted.

**Do this:** Name the targets in the menu title — "Ask Puchne (ChatGPT, Claude, Gemini)" — rebuilt whenever `askTargetIds`/`enabledServices` change. Keep the tab ids `markService` already records and add a `cancelSend` handler that closes them and clears the status record. Surface it as a 4–5 second "Sent to 3 tools — Undo" strip: a toast in the source tab for direct sends, an inline strip in the panel for composed ones. Do not clear the textarea until the undo window closes.

### 26. Re-adopt the follow-up session after a restart; introduce and reset the bar

**Impact:** Medium · **Effort:** M · **Type:** Improve

**Today:** `activeSessionTabs` lives in `chrome.storage.session` for a good documented reason (tab ids are recycled), but that means Chrome restores the ChatGPT, Claude and Gemini tabs after a restart while the follow-up bar — the one thing that made them a session — silently vanishes, with no notice and no way back short of a fresh multicast. Separately, the bar itself mounts as a 520px card fixed bottom-right on a third-party site with no introduction; its position is persisted per origin in `FOLLOWUP_POS_KEY` with **no reset path anywhere** (not even "Reset All"), and its input is a single-line `<input type="text">` while the grid's equivalent is a textarea with Shift+Enter.

**Do this:** Persist a durable session descriptor in `storage.local` keyed by service id + tab URL alongside the ephemeral id list, and re-adopt matching restored tabs on `chrome.runtime.onStartup`. (Cheaper alternative: on any granted AI host with no live session, mount the collapsed pill only — clicking it starts a session from the tabs currently open.) Show a one-time inline caption on the bar's first appearance ("Type here to ask all your open AIs at once"), add **Reset follow-up bar position** to Settings › Maintenance, and bring the input to parity with the grid's — auto-growing textarea, Shift+Enter for a newline, Up-arrow recalling the last prompt.

### 27. Give the grid's empty and all-failed states somewhere to go

**Impact:** Medium · **Effort:** S · **Type:** Add

**Today:** `showEmpty` in [grid.js](pages/grid.js) renders an icon and the sentence *"No services to display. Enable some AI services in Settings"* — with no link and no button, on a full extension tab, and the header has no settings affordance at all (a grep for `openOptions` in grid.js returns nothing). When every iframe fails, the code logs a warning, reports the failures and returns, leaving a grid of identical error cards with no aggregate message. The prompt the user typed is held in `lastQuery` and rendered nowhere.

**Do this:** Give `showEmpty` an action and render an "Open settings" button (`chrome.runtime.sendMessage({action:'openOptions'})` already exists), plus a gear in the grid header. When `loadedTargets.length === 0`, render one banner — *"None of your AI tools would load here"* — with **Copy prompt · Open all in tabs with this prompt · Open settings**. Distinguish the two empty causes: "Puchne couldn't restore this session — start a new one?" versus a genuine no-services-enabled state.

### 28. Add search, export and import to Settings

**Impact:** Medium · **Effort:** M · **Type:** Add

**Today:** [options.html](pages/options.html) has six nav sections driving roughly forty controls across 1,767 lines of JS, with no way to find a setting by name — a user who remembers "hover expand" has to guess which tab owns it. Maintenance contains exactly two buttons. And the two most expensive things a user can build here — `customProviders` and hand-tuned `customSelectors` — exist only in `chrome.storage.sync` with no export path, so they cannot be backed up, moved to another profile, or shared. When someone works out the selector for a newly-broken site, that knowledge has nowhere to travel.

**Do this:** Add a filter field above the nav that indexes `.setting-label`/`.setting-desc` text on load and reveals the owning section — the markup already carries the labels. Add **Export settings** / **Import settings** to Maintenance writing a JSON blob (history excluded unless explicitly ticked). Export is what makes a selector fix a paste-able snippet, which feeds [12](#12-move-the-registry-into-a-data-module-with-a-remotely-refreshable-selector-manifest) and [45](#45-grow-the-provider-list-and-make-adding-one-a-non-developer-task).

### 29. Apply one destructive-action pattern — and stop "Reset All" eating custom providers

**Impact:** Critical · **Effort:** S · **Type:** Fix

**Today:** The guarding is inversely proportional to how hard the data is to reconstruct. "Reset All" gets a full confirm modal; **Delete provider** runs immediately with no confirmation and no undo, destroying a hand-written URL, two selectors and an input-type config; **Clear History** fires instantly; deleting a recent row fires instantly. Worse, `performReset` writes `chrome.storage.sync.set({ settings: DEFAULTS })`, and `DEFAULTS` contains `customProviders: []` and `customSelectors: {}` — so the one action that *is* guarded silently destroys every custom provider and every hand-tuned selector, while its modal promises only to "restore all settings to their default values and clear your prompt history". It also leaves every host permission granted, and never clears `gridLayout`, `followUpBar`, `grantedOrigins` or the flag keys. There is a live aliasing bug behind it: `{...DEFAULTS, ...stored}` is a shallow spread, so on any page load where stored settings lack `customProviders`, pushing a new provider mutates the `DEFAULTS` constant itself.

**Do this:** Fix the reset first — it is two changes. Write `structuredClone(DEFAULT_SETTINGS)` (see [128](#128-create-one-settings-schema-module)), and **preserve** `customProviders`/`customSelectors` unless a separately-checked box in the modal says "also delete my N custom AI tools". Add a third checkbox, "also withdraw access to all sites", wired to `chrome.permissions.remove`. Clear the orphaned local keys in the same pass. Then standardise: an undo toast with a 5-second window for everything reversible (delete provider, clear history, delete a recent), modal only for Reset All. `showToast` already exists — give it an optional action button and hold the deleted object in memory until the timer expires.

### 30. Rewrite the prompts "Ask Puchne" generates

**Impact:** High · **Effort:** M · **Type:** Improve

**Today:** This is the only prose Puchne writes on the user's behalf, and it determines whether the answers are any good. The page path takes `document.body.innerText`, collapses all whitespace, and hard-cuts at 2,500 characters with no marker — so on a typical article those 2,500 characters are the skip link, the nav bar, a cookie notice, a newsletter modal and the sidebar, with every paragraph boundary destroyed, followed by a fixed canned question. The selection path is worse: `info.selectionText.trim()` is sent verbatim with no instruction, no title and no URL, so seven models each guess what was wanted and most default to a summary nobody asked for.

**Do this:** Extract from `document.querySelector('article, main, [role=main]')` before falling back to `body`, remove `nav, header, footer, aside, script, style, [aria-hidden=true]` from a cloned subtree, collapse runs of spaces but keep `\n\n` between blocks, cut on a word boundary, append `…[truncated]`, and raise the cap to ~8,000 characters. Template the selection: ``From "${title}" (${url}):\n\n> ${selection}\n\nExplain this and tell me what actually matters here.`` In "show prompt" mode, render a collapsed "About this page — 2,410 characters" summary above the textarea with an expand toggle rather than dumping the slab into the box. Add a Behavior row: "Include page text" / "Send only the title and URL" — `formatPagePrompt` already has the empty-text branch, so the off case is free.

### 31. Show prompt size before a multicast multiplies it, and show recents before they exist

**Impact:** Medium · **Effort:** S · **Type:** Add

**Today:** Neither composer has a character counter, a length warning or a confirmation. Multicast multiplies cost: pasting a 30,000-character document sends it seven times — some composers truncate, some convert it to a file attachment, some reject it — and the user sees seven cells, several of which silently received a *different* prompt, which destroys the comparison the product exists for. Separately, `renderHistory` hides the entire history section when it is empty, so two of the panel's best properties — that it remembers prompts, and that they stay on-device — are visible only to users who no longer need telling. The privacy reassurance *"Stored locally on this device only"* lives inside that hidden block.

**Do this:** Add a live counter under the textarea (chars + `chars/4` as an approximate token count): neutral below ~4k, amber past ~8k, red past ~20k, and above amber make Send a confirm step naming the multiplier ("~9,400 tokens × 5 tools"). Add an optional `maxChars` per registry entry and a per-chip "will be truncated" hint. On first run, render the history section with one placeholder row — *"Prompts you send appear here, stored on this device only"* — dismissible so it doesn't become permanent chrome.

### 32. Declare incognito behaviour, and handle the second profile

**Impact:** High · **Effort:** M · **Type:** Fix

**Today:** [manifest.json](manifest.json) has no `incognito` key, so MV3 defaults to `"spanning"`: one shared worker, one shared `storage.local`. `addToHistory` never reads `sender.tab.incognito`, so a prompt deliberately typed in a private window is written to a history file that outlives the session — and the grid page, running in the normal profile's context, answers it from the user's real logged-in accounts. Separately, settings live in `chrome.storage.sync` while host permissions and history are per-installation: open Puchne in a second profile on the same Google account and you get seven chips switched **on**, all rendered **locked**, an empty recents list, and a first send that parks behind the access window — with nothing saying this is a new profile rather than a broken install.

**Do this:** Declare `"incognito": "split"` and hard-gate history (`if (sender.tab?.incognito) return;`), hide the recents list in any incognito-mounted panel, and show a "Private window — nothing saved" line where the shortcut hint sits. Say it on [privacy.html](website/privacy.html). For the profile case: when settings exist but zero origins are granted, show a one-line setup state — *"Your tools synced from another profile — allow the N sites here too"* — with a single button requesting every origin for the enabled set in one gesture. Add a note in AI Tools that tool choices sync while site access and prompt history deliberately do not; that split is a privacy feature and should read as one.

### 33. Trim the settings surface

**Impact:** High · **Effort:** M · **Type:** Remove

**Today:** `_doSave` writes 23 keys; `serviceOrder` is written separately by [prompt-panel.js](scripts/prompt-panel.js), making 24 — for a product whose job is one text box and a send button. Six of them configure things that should simply be right: `hoverExpandMin` (a dropdown for "2 or more / 3 or more / 4 or more"), `hoverExpandDelay` (six options from 0 to 2000ms), `overlayPosition`, `chipDisplay`, `showShortcutHint`, `historyLimit`. Three settings rows are devoted to tuning one hover interaction — a strong signal that the interaction is wrong rather than under-configured (see [62](#62-make-focus-sticky-and-keyboard-reachable-demote-hover-expand)). Every knob costs a row, a label, a save path, a hand-mirrored entry in [settings.html](website/settings.html) and a support answer.

**Do this:** Delete those six keys and their rows; hard-code hover-expand at ≥3 cells / 200ms, overlay centred, chips as logo+name, the shortcut hint always on, history at 50. Delete `delayMs` too ([17](#17-delete-the-page-load-delay-setting)). That takes 24 keys to roughly 13 and lets Appearance collapse into Behavior — one screen, no sidebar, no scroll. Also fix the two rows that are quietly wrong: one checkbox writes both `enableHistory` and `showRecents`, so a user who wanted a tidier panel has silently disabled recording; and the "disabled" Overlay Position row uses `opacity: .45; pointer-events: none`, so its combobox stays keyboard-focusable and fully operable.

### 34. Fix the popup / side-panel naming mismatch

**Impact:** Low · **Effort:** S · **Type:** Fix

**Today:** [manifest.json](manifest.json) has no `default_popup`, so `pages/popup.html` exists solely as the side panel, gated on the off-by-default `useSidebar`. Yet the manifest describes `Ctrl+Shift+X` as **"Open Puchne popup"**, and the panel's own footer advertises that shortcut as *the* way in — while both actually toggle an in-page overlay. The name of the surface is wrong in the manifest, in the command description, and by implication in the panel's hint.

**Do this:** Rename the command description to match what it does ("Open the Puchne compose panel"), and make the footer hint state the surface it will actually open, derived from the `useSidebar` setting. If [20](#20-make-the-first-icon-click-always-do-something) lands, the same shortcut genuinely does open a window on restricted pages, and the copy should say so.

---

# Features to Add

> Everything in this section from [35](#35-read-the-answers-back-out-of-the-grid-frames) onward is ordered so the blocker comes first. Findings 36, 37, 43 and 49 are hard-blocked on 35; nothing else here is.

### 35. Read the answers back out of the grid frames

**Impact:** Critical · **Effort:** L · **Type:** Add

**Today:** [content.js](scripts/content.js) has no answer-reading path at all — the only DOM work is the three fill functions and `pressEnter`. The registry entries carry `selector`, `buttonSel`, `loginSelector`, `waitMs`, `inputType` and `submitType`, and no `answerSelector`. `createCell` in [grid.js](pages/grid.js) sets `iframe.src` and stops. The only comparison aid in the entire product is hover-to-expand, which shows one answer bigger — not two answers together. [index.html](website/index.html) promises *"Ask once. Compare every answer."* and the product ships zero comparison surface.

**Do this:** The plumbing already exists — `background.js` injects `CONTENT_SCRIPT_FILES` into every grid sub-frame and messages it by frameId, and `getPageContext` already reads `document.body.innerText` from a frame, so there is a script inside each pane that can read text; it is simply never pointed at an answer node. Add an `answerSelector` (plus `streamingSelector`/`doneSelector`) to every registry entry and an `extractAnswer` handler beside the existing `getPageContext` one, returning `{ text, html, wordCount, startedAt, finishedAt }` without the 2,500-char cap. Detect "stopped streaming" with a MutationObserver on the message list (no mutation for ~1.5s) rather than polling. Gate it behind a setting so a user who wants pure multicast can turn it off. This is the one change that converts Puchne from a sender into a comparison tool: diff, copy-all, export, consensus, latency, best-answer, chaining and judging are all downstream of it, and each becomes about a week's work instead of impossible.

### 36. Ship "Copy all" and "Export to Markdown"

**Impact:** High · **Effort:** M · **Type:** Add

**Today:** The grid header holds exactly three controls: the Closed menu, Reset layout, and the Hover-to-Expand toggle. A repo-wide grep for clipboard/`writeText`/`execCommand('copy')` across `scripts/` and `pages/` returns one hit — a `DataTransfer` comment in the paste helper — and nothing else. So the most common thing anyone does after a multi-AI comparison (paste it into a doc, a PR, a Slack thread) requires seven manual select-and-copy operations across seven cross-origin iframes: precisely the copy-paste chore the README claims Puchne eliminates. Worse, per-cell copy is *separately* broken by the missing `allow` attribute ([59](#59-set-allow-and-sandbox-on-the-cell-iframes)) — the sites' own Copy buttons silently do nothing inside a cell.

**Do this:** Once answers are readable, add **Copy all** and an **Export ▾** menu (Markdown / plain text / self-contained HTML) to the grid header, plus a small copy icon in each cell header. Markdown shape: `# <prompt>`, then `## ChatGPT` / answer / `## Claude` / answer, with a footer carrying the timestamp and model names. Assemble and write from the top-level extension page — a cell cannot do it — and note that a published page cannot start its own download, so use the downloads API rather than an `<a download>`. Ship "Copy all" first; it is a day of work and it is the single most-requested capability a tool like this has.

### 37. Build a consensus and disagreement view

**Impact:** Medium · **Effort:** L · **Type:** Add

**Today:** No text analysis exists anywhere. The grid's only aggregate operation is the follow-up send, which fans one string out and reads nothing back. [use-cases.html](website/use-cases.html) sells this as *"Grid view — diff the patches by eye"*, which is an admission that the product stops at "by eye".

**Do this:** Two tiers. **Tier 1, no API needed:** a `Compare` panel sliding over the grid showing sentence-level overlap — claims appearing in ≥N answers in green, claims unique to one model in amber — plus a numbers-and-entities table, because if four models say "2019" and one says "2021" that disagreement is mechanically findable. **Tier 2, API mode only:** a real LLM synthesis pass. Ship Tier 1 first: it is honest, deterministic, offline, and nobody else has it. With N answers on screen the real question is never "what did each say" but "what did they all say, and where do they split" — that synthesis is what the user is doing by hand today, and it is the thing that makes a launch video land.

### 38. Save comparisons as named, reopenable sessions

**Impact:** High · **Effort:** L · **Type:** Add

**Today:** A comparison is a document and Puchne treats it as scratch. The payload is deleted the moment the tab closes and swept on startup; `saveLayout` writes one global `gridLayout` key, so a second comparison of a different size silently discards the first one's geometry; and `lastQuery` is a single string each follow-up overwrites, so the thread *inside* a grid session isn't recorded at all — only the most recent turn survives.

**Do this:** Introduce a local `comparisons` store: `{id, title, createdAt, targetIds, turns: [{prompt, at, answers?}], layout}`. Auto-title from the first prompt; let the user rename. Add a **Comparisons** tab to the options sidebar (the six-tab nav pattern already exists) with search, delete, and a **Reopen** that rebuilds the grid and replays the thread. Explicitly do **not** build share-permalinks — that needs a server and breaks the no-server promise; [36](#36-ship-copy-all-and-export-to-markdown) is the sharing story.

### 39. Turn recents into a searchable, pinnable prompt library

**Impact:** High · **Effort:** M · **Type:** Improve

**Today:** `promptHistory` is a flat array of `{text, timestamp}` rendered as an unfiltered `<ul>` with one delete button per row — no search, no pin, no tag, no folder, no sort beyond recency. Dedupe is exact-string, so a prompt with one word changed is a separate entry. The 20-item default is user-configurable up to 100, so the cap is less brutal than it looks — but the list is FIFO with no way to protect the prompt you use every Monday, and it lives in `storage.local` while every setting lives in `storage.sync`, so recents never follow the user to a second machine even though their layout preferences do.

**Do this:** Extend the entry shape to `{text, timestamp, pinned, tags, useCount, lastUsedAt}` and migrate on read — `loadHistory` already normalises a legacy string format, so the hook exists. Add a fuzzy filter input above the list, a pin toggle that exempts an entry from the slice and floats it to the top, sort by recent/most-used, and a **Prompts** section in Settings for bulk management, tagging and JSON import/export. Consider syncing *pinned* items only. Keep the rest in `storage.local` — prompt text is the most sensitive thing this extension touches.

### 40. Add a template library with `{{variables}}`

**Impact:** High · **Effort:** M · **Type:** Add

**Today:** The panel is a bare textarea with a placeholder — no template picker, no slash commands, no snippet insertion — and the settings object contains no template key. Every serious prompt user keeps a stash of scaffolds ("act as a senior X, review this Y, output Z"); Puchne makes them retype it or dig through the recents list.

**Do this:** Store `promptTemplates: [{id, name, body, tags, targetIds?}]` in `storage.local`. A `/` at the start of an empty textarea opens a picker; selecting a template inserts the body and, if it contains `{{placeholders}}`, walks the user through filling them with Tab-to-next-field. Ship 8–10 starters mapped to the use-cases page (Explain like I'm five · Code review · Rewrite for clarity · Fact-check with sources · Translate to X · Compare these two options · Turn into a checklist · Interview me about this). Let a template pin its own target set so it composes with [49](#49-add-quick-switch-profiles). Support `{{selection}}` and `{{page}}` so templates compose with Ask Puchne. Add a Templates tab with JSON import/export so the community can trade packs on GitHub.

### 41. Add per-service prefix/suffix and a global modifier

**Impact:** High · **Effort:** S · **Type:** Add

**Today:** `handleMulticast` sends the identical `query` string to every target; the grid payload stores one `query` for all cells; and `resolveTargets` — the natural insertion point — merges per-service overrides for `selector` and `buttonSel` only, with no hook for text. Sending one undifferentiated string to seven very different systems is the crudest possible version of multicast.

**Do this:** Add `servicePrompts: { [serviceId]: { prefix, suffix } }` to settings and apply it in `resolveTargets`, so every send path — multicast, grid injection, follow-up, direct Ask Puchne — inherits it for free. Surface it as two textareas in the existing per-service expandable editor in [options.js](pages/options.js). Add a global **System modifier** applied to all services, with quick chips: Be concise / Cite sources / No preamble / Answer in `<language>`. Models need different handling — ChatGPT rambles unless told not to, Perplexity needs "cite sources", a reasoning model wants "think step by step" and a fast one does not — and the fix is about thirty lines.

### 42. Support model variants

**Impact:** High · **Effort:** L · **Type:** Add

**Today:** Every registry entry pins exactly one URL, and the documented field list contains no model, variant or mode field; nothing downstream carries one either. So "ask every AI at once" currently means "ask whatever model each site happens to have selected" — the user cannot compare Opus against Sonnet, a thinking model against a fast one, or force a deep-research mode. Worse, the comparison is silently non-reproducible: the reader has no idea which model actually answered.

**Do this:** Add an optional `variants: [{id, label, url?, modeSelector?}]` array. Where the site accepts a URL parameter a variant is just a different URL and costs nothing; where it needs a click, an optional `modeSelector` the content script clicks after load and before fill, reusing `waitForElement`. Render variants as a chevron on the chip, and **stamp the chosen model name into each grid cell header** so an exported comparison says which model produced which answer. Ship with the two or three URL-addressable variants per provider and let the rest be community selector contributions. This is the difference between "I asked five AIs" and "I asked GPT-5.1, Opus 4.6 and Gemini 3 Pro".

### 43. Add a temporary-chat toggle and an honest one-line disclosure

**Impact:** High · **Effort:** M · **Type:** Add

**Today:** This is the sharpest coherence gap in the product. Every service URL opens a normal, logged, account-attached session. The panel reassures the user *"Stored locally on this device only"* about the prompt history while simultaneously writing that same prompt into seven permanent cloud chat histories. The README and [privacy.html](website/privacy.html) headline "No account. No server. No tracking.", and [index.html](website/index.html) answers "Can it see my prompts?" with "Only to type them." — true of Puchne, and silent about the seven vendor logs.

**Do this:** Add a `temporaryUrl` field per registry entry and a **"Temporary chat where supported"** toggle in the panel header and Behavior settings. ChatGPT has a URL-addressable temporary mode; most of the other six do not, so this lands as an optional per-service field, not a universal switch — render a small persistent-history marker on the chips that will remember. Then add the one line that matters, under the send button on first use: *"Your prompt goes to each AI's servers under your account."* Being the extension that says this out loud is a positioning win, not a liability.

### 44. Send the page screenshot or a selected image, not just text

**Impact:** Medium · **Effort:** L · **Type:** Add

**Today:** The whole pipeline is string-shaped: `fillQuery` carries `query` as text and all three fill functions take a string. `activeTab` is already in the manifest, which is what `captureVisibleTab` needs. Every provider in the registry accepts image input, and "explain this chart", "what's wrong with this UI" and "read this error screenshot" are among the most common multimodal asks — Puchne can't express any of them.

**Do this:** Start with the achievable 80%: an **Ask about this screenshot** context-menu action calling `chrome.tabs.captureVisibleTab`, delivering the PNG by synthesising a paste — `fillContentEditable` already builds a `DataTransfer` and dispatches a paste event, so attaching a `File` to `dataTransfer.items` is a small extension of code that exists. Add **Ask about this image** on `contexts: ['image']`. Defer arbitrary file attachment and voice-to-file: both are large, per-site fragile, and low frequency next to screenshots.

### 45. Grow the provider list, and make adding one a non-developer task

**Impact:** High · **Effort:** M · **Type:** Add

**Today:** `AI_SERVICES` holds exactly seven entries and skews Western; Mistral, Qwen, Kimi, Meta AI, Z.ai and Poe are absent. The escape hatch exists but is priced in developer skill: the add form hard-requires a CSS selector before it will submit, offers an `inputType` choice between textarea/contenteditable/prosemirror that is meaningless to a non-developer, and is reachable only by clicking a collapsed row inside the AI Tools tab — never mentioned in the panel, in the grid, or when a service is missing. In practice the seven built-ins are the whole product. (Note the form is not blind: it already ships a **Test service** button that opens the page and reports Input ✓ / Button ✓ before saving — that is the foundation, not a missing piece.)

**Do this:** Three moves.
- **Grow the list.** Roughly in value order: Mistral Le Chat, Qwen Chat, Kimi, Meta AI, Z.ai/GLM, Poe, Copilot's consumer sibling. Add a **Local & self-hosted** group (see [47](#47-make-local-and-self-hosted-models-a-headline-feature)). Each addition is one registry entry, one icon, one `optional_host_permissions` line and one DNR rule — a three-file change with tiny marginal cost and value linear in the count.
- **Ship a catalogue.** An "Add from catalogue" list of ~20 pre-configured providers with selectors filled in, maintained as a JSON file in the repo, so "adding Mistral" is one click and the community maintains the selectors.
- **Add auto-detect.** A button that opens the URL and runs the generic fallback selectors through the existing `testService`/`testSelector` round trip, filling whatever resolves — reducing the required input to Name + URL — plus a visual element picker ("open the site and click the prompt box") for the rest, and inferring `inputType` from the picked element instead of asking. Surface the entry point where the need arises: from the panel's locked-chip area and the grid's empty state.

### 46. Make custom providers shareable

**Impact:** Medium · **Effort:** M · **Type:** Add

**Today:** A custom provider is created only by hand-typing five fields and lives only in that install's `storage.sync`. There is no export, no import, no paste. Every user who adds Mistral solves the identical selector puzzle from scratch, and when Mistral's DOM changes every one of them breaks independently and privately. The knowledge that makes this product work is generated repeatedly and thrown away.

**Do this:** Add **Copy as JSON** and **Paste a provider** to the custom-provider card, with strict validation on the way in (https or localhost only, no `javascript:`, selector length caps, name escaped — see [121](#121-escape-provider-supplied-strings-and-validate-provider-urls)). Publish a `providers/` directory in the repo and a gallery page on the site with a copy button per entry, so a contributor's PR is a five-line JSON file rather than a code change. This is also the natural delivery vehicle for the remote selector manifest in [12](#12-move-the-registry-into-a-data-module-with-a-remotely-refreshable-selector-manifest).

### 47. Make local and self-hosted models a headline feature

**Impact:** Medium · **Effort:** S · **Type:** Add

**Today:** [options.html](pages/options.html) advertises "or a self-hosted UI" as a custom-provider use case, and `http://*/*` sits in `optional_host_permissions` to make it possible — but every local AI UI (Open WebUI, LM Studio, Jan, AnythingLLM, text-generation-webui) serves over plain http on localhost, and the wildcard is also the thing that makes the "On all sites" escalation reachable. Deleting it outright (correct on security grounds) would quietly kill the one custom-provider story that is both safe and genuinely differentiating.

**Do this:** Replace `http://*/*` with `http://localhost/*` and `http://127.0.0.1/*`. Ship presets in the Add card — "Local model (Open WebUI / LM Studio / Jan)" — that prefill URL and selectors, so adding one is a dropdown rather than DOM archaeology. Give local providers a distinct badge on the chip and the cell header. Then make it the hero of a use-case page: *"Your prompt, GPT-5, Claude, and the 8B model on your own SSD — in one screen, with the local one never touching the network."* No competitor puts that in a screenshot, and this codebase is four manifest lines away from it.

### 48. Offer an optional bring-your-own-key API mode

**Impact:** High · **Effort:** XL · **Type:** Add

**Today:** Every structural weakness traces to one root cause: the extension drives other people's UIs. Selectors rot (the registry's own comment says so), frames get blocked, answers are unreadable because they live cross-origin, latency is unmeasurable, and the maintenance burden scales with providers × redesign frequency. The evidence is all in the code: a per-service CSS selector registry, a user-facing custom-selector escape hatch, a Test button that opens a background tab to check whether selectors still resolve, and eight DNR rules stripping framing headers so the sites can be embedded at all.

**Do this:** Build it as a **second delivery mode, not a replacement**. Per service the user may store an API key; keys go in `chrome.storage.local` and **never** `chrome.storage.sync` — note `getSettings` reads from sync, so keys must not live in the settings object. Calls go browser→provider directly, so no server and no account is introduced and the privacy claim survives; add the API hosts to `optional_host_permissions` and request them alongside the existing per-service grant. Render API answers as native panes in the same grid geometry with real streaming. Be honest in the UI about the trade-off — web mode is free and uses the subscription you already pay for; API mode costs per token but is faster, scriptable, reproducible and never breaks — and show a running per-comparison cost estimate. Sequence it **after** [35](#35-read-the-answers-back-out-of-the-grid-frames) so the compare features exist in both modes; API mode must never become a prerequisite for the product's core promise.

### 49. Add quick-switch profiles

**Impact:** High · **Effort:** M · **Type:** Add

**Today:** `enabledServices` is a single flat array with one global `serviceOrder`. Changing which AIs a send goes to means clicking chips off and on by hand, every time. Different jobs want different panels — code review wants Claude + DeepSeek + Copilot, research wants Perplexity + Gemini + ChatGPT, a quick factual check wants two fast models — so today the user either keeps a permanent compromise set or re-toggles on every context switch. The architecture is one array away, and `askTargetMode`/`askTargetIds` is already a *second*, separate target set for the Ask Puchne flow — evidence the one-array model is straining.

**Do this:** Add `profiles: [{id, name, serviceIds, servicePrompts?, gridView?}]` and an `activeProfileId`, generalising from the `askTargetIds` case rather than bolting on a third. Render them as a compact segmented control above the chip row, with the current chip state acting as an unsaved override plus "Save as profile". Ship three defaults (Everything / Coding / Research) so the feature is discoverable on install rather than empty. Compose with [40](#40-add-a-template-library-with-variables) so a "Code review" template automatically targets the coding profile.

### 50. Replace the single "Ask Puchne" menu item with a set of one-click actions

**Impact:** High · **Effort:** M · **Type:** Improve

**Today:** `setupContextMenus` creates exactly two items, both literally titled "Ask Puchne" — one for selection, one for page/frame — and the page mode always produces the same two hard-coded strings. That is the least ambitious possible use of the most valuable real estate the extension owns.

**Do this:** Make "Ask Puchne" a parent menu with a verb list: **Summarize this page · Explain simply · Key takeaways · Fact-check with sources · Translate to `<language>` · Extract action items · Critique this** (on selection) **· Explain this code** (on selection, when the page looks like a code host) **· Summarize this video** (on YouTube — pull the transcript from the page rather than sending a bare URL, which is what makes the difference between this working and not). Store the action list as data so users can add their own from the template library. Add the same verb row to the panel above the textarea as one-tap chips. Keep the existing panel-vs-direct setting governing all of them. The YouTube and code cases alone are demo-worthy.

### 51. Add regenerate, edit-and-resend, and a real turn history

**Impact:** Medium · **Effort:** S · **Type:** Add

**Today:** `submitFollowUp` clears the input and overwrites `lastQuery`. There is no history of the thread inside the grid, no way to resend the previous prompt, and no way to edit-and-resend without retyping — and because `injectRestored` replays only `lastQuery`, a cell re-opened mid-thread receives just the most recent turn and silently misses every earlier one, so it is no longer comparable to the cells that stayed.

**Do this:** Keep the grid's prompts in an array rather than one string. Add a ↻ next to the follow-up send that resends the last prompt to all cells, ↑/↓ in the empty input to walk back through this session's prompts shell-style, and a per-cell ↻ that regenerates one. Add a **Send with modifier** split button (shorter / longer / more technical / with sources) that appends to the previous prompt. Fix `injectRestored` to replay the whole turn array so a re-opened cell catches up instead of joining mid-conversation with no context.

### 52. Enable prompt chaining and judging

**Impact:** Medium · **Effort:** L · **Type:** Add

**Today:** Every send is a fan-out of one string to N targets; `injectIntoGridFrame` returns only `{ok, filled, submitted, error}` and never any page content. There is no path from any service back into a prompt, because nothing reads answers.

**Do this:** Once [35](#35-read-the-answers-back-out-of-the-grid-frames) lands, add a per-cell overflow menu: **Send this answer to →** (pick targets), **Ask the others to critique this**, **Ask all to merge their answers**. Implement as a template wrapping the extracted answer — *"Here is another AI's answer to `<prompt>`. Critique it, then give your own."* Add a **Judge** action that sends all N answers to one chosen model and asks it to rank them, which pairs directly with [53](#53-let-the-user-crown-a-winner-and-keep-a-local-scoreboard). This is the feature nobody else in the category can have, because nobody else is sitting on N live panes at once — and it is the one that gets screenshotted.

### 53. Let the user crown a winner, and keep a local scoreboard

**Impact:** High · **Effort:** M · **Type:** Add

**Today:** Nothing in Puchne learns from use. No rating, voting or preference storage exists; the settings defaults hold only enable/appearance/behavior keys, and history entries record `{text, timestamp}` and nothing about outcomes. Every comparison produces a judgement in the user's head that the product throws away.

**Do this:** Add a ★ to each grid cell header recording `{promptText, promptHash, winnerId, allTargetIds, at}` in `chrome.storage.local`. Surface it two ways: a **Your scoreboard** card in Settings — *"Claude wins 61% of your coding prompts, Gemini wins 48% of your research prompts"* — and a subtle win-rate hint on the chips, so the default enabled set can eventually suggest itself. Local-only, so it costs the privacy promise nothing; add a Clear scoreboard button next to Clear History. After a month the user knows, from their own data rather than a benchmark, which model to trust for which kind of question — which is a reason to keep the extension installed forever.

### 54. Add a Ctrl+K command palette and an omnibox keyword

**Impact:** Medium · **Effort:** M · **Type:** Add

**Today:** The grid's keyboard surface is better than it looks — Escape to un-maximize, Alt+1..9 to focus a cell, fully keyboard-resizable `role="separator"` handles with arrow/PageUp/Home/End support, Escape-to-close on the Closed menu, Enter-to-send from both composers. What is missing is a way to *reach* those surfaces without a mouse and to act on cells: no binding to focus the follow-up bar, no close/reopen/maximize-cell shortcut, no copy, no jump to settings, no reset-layout key — and no discoverability, since none of the existing bindings appear anywhere in the UI. Only two of Chrome's four `commands` slots are used. `omnibox` appears nowhere.

**Do this:** Add a `?` cheat-sheet overlay documenting what already exists, a shortcut to focus the follow-up input, and a **Ctrl+K palette** in both the grid and the panel with fuzzy search over every action (send to `<service>`, toggle `<service>`, switch profile, insert template, copy all, export, maximize/close cell N, reset layout, reopen closed, open settings). Note that keystrokes inside a cross-origin iframe never reach the grid document — the code already documents this — so the palette needs a visible header affordance too. Spend the two unused command slots on "Send my last prompt again" and "Open the grid with the last comparison". Then add `"omnibox": { "keyword": "ai" }` and an `onInputEntered` handler calling `handleMulticast` — with `onInputChanged` suggesting recent prompts and supporting `ai @claude @gpt <prompt>` for targeting. Ctrl+L, "ai", question, Enter: thought to seven answers without the mouse moving.

### 55. Put an "Ask the others" pill on AI pages

**Impact:** High · **Effort:** M · **Type:** Add

**Today:** `registerServiceScripts` already registers `content.js` on every granted AI host at `document_idle`, and the registry already knows each site's input selector — but the follow-up bar mounts nothing unless the tab belongs to a live multicast, so an ordinary visit to chatgpt.com loads 92 KB of Puchne and shows nothing. Meanwhile the most common real-world moment is not "I will now compose a multicast"; it is *"I'm already in ChatGPT, this answer is weak, I want a second opinion"* — which today means copying the prompt out, opening Puchne, and pasting it back.

**Do this:** On any granted AI host, mount a small collapsed pill (reuse the follow-up bar's shadow host and per-origin position persistence). One click reads the last user turn out of the page — add a `lastPromptSel` field next to `loginSelector` so it rots in the same place selectors already rot — and multicasts it to every *other* enabled tool, opening the grid alongside. Gate the whole surface behind one clearly-named setting, since it means Puchne is visible on pages the user did not summon it on. This is the feature no competitor can copy without also being inside the page.

### 56. Pop the compose bar out into a floating window

**Impact:** Medium · **Effort:** M · **Type:** Add

**Today:** `documentPictureInPicture` appears nowhere. The grid's follow-up bar lives inside the grid tab and the in-page one lives inside whatever tab it was mounted on — both vanish the moment the user switches tabs. But the real workflow is: send to seven AIs, go read something else while they answer, come back with a follow-up.

**Do this:** Add a pop-out button to the grid header and the follow-up bar calling `documentPictureInPicture.requestWindow({ width: 460, height: 220 })` and **moving** the existing form node into it — the DOM node moves, so listeners and the adopted stylesheet survive. Show per-service delivery dots from the status record the worker already maintains. Fall back silently to the inline bar where the API is unavailable, and close the window when the session ends. An always-on-top Puchne console that follows you across tabs and apps is the single most "I didn't know an extension could do that" moment available here for a day's work.

### 57. Add voice input

**Impact:** Medium · **Effort:** S · **Type:** Add

**Today:** No `SpeechRecognition` usage anywhere; the only input path is the textarea. (Microphone is separately dead inside grid cells because the iframes set no `allow` attribute — see [59](#59-set-allow-and-sandbox-on-the-cell-iframes).)

**Do this:** Add a mic button to the panel running `SpeechRecognition` with `interimResults` streaming into the textarea, in the popup and options page (extension pages can hold a persistent mic grant; the in-page overlay should fall back to opening the popup). Respect reduced motion for the level meter and show a clear recording state. Say plainly that audio is processed by the browser and never leaves the device — which is true, and is exactly the sentence this product should be saying. "Say it once, seven AIs answer" is a demo; it is also the cheapest genuine accessibility win in the codebase.

---

# Grid View

> Grid view is the **default** (`gridView: true`), not an opt-in power-user mode. Everything here describes the out-of-the-box first-run experience, which changes the priority of [58](#58-send-the-prompt-to-each-cell-as-it-loads-not-after-the-slowest-one), [60](#60-detect-a-blocked-cell-and-give-it-a-real-reason-and-a-retry), [1](#1-give-grid-mode-a-failure-surface--today-it-has-none) and [8](#8-run-the-login-check-in-grid-mode-and-tighten-its-heuristic) from "polish" to "first-impression blockers".

### 58. Send the prompt to each cell as it loads, not after the slowest one

**Impact:** Critical · **Effort:** M · **Type:** Perf

**Today:** Two independent serializations stack. In [grid.js](pages/grid.js) injection is gated behind `await Promise.all(iframeLoadPromises)` — nothing is injected until the *slowest* cell resolves, and each cell's promise carries a 12,000ms timeout that only starts at `i * GRID_STAGGER_MS`, so with seven cells the last navigation begins 1,200ms in and its deadline is 13.2s. Then in [background.js](scripts/background.js) the `injectGridQueries` handler is a strict `for (const target of allowed) { await injectIntoGridFrame(...) }`, re-running `chrome.webNavigation.getAllFrames` over the whole frame tree on every iteration, re-injecting the 94 KB bundle into each sub-frame, and paying up to `INJECT_TIMEOUT_MS` (15s) per target. The tabs branch, by contrast, is correctly parallel. So the mode advertised as "at once" is the slowest path in the product: ChatGPT can be interactive at 1.5s and sit empty for twelve seconds waiting on a Grok cell that will never load, then wait again behind a serial queue. And the 15s burners are not the dead cells (those are collected as `failedIds` and never enter the loop) — they are the logged-out ones, which [8](#8-run-the-login-check-in-grid-mode-and-tighten-its-heuristic) shows are common.

**Do this:** Two changes.
```js
// grid.js — the per-cell path already exists; injectRestored() uses it
iframeLoadPromises.forEach((p) =>
  p.then((r) => (r.ok ? sendInject([r.service]) : markFailed(r.service))));
// keep one Promise.allSettled afterwards purely for failedIds bookkeeping
```
```js
// background.js — hoist getAllFrames out of the loop, then:
const results = await Promise.all(allowed.map(async (t) => {
  const res = await injectIntoGridFrame(tabId, t, query, opts);
  await markService(t.id, stateFromResult(res));   // markService already serializes
  return { service: t.name, ...res };
}));
```
Also lower the injection timeout for the grid path — the frame is already loaded, so 15s is an order of magnitude too generous — and give the first fill attempt a deadline shorter than the 30×1s `waitForElement` budget, which can never finish inside it anyway. Expect ~5.6s of pure serialization to drop to ~0.8s, and first answers to start at ~2s instead of ~15s.

### 59. Set `allow` and `sandbox` on the cell iframes

**Impact:** High · **Effort:** S · **Type:** Fix

**Today:** `createCell` in [grid.js](pages/grid.js) creates the iframe with `className`, `title` and `style.display` and nothing else — no `allow`, no `sandbox`, no `referrerpolicy`. Two consequences.
- Permissions Policy defaults `clipboard-read`, `clipboard-write`, `microphone`, `camera` and `display-capture` to `self`, i.e. **denied in cross-origin iframes** unless the embedder opts in. So inside every cell, ChatGPT's and Claude's Copy buttons on every code block and every answer silently do nothing, and voice input is dead everywhere. The one interaction a comparison user performs most is the one that's broken, and it fails silently, so it reads as *"this extension breaks ChatGPT"*.
- A non-sandboxed cross-origin frame retains top-level navigation once it has sticky user activation — i.e. after the user clicks anywhere in that cell. One line of `if (top !== self) top.location = self.location` from any provider replaces the whole grid tab, destroying six other live conversations and the prompt. Given that Puchne actively strips `X-Frame-Options`, a JS frame-buster is the provider's obvious next move.

**Do this:** Set both before assigning `src` (Permissions Policy is locked in at navigation):
```js
iframe.allow = "clipboard-read; clipboard-write; microphone; camera; display-capture";
iframe.sandbox = "allow-same-origin allow-scripts allow-forms allow-modals " +
                 "allow-popups allow-popups-to-escape-sandbox allow-downloads " +
                 "allow-storage-access-by-user-activation";  // NOT allow-top-navigation
iframe.referrerPolicy = "strict-origin-when-cross-origin";
```
Omitting `allow-top-navigation` is exactly what neuters a frame-buster; `allow-same-origin` restores the frame's own origin to itself and grants no access to the parent extension page. Test all seven — OAuth popups need `allow-popups-to-escape-sandbox`, uploads need `allow-forms` — and leave a comment recording why, because it is a strong signal to a store reviewer that the framing is defensive rather than careless. (Do not add `autoplay`: its default allowlist is already `*`.)

### 60. Detect a blocked cell and give it a real reason and a retry

**Impact:** High · **Effort:** M · **Type:** Fix

**Today:** [grid.js](pages/grid.js) resolves `{ ok: true }` on the iframe `load` event — but Chrome fires `load` for navigations refused by `X-Frame-Options`/`frame-ancestors` and for error documents too, so a blocked cell is recorded as loaded, passed to `injectGridQueries` as a live target, and the user gets a white rectangle with a title bar while the worker records "frame not found". Puchne's own *"could not be embedded"* card only ever appears on the 12-second **no-load** timeout, which a fast refusal never reaches. And when that path does fire it calls `iframe.remove()`, so a cell that was merely slow is dead for the life of the tab — recoverable only by closing it and hunting through the Closed dropdown, which then re-sends the prompt. Meanwhile `describeError` has a purpose-written string for this case, *"This site refused to load in the grid. Open it in a tab instead."*, that reaches no UI at all.

**Do this:** After `load`, probe the frame — `chrome.webNavigation.getAllFrames` for a sub-frame on the target origin, or a `chrome.scripting.executeScript` returning `location.origin` — and only then mark the cell loaded; on failure paint the error state with `describeError`'s existing copy. Never call `iframe.remove()`; keep it behind an overlay so the state is recoverable. Give the error card three actions instead of one dead link: **Retry** (calling the `mountService` primitive that already exists), **Open in a tab with my prompt**, and **Sign in** where the failure looks like auth. Give `injectRestored` a `{ resend: false }` flag so a retry remounts without re-asking. Make the 12s timer soft: "Still loading — Retry / Open in tab" over a live iframe rather than a tombstone.

### 61. Fix the 4- and 7-cell layouts and add a responsive floor

**Impact:** Medium · **Effort:** M · **Type:** Improve

**Today:** `computeLayout` hard-caps at three logical columns forever. Four services — an extremely common set — therefore produce three narrow cells above one triple-width cell, when 2×2 is obviously right; seven does the same. Only the 3-columns-with-2-in-the-last-row case gets the nice 6-track treatment. There are no width-based media queries in [grid.css](styles/grid.css) (the only `@media` is `prefers-reduced-motion`), `.grid-container` is a fixed `height: calc(100vh - 48px)` with `overflow: clip`, and there is no column-count control anywhere. At seven cells on a 1366×768 laptop each frame is roughly 455×206 CSS pixels — below every provider's mobile breakpoint.

**Do this:** Replace the `Math.min(count, 3)` cap with a lookup — 4 → 2×2, 6 → 3×2, 7/8 → 4×2 — falling back to the current algorithm above 8. Add a `MIN_CELL_PX` floor (~520px wide, ~320px tall): when `containerW / cols` drops below it, reduce columns and let the container scroll (`overflow-y: auto` with `grid-auto-rows: minmax(320px, 1fr)`) instead of clipping. Add a column-count control to the grid header — 1 / 2 / 3 / 4 / auto — persisted into the layout record, and one `@media (max-width: 1100px)` rule dropping to two columns.

### 62. Make focus sticky and keyboard-reachable; demote hover-expand

**Impact:** Medium · **Effort:** M · **Type:** Flow

**Today:** Expansion is driven purely by `mouseenter` with a dwell timer, collapsed on `mouseleave`, and rewrites `colFracs`/`rowFracs` so that **every** cell relayouts under the cursor as a side effect of the cursor merely being somewhere. Reaching across the grid to click a button in a far cell re-lays-out seven live SPAs mid-gesture and the target moves. It cannot be triggered by keyboard, cannot be pinned (the state is discarded by any resize or drag), and overlaps confusingly with a maximize that already exists three ways — header button, header double-click, Alt+1..9. Three settings rows exist to tune it, which is the tell.

**Do this:** Keep the mechanism, change the trigger and the default. Flip `hoverExpand` to `false` and relabel it "Expand on hover (experimental)". Make **click-to-focus** primary: clicking a cell header (or Alt+1..9, which already works) sets a *persistent* focused cell using the same `computeExpandedFracs` path, saved through `saveLayout`, cleared by clicking again or pressing Escape. Bind it to `focusin`/`focusout` as well as click so keyboard users get it. Add a thin rail of service chips in the header that focus each cell — which doubles as the keyboard cell-switcher the grid is missing and as somewhere for focus to land after escaping a frame. Keep maximize as the 100% case and drop the redundant double-click, whose `title` is currently the only documentation of the feature.

### 63. Add per-cell zoom and per-cell controls

**Impact:** Medium · **Effort:** M · **Type:** Add

**Today:** Each cell header holds exactly two buttons — maximize and close. There is no reload, no "new chat", no always-visible open-in-tab (it exists only in the dead-cell error card), no collapse, and no way to swap in a service that wasn't in the original send: `closedServices` starts empty and only ever collects cells the user closed, so the Closed menu can restore but never extend. And `.cell-iframe` has no transform of any kind, while `chrome.tabs.setZoom` cannot target a frame — so with six cells on a 1440px display each frame is ~480px wide, inside every provider's mobile layout, and the only levers are "make one bigger (making the others smaller)" or "close one".

**Do this:** Add an overflow "⋯" menu to the cell header: **Reload** (`iframe.src = iframe.src`), **New chat** (`iframe.src = service.url`), **Open in a tab** (read the frame's *current* URL via `getAllFrames` so the user lands on the actual conversation), **Collapse** (shrink to the 34px header and redistribute the freed fraction — `computeExpandedFracs` already does that math), **Suspend** (see [68](#68-bound-the-memory-cost-and-add-suspend)), and **Swap service**. Also expose "Open in a tab" as an always-visible icon. Add a zoom control — 100/90/80/70/60% — implemented as `transform: scale(z)` with `transform-origin: 0 0` and compensating `width`/`height` on an `overflow: hidden` wrapper, persisted per service in the layout record, plus a global "Fit more". At 75% each cell shows roughly 1.8× the content, and AI answers are text, so they stay perfectly legible. Six answers become genuinely readable side by side instead of six scrolling slivers.

### 64. Upgrade the follow-up bar, and wire it immediately

**Impact:** Medium · **Effort:** M · **Type:** Improve

**Today:** The grid's follow-up bar is a bare textarea and a send button that clears the input, reassigns `lastQuery`, fires `injectGridQueries` at `loadedTargets`, and does nothing else — no recents (though [prompt-panel.js](scripts/prompt-panel.js) implements exactly that UI and [grid.html](pages/grid.html) *loads* it without ever instantiating it), no per-cell targeting, no focus shortcut, and a `height: 1.4em; overflow: hidden` input so a pasted paragraph scrolls invisibly inside one line. There is also a focus-guard hack — a blur handler with a one-second "typed recently" heuristic that re-steals focus — which exists only because injection focuses the editor inside each frame. Worst of all, the form's handlers are registered **after** `await Promise.all(iframeLoadPromises)`, so for the first up-to-12 seconds pressing Enter does nothing silently — and the zero-load guard returns before that line is ever reached, so if no cell embeds the input is permanently inert while still looking fully interactive.

**Do this:** Register the form handlers immediately after `initHeaderControls()` and have the submit read the live `loadedTargets` (already a module-level `let`), disabling the button while it is empty. Mount `PuchnePromptPanel`'s recents list and service chips as a popover above the bar — the script is already loaded — and let the chips act as **targets**, so a follow-up can go to a subset instead of always all loaded cells. Bind `/` and `Ctrl+K` to focus it. Let the textarea auto-grow to ~5 rows. Add a `focusInput: false` flag to the `fillQuery` message for follow-ups so the content script stops stealing focus, then delete the guard hack outright.

### 65. Add synchronized scrolling

**Impact:** Medium · **Effort:** M · **Type:** Add

**Today:** There is no cross-pane scroll synchronization — [grid.js](pages/grid.js) scrolls the parent container to bring a cell into view for Alt+N focus, and that is all. Comparing two long answers means scrolling seven panes independently and losing your place every time. The parent cannot do this directly (the cells are cross-origin), but Puchne already runs its own content script inside every grid frame, which can.

**Do this:** Add a **Sync scroll** toggle beside Hover-to-Expand, defaulted off. Each grid sub-frame reports its `scrollTop / scrollHeight` ratio on scroll (throttled through `requestAnimationFrame`); the grid relays a `setScrollFraction` to every *other* frame by frameId, reusing the plumbing `injectIntoGridFrame` already has, with a re-entrancy guard so relayed scrolls don't echo. Make it **proportional**, not pixel-locked — answers differ wildly in length, so pixel sync is meaningless. Reading answer three against answer five stops being a memory exercise.

### 66. Show latency and answer-length badges

**Impact:** Medium · **Effort:** M · **Type:** Add

**Today:** The cell header carries only an icon, the name, maximize and close. `startSendStatus` records one send-level `startedAt`, and `markService` writes no timestamps at all — so there is no per-service start or finish time to render, and nothing pushes the record to the grid anyway (the injection response is `console.log`ged and dropped). What is derivable today is time-to-*submit*; true answer latency and length need [35](#35-read-the-answers-back-out-of-the-grid-frames).

**Do this:** Two stages. **Stage 1 (cheap):** stamp `filledAt`/`submittedAt` per service inside `markService`, subscribe [grid.js](pages/grid.js) to `chrome.storage.session.onChanged` for the status key, and render a right-aligned chip in each cell header — a pulsing dot while pending, then "sent in 1.2s", then ⚠ on failure. This shares its wiring with [1](#1-give-grid-mode-a-failure-surface--today-it-has-none), so build them together. **Stage 2 (after 35):** real time-to-first-token and time-to-settle from a MutationObserver on the answer container, plus a word count — "4.1s · 620 words" — included in the export, with a summary strip showing fastest / longest / shortest. Speed is a real axis of comparison, and "which model answered first" is a natural screenshot.

### 67. Stop animating `grid-template`, and drop `will-change`

**Impact:** Medium · **Effort:** S · **Type:** Perf

**Today:** [grid.css](styles/grid.css) declares `will-change: grid-template-columns, grid-template-rows` and a 250ms transition on both, on `.grid-container`. `grid-template-columns` is a layout property — it cannot be composited — so animating it for 250ms resizes every iframe every frame, forcing a full relayout *inside* up to seven React SPAs at 60fps. With hover-expand on by default, that fires whenever the mouse crosses a cell boundary. `will-change` on a non-compositable property does nothing useful and permanently hints the compositor to hold resources; a permanent `will-change` is a documented anti-pattern. The existing mitigation (`pointer-events: none` on iframes during the transition) prevents clicks, not layout.

**Do this:** Delete the `will-change`. Skip the transition entirely above a cell threshold — only add the transitioning class when there are ≤3 cells; above that, snap. Add `contain: layout paint` to `.grid-cell` so a cell resize doesn't invalidate the container. Coalesce `updateGridTemplate` behind `requestAnimationFrame` during a drag-resize (see [93](#93-raf-coalesce-the-grids-pointer-handlers)). Measure before and after with the Performance panel: a 7-cell hover-expand should drop from tens of long frames to a handful.

### 68. Bound the memory cost and add suspend

**Impact:** Medium · **Effort:** M · **Type:** Improve

**Today:** `toggleMaximize` only toggles classes; the siblings are hidden with `display: none`, which Chrome does **not** unload — the comment above it says this is deliberate so every embedded conversation survives a maximize round trip, and that is the right default. But it means maximizing one cell keeps the other six fully alive, scripting and streaming, in a foreground tab where background throttling does not apply. Seven concurrent AI SPAs is realistically 1–2 GB. There is no cell-count warning, no lazy mount (all cells navigate within `(N−1) × 200ms`), no suspend, and no way for anyone — including the maintainer — to measure whether a change helped.

**Do this:** Add **Suspend** to the per-cell menu: replace the iframe with a placeholder card showing the service name and a Resume button, freeing the renderer immediately; make maximize offer "Suspend the others" as one click. Make the stagger adaptive — navigate the next cell when the previous fires `load`, or after 400ms, whichever comes first — which is faster for small grids and gentler for large ones. Add a soft cap (e.g. 4 eager cells, the rest as one-click "Load" placeholders reusing `mountService`), defaulted from `navigator.deviceMemory`. Warn at send time when more than four services are enabled in grid mode. And write down a manual measurement protocol (Chrome Task Manager, per-cell counts, three-run median) in the README so performance claims can be checked.

### 69. Split "Reset layout", persist closed cells, and key layouts per service set

**Impact:** Medium · **Effort:** S · **Type:** Fix

**Today:** Three separate surprises in the persistence model.
- A button labelled **"Reset layout"** does three things, one of which spends money: `resetLayout` re-mounts every cell the user deliberately closed and then calls `injectRestored` on each, **re-asking the original prompt** in all of them. The tooltip discloses the restore; nothing anywhere discloses the re-send.
- Pane sizes and cell order survive a reload; the fact that you closed three cells does not — `closedServices` lives only in page memory, so reload brings them all back inside your carefully saved column widths.
- `gridLayout` is one global key restored only on an exact shape match, and `applyLayout` calls `saveLayout()` unconditionally including on first render — so opening a grid with a different service count doesn't merely fail to match the old record, it **overwrites and destroys** it.

**Do this:** Split the button into **"Even out"** (frac reset only, no mounting, no injection) and **"Restore all (N)"**, shown only when cells are closed, asking before re-sending with a remembered choice — or move restore-all into the Closed menu, where users already look. Persist `closedServices` into the payload. Key the layout record by a stable signature of the service set (`gridLayout_<sorted ids>`), capped at ~10 entries, and once the payload moves into the URL hash ([11](#11-key-grid-payloads-by-id-not-tab-id)) let layout, closed set and zoom levels all live in one per-session record that survives reload and restart.

---

# Visual Design & Premium Feel

> This section is design judgement rather than verified defect analysis — treat the specific values as proposals, not measurements. The underlying observation is consistent though: Puchne is *carefully built* and *not yet designed as one system*, and almost all of the gap is in three moments — the seconds after you press send, a failure, and a first-run empty state.

### 70. Create one shared token layer

**Impact:** High · **Effort:** L · **Type:** Fix

**Today:** There is no token system — there are six or seven independent forks of one. [popup.css](styles/popup.css), [overlay.css](styles/overlay.css), [grid.css](styles/grid.css), [options.css](styles/options.css) and [permissions.css](styles/permissions.css) each redeclare `:root` with the same dozen hex values and each repeat the `box-sizing` reset; [content.js](scripts/content.js)'s `getStyles(theme)` bakes a further copy into a JS template string as literal hex; and [options.js](pages/options.js) sets the mock overlay's background with inline hex. Drift is already real: `--radius` is 12px in one sheet and 14px in three others — and both feed the *same* `panel.css` component, so the compose card renders at two different radii depending on which host loaded it. `--transition` differs between sheets and is undefined in `grid.css` entirely, and `--accent-text` is consumed by `options.css` while being defined only in sheets that page never loads (so the author link in the settings footer renders as muted grey).

**Do this:** Add `styles/tokens.css` as the first `<link>` on every page and the first adopted sheet in `getPanelSheets()` — the shadow-DOM machinery to share it already exists and already caches parsed sheets. Define a primitive layer (grey/orange ramps) and a semantic layer (`--surface-0/1/2`, `--border-subtle/strong`, `--text-1/2/3`, `--brand`, `--brand-text`, `--brand-on`, radius, space, motion, elevation, z-index), and override **only the semantic layer** under `[data-theme="dark"]` and `:host([data-theme="dark"])`. Keep the old names as aliases for one release, then delete them. Then delete the five `:root` blocks, the inline hex, and `getStyles()`'s literals — give the follow-up bar its own `styles/followup.css` adopted through the existing `adoptPanelStyles` path and set `data-theme` on its host, which also fixes a real bug: the bar resolves its palette once at construction and subscribes to nothing, so it is the one surface that cannot follow a live system theme change. Add a build check that fails when a `var(--x)` has no reachable definition — that whole class of bug then cannot recur.

### 71. Kill `rem` inside the overlay, and adopt a type scale

**Impact:** Critical · **Effort:** M · **Type:** Fix

**Today:** [panel.css](styles/panel.css) sizes most text in `rem`, and the overlay variant overrides only three of those to px. `rem` always resolves against the **host page's** `<html>`, and `all: initial` on the shadow host resets `font-size` without changing what `rem` resolves against — so on any site using the common `html { font-size: 62.5% }` trick, Puchne's overlay renders its section labels and timestamps at about 7px, and on a 20px-root site everything is 40% too large. This is the one surface that runs on arbitrary third-party pages, and its type is anchored to those pages' CSS. Separately, `popup.css` sets `html { font-size: 15px }`, so the identical rule renders at a third size there — and it overrides the user's browser font-size preference, which is its own accessibility failure. Compounding it, the placeholder is pinned to a fixed px size while the textarea it sits in is not, so in the overlay the text visibly jumps size on the first keystroke of every session.

**Do this:** Convert every font-size in `panel.css` to px (or px-valued `--fs-*` tokens) and delete `html { font-size: 15px }` from `popup.css`. Delete the placeholder's `font-size` entirely and let it inherit — use `opacity: .72` if it needs to feel lighter. Then adopt one eight-step scale across all six sheets, replacing the ~27 distinct sizes currently in use, with paired line-height and **tracking that goes positive below 13px and negative above 16px**: 11/1.36/+.06em for all-caps labels and timestamps, 12/1.4/+.01em, 13/1.5/0, 14/1.5/0 (body, chips, rows), 15/1.5/−.005em (the prompt textarea, setting labels), 17/1.35/−.011em, 20/1.3/−.017em, 26/1.2/−.021em. Add `font-variant-numeric: tabular-nums` to the timestamp list, the count badge, the number inputs and the shortcut badge — the system UI font ships genuine tabular figures for free and a column of "2h ago / 14m ago" currently renders ragged. Applying this one table is the single typography change that most raises perceived quality — more than changing the typeface would.

### 72. Fix the light-mode brand contrast

**Impact:** Critical · **Effort:** M · **Type:** Fix

**Today:** `--accent: #fb923c` computes to roughly 2.26:1 against white — about half the 4.5:1 minimum — and it is used as a **text** colour throughout the light theme: the section headings on the settings page, the active nav item, the selected dropdown option, the active mode button, the active tool chip, and every hover state across the grid, panel and options. In dark mode the same colour is ~7:1, so the two themes are not at parity and only light mode fails. Three specific instances are worse than the rest: the send button's arrow is white-on-orange at 2.26:1 — the single most important control in the product and the pixel every screenshot centres on — while [permissions.css](styles/permissions.css) already uses a dark foreground on the same orange and gets it right; `--bg-hover` is defined as the *same* value as `--border` in light mode, so hovering an inactive chip makes it lose its outline and turn into a flat grey blob (and overshoots to near-white in dark); and every `:focus-visible` ring across all five sheets is `2px solid var(--accent)`, i.e. below the 3:1 threshold a focus indicator needs.

**Do this:** Split brand-as-surface from brand-as-text. `--accent` stays `#fb923c` for fills, rings and borders; add `--brand-text` (roughly `#c2410c` light, `#fdba74` dark, both comfortably above 4.5:1) for every `color: var(--accent)`, and `--brand-on: #1f1300` for foregrounds *on* the orange fill — send button, test button, action buttons, count badges. Add `--brand-strong` for focus rings in light theme and pair it with a `box-shadow: 0 0 0 4px rgba(255,255,255,.9)` halo so the ring survives on any host page behind the overlay. Replace `--bg-hover` with theme-neutral overlays — `rgba(0,0,0,.045)` / `rgba(255,255,255,.06)` — so the hover step is always the right direction and the border always stays a step darker than the fill. Raise `--text-muted` in light theme too: at ~3.68:1 it fails, and it is applied to the smallest type in the product (labels, timestamps, URLs, the grid's loading and error copy).

### 73. Collapse the radius scale

**Impact:** High · **Effort:** M · **Type:** Fix

**Today:** Eleven distinct radius values are in use across `styles/` — 2, 4, 6, 8, 10, 12, 14, 20, 24, 50%, 999px — with no hierarchy behind the ordering: the confirm modal is rounder than the overlay card, which is rounder than the popup card holding identical markup. Nested elements also break concentricity: a list at 8px contains rows at 6px with 4px of padding, where the inner corner should be 4px.

**Do this:** Five steps and nothing else — `--r-1: 4px` (dots, spinner tracks, tiny chrome), `--r-2: 8px` (inputs, buttons, list rows, menu items), `--r-3: 12px` (cards, section panels, modals — including the overlay card, the popup card and the confirm modal), `--r-4: 16px` (only the maximized cell), `--r-full: 999px` (chips, toggles, the send button, badges). Delete `--radius-xs`. Let nested corners compute — `border-radius: calc(var(--r-2) - 4px)` on a row inside a 4px-padded list. Normalise the grid query bar and the follow-up bar from 20/24px to `--r-full`, since both are pill-shaped inputs.

### 74. Layer the shadows

**Impact:** High · **Effort:** M · **Type:** Improve

**Today:** Twelve unique one-off `box-shadow` values, each written once, none layered. The overlay card is the giveaway — a single 50px blur at 50% black with no contact shadow produces a soft grey smudge with no edge definition, and over a white page in light mode it reads as dirt rather than elevation.

**Do this:** Three tokens and nothing else. Real elevation needs a tight, dark contact shadow that defines the edge *plus* a wide, faint ambient one that provides the lift:
```css
--shadow-1: 0 1px 2px rgba(0,0,0,.06), 0 1px 3px rgba(0,0,0,.10);
--shadow-2: 0 2px 4px rgba(0,0,0,.06), 0 8px 16px -4px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.04);
--shadow-3: 0 4px 8px rgba(0,0,0,.08), 0 16px 32px -8px rgba(0,0,0,.18),
            0 32px 64px -16px rgba(0,0,0,.14), 0 0 0 1px rgba(0,0,0,.05);
```
Dark mode doubles the alphas and swaps the hairline ring for `inset 0 1px 0 rgba(255,255,255,.06)` — a 1px top highlight is what makes a dark card read as lit from above rather than as a hole. Map: `--shadow-1` to dropdowns and menus, `--shadow-2` to toasts, the follow-up bar and a dragging cell, `--shadow-3` to the overlay card and the confirm modal. While you are in the overlay, make the backdrop theme-aware and move it out of JS: `rgba(24,24,27,.32)` light / `rgba(0,0,0,.52)` dark with `backdrop-filter: blur(10px) saturate(1.1)` — the saturation is what makes a blur read as frosted glass rather than a smudge, and 4px of blur reads as "slightly out of focus", not as material. Add an `@supports not` fallback with a heavier scrim.

### 75. Give motion a vocabulary

**Impact:** High · **Effort:** M · **Type:** Improve

**Today:** Fifteen distinct durations, six easings, `ease` used 34 times, and `transition: all` 31 times. `ease` is the browser default and the flattest curve available; using it 34 times is the same as having no motion design. 350ms is the most common duration and it is a page-transition speed applied to chip and row states. `transition: all` is also a correctness hazard — on `.section` it animates `outline-color` and fights the highlight-blink keyframes used by the "edit this selector" deep link. And `--transition` itself has two different values depending on the sheet, so `panel.css` runs at two speeds.

**Do this:** Four durations, three curves, nothing else — `--dur-1: 120ms` (colour/opacity feedback), `--dur-2: 180ms` (small transforms), `--dur-3: 260ms` (surface reveal), `--dur-4: 400ms` (layout); `--ease-out: cubic-bezier(.16,1,.3,1)` for everything entering, `--ease-std: cubic-bezier(.2,0,0,1)` for everything moving in place, `--ease-in: cubic-bezier(.4,0,1,1)` for everything leaving, always at ~60% of the entrance duration. Replace all 31 `transition: all` with explicit property lists. Two things that should **not** animate: theme swaps (a 200ms cross-fade of every surface reads as lag, not polish — flips should be instant) and `grid-template-columns` during a drag, which the code already correctly suppresses.

### 76. Animate the overlay in and out

**Impact:** High · **Effort:** M · **Type:** Add

**Today:** `show()` and `hide()` in [content.js](scripts/content.js) set `display: flex` and `display: none`. That is the entire transition — the backdrop and its blur appear instantly too. Meanwhile *every other surface* animates: the popup fades and rises, the login toast slides in on a considered curve, settings sections fade, and the confirm modal gets a spring. The product's signature moment — press the shortcut, Puchne appears over the page — is the only moment with zero motion design, while a settings confirmation dialog gets a spring curve. A modal that hard-cuts in with a blurred backdrop reads as an injected script, not as a native command palette.

**Do this:** Move the backdrop styles out of JS into [overlay.css](styles/overlay.css) and animate both layers with an `.is-open` class toggled after a `requestAnimationFrame`, hiding on `transitionend`. Backdrop: opacity 0→1 and blur 0→10px over 200ms `--ease-out`. Card: opacity 0→1, `translateY(8px) scale(.98)` → none over 260ms `--ease-out`, with a ~20ms stagger so the scrim leads. Exit is faster and flatter: 140ms `--ease-in`, `translateY(4px) scale(.99)`, no blur unwind. Wrap it in the existing reduced-motion block with a 100ms opacity-only fallback, and gate the blur animation behind the same query. This is the highest-leverage single change for a ten-second demo.

### 77. Give Send a real state machine

**Impact:** Critical · **Effort:** M · **Type:** Add

**Today:** The entire sending state is `.send-btn.sending { opacity: .6; cursor: progress }`. `handleSend` sets it, clears the textarea in the callback, and in the popup closes the window. There is no success state, no per-service acknowledgement, no count. So the user types one prompt, presses send, and the UI dims a button by 40% and vanishes — whether seven tabs opened, three opened and four failed, or nothing happened at all is indistinguishable. *"One prompt. Every AI. At once."* is the tagline, and the moment it happens is the least designed moment in the app.

**Do this:** Three layers, cheapest first.
1. **Press and progress.** `transform: scale(.94)` on `:active` over 90ms `--ease-in` so the press has weight; then keep the button at full opacity and swap the arrow for a 16px conic-gradient ring rotating at 900ms linear.
2. **Success.** On the callback, morph to a checkmark for ~700ms (`--green`, scaling .9→1 on `--ease-out`) before the popup closes.
3. **Per-service dots.** Give each existing chip a `--chip-state` of pending/sent/failed rendering a 6px dot in `--text-muted`/`--green`/`--danger`, transitioning over 180ms and staggered ~60ms apart in send order. This costs almost nothing because the worker already keeps the record — it needs a reader, which is the same wiring as [1](#1-give-grid-mode-a-failure-surface--today-it-has-none). It is also the single most impressive thing in a screen recording: seven chips lighting up green in sequence.

### 78. Skeleton-load the grid cells

**Impact:** Medium · **Effort:** M · **Type:** Improve

**Today:** Each cell shows `<div class="spinner"></div> Loading ChatGPT…`. Seven cells means seven rotating circles — the busiest possible loading state, drawing the eye to seven points at once and making the wait feel longer than a static skeleton would. The grid is the product's differentiator and its first three seconds are seven spinners. The cell header's drag affordance is also invisible (a `title` attribute and nothing else).

**Do this:** Replace the spinner with a per-cell skeleton previewing the *shape of a chat* — three rounded bars at 60%/85%/40% width, 12px tall, with a shimmer sweep — and stagger each cell's `animation-delay` by `calc(var(--cell-index) * 90ms)` so the grid **ripples** rather than pulsing in unison. That alone is the most screen-recordable moment in the product. Give the reduced-motion case a static, still-visible state rather than the current `animation-duration: 0.01ms` blanket, which deletes the loading cue entirely. Add a 6-dot grip glyph at the left of the cell header, fading in on cell hover, so the drag target announces itself.

### 79. Give the chips press feedback

**Impact:** Medium · **Effort:** S · **Type:** Add

**Today:** `.chip` carries `transition: none` — the primary toggle in the product, and the only interactive element in the panel with motion explicitly disabled. Its `.active` fill therefore hard-cuts, while the service icon *inside* it does animate its greyscale filter, so the result is half-animated: the logo cross-fades inside a pill that snaps. There is no `:active` state anywhere on `.chip` either.

**Do this:** Replace `transition: none` with explicit background/border/transform transitions at `--dur-1`/`--dur-2`, add `.chip:active { transform: scale(.96) }`, and give the toggle-on moment a two-keyframe overshoot — 260ms `--ease-out`, scale .94 → 1.02 → 1 — so the chip clicks into place. That is the highest delight-per-line-of-CSS in the codebase. Guard it under the existing reduced-motion block. One thing **not** to animate: the greyscale `filter` on the icon — filter transitions are expensive per frame across seven chips; cross-fade two stacked layers with `opacity`, or make it instant.

### 80. Standardise border weights and put spacing on a grid

**Impact:** Medium · **Effort:** M · **Type:** Improve

**Today:** Four stroke weights coexist — 1, 1.5, 2 and the 2.5px focus ring — and two of them appear 40px apart in the hero surface: the chips carry a 2px border while the prompt box directly below them carries 1px in the overlay variant. The 2px chip border does double duty as the selected-state indicator, which is why it was thickened, and the consequence is that the *resting* state carries a heavier stroke than any other element in the app. Spacing has the same problem: roughly a third of the values in use are off any 4px rhythm (3, 5, 7, 9, 10, 14, 18, 22), concentrated in the compose panel where alignment is most visible because everything is one narrow column — `padding: 7px 8px 7px 12px` on a history row inside a 4px-padded list is four numbers on one element, none of them derived. And about eleven spacing and colour values are inline `style=` attributes in [options.html](pages/options.html), so they cannot be changed from CSS at all (one of them is a green that doesn't match `--green`).

**Do this:** Standardise on 1px hairlines and carry selection with fill plus colour instead of weight — `.chip.active { border-color: var(--brand); background: var(--brand-wash); box-shadow: inset 0 0 0 1px var(--brand) }` doubles the apparent weight with no reflow and no second stroke value. Keep 2px only for the focus ring, which should be the heaviest stroke in the app by design. Add `@media (min-resolution: 2dppx) { --border-subtle: rgba(0,0,0,.10) }` — a 1px line at 2× is half a device pixel and washes out, so it needs more alpha, not more width. Define `--s-1: 4px` through `--s-12: 48px`, round every value to the nearest step resolving ties tighter (3→4, 5→4, 7→8, 9→8, 10→8 or 12, 14→16, 18→16, 22→24), and move all eleven inline styles into classes.

### 81. Unify the icon set and the font stacks

**Impact:** High · **Effort:** M · **Type:** Improve

**Today:** Every icon is hand-pasted inline SVG with four different stroke widths (1.5, 2, 2.5, 3) across eleven sizes — so the gear and the send arrow in the same header render at different visual weights, and the settings page's plus icons look bold next to its nav icons. Two of the sizes are odd numbers on a 24-unit viewBox, so the stroke lands on a fractional device pixel and the edges are visibly soft even at 1×. Iconography is one of the fastest reads for "was this designed", and this one is currently four systems. The fonts have two problems too: the monospace stack leads with `"SF Mono"`, which is not installed as a system font on macOS (it ships with Xcode), so Mac users editing a CSS selector get Courier while Windows users get Consolas; and the JS-injected surfaces pin `"Segoe UI"` *ahead* of `system-ui`, which on Windows 11 defeats Segoe UI Variable, so Puchne's in-page surfaces render in the older static face while its extension pages render in the newer one.

**Do this:** Pick Lucide, lock `stroke-width: 1.75` at every size (2 is heavy below 16px), use only even sizes — 14/16/20/24 — and ship them as one `icons/sprite.svg` of `<symbol>` elements so each call site becomes `<svg class="icon icon-16"><use href="/icons/sprite.svg#gear"/></svg>`. For the shadow-DOM overlay, inline the sprite once into the shadow root at construction, reusing the same one-time fetch pattern the stylesheets already use. This also removes ~2 KB of duplicated path data from JS and markup. For fonts: `--font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace` (the generic keyword first is the entire point of CSS Fonts 4), plus `font-feature-settings: "calt" 0` on selector inputs so `!=` isn't ligated into a glyph the user didn't type. Unify on one `--font` token including a `"Segoe UI Variable Text"` entry and emoji fallbacks, and delete the three hard-coded stacks in [content.js](scripts/content.js).

### 82. Add a z-index scale

**Impact:** Medium · **Effort:** S · **Type:** Fix

**Today:** Eight ad-hoc values decided by whoever wrote the rule last. A custom `select` dropdown sits at 9999 while the modal that could contain it sits at 1000, so the dropdown would render *above* a confirmation dialog. And in [content.js](scripts/content.js) the overlay root and the follow-up bar root are **both** at `2147483647`, so which one wins on an AI page is DOM-order luck rather than design.

**Do this:** Six named tiers — `--z-base: 0`, `--z-raised: 10` (sticky sidebar, resize handles), `--z-sticky: 100` (grid header, toasts), `--z-dropdown: 1000` (menus, custom selects), `--z-modal: 10000` (confirm dialog, overlay card), `--z-overlay-root: 2147483647` (the single in-page shadow host). Give the follow-up bar `2147483646` and the login notice `2147483645` so the compose overlay is unambiguously on top, and fix the select to `--z-dropdown` so it cannot escape its modal. Note that even the maximum z-index loses to a host page's `<dialog>` or `popover`, which paint in the top layer — see [103](#103-rebuild-the-overlay-on-the-top-layer).

### 83. Tell the Gujarati story in-product, and rewrite the microcopy

**Impact:** High · **Effort:** M · **Type:** Add

**Today:** `પૂછવું` appears eight times on the marketing site and **zero** times in the extension — not in the manifest, not in any page, not in any script. So a user installs Puchne, opens it every day, and never learns why it is called that. The one genuinely distinctive thing about the product's identity is quarantined on a website they visit once. The extension also has no wordmark: "Puchne" is `<h1>Puchne</h1>` in system-ui bold in three headers, with the leaf mark beside it at a fixed gap and no baseline relationship, so the mark floats. And the copy has no voice: the send button's accessible name is *"Send Multicast"* (an implementation term — a person would say "Send to all"), the two most visible placeholders use different ellipsis characters, three adjacent state messages use three different grammatical constructions, and a `<br>` is used for a line break in prose.

**Do this:** Three moves. (1) Put `પૂછવું · to ask` under the wordmark on the first-run screen ([21](#21-build-a-first-run-welcome)), permanently in the settings footer beside the attribution, and as a `title` on the panel wordmark — it costs one line and it is the app's only piece of soul, and "Puchne, from Gujarati પૂછવું — to ask" is the line reviewers will quote. Add `lang="gu"` to those spans and a pronunciation gloss the first time the name appears on the site. (2) Ship `icons/app/wordmark.svg` in `currentColor` and use it instead of the `<h1>` in all three headers, optically aligned with the mark. (3) Normalise on the typographic ellipsis everywhere; rewrite the send button as `aria-label="Send to 3 AI tools"` built from the live count with `title="Send to all — Enter"`; settle on one voice for state messages — plain second person, no product name as subject ("Pick at least one AI tool", "Allow access to Copilot to send there", "Waiting for permission…"); and replace the `<br>` with two paragraphs. Consider making the placeholder earn its place too: *"Ask ChatGPT, Claude and Gemini at once…"* built from the actual enabled service names turns dead filler into a demonstration.

---

# Performance

> The single largest perf win is [58](#58-send-the-prompt-to-each-cell-as-it-loads-not-after-the-slowest-one) (the grid's double serialization), filed under Grid View because it is a product problem before it is a performance one.

### 84. Replace the 600ms of unconditional sleeps in `fillAndSubmit`

**Impact:** High · **Effort:** M · **Type:** Perf

**Today:** [content.js](scripts/content.js) sleeps 300ms to "settle", then `focus()` and sleeps another 200ms, then sleeps 100ms before submitting — 600ms per service that measures nothing. In tabs mode those run in parallel, so it is 600ms of wall clock; in grid mode the injection loop is serial, so it is **4.2 seconds** across seven services. Then `clickSubmitButton` polls six times at 300ms for up to another 1.5s. Commit `e2a39e3` correctly removed the 2s pre-search sleep by making the search observer-driven; the same reasoning applies to the three that survived. (Note the 300ms settle is inside `if (waitMs > 0)`, and tabs-mode follow-ups pass 0, so they pay 300ms rather than 600.)

**Do this:** Replace the settle with a MutationObserver on the editor node resolving when mutations stop for two animation frames — the code already re-resolves the selector afterwards, so the sleep is only buying time it could instead measure. Replace `focus(); sleep(200)` with `focus()` plus a double `requestAnimationFrame` (~32ms is all a focus handler needs). Delete the pre-submit sleep entirely on the button path: `waitForElement(buttonSel, true)` already waits for `!el.disabled`, so the extra 100ms is redundant. Drive `clickSubmitButton`'s retries from the same attribute observer instead of a 300ms poll.

### 85. Disconnect the document-wide MutationObservers

**Impact:** Critical · **Effort:** S · **Type:** Fix

**Today:** Two observers watch entire documents on pages the user is actively reading, and neither is well-behaved.
- `PuchneFollowUpBar` observes `document.documentElement` with `{ childList: true, subtree: true }` and runs `document.body.contains(this.container)` on **every** mutation — for the whole life of every session tab. AI chat UIs stream responses by appending DOM nodes continuously, so this fires hundreds to thousands of times per answer, each invocation doing an O(depth) tree walk. The class has no `destroy()` and nothing ever calls `disconnect()`. It exists to re-append the bar if the site removes it, which is a once-per-navigation concern.
- [cookie-dismiss.js](scripts/cookie-dismiss.js) is worse: it observes `document.body` subtree and calls `tryDismiss()` on every mutation for ~10 seconds, and `tryDismiss` runs 15 `querySelectorAll` passes, then six more, then a whole-document `querySelectorAll('button, a[role=button], [role=button]')` with an `offsetParent` read per element — and because each mutation dirties layout, each invocation forces a fresh reflow. It is injected into all seven grid sub-frames precisely while seven SPAs are booting and emitting thousands of mutations, i.e. the exact moment the grid is jankiest.

**Do this:** For the follow-up bar, observe `document.body` with `subtree: false` (the bar is a direct child), throttle the callback through `requestIdleCallback` or a 1s gate, and add a `destroy()` that disconnects it and removes the unthrottled `resize` listener — called from the existing `pagehide` cleanup. Better still, drop the observer and re-attach on `popstate`/`pagehide` plus one 30s liveness check. For the cookie dismisser, the right answer is [16](#16-rescope-or-delete-the-cookie-auto-dismisser) (delete it); if it stays, coalesce the callback into a single `requestAnimationFrame`/300ms debounce and scope its third strategy to `mutation.addedNodes` rather than the whole document.

### 86. Stop double-injecting the 92 KB content bundle

**Impact:** High · **Effort:** M · **Type:** Fix

**Today:** `ensureContentScript` unconditionally `executeScript`s all four `CONTENT_SCRIPT_FILES` — 94,320 bytes — into every tab on every send, follow-up, retry and grid injection. But `registerServiceScripts` has *already* registered those exact four files at `document_idle` for every granted host, with `persistAcrossSessions: true`. `document_idle` precedes the "complete" that `waitForTabLoad` waits for, so on a granted host the bundle is fetched, parsed and compiled twice on the **first** tabs-mode send, not merely on follow-ups. `content.js` is guarded so its body is skipped, but the bytes are still paid, and the other files fully re-execute — which is also how the top-level `class` in [prompt-panel.js](scripts/prompt-panel.js) throws a `SyntaxError` into every AI tab's console ([10](#10-make-re-injection-idempotent-and-version-aware)).

**Do this:** Add a trivial `ping` handler in `content.js` and have `ensureContentScript` try `chrome.tabs.sendMessage(tabId, {action:"ping"})` first, injecting only when it fails — a ~2ms round trip against ~30–80ms of fetch and compile. Alternatively read the registered-script match list once at boot and cache it. Also note `registerServiceScripts` rewrites an identical registration on every worker wake with no equality check.

### 87. Remove dead scripts from `options.html` and `grid.html`

**Impact:** High · **Effort:** S · **Type:** Remove

**Today:** Both pages load `prompt-panel.js` (33 KB) **and** `content.js` (51 KB) — 84 KB, ~2,300 lines — and neither page references a single symbol from either file (the only consumer of `PuchnePromptPanel` anywhere is [popup.js](pages/popup.js)). Worse, `content.js` is not inert on load: it sets `window.PuchneLoaded`, installs a seven-branch `chrome.runtime.onMessage` listener inside the extension page, registers the fill engine in a top frame where nothing calls it, and runs `initFollowUpBar()` at top level — which does a `storage.session` read and, if a tabs-mode session is live in that browser session, wakes the service worker with a message. On the grid tab all of this happens on the critical path, before the first iframe is created and while the page is racing to read its payload.

**Do this:** Delete both `<script>` tags from [options.html](pages/options.html) and [grid.html](pages/grid.html); keep `constants.js` and `permissions.js`, which both pages do use. (Re-add `prompt-panel.js` deliberately if [64](#64-upgrade-the-follow-up-bar-and-wire-it-immediately) adopts it, not as leftover boilerplate.) Add a top-of-file guard in `content.js` — `if (location.protocol === 'chrome-extension:' && window === window.top) return;` — so a stray future include cannot re-register the fill engine in an extension page. Add a check to the CI manifest verifier asserting each page's script set is minimal.

### 88. Trim the service-worker cold start

**Impact:** High · **Effort:** S · **Type:** Perf

**Today:** An MV3 worker is killed after ~30s idle, so a normal user wakes it dozens of times a day — and every wake compiles ~72 KB of unminified JS and then issues **eleven** extension-API round trips before doing any useful work: `setAccessLevel`, `permissions.getAll`, a `storage.local.set`, two separate `storage.sync.get("settings")` calls, `getRegisteredContentScripts`, `updateContentScripts` (rewriting an identical registration), `sidePanel.setPanelBehavior`, plus `contextMenus.removeAll` and two `create` calls — which also run at top level *and* are registered in `onInstalled`. Because `removeAll` is async, there is a real window on every wake where a right-click finds no "Ask Puchne" item at all. Separately, `chrome.runtime.onStartup` calls `chrome.storage.local.get(null)` — deserializing the entire local area, including the whole prompt history — purely to find keys with the `gridData_` prefix.

**Do this:** Delete the bare top-level `setupContextMenus()` call; keep it in `onInstalled` and add `chrome.runtime.onStartup`. Drop the `removeAll` and use `chrome.contextMenus.create({...}, () => void chrome.runtime.lastError)` so duplicate-id errors are swallowed. Guard the boot IIFE's `syncHostAccess` behind a `storage.session` sentinel so full permission re-derivation runs once per browser session rather than once per wake — the `permissions.onAdded`/`onRemoved` listeners are the real source of truth. Pass the single `getSettings()` result into `registerServiceScripts` instead of reading sync twice. Replace `get(null)` with `chrome.storage.local.getKeys()` or a small index key.

### 89. Cache settings, and collapse the duplicate reads

**Impact:** High · **Effort:** M · **Type:** Improve

**Today:** `getSettings()` hits storage on every call with no cache. One overlay send performs seven to nine separate `storage.sync.get("settings")` round trips: the panel's `fetchServices` and `loadPermissionState` each go through the worker, `loadSettings` reads directly, then `show()` calls `refresh()` which repeats `loadPermissionState` + `loadSettings` **milliseconds after `init()` already did them**, then `saveSettings` reads again, then `handleMulticast` reads again, plus the grid page or the per-tab content script. Each is a real IPC to the browser process; the aggregate is tens of milliseconds of latency plus scheduler churn on the worker's single thread. `handleAccessGranted` also reads the same key twice within one function, the first read used only to build the registry.

**Do this:** Add `let _settingsCache = null` in the worker, invalidated by a `chrome.storage.onChanged` listener on the sync area, and have `getSettings()` return it when warm. In [prompt-panel.js](scripts/prompt-panel.js), skip `refresh()` when `init()` completed under ~500ms ago. Return settings alongside the `getServices`/`getPermissionState` responses so the panel needs one message instead of three. Remove the duplicate read in `handleAccessGranted`.

### 90. Debounce writes, handle the sync quota, and split `customProviders` out

**Impact:** High · **Effort:** M · **Type:** Fix

**Today:** Three related storage problems.
- `PuchnePromptPanel.saveSettings` does a `sync.get` + `sync.set` with **no debounce**, called on every chip click and every drag-reorder drop — against `chrome.storage.sync`'s 120-writes-per-minute limit. (The options page *is* debounced at 300ms and is the well-behaved surface here.)
- Every write is unguarded. `await chrome.storage.sync.set({ settings })` in `_doSave` has no try/catch and is invoked from a bare `setTimeout`, so a rejection becomes an unhandled promise rejection, the `showToast("Settings saved")` after it never runs, and the user gets **no feedback at all** — no toast, no error, just a settings page that has silently stopped saving.
- Everything lives in one `settings` key against an 8,192-byte per-item quota: 23 scalars plus `serviceOrder`, `askTargetIds`, `customSelectors` and `customProviders`. Each provider serialises to roughly 200–300 bytes (and spends ~60 of them twice on a hardcoded icon path), and a custom selector for a built-in can be 100+ characters. It takes more than a handful of providers to cross the line — but when it does, the write is all-or-nothing on one key, so the user does not lose just the new provider, they lose the ability to change *any* setting.

**Do this:** Give `saveSettings` the same 300ms debounce, flushed before `handleSend`. Wrap every `sync.set` in try/catch, move the success toast into the success branch, and on quota failure show a real message naming the cause and fall back to `storage.local` for the oversized part. Move `customProviders` and `customSelectors` out of the `settings` item entirely — `storage.local` has a 10 MB budget and is the right home for machine-specific CSS selectors anyway — and strip the derivable `iconPath`/`iconPathDark`/`isCustom` fields before persisting.

### 91. Serialize storage writes with one helper

**Impact:** Medium · **Effort:** S · **Type:** Improve

**Today:** [background.js](scripts/background.js) contains **three** hand-rolled promise queues — `hostAccessQueue`, `sendStatusQueue`, `sessionPruneQueue` — each about 25 lines, each solving the identical read-modify-write race with the identical pattern, each with its own good comment explaining the same problem. Meanwhile the two places that need it most have no protection at all: `promptHistory` has three unserialized writers ([134](#134-give-prompt-history-one-owner)), and the `settings` key itself is read-modify-written from five surfaces — the panel, the options page, the popup's theme cycle, the grid's hover toggle and the worker — with no coordination, so changing the theme in the popup while Settings is open silently reverts whatever was last changed there. The concurrency problem was correctly diagnosed and solved three times, and then not applied where it matters.

**Do this:** Collapse the three into one helper and use it everywhere:
```js
const _queues = new Map();
function updateStored(area, key, fn) {           // serializes RMW against one key
  const id = `${area}:${key}`;
  const next = (_queues.get(id) ?? Promise.resolve()).then(async () => {
    const cur = (await chrome.storage[area].get(key))[key];
    const out = await fn(cur);
    if (out !== undefined) await chrome.storage[area].set({ [key]: out });
  }).catch((err) => logWarn(`storage update ${id}`, err));
  _queues.set(id, next);
  return next;
}
```
Then route settings writes through one `patchSettings` worker message so each surface sends a **diff** rather than a whole object, and route history through the same helper. While consolidating, put the key names and shapes in one `STORAGE_KEYS` object with a JSDoc typedef per key — the tab-id-keyed grid payload and the granted-origins mirror are both non-obvious contracts documented only in comments.

### 92. Patch chips in place, and batch the FLIP reads

**Impact:** Medium · **Effort:** M · **Type:** Perf

**Today:** `renderServiceChips` guards on a fingerprint that **includes** `enabledServiceIds` — so `toggleService`, the most common interaction in the product, always changes the fingerprint and always falls through to `chipsEl.innerHTML = ""` and a full rebuild. With seven services, one chip click destroys and recreates seven buttons, seven `<img>` elements and 42 event listeners in order to change one CSS class and one `aria-pressed` attribute (and destroys keyboard focus in the process — see [102](#102-stop-destroying-focus-on-chip-toggle)). The guard only short-circuits when *nothing* changed, i.e. it optimises the case that was already free. Separately, the chip-reorder FLIP loop interleaves a `getBoundingClientRect()` read with the previous iteration's style writes, forcing about one layout per chip on every `dragenter`.

**Do this:** Keep a `Map(serviceId → element)`; on toggle, flip `classList` and `aria-pressed` on the existing node and return, rebuilding only when the service *set*, display mode, theme or order changes. Move the six per-chip listeners to one delegated set on the container reading `e.target.closest('.chip').dataset.id`. In the FLIP loop, split read and write phases — collect every `{el, dx, dy}` in one pass, then apply all transitions and transforms in a second pass inside a single `requestAnimationFrame` — which takes ~N forced layouts down to one. The grid's swap animation is already batched into two read passes; leave its deliberate reflow alone, but cache the rects where the geometry is derivable, because there each forced layout propagates a resize into seven embedded SPAs.

### 93. rAF-coalesce the grid's pointer handlers

**Impact:** High · **Effort:** S · **Type:** Perf

**Today:** `initResize.onMove` calls `updateGridTemplate()` — which writes `gridTemplateColumns` and `gridTemplateRows` — on **every** raw `mousemove`, registered with no throttle. `initDrag.onMove` writes two inline styles and runs an O(N) rect scan on every `mousemove` too. Mouse events fire at the pointer's poll rate, 60–1000 Hz, and each template rewrite relayouts N cells — each of which is a cross-origin iframe hosting a full SPA, so each one forces a resize inside ChatGPT, Claude and Gemini simultaneously. This is the most expensive interaction in the product, and it is the grid's signature gesture and the one the landing page shows off.

**Do this:** Store the latest `clientX/clientY` in a closure and do the layout work inside a `requestAnimationFrame` scheduled only when one isn't already pending; cancel it in `onUp`. Combine with `contain: layout paint` on `.grid-cell` from [67](#67-stop-animating-grid-template-and-drop-will-change) so an iframe resize doesn't cascade. Dragging a splitter goes from a slideshow to smooth — right now resizing a 7-cell grid is the moment the product feels least premium.

### 94. Downscale the service icons

**Impact:** High · **Effort:** S · **Type:** Perf

**Today:** `icons/services/` is 319 KB of 512px PNGs — **73.6%** of the 433 KB store package — rendered at 16–22px. Two files alone, `copilot.png` (151 KB, 512×512) and `gemini.png` (101 KB, 513×513), are 57% of the entire extension, drawn as two 20-pixel logos. They are also `web_accessible_resources` matched to `<all_urls>`, so every overlay, popup open, grid header and options render decodes a 512² bitmap — roughly 1 MB of RGBA memory each — to paint a 20px square.

**Do this:** Re-export at 48×48 and 96×96 (2×), or SVG where the brand allows (two icons already are, at a few hundred bytes each), then run them through `oxipng`/`pngquant` — Copilot at 96×96 should land around 4 KB. Add explicit `width`/`height` at every render site so the browser can skip a layout pass. Expected package reduction ~240 KB, roughly 55% of the zip, which turns a 433 KB store listing into ~190 KB — a real trust signal for a privacy-positioned tool.

### 95. Add a build step that minifies

**Impact:** Medium · **Effort:** M · **Type:** Add

**Today:** No bundler, no minifier, no `package.json`; [package.ps1](tools/package.ps1) zips manifest-referenced files verbatim. The content-script bundle is 94,320 bytes of unminified source, injected into every AI tab and, via the icon-click fallback, into any page the user opens the overlay on; the worker compiles 72,204 bytes on every wake. About 30% of those bytes are comments — which are excellent and must stay in the source, but the browser still tokenizes every one of them, on every injection and every cold start.

**Do this:** Add an esbuild (or terser) step to the packaging script that minifies `scripts/` and `pages/` **into the staging folder** before zipping, keeping the commented sources as the only thing contributors touch and the only thing in git. Expect the content bundle to land near 35–45 KB and the worker near 30 KB. Keep sourcemaps for debugging, and pair it with [87](#87-remove-dead-scripts-from-optionshtml-and-gridhtml), since without module boundaries a bundler cannot tree-shake those on its own.

### 96. Narrow the login-check scan and the page-text extraction

**Impact:** Medium · **Effort:** S · **Type:** Perf

**Today:** Two whole-document reads on user-visible paths. The login fallback does `Array.from(document.querySelectorAll("button, a"))` and, for each, lowercases `textContent` and reads `offsetParent` — on a logged-out page that can be several hundred elements, allocating and lowercasing a string for each, on a page that is already busy booting. (It is one forced reflow, not hundreds — there are no interleaved writes — and it only runs as a fallback-of-a-fallback after the service's own `loginSelector` misses, so it is a cleanup rather than a hot path.) More consequential: `getPageContext` and `getSelectionOrPage` both call `document.body.innerText`, which forces a full layout and serialises the *entire* rendered document to a string, and only *then* slices to 2,500 characters — tens of milliseconds and a multi-megabyte transient allocation on a long article, sitting directly on the critical path of the selection shortcut and the right-click menu.

**Do this:** For the login scan, hoist the visibility test to the front of the predicate so it short-circuits before the string work, read `textContent` once into a variable, cap the scan, and scope it to `document.querySelector("header, nav, [role=banner]") ?? document` — sign-in affordances live in page chrome. For the extraction, read `document.querySelector('article, main, [role=main]')` first, or accumulate from a `TreeWalker` and stop at the cap — which is also what [30](#30-rewrite-the-prompts-ask-puchne-generates) needs for quality reasons, so do both in one change.

### 97. Call `destroy()`, cap concurrent cells, and debounce `saveLayout`

**Impact:** Medium · **Effort:** M · **Type:** Fix

**Today:** `PuchnePromptPanel.destroy()` exists, is correct — it removes a `chrome.storage.onChanged` listener and a `matchMedia` listener — and a repo-wide grep for `.destroy()` returns **zero** calls. `PuchneOverlay` has no teardown at all and is a module-level singleton appended to `document.body` forever; `hide()` only sets `display: none`. So every page on which the user has ever pressed the shortcut permanently holds a shadow root, a full panel DOM, a storage listener that fires on *every* write anywhere in the browser, and a matchMedia listener. `PuchneFollowUpBar` is worse — no `destroy()`, plus an unthrottled `resize` handler that calls `getBoundingClientRect()`. Separately, `saveLayout()` — an unconditional `storage.local.set` — is called from `onHandleKeydown`, i.e. ~30 disk writes per second while an arrow key repeats during a resize the user hasn't finished.

**Do this:** Add `PuchneOverlay.destroy()` calling `this.panel.destroy()` and removing the container, and a `PuchneFollowUpBar.destroy()` disconnecting its observer and removing its listeners; call both from the existing `pagehide` cleanup. Throttle the resize handler through `requestAnimationFrame`. Debounce `saveLayout` by ~400ms behind one shared wrapper covering all its callers. Add the eager-cell cap and adaptive stagger from [68](#68-bound-the-memory-cost-and-add-suspend). And parallelize `injectIntoOpenTabs`, which currently awaits `executeScript` one tab at a time inside a nested loop, injecting the full bundle serially — immediately after the user clicks Allow, i.e. the one moment they are watching.

---

# Accessibility & Internationalization

> Credit first: reduced motion is respected in both CSS and JS, the grid's resize handles carry proper `role="separator"` semantics with full arrow-key support, iframes are titled, focus-visible styling exists, and the marketing site has a skip link. The gaps below are specific, not systemic — which is why closing them is realistic.

### 98. Label every control on the options page

**Impact:** Critical · **Effort:** S · **Type:** Fix

**Today:** Seven toggles in [options.html](pages/options.html) — `showRecents`, `useSidebar`, `showShortcutHint`, `autoSubmit`, `showFollowUpInput`, `hoverExpand`, `groupTabs` — are written as `<label class="toggle"><input type="checkbox" id=…><span class="slider"></span></label>`, so the `<label>` wraps only a visually-empty span while the human-readable text lives in a sibling `<p class="setting-label">` with no relationship to it. The two number inputs have no label, no `aria-label` and no `aria-labelledby`, and the four spinner buttons beside them contain only an SVG with no `aria-hidden` and no name. A screen-reader user tabbing this page hears "checkbox, not checked" nine times with no indication of what any of them do. The correct pattern already exists two files away: the grid's hover toggle uses `aria-labelledby`.

**Do this:** Stamp an id on every `.setting-label` and `.setting-desc` (the theme combobox already follows this convention) and wire each row's control with `aria-labelledby` + `aria-describedby`. Add `aria-hidden="true"` to the spinner buttons — they already have `tabindex="-1"`, and the native number input's arrow keys are the keyboard path. Write it as one loop in [options.js](pages/options.js) over `.setting-row` rather than twenty hand-edits, so new rows inherit it. This is one small function and it closes the largest accessibility defect in the product.

### 99. Break the keyboard trap in the grid's follow-up input

**Impact:** Critical · **Effort:** S · **Type:** Fix

**Today:** [grid.js](pages/grid.js) installs a `blur` handler on the follow-up textarea that, on the next tick, re-focuses it whenever the new `activeElement` is an IFRAME and either the pointer is not over the grid or the user typed within the last second. `pointerInGrid` is only ever set by a `mouseenter`, so for a keyboard-only user it is permanently false. And because `.grid-container` precedes `.grid-header` in the DOM, the focusable element immediately *before* the input is the last cell's iframe — so Shift+Tab moves focus there, the handler fires, and yanks it straight back. There is no keyboard route backwards out of that field. The guard was written for a real problem (injection focuses the editor inside each frame and steals focus mid-typing), but it cannot tell that apart from a deliberate Shift+Tab.

**Do this:** Only re-claim focus when the steal was not user-initiated: record the timestamp of the last `Tab` keydown on the input and bail out of the guard within ~200ms of it. Better, remove the heuristic entirely and scope the guard to the injection window — set an `injecting` flag around the `injectGridQueries` calls and only restore focus while it is set. Best of all, add the `focusInput: false` flag from [64](#64-upgrade-the-follow-up-bar-and-wire-it-immediately) so the content script never steals focus on a follow-up and the guard can be deleted.

### 100. Announce sending, and every status message

**Impact:** Critical · **Effort:** M · **Type:** Add

**Today:** `handleSend` disables the button, adds a class, disables the textarea, then clears the value and resets — with no live region and no status text anywhere. The only `role="status"` on the surface is the panel hint, which is repurposed for "no tools selected" / "needs permission" and emptied on the happy path. The options page's toast — which fires for roughly twenty different messages including "Settings saved", "ChatGPT allowed", "History cleared", "Custom provider deleted" — has no `role` and no `aria-live`. The grid's "Loading X…" and its cell-error card are plain divs. So a screen-reader user presses Send, the textarea empties, and *nothing is spoken*: no "sending", no "opened 3 tabs", no "Gemini failed". That is WCAG 4.1.3 failing on every surface at once, and it is also why the product feels like a black box to sighted users.

**Do this:** Three things. Add a visually-hidden `<p role="status" aria-live="polite">` to the panel template and write to it in `handleSend` — "Sending to ChatGPT, Claude and Gemini…" on dispatch, "Sent to 3 AI tools" or the failure count on the callback, read back from the record the worker already keeps. Add `role="status" aria-live="polite" aria-atomic="true"` to the options toast. Add one page-level `role="status"` in the grid and post "Loading 5 AI tools", "ChatGPT ready", "Perplexity could not be embedded" from the load-promise resolution path. Add a `.visually-hidden` utility class to each stylesheet — the codebase currently has none. This shares its data source with [1](#1-give-grid-mode-a-failure-surface--today-it-has-none) and [77](#77-give-send-a-real-state-machine), so build all three together.

### 101. Remove the invisible focusable controls

**Impact:** High · **Effort:** S · **Type:** Fix

**Today:** Two collapse mechanisms in [options.css](styles/options.css) use `grid-template-rows: minmax(0, 0fr)` with `overflow: hidden` — collapsed, not hidden. The per-service selector editors each contain two text inputs and two buttons, so seven built-in services contribute roughly 28 focusable controls at zero height; the row-collapse wrapper adds the Group Tabs toggle, the Ask-target combobox, seven tool chips, the cookie select and two hover-expand rows; and the custom-provider form adds six more fields and two buttons. In the default configuration a keyboard user tabbing through AI Tools hits roughly forty stops that render nothing on screen — focus simply vanishes for half a minute. The page already demonstrates the right technique elsewhere (`display: none` on inactive sections); it just wasn't applied here.

**Do this:** Set `inert` alongside the class in both places — `wrap.inert = collapsed` next to every `classList.toggle("collapsed", …)`, and `editor.inert = !isOpen` at each of the three sites that toggle an editor open, including the deep-link path. `inert` keeps the grid-rows animation intact while removing the subtree from both the tab order and the accessibility tree. Do the same for the custom-provider form, and while you are there replace the "disabled" Overlay Position row's `pointer-events: none` with a real `disabled` + `inert` ([33](#33-trim-the-settings-surface)).

### 102. Stop destroying focus on chip toggle

**Impact:** High · **Effort:** M · **Type:** Fix

**Today:** `renderServiceChips` does `chipsEl.innerHTML = ""` and rebuilds, and it is called unconditionally from `toggleService` and from the permission watcher. So the chip the user just activated with Space is removed from the DOM mid-interaction and focus falls back to the shadow root — meaning enabling three services by keyboard requires three full tab traversals. It also happens right after a permission grant lands, which is exactly when a user is most likely to be mid-flow. `aria-pressed` is set correctly, but nobody hears the state change because focus is gone before it is announced.

**Do this:** Mutate in place — flip `classList` and `aria-pressed` on the existing element, then update the send button and save — and keep the full rebuild only for changes that alter chip *identity* (display mode, theme, granted set, order). This is the same fix as [92](#92-patch-chips-in-place-and-batch-the-flip-reads), so it pays twice. For the rebuild paths that remain, capture `getRootNode().activeElement?.dataset.id` before clearing and re-focus the matching chip afterwards. Give ungranted chips `aria-disabled="true"` rather than simply omitting `aria-pressed` — combined with the existing "— allow site access" text, that tells the user *why* the toggle isn't a toggle yet.

### 103. Rebuild the overlay on the top layer

**Impact:** High · **Effort:** M · **Type:** Improve

**Today:** The overlay's focus trap is held together by three assumptions any host page can break. It filters focusable candidates with `el.offsetParent !== null`, which is unreliable across a **closed** shadow boundary — the only positioned ancestor is the host, outside the closed tree. It includes the history row's delete button, which is `opacity: 0; pointer-events: none` until its row is hovered, so the trap can park focus on an invisible control. Escape is handled in the bubble phase, so a host page with a capture-phase `keydown` on `document` sees it first. There is no close button in the panel at all — Escape and a backdrop click are the only exits. And `z-index: 2147483647` still loses to any host-page `<dialog open>` or `popover`, which paint in the top layer above all z-index. On top of that, `show()` sets `display`, then `await`s three storage round trips, and only then focuses the input on a 50ms timer — so on a cold worker the overlay can be visible for hundreds of milliseconds while the user's first keystrokes go to the page behind it.

**Do this:** Make the host a `<dialog>` (or `popover="manual"`) and call `showModal()`/`close()` in `show()`/`hide()`. That gives you a real focus trap, native Escape via the `cancel` event, `::backdrop`, focus restoration, and guaranteed painting above any host content — and lets you delete the hand-rolled Tab handling entirely. Independently and regardless: add a visible close button to the overlay variant's header, reveal the history delete button on `:focus-visible` as well as row hover, and reorder `show()` so the textarea is focused **synchronously** before the refresh awaits (the panel already handles a late repaint).

### 104. Add non-drag alternatives to every drag interaction

**Impact:** High · **Effort:** L · **Type:** Add

**Today:** Five drag-only affordances, none with an alternative: chip reordering (HTML5 `dragstart`/`dragenter` only — no keyboard path *and* no pointer path, so it fails 2.1.1 as well as 2.5.7), grid cell repositioning (`mousedown` on the header), grid pane resizing by pointer (keyboard *is* covered, but SC 2.5.7 requires a non-dragging **pointer** path, not a keyboard one), overlay repositioning, and follow-up bar repositioning — whose drag handle is `aria-hidden="true"`. WCAG 2.2 added Dragging Movements at Level AA specifically for users with tremor, limited dexterity, head pointers and switch access, and grid cell arrangement is the differentiating feature of the product.

**Do this:** Start with chips, which are the highest value and the smallest change: Space picks a chip up (set a `grabbed` state, an outline, and announce "ChatGPT grabbed, position 1 of 7, use arrow keys" through the live region from [100](#100-announce-sending-and-every-status-message)), Arrow keys move it one slot with an announcement, Space or Enter drops and persists, Escape cancels and restores. Reuse the existing FLIP block for the travel so reduced motion is already handled. For grid cells, add a **Move** item to the cell overflow menu (or `Alt+Shift+Arrow` while a cell button is focused) calling the existing swap-with-animation path. For the resize handles, add a pointer alternative — double-click to reset, plus the column-count control from [61](#61-fix-the-4--and-7-cell-layouts-and-add-a-responsive-floor). For the two floating bars, a click-to-cycle corner control. Document the keyboard model in a visually-hidden instructions element referenced by `aria-describedby` on the chip group.

### 105. Give hover-expand a keyboard equivalent and a static focus cue

**Impact:** High · **Effort:** M · **Type:** Add

**Today:** Expansion is bound purely to `mouseenter`/`mouseleave` with a dwell timer; `expandCell`/`collapseCell` are never called from a focus event. The grid's headline interaction — with its own header toggle and three settings rows — is unreachable without a mouse. The one keyboard affordance that does exist, Alt+1..9, has its only feedback deleted by the reduced-motion guard: the cue is a `@keyframes` flash reduced to 0.01ms, so a reduced-motion user gets no indication that the keystroke did anything. And the shortcut is documented nowhere in the UI — only in a code comment.

**Do this:** Bind expansion to `focusin`/`focusout` as well as hover, gated on the same settings, and make the focused cell **sticky** rather than transient ([62](#62-make-focus-sticky-and-keyboard-reachable-demote-hover-expand)). Replace the flash with a persistent `.cell-current` state — an inset 3px ring in the strong brand colour, no animation — cleared when another cell is selected, so reduced-motion users still see which cell Alt+N chose. Surface the shortcuts: a `?` button in the grid header opening a cheat sheet that lists Alt+1..9, Escape, and the arrow/PageUp/Home/End resize keys the code already supports, mirrored into [guide.html](website/guide.html).

### 106. Meet the 24×24 minimum target size

**Impact:** Medium · **Effort:** S · **Type:** Fix

**Today:** Several controls fall under WCAG 2.2's 24×24 minimum: the grid's per-cell maximize and close buttons (~22×22, two per cell header), the login toast's close button (22×22), each half of the number spinner (~26×17 over a ~35px input), the grid's small hover-expand switch (40×22), and the resize handles at 7px for the south and east edges and 14×14 for the corner — which are pointer targets *and*, for two of the three, keyboard separators. The handles are the worst case and they sit adjacent to each other at every cell corner, so the spacing exception doesn't rescue them either. Separately, the history row's delete button is exactly 24×24 and passes on paper, but is `opacity: 0; pointer-events: none` until its row is hovered, so its effective target is zero until the pointer is already there.

**Do this:** Set `min-width: 24px; min-height: 24px` on the cell icon buttons, the toast close and the spinner halves (widening the spinner column and the input's inline-end padding to match). Raise the small toggle to 24px tall with an 18px knob. For the resize handles, keep the 7px *visual* line and expand the hit area with a transparent `::before` at `inset-block: -9px` (south) / `inset-inline: -9px` (east) — the standard splitter technique, 24px target, thin divider, no layout cost. Reveal the history delete button on `:focus-visible` too.

### 107. Make the options sidebar a real tab list

**Impact:** High · **Effort:** S · **Type:** Fix

**Today:** The six nav items are `<a href="#tools">` … `<a href="#maintenance">` — and **no element in the document has those ids** (the sections are `id="section-tools"` etc.), while the click handler calls `preventDefault()`, so the hrefs are purely decorative. Screen readers announce six links that appear to go nowhere; without JavaScript they genuinely do. Which section is open is conveyed only by colour and a border — not exposed programmatically at all — and the `<section>` elements have no accessible names, so a user who jumps to content has no idea where they landed.

**Do this:** Convert to the ARIA tabs pattern: `role="tablist" aria-orientation="vertical"` on the menu, `<button role="tab" id="tab-tools" aria-controls="section-tools" aria-selected tabindex>` for each item, `role="tabpanel" aria-labelledby` + `tabindex="0"` on each section, with Up/Down/Home/End roving-tabindex handling — the page's own custom combobox controller already implements exactly this keyboard model, so reuse its shape. Add a non-colour selected cue: a 3px inline-start bar plus `font-weight: 700`. Keep the hash sync for deep links.

### 108. Expose the selected state of the mode buttons and tool chips

**Impact:** High · **Effort:** S · **Type:** Fix

**Today:** The Grid/Tabs pair and the Show-prompt/Send-directly pair are plain `<button>`s whose state is written by `classList.toggle("active", …)`, with the real value hidden in a `display: none` checkbox. The Ask-Puchne tool chips do the same with no `aria-pressed`. Styling is colour-only in all three cases. So a screen-reader user cannot tell whether Grid View or New Tabs is active, whether prompts are shown or sent directly, or which of the seven tools are selected — the two most consequential behaviour settings in the extension — and colour-blind users have the same problem visually. The panel's own chips get this right; the options page never copied the pattern.

**Do this:** Use `role="radiogroup"` with `role="radio" aria-checked` and arrow-key roving tabindex for the two mutually-exclusive mode pairs (radio, not `aria-pressed`, is the correct role here). Add `aria-pressed` to the tool chips beside the existing `classList.toggle`. Add a non-colour cue to both — a check glyph inside the active option (the icon constant already exists in [options.js](pages/options.js)).

### 109. Give the confirm modal dialog semantics, and associate validation errors

**Impact:** Medium · **Effort:** S · **Type:** Fix

**Today:** The reset confirmation is a plain `<div class="modal-overlay">` — no `role="dialog"`, no `aria-modal`, no `aria-labelledby` pointing at its heading. `showModal(show)` only adds a class: nothing focuses a button, nothing traps Tab, nothing returns focus to the trigger, and there is no Escape handler (tellingly, the combobox controller has a `stopPropagation` comment guarding against a modal Escape handler that does not exist). So pressing "Reset All" appears to do nothing for a keyboard user — and that action destroys all settings, all custom providers and all prompt history. Separately, the custom-provider form's validation writes into a `<span>` with no `role` and no relationship to any field, then focuses a field carrying no `aria-invalid` and no `aria-describedby`; the access window's error paragraph has the same problem; and the per-service selector test reports pass/fail only by mutating the button's own text and colour.

**Do this:** Swap the modal for a `<dialog>` and call `showModal()`/`close()` — that supplies the trap, Escape, `::backdrop` and focus restoration natively. Move focus to **Cancel**, not Confirm, for a destructive action. If you keep the div, add `role="alertdialog" aria-modal="true" aria-labelledby aria-describedby`, focus management and an Escape handler by hand. Add `role="alert"` to both error containers, and have the validation function take the field element so it can own the whole relationship — set `aria-invalid="true"` and `aria-describedby` pointing at the message, cleared on the next successful validation. Give the selector test a sibling `role="status"` span instead of a colour-and-glyph button state.

### 110. Add forced-colors support, and close the reduced-motion gaps

**Impact:** Medium · **Effort:** M · **Type:** Add

**Today:** There is no `@media (forced-colors: active)` block anywhere in `styles/` or in the JS-generated sheet. Windows High Contrast deliberately discards author colours — and Puchne encodes almost every state purely in `background` and `border-color`: the toggle switches are a background plus a `::before` knob, so on/off becomes indistinguishable; `.chip.active`, `.tool-chip.active` and `.mode-option.active` lose both their cues; the resize handles are pure `background: var(--accent)` and vanish. Separately, three reduced-motion gaps survive the otherwise thorough CSS guards, and two of them *remove information* rather than motion: the blanket `animation-duration: 0.01ms !important` kills the grid's loading spinner and the Alt+N flash outright, the `scrollIntoView({ behavior: "smooth" })` calls in [options.js](pages/options.js) win over the `scroll-behavior: auto !important` rule because an explicit argument beats the CSS property, and the footer heart animates infinitely for anyone who hasn't set the OS preference (WCAG 2.2.2 has no reduced-motion escape clause).

**Do this:** Add a shared forced-colors block: `.toggle input:checked + .slider { background: Highlight; forced-color-adjust: none }` with `::before { background: ButtonText }`; a 3px `Highlight` border plus a `::after` check glyph on every active chip and mode option; `Highlight` on hovered/focused resize handles. Test with DevTools → Rendering → Emulate forced-colors. Pair it with the non-colour cues from [108](#108-expose-the-selected-state-of-the-mode-buttons-and-tool-chips) — same pass. For motion: use `behavior: prefersReducedMotion() ? "auto" : "smooth"` at both `scrollIntoView` sites (the helper is already global), give the spinner a reduced-motion fallback that stays *visible* alongside its "Loading X…" text, replace the flash with the static ring from [105](#105-give-hover-expand-a-keyboard-equivalent-and-a-static-focus-cue), and cap the heart at `animation-iteration-count: 3`.

### 111. Survive 200% zoom and 320px reflow

**Impact:** Medium · **Effort:** M · **Type:** Fix

**Today:** [popup.css](styles/popup.css) sets `html { font-size: 15px }` — overriding the user's browser font-size preference outright — and `body { width: 600px; height: 530px; overflow-x: hidden }`. Chrome caps popups at roughly 800×600 device pixels, so at 200% zoom the visible area is ~300 CSS px wide while the body stays 600px with horizontal overflow hidden: the right half is clipped and unreachable. The options page — a full browser tab, and therefore squarely in scope for WCAG 1.4.10 — never switches `.setting-row` to a column, and with fixed-width selects and number inputs plus generous container padding, a 320px viewport leaves about 70px for the label; the three existing breakpoints don't touch that rule, and the preview box and mock overlay overflow outright. The grid pins `overflow: hidden` on `html, body` with a fixed-height header holding five controls, which are simply clipped at narrow widths.

**Do this:** In `popup.css`, delete the `html` font-size (or set `100%`) and change the body to `width: 100%; min-width: 320px; max-width: 600px; overflow-x: auto` with `min-height` rather than a fixed height. In `options.css`, add a `max-width: 600px` block that makes `.setting-row` a stretched column with full-width controls, reduces container padding, and lets the preview box size to content. In `grid.css`, let the header wrap with `min-height` instead of a fixed height and compute the container height from a measured value — or below ~700px switch to a single column with the cell-switcher rail from [62](#62-make-focus-sticky-and-keyboard-reachable-demote-hover-expand).

### 112. Give the grid structure, and fix its tab order

**Impact:** Medium · **Effort:** S · **Type:** Add

**Today:** [grid.html](pages/grid.html) has exactly one heading for a page hosting up to seven full AI applications, no landmarks (`.grid-header` and `.grid-container` are both `<div>`s), and no skip link — while the marketing site has one. Cell names are `<span>`s, not headings, and `.grid-cell` has no `role`/`aria-label`, so both the heading list and the landmark list are empty and the only way to understand the page is to tab linearly through seven embedded chat apps. Two things make that worse: `.grid-container` comes **before** `.grid-header` in the DOM, so tab order runs through every cell's two buttons, its iframe and its separators before reaching the follow-up textarea, Reset layout, the Closed menu or the hover toggle — the page's primary input is its last tab stop; and every non-corner resize handle is `tabIndex = 0`, adding about ten focusable, visually-empty separators interleaved with the iframes. There is also no live region, so a cell loading, failing or closing is announced to nobody.

**Do this:** Move the header markup above the container in the HTML and restore the visual order with CSS `order` — one change that fixes the whole tab sequence and compounds every other item here. Make the container a `<main id="main">` and the header a `<header>` (or `role="toolbar" aria-label="Grid controls"`), and add a skip link to the follow-up input as the first body child. In `createCell`, give the cell `role="region" aria-labelledby` and promote the name span to a visually-identical `<h2>`. Put the separators behind a roving tabindex so the whole set is one tab stop, promoted into the full tab order only in an explicit "Resize panes" mode. Add a visually-hidden `aria-live="polite"` region for load/fail/close, and `aria-live` on the closed-count badge.

### 113. Adopt `chrome.i18n`

**Impact:** High · **Effort:** L · **Type:** Add

**Today:** There is no `_locales/` directory, `chrome.i18n` appears in zero files, and the manifest has no `default_locale` — so the extension name, its description and both command descriptions are literal English, and the store listing can only ever exist in one language. Roughly 250–280 user-visible strings are compiled into markup or template literals across the six surfaces. The architecture is actually favourable — one shared panel component, six pages, one worker — so this is a bounded one-time migration rather than a rewrite, and doing it *before* the store listing matures is far cheaper than after.

**Do this:** Four steps. (1) Add `"default_locale": "en"` and replace `name`, `description` and the two `commands[].description` values with `__MSG_*__`. (2) Structure `_locales/<lang>/messages.json` by surface so translators get context — `panel_sendTo`, `options_tools_title`, `grid_closedCount`, `bg_error_inputNotFound` — each with a `description` and `placeholders` for interpolations. (3) Convert static HTML with a `data-i18n` convention plus a ~15-line runtime helper handling `data-i18n`, `-title`, `-aria-label` and `-placeholder`, called once per page — that converts ~110 strings mechanically. (4) Write a `tools/extract-strings` script that walks the pages for text nodes and the four localisable attributes and the scripts for literals assigned to `textContent`/`title`/`aria-label`/`showToast`, emits `_locales/en/messages.json`, and prints a `file:line → suggested key` report to drive the codemod. **Decide the plural strategy up front:** `chrome.i18n` has no plural support, so cases like "Allow Puchne to use these 3 AI tools?" need either one message per CLDR category with an `Intl.PluralRules` lookup or a small `t(key, n)` wrapper. In the same pass, replace the hand-rolled `formatRelativeTime` ("2h ago") with an `Intl.RelativeTimeFormat` constructed **once at module scope** (`numeric: "auto"` gives idiomatic "yesterday"/"just now" free), generate the "0.2 seconds" option labels from their `data-value` via `Intl.NumberFormat`, and prefer the shortcut string `chrome.commands.getAll()` returns, which Chrome already localises.

### 114. Pick a starter locale set

**Impact:** Medium · **Effort:** L · **Type:** Add

**Today:** The product name is Gujarati, the author is Gujarati-speaking, and the store listing plus all ten website pages are English-only. Translating all forty Chrome UI locales is wasted effort at launch; translating none forfeits the two audiences most likely to adopt this specific product.

**Do this:** Eight locales, argued rather than defaulted. **en** — source. **hi** — the largest addressable market for a multi-LLM tool outside English, and where this extension's word-of-mouth will start. **gu** — small in absolute terms but it is the *brand story*; a Gujarati-named extension that cannot speak Gujarati is a missed narrative, and it is about a person-day given the author's fluency. **es** and **pt_BR** — the highest-volume store locales after English and the cheapest reach per string. **de** — high engagement and a market that reads permission copy carefully, which suits Puchne's consent model. **ja** — very high extension adoption and a culturally strong comparison use case. **ar** — include it *specifically* to force RTL correctness into the first release rather than retrofitting; every bug it exposes also affects `he` and `fa` later. Defer fr, ru, id, tr, zh_CN, ko to a second wave. Prioritise by surface too: the panel (~30 strings) and the permissions window (~10) carry almost all first-run comprehension, so translate those for all eight before touching the ~100-string options page.

### 115. Fix RTL — and ship `dir="auto"` today

**Impact:** Medium · **Effort:** L · **Type:** Fix

**Today:** No `dir` attribute exists anywhere, and `all: initial` on the overlay host pins it to `direction: ltr`, so the overlay would ignore an RTL browser UI even once localised. Dozens of physical CSS properties need logical equivalents — `right`/`left` offsets on the login toast, the follow-up bar root, the grid menu, the number spinners and the sidebar-mode mock; `margin-left/right` on the drag handle, logo, badges and action buttons; `text-align: left` on history and menu items; directional `border-radius` shorthands; and an `inset` sub-row rule with a physical `padding-left` plus a `::before` at a physical `left`. Two behavioural issues too: the grid maps ArrowLeft to a negative step, which is inverted in RTL, and Alt+1..9 numbers cells in array order while a `direction: rtl` container renders them right-to-left, so the numbering would no longer match the screen. And the follow-up bar persists an absolute `{left, top}` in pixels per origin, which is meaningless after a language flip.

**Do this:** Do the mechanical pass now, before translators are in flight — `inset-inline-start/end`, `margin-inline-*`, `padding-inline-*`, `text-align: start`, logical `border-*-radius`. Set `document.documentElement.dir` from `chrome.i18n.getMessage('@@bidi_dir')` on each extension page and set it explicitly on the overlay host to override the `all: initial` reset. Derive the arrow-key sign from the computed direction, and index cells by visual position for Alt+N. Change the persisted bar position to a normalised `{xPct, yPct}` or an anchor corner plus offset. **And do this one immediately, independent of localisation:** add `dir="auto"` to the prompt textarea, the follow-up input, the grid query input and the history text spans — users type Arabic, Hebrew, Urdu and Gujarati prompts *today* and they currently render with mangled alignment and punctuation. That is a four-attribute change with an immediate payoff. Finally, note that [16](#16-rescope-or-delete-the-cookie-auto-dismisser)'s term lists are English-only, which is a *functional* failure in de/fr/es rather than a cosmetic one — a German user's grid cells sit behind undismissed banners and the send silently fails — so either delete the feature or table the terms per language.

---

# Privacy & Security

> The privacy posture is genuinely strong and genuinely differentiating: zero host permissions at install, per-service consent, no server, no telemetry, no remote code. Almost everything below is about making the *implementation* match that promise as precisely as the marketing does — which is also what makes the store review routine instead of a conversation.

### 116. Scope the header-stripping rules to the grid tab

**Impact:** Critical · **Effort:** M · **Type:** Fix

**Today:** All eight rules in [grid_headers.json](rules/grid_headers.json) carry a condition of only `{ urlFilter, resourceTypes: ["sub_frame"] }` — no `tabIds`, no initiator constraint, no lifetime — and the ruleset is registered as **static and enabled from install**, so it is live for every user who never opens the grid. The manifest declares `declarativeNetRequestWithHostAccess`, which requires host permission for both the request URL *and* the initiator, so this is not a global "any website can now frame ChatGPT" hole under the default per-service grant. But two paths widen it: adding a custom provider requests that origin as a full host permission, and `http://*/*` + `https://*/*` in `optional_host_permissions` make Chrome's own "On all sites" toggle available. Either way the user's logged-in AI sessions become framable, with framing defences removed, by an origin Puchne has been granted — which turns a social-engineered custom provider into a working clickjacking surface.

**Do this:** Delete the `declarative_net_request` block and the static rules file. Create the rules at runtime in `handleMulticast`, immediately after `chrome.tabs.create` for the grid tab and before the payload write — session rules are the only rule type that supports `tabIds`, which is exactly the scoping needed:
```js
await chrome.declarativeNetRequest.updateSessionRules({
  addRules: targets.map((t, i) => ({
    id: gridTab.id * 100 + i, priority: 1,
    action: { type: "modifyHeaders", responseHeaders: [
      { header: "X-Frame-Options", operation: "remove" } ] },
    condition: { requestDomains: [new URL(t.url).hostname],
                 resourceTypes: ["sub_frame"], tabIds: [gridTab.id] },
  })),
});
```
The ordering is already race-free — [grid.js](pages/grid.js) waits on `readGridData` before it ever sets `iframe.src`. Remove the rules in the existing `chrome.tabs.onRemoved` handler alongside the payload cleanup, and add rules only for the services actually in that send. Result: zero standing header modification, rules that exist only while a grid tab is open and only inside it, and a justification a reviewer accepts in one sentence.

### 117. Stop deleting the whole Content-Security-Policy header

**Impact:** Critical · **Effort:** M · **Type:** Fix

**Today:** Every rule removes `X-Frame-Options` **and** `Content-Security-Policy` outright. Only `frame-ancestors` blocks framing; removing the whole header also removes `script-src`, `object-src`, `base-uri`, `trusted-types` and reporting for that document. The frame this happens in then holds a live authenticated session *and* receives Puchne's own injected code. So inside the grid, the user's ChatGPT/Claude/Gemini session runs with none of the XSS mitigations those companies ship — an injection that their own CSP would neutralise executes normally against a fully logged-in account. [privacy.html](website/privacy.html) describes this as "removes the two headers that forbid framing", which materially undersells what the rules do. And nothing replaces the policy: the cells set no `csp` attribute and no sandbox ([59](#59-set-allow-and-sandbox-on-the-cell-iframes)).

**Do this:** Test each of the eight hosts with **only** the `X-Frame-Options` rule active — several sites ship XFO and no `frame-ancestors`, and for those the CSP removal is pure downside; drop it per-host. Where CSP removal is genuinely required, use `operation: "set"` with a value that restores the mitigations you are not trying to defeat (at minimum `object-src 'none'; base-uri 'none'`) rather than `remove`. Combine with [116](#116-scope-the-header-stripping-rules-to-the-grid-tab), and rewrite the privacy-page row to say plainly which headers, on which hosts, in which tab, and why.

### 118. Stop reading text out of password fields

**Impact:** Critical · **Effort:** S · **Type:** Fix

**Today:** `getActiveSelectionText` in [content.js](scripts/content.js) reads the selection out of the focused element when it is a textarea or an input of type `text|search|url|tel|password`. `window.getSelection()` deliberately never exposes password-field text — this branch is the only way it escapes. It is reached from the `Ctrl+Shift+S` command path, and flows straight into `handleAskPuchne` → `sendPromptDirect` → `handleMulticast` when the ask action is "direct", **and** into `addToHistory`, which writes it to disk. So selecting part of a password, a TOTP secret, or an API key pasted into a password input and pressing the shortcut sends it to every enabled AI provider and records it in prompt history. The context-menu path is safe because Chrome's `info.selectionText` excludes password fields; this is specific to the keyboard shortcut.

**Do this:** Change the regex to `/^(text|search|url)$/i` — drop `password` and `tel`. Also skip when the field's `autocomplete` contains `one-time-code` or `cc-number`, and honour an opt-out attribute. Leave a comment saying why, because this is exactly the line a future refactor re-adds "for completeness".

### 119. Replace `http://*/*` with localhost

**Impact:** High · **Effort:** S · **Type:** Remove

**Today:** [manifest.json](manifest.json) declares both `http://*/*` and `https://*/*` as optional host permissions. The eight named service patterns cover the built-in registry; the two wildcards exist only so the custom-provider form can request an arbitrary origin — and that form validates the URL with nothing but `new URL(urlVal)`, so plaintext-HTTP providers are accepted today. Declaring the wildcards is also what puts "On all sites" into Chrome's extension menu, which is the switch that widens [116](#116-scope-the-header-stripping-rules-to-the-grid-tab), and `http://*/*` is the first entry a reviewer reads.

**Do this:** Replace `http://*/*` with `http://localhost/*` and `http://127.0.0.1/*` — that keeps the only legitimate plaintext case (self-hosted local AI UIs, which is the audience most aligned with this product — see [47](#47-make-local-and-self-hosted-models-a-headline-feature)) and removes the wildcard. Keep `https://*/*` for custom providers, but **say so where it matters**: in the store's host-permission justification and in the AI Tools section itself — *"declared but never requested at install; requested one origin at a time, only when you add your own AI provider."* Enforce it in code: reject any scheme other than https, or http on localhost/127.0.0.1, with an inline message.

### 120. Close `storage.session` to untrusted contexts

**Impact:** High · **Effort:** M · **Type:** Fix

**Today:** [background.js](scripts/background.js) calls `chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" })` on every worker startup. That area holds the **full prompt text** in three places — the send-status record, the parked pending send, and the pending prompt — plus `activeSessionTabs` with each target's URL and selectors. What actually needs untrusted access is one existence check in [content.js](scripts/content.js), which already has a working fallback message immediately below it. The contexts that gain the read are content scripts on every granted host, inside every grid sub-frame, and — after a toolbar-icon click — on *any* page at all. To be precise, because it is easy to overstate: a hostile page's own JavaScript cannot read this, since content scripts run in an isolated world and `chrome.storage` is unreachable from the main world. What is wrong is least privilege — the user's complete prompt is made readable in dozens of injected contexts on third-party origins to support a single boolean.

**Do this:** Three steps, smallest first. Delete `query` from the status record — nothing renders it ([132](#132-delete-or-resurrect-the-status-subsystem)). Replace the content-script read with a plain boolean the worker writes to `storage.local` (`hasActiveSession`), updated where the session list is written and pruned — the same mirror pattern already used for granted origins. Then delete `openSessionStorageToContentScripts` entirely, so session storage returns to trusted-contexts-only. Route the overlay's pending-prompt read through a runtime message like everything else in that class. Note the related exposure that no access level can fix: the panel renders the **entire prompt history** into the DOM of third-party pages when the overlay is used there, inside a shadow root whose "closed" mode is not a security boundary against a page that patched `attachShadow` first. The fix for that is to render recents only in the popup and side panel, not in the in-page overlay.

### 121. Escape provider-supplied strings, and validate provider URLs

**Impact:** High · **Effort:** M · **Type:** Fix

**Today:** `service.name` and `service.url` come from a form with no sanitisation and are interpolated raw into `innerHTML` at nine sites across [grid.js](pages/grid.js), [options.js](pages/options.js) and [prompt-panel.js](scripts/prompt-panel.js) — cell headers (twice, including into an `aria-label`), the loading line, the closed-cells menu, the error card (where the URL lands unquoted in an `href`), the service list, the tool picker and the chip row. The extension-pages CSP blocks inline handlers and `javascript:` URLs, so this is **not** script execution on options or grid — but there is no `img-src` or `default-src`, so `<img src="https://attacker/?p=…">` in a provider name fires an outbound request from a `chrome-extension://` page, and `<iframe>`/`<a href>` inject clickable content into privileged UI. The chip path is different: it lands in the **host page's** DOM via `innerHTML`, where `<img src=x onerror=…>` executes in the host page's main world on any page the overlay is opened on. The existing `escapeAttr` helper escapes only `&` and `"` and is used only in the selector-editor inputs (where that is sufficient). And because provider configs are exactly the kind of thing users paste from a blog post or a gist, "the user typed it themselves" is not a real defence.

**Do this:** Sanitise on write and escape on read. On write, strip `<`, `>` and control characters from the name and cap it at ~40 characters; validate the URL scheme ([119](#119-replace-http-with-localhost)) and reject embedded credentials. On read, convert every site to the pattern [permissions-page.js](pages/permissions-page.js) already uses correctly — build the skeleton with static `innerHTML`, then assign the dynamic parts with `textContent` / `setAttribute` / `img.src`. Build the error card's link with `createElement` and a validated `.href`. Add a shared `escapeHtml` beside `escapeAttr` for anything that must stay templated, and re-validate stored providers on load so pre-existing bad entries surface. Frame this internally as UI-spoofing hardening and reviewer hygiene, not as an XSS vulnerability — overstating it costs credibility.

### 122. Trim `web_accessible_resources` and turn on `use_dynamic_url`

**Impact:** Medium · **Effort:** S · **Type:** Remove

**Today:** The resources list is matched to `<all_urls>` and includes `pages/grid.html` and `scripts/cookie-dismiss.js`, neither of which needs web accessibility: the grid page is opened by the extension itself via `chrome.tabs.create`, and the cookie script is injected with `chrome.scripting.executeScript({files})`. Listing `grid.html` means any website can iframe it. More broadly, with a fixed store-assigned extension id and `<all_urls>` matches, any page on the web can probe an icon URL and reliably detect that the visitor has Puchne installed — a stable cross-site fingerprinting bit tied to a specific behavioural profile ("uses six AI chatbots"), which sits badly beside "no tracking".

**Do this:** Reduce the list to the icons and the two stylesheets that content scripts genuinely fetch, and add `"use_dynamic_url": true` to that entry — dynamic URLs rotate per session and are still resolved correctly by `chrome.runtime.getURL`, so every consumer keeps working unchanged. If you want to go further, inline the two stylesheets into a JS constant at build time and leave only icons.

### 123. Move `tabGroups` to `optional_permissions`

**Impact:** Medium · **Effort:** M · **Type:** Remove

**Today:** Nine API permissions are requested up front. `chrome.tabGroups` is used in exactly one place, behind a `groupTabs` setting that defaults to **false** and whose row is collapsed entirely in grid mode — which is the default. So it is a permission most users will never exercise, declared unconditionally, on an extension whose headline claim is that it installs with access to no websites at all. `tabs` is close behind: it is needed only for three `chrome.tabs.query({url})` calls — two of which are dedupe conveniences — while `tabs.create/update/remove/group/sendMessage` need no permission and the URL reads in the action handler are covered by `activeTab`.

**Do this:** Move `tabGroups` to `optional_permissions` and request it straight out of the click on the Group Tabs toggle, mirroring the existing per-service grant flow. For `tabs`: `openOptionsPage` can drop its query and call `chrome.runtime.openOptionsPage()`, which already focuses an existing tab; the access-window dedupe can track its window id in session storage; that leaves `injectIntoOpenTabs`, which works with the host permission just granted. If those three go, `tabs` can leave the manifest entirely — which is a real headline for the store listing.

### 124. Give prompt history a TTL, an incognito rule, and a clear-all where it lives

**Impact:** Medium · **Effort:** M · **Type:** Add

**Today:** Prompts are written to `chrome.storage.local` from two places, capped only by **count** (default 20, configurable to 100) and never aged out. History is on by default. The manifest declares no `incognito` key, so a private-window prompt is written to the same persistent list ([32](#32-declare-incognito-behaviour-and-handle-the-second-profile)). And the only way to clear it is Settings → Maintenance → Clear History — three clicks away, in a different tab from where the prompts are displayed, while the panel that *does* display them offers only per-row delete. Prompts are the most sensitive thing this extension touches: people paste error logs, contracts, and code with keys in it.

**Do this:** Filter entries older than a configurable window (default 30 days) on read and write the filtered list back — `loadHistory` already normalises a legacy format, so the hook exists. Add a **Clear all** control in the Recent prompts header, where the data actually lives. Add a "Don't save this one" toggle beside Send that skips recording for a single send. And split the one checkbox that currently writes both `enableHistory` and `showRecents` into "Save prompts" (which clears storage when switched off, and says so) and "Show them in the panel" — being able to say *"you can stop Puchne writing prompts to disk"* as its own switch is worth more than the row it saves.

### 125. Disclose settings sync, tighten the CSP, and anchor the rule patterns

**Impact:** Medium · **Effort:** S · **Type:** Fix

**Today:** Three small precision problems. **(a)** Everything — including custom provider names, URLs and selectors — is written to a single `chrome.storage.sync` key, so the list of AI tools a person uses, and any private or internal provider URL they added, leaves the device to Google's sync servers. The website mentions this once; the extension never does — and the *only* sync sentence inside the product says prompt history is "never synced or uploaded", which pushes the reader the opposite way. **(b)** The extension-pages CSP is `script-src 'self'; object-src 'self'` — no `default-src`, no `img-src`, no `base-uri`, no `form-action`, no `connect-src` — on pages that render user-controlled markup ([121](#121-escape-provider-supplied-strings-and-validate-provider-urls)). **(c)** The DNR `urlFilter` values are unanchored (`||chatgpt.com`), so they also match hosts like `chatgpt.com.attacker.io` — low impact on its own, but it widens the rules beyond the eight domains the privacy page names, and it is the same imprecision that has a real payload in [9](#9-match-frames-by-origin-and-prune-session-tabs-on-navigation).

**Do this:** Add one line near the AI Tools heading — *"Your tool list and settings sync to your Chrome profile. Prompts never do."* — which converts a surprise into a feature, and consider a "Keep settings on this device only" toggle (`getSettings` is already a single choke point). Replace the CSP with `script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'none'` — `connect-src 'none'` is the strongest single line available here, because it makes "this extension cannot phone home" *browser-enforced* rather than a promise, and that is a sentence worth putting in the store listing (verify the grid still frames, since `frame-src` falls back to `default-src`). Use `requestDomains: ["chatgpt.com"]` instead of `urlFilter`, which matches the domain and its subdomains exactly with no anchoring subtleties — and which [116](#116-scope-the-header-stripping-rules-to-the-grid-tab) needs anyway.

### 126. Put a "What leaves your device" screen inside the extension

**Impact:** Medium · **Effort:** M · **Type:** Add

**Today:** [privacy.html](website/privacy.html) has the good version of this — a table of what is stored, where, and whether it leaves the device, plus a permission-by-permission table. Nothing equivalent exists in the extension: the options page has six tabs and none is about privacy, and the only in-product statements are two one-liners, one of which overclaims ([22](#22-fix-the-consent-flow-one-surface-honest-copy-and-say-that-granting-enables)). Everything that makes Puchne trustworthy is documented where it is least likely to be seen, and a privacy posture only works as a feature if it is visible at the moment of use.

**Do this:** Add a **Privacy** tab rendering the same table as the website but with **live values from the running profile**: how many prompts are currently stored, which origins are granted (`chrome.permissions.getAll`), whether history is on, whether settings sync is on, and bytes in use (`getBytesInUse`). Put three buttons under it — **Clear prompts**, **Withdraw all site access** (`chrome.permissions.remove` over every granted origin), **Export my settings as JSON**. Add a permanent one-line footer to the compose panel: *"Prompts go only to the tools you picked."* This is a couple of hundred lines and it is the most persuasive thing you could add to the product.

### 127. Make "no remote code" a CI check, and preview what page sends

**Impact:** Medium · **Effort:** S · **Type:** Add

**Today:** The no-remote-code property genuinely holds — the only `fetch` in the extension targets `chrome.runtime.getURL` for two bundled stylesheets, and there is no `eval`, no `new Function`, no external `<script>`, no CDN URL, and no bundler that could introduce one. But nothing enforces it, and it is both a Chrome policy requirement (the fastest route to a takedown) and the load-bearing claim on the privacy page. Separately, "Ask Puchne" on a page captures up to 2,500 characters of `innerText` — an intranet wiki, a webmail thread, a CRM record, a bank statement — and in direct mode delivers it to up to seven third parties with no preview, no confirmation and no undo, recording it to history before the send.

**Do this:** Add a ten-line `verify.yml` running a ripgrep gate on every push that fails on `eval\(|new Function|importScripts\(['\"]https|src=['\"]https?://|fetch\(['\"]https?://|@import url\(['\"]?https` across `scripts/`, `pages/` and `styles/`, plus `web-ext lint` or a manifest schema check. That makes the strongest sentence in the store listing mechanically true. For the page path, add the 3-second undo toast from [25](#25-add-undo-and-target-naming-to-direct-sends-and-multicasts), the collapsed "About this page — 2,410 characters" preview from [30](#30-rewrite-the-prompts-ask-puchne-generates), and exclude obvious no-go containers from the capture — text inside `input`, `[type=password]`, `[data-nosnippet]` and `[aria-hidden=true]`.

---

# Code Quality & Maintainability

> The repository is in better shape than most launched extensions — `promo/node_modules`, `dist/` and `_metadata/` are all correctly ignored and were never committed, the git history is 111 clean, well-scoped commits, and `.git` is about 9 MB. The gap is not hygiene; it is that a ~7,300-line codebase with a 24-key untyped configuration object has **zero** automated feedback.

### 128. Create one settings schema module

**Impact:** Critical · **Effort:** M · **Type:** Fix

**Today:** There is no single definition of what a Puchne settings object *is*. [options.js](pages/options.js) declares a 23-key `DEFAULTS`; [background.js](scripts/background.js) declares an 18-key defaults object inside `getSettings()` — already missing `historyLimit`, `showShortcutHint`, `overlayPosition`, `chipDisplay` and `cookieConsent`; [prompt-panel.js](scripts/prompt-panel.js) declares a third set inline; and there are scattered fourth copies as `|| default` fallbacks across the worker, the grid, the popup, the permissions page and the content script. `["chatgpt","claude","gemini"]` is hard-coded in four places, `MAX_HISTORY = 20` is re-typed as the literal `20`, and `serviceOrder` — written by the panel — appears in **no** defaults object at all, so a reset silently drops it. On top of the drift there is a live bug: `{...DEFAULTS, ...stored}` is a shallow spread, so a page whose stored settings lack `customProviders` aliases the `DEFAULTS` array by reference and then mutates the constant when a provider is added (see [29](#29-apply-one-destructive-action-pattern--and-stop-reset-all-eating-custom-providers)).

**Do this:** Add `scripts/settings.js`, loaded everywhere `constants.js` already is. It owns four things: a `SETTINGS_SCHEMA` with one entry per key (`{type, default, values?, min?, max?}`) from which `DEFAULT_SETTINGS` is *derived*, referencing `MAX_HISTORY`/`THEME_DEFAULT` rather than re-typing them; `loadSettings()`, which `structuredClone`s the defaults before merging — the clone alone kills the aliasing bug; `validateSettings(raw)`, which coerces and clamps against the schema and drops unknown keys, so a corrupted sync record or a downgrade cannot poison a surface; and a `SETTINGS_MIGRATIONS` array with a `settingsVersion` stored in the object, replacing the one-off theme migration and its separate flag key. Then delete every duplicate. Adding a setting becomes one edit instead of remembering four files — and it is the prerequisite that makes [129](#129-type-check-the-existing-js-with-no-build-step) worth doing.

### 129. Type-check the existing JS, with no build step

**Impact:** High · **Effort:** M · **Type:** Add

**Today:** No TypeScript, no linter, no formatter, no tests, no hooks. But the codebase is already ~60% of the way there: [permissions.js](scripts/permissions.js), [constants.js](scripts/constants.js) and [prompt-panel.js](scripts/prompt-panel.js) carry near-complete `@param`/`@returns` JSDoc that nothing checks. Every rename of a settings key, every new registry field, every message payload change is verified only by clicking through the extension by hand.

**Do this:** Type-check the JS **in place** — no build output, no change to how scripts load. Add a `jsconfig.json` with `checkJs: true`, `noEmit: true`, `strict: false`, `noImplicitAny: false`, `strictNullChecks: true`, `types: ["chrome"]`, including `scripts/**` and `pages/**` and excluding `promo/` and `website/`; a root `package.json` with `typescript` and `@types/chrome` as devDependencies only; and `"typecheck": "tsc -p jsconfig.json"`. **Do not** convert to `.ts` or add a bundler: classic scripts sharing globals via `var` is a deliberate and correct choice here — those files are re-injected into the same page by `ensureContentScript` and must not throw on redeclaration, `CONTENT_SCRIPT_FILES` is passed straight to `chrome.scripting`, and three of them are web-accessible resources. `checkJs` respects that model natively; declare the cross-file globals once in a `types/globals.d.ts`. Roll out in three commits so the first CI run is green: jsconfig with `strictNullChecks: false`; then annotate the settings, service and message boundaries with typedefs (that is where 90% of the value is, and it is what turns [128](#128-create-one-settings-schema-module) into a checked contract); then turn `strictNullChecks` on. Contributors get red squiggles before they load the unpacked extension, instead of a silent `undefined` that surfaces as a service that never receives a prompt.

### 130. Add ESLint — and `.editorconfig` instead of Prettier

**Impact:** High · **Effort:** S · **Type:** Add

**Today:** Nothing guards the two patterns this codebase uses most heavily and most dangerously: 31 `innerHTML =` assignments, several interpolating user-controlled provider data ([121](#121-escape-provider-supplied-strings-and-validate-provider-urls)), and 13 genuinely empty or comment-only `catch` blocks. There is also unflagged variable shadowing with a redundant duplicate storage read, and three message handlers with no callers anywhere.

**Do this:** Add a flat `eslint.config.js` with `eslint-plugin-no-unsanitized` (`no-unsanitized/property` and `/method` as errors), `no-empty` with `allowEmptyCatch: false`, `no-shadow`, `no-undef`, `no-unused-vars`, and `eqeqeq`. Declare the cross-file globals in the `globals` map — that map doubles as machine-readable documentation of the classic-script contract, which today exists only as prose in one file's header. Expect roughly 13 empty-catch hits; several are legitimately "expected, ignore" (the cookie dismisser's per-selector probes), so pre-add a disable comment with a one-line reason rather than silence, and fill the rest with `logDebug()` from [137](#137-add-a-logger-and-a-user-facing-diagnostics-report).

**On formatting: skip Prettier.** Add `.editorconfig` (2-space, LF, UTF-8, final newline, trim trailing whitespace) instead. That covers the churn that actually causes noisy diffs, needs no dependency, and reflows nothing. A repo-wide `--write` would destroy hand-aligned columns in [constants.js](scripts/constants.js), the DOM-constant block in `options.js` and the state block in [grid.js](pages/grid.js) — but the durable argument is git blame: making every file's history useless the week after launch is exactly wrong at the moment selector-fix archaeology matters most. If you want Prettier later, scope it to `website/` and `promo/`, or to changed files via lint-staged.

### 131. Replace the 16-branch `onMessage` chain with a handler map

**Impact:** High · **Effort:** M · **Type:** Improve

**Today:** One listener in [background.js](scripts/background.js) contains sixteen sequential `if (message.action === …)` branches over ~220 lines, each independently re-implementing the `return true` async-channel dance. The response shapes have consequently diverged into at least six: `{services}`, `{grantedOrigins, grantedIds}`, `{ok}` / `{ok:false, error}`, `{ok:true}` returned *before* the work is done, `{shortcut:""}` on failure with no error signal, `{ok, results}`. So every caller guesses — one checks `lastError` then `res?.services || []`, another maps `lastError` into `{ok:false,error}` by hand, a third checks `lastError` then a bespoke boolean — and there are eighteen hand-rolled `new Promise((resolve) => chrome.runtime.sendMessage(...))` wrappers of 6–10 lines each across the codebase. [content.js](scripts/content.js) has the same shape at smaller scale with seven branches.

**Do this:** A handler map plus one envelope, with `return true` written exactly once:
```js
const HANDLERS = {
  async getServices()        { return { services: getRegistry(await getSettings()) }; },
  async multicast({ query }) { void handleMulticast(query); return {}; },
  /* … */
};
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = HANDLERS[message?.action];
  if (!handler) return false;                       // let other listeners see it
  Promise.resolve(handler(message, sender)).then(
    (data) => sendResponse({ ok: true, data: data ?? null }),
    (err)  => { logError(message.action, err);
                sendResponse({ ok: false, error: String(err?.message ?? err) }); });
  return true;
});
```
Pair it with one client helper that throws a real `Error` on `lastError` or `!ok`, replacing all eighteen wrappers — roughly −150 lines and one error contract instead of six. Do `content.js` the same way when you split it. While there, add a `_sender` check to any handler that should only be callable from an extension page.

### 132. Delete or resurrect the status subsystem

**Impact:** High · **Effort:** M · **Type:** Remove

**Today:** A fifth of the service worker maintains a data structure with no reader. The subsystem — a serializing queue plus `withSendStatus`, `startSendStatus`, `markService`, `stateFromResult`, `markBlocked` and `describeError` — is fed from roughly eighteen call sites threaded through `handleMulticast`, `handleFollowUpMulticast` and `injectGridQueries`, writes the prompt text and per-service tab ids into session storage on every send, and is read by exactly one function: `retryService`, which nothing calls. The badge computes failures independently from the local results array. Its own module comment claims the record exists "so the toolbar badge knows whether anything failed", which is not true. Roughly 220 lines, including genuinely good user-facing error copy that no user will ever see, sitting in the file that most needs to be smaller.

**Do this:** Decide, and commit. **(a) Resurrect** — the better call, and it is the same work as [1](#1-give-grid-mode-a-failure-surface--today-it-has-none) and [2](#2-wire-the-three-orphaned-recovery-handlers-into-a-last-send-sheet): the record is precisely what a "what happened to my last send?" surface needs, and that is ~80 lines of new UI on top of ~220 lines of already-written, already-debugged backend — very high value per line. Drop `query` from the record either way ([120](#120-close-storagesession-to-untrusted-contexts)). **(b) Delete** — if the UI isn't shipping this release, remove all of it plus the storage key, the queue and the three handlers, keeping only `describeError` (move it to `scripts/errors.js`, because the copy is worth preserving and the badge tooltip should use it). What you must not do is leave it as-is, where every future change to the send path has to correctly maintain a record nobody reads.

### 133. Extract the send pipeline

**Impact:** Medium · **Effort:** M · **Type:** Improve

**Today:** The worker's core job — get a content script into a target and hand it a prompt — is implemented five or six times with small, mostly accidental variations. The badge-flash block appears **twice, byte-for-byte identical** apart from one log string. The injection loop appears three times with diverging details, which is exactly why the follow-up path never calls `waitForTabLoad` or `checkLogin` while the initial-send path does. The `chrome.tabs.sendMessage`-with-timeout-and-`lastError` wrapper appears three times at ~25 lines each. And the "sendMessage, catch 'Could not establish connection', executeScript, sendMessage again" recovery is written out in full twice at ~18 lines each, while `executeScript(CONTENT_SCRIPT_FILES)` appears at six sites.

**Do this:** Add a worker-only `scripts/inject.js` with four functions and delete the copies: `sendToTab(tabId, message, {frameId, timeoutMs})` (one promise/timeout/`lastError` wrapper, replacing all three); `ensureScripts(tabId, frameId?)`; `sendWithInjectRetry(tabId, message)` (replacing both hand-written recoveries); and `deliver(target, {tabId, query, settings, needsLoad})` — the single injection pipeline that all three callers invoke with different flags. Plus one `flashFailureBadge(failed, total)` with the colour and window as named constants. That is roughly 150–180 lines out of [background.js](scripts/background.js), and the follow-up path inherits the tab-load handling it is currently missing.

### 134. Give prompt history one owner

**Impact:** Medium · **Effort:** S · **Type:** Fix

**Today:** Three independent writers to one `storage.local` key. The worker does a proper read-modify-write. The panel operates on its **in-memory** array, loaded once at init, and writes it back without re-reading — so if the worker records a prompt (a direct "Ask Puchne" send) while a popup or overlay is open, the panel's next write silently discards it. The options page does a third read-modify-write to trim to a new limit. Nothing serializes the three. Both normalisers also stamp legacy string entries with `Date.now()`, so old entries all display as "just now".

**Do this:** Add `scripts/history.js` with `addPrompt`, `removePrompt`, `readPrompts` and `trimTo`, all read-modify-write, all routed through the serialized-storage helper from [91](#91-serialize-storage-writes-with-one-helper). Delete the three implementations; the panel keeps its array purely as a render cache refreshed from a `chrome.storage.onChanged` listener — it already uses that pattern for permissions. Preserve the original timestamp when normalising legacy entries (use `0` and render "earlier" rather than lying).

### 135. Split the three big files

**Impact:** Medium · **Effort:** L · **Type:** Improve

**Today:** [options.js](pages/options.js) is 1,767 lines with ~54 module-level DOM constants and at least six unrelated concerns interleaved — including a 150-line from-scratch accessible combobox controller that is genuinely reusable and completely undiscoverable where it sits. [content.js](scripts/content.js) is 1,475 lines containing three unrelated products: the fill engine (~420 lines, the technical heart of the product and the thing most likely to need a fix when a site changes), an overlay, a login toast, and a draggable follow-up bar with 155 lines of inlined CSS. [grid.js](pages/grid.js) is 1,446 lines. `content.js` is also injected into every granted AI host on every page load, so its size is a real cost.

**Do this:** Split into ordered classic scripts — the model the project already uses, no bundler needed.
- `scripts/content/fill-engine.js` (the three fill strategies, `submit`, `pressEnter`, `clickSubmitButton`, `waitForElement`, the fallback tables) — this becomes *the* file a selector contributor opens; move the "Why is this complicated?" header comment onto it. Then `content/overlay.js`, `content/login-notice.js`, `content/follow-up-bar.js` (shrinking once its CSS moves out per [70](#70-create-one-shared-token-layer)), and `content/index.js` holding the guard and the handler map. Verify idempotence under re-injection before shipping — that property is load-bearing.
- `pages/options/` → `ui-select.js` (promote the combobox to `scripts/ui/select.js` so the grid can use it), `ui-spinner.js`, `nav.js`, `services-tab.js`, `custom-providers.js`, `access.js`, `ask-tab.js`, `preview.js`, and a `main.js` under 250 lines. Mirror it in CSS: six sheets of ~250 lines rather than one of 1,757.
- `pages/grid/` → `layout.js`, `resize.js`, `drag.js`, `cells.js`, `main.js`.

Do this *after* [128](#128-create-one-settings-schema-module) so the split moves less code.

### 136. Add error handling to `grid.js`, and namespace the injected globals

**Impact:** High · **Effort:** M · **Type:** Fix

**Today:** [grid.js](pages/grid.js) contains **zero** `try {` and **zero** `.catch(` in 1,446 lines. It is the second-largest file in the project, it is the product's core differentiator, and it makes unguarded `chrome.tabs`, `chrome.storage` and `chrome.runtime` calls throughout — so any rejection becomes an unhandled promise rejection that kills the rest of the render with no user-visible signal, on a page that has no other surface to report through. Separately, the injected classic scripts declare everything at global scope on whatever AI site is being driven: sixteen `var` globals from [constants.js](scripts/constants.js), eight top-level functions from [permissions.js](scripts/permissions.js), and generically-named globals from `content.js` including `submit`, `waitForElement` and `sleep`. The `window.PuchneLoaded` guard protects against double-injection, not against a host page already owning one of those names.

**Do this:** Wrap the grid bootstrap and every storage/tabs call in try/catch that renders an in-page error state (which is also where [27](#27-give-the-grids-empty-and-all-failed-states-somewhere-to-go)'s recovery affordances belong). Namespace the shared surface under a single `window.__puchne` object, or at minimum rename the three generically-named content globals, and hold the line afterwards with the ESLint `globals` allowlist from [130](#130-add-eslint--and-editorconfig-instead-of-prettier).

### 137. Add a logger and a user-facing diagnostics report

**Impact:** High · **Effort:** M · **Type:** Add

**Today:** 64 raw `console` calls, unevenly distributed: the worker has 48, the content script 9, the grid 7 — and [options.js](pages/options.js), [prompt-panel.js](scripts/prompt-panel.js), [popup.js](pages/popup.js), [permissions.js](scripts/permissions.js), [permissions-page.js](pages/permissions-page.js) and [cookie-dismiss.js](scripts/cookie-dismiss.js) have **zero**. So the surfaces users interact with are silent, twenty unconditional `console.log`s ship to production and fire on every send, the `[Puchne]` prefix is hand-applied and inconsistent, and thirteen catch blocks swallow errors entirely. There is no way for a user to tell you what went wrong and no way for you to ask — and when a selector breaks, which is this product's dominant failure mode, the only evidence is a warning in a service-worker inspector they will never open.

**Do this:** Two parts, and the second is a real product feature.
1. **`scripts/log.js`** — `logError`/`logWarn`/`logDebug`, each prefixing consistently and writing to a bounded ring buffer in session storage (last ~200 entries: `{ts, level, surface, action, message}`). `logDebug` is a no-op unless diagnostics are on, so the twenty production logs become opt-in. Fill every empty catch with `logDebug("expected: …", err)` — that converts thirteen silent swallows into thirteen documented, inspectable decisions without changing behaviour.
2. **Settings → Maintenance → Diagnostics** — a toggle plus a **Copy diagnostic report** button producing a paste-able Markdown block: version, browser, OS, enabled vs granted services, mode, custom selectors in use, the last send's per-service outcome with `describeError`'s sentence, and the recent log. **Redact prompt text by default**, behind an explicit "include prompt text" checkbox.

For an open-source extension this is the highest-leverage feature in the whole audit: it turns a useless "it stopped working" into a report containing the exact failing selector — which is precisely the input needed to fix it. Pair it with the issue template in [138](#138-add-the-repo-baseline-and-ignore-node_modules-at-the-root) and the status surface in [1](#1-give-grid-mode-a-failure-surface--today-it-has-none), which supplies the per-service outcome the report prints.

### 138. Add the repo baseline, and ignore `node_modules` at the root

**Impact:** High · **Effort:** M · **Type:** Add

**Today:** `.github/` contains exactly one file (the Pages workflow). There is no `CONTRIBUTING.md`, `CHANGELOG.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, issue template, PR template or `dependabot.yml`. The README ends with *"Contributions welcome: bug reports, selector fixes, UI polish"* — an invitation with no landing page: nothing tells a contributor how to run the extension locally, what the code style is, that a packaging script exists, or where to report a security issue in an extension holding optional host permissions across seven AI services. And there is a live trap: `node_modules/` is ignored only by `promo/.gitignore`, so it is **not** ignored at the repo root — every tooling recommendation in this audit would drop an untracked 100 MB directory into `git status`.

**Do this:** Extend the root `.gitignore` first (`node_modules/` unanchored, `*.log`, `.DS_Store`, `Thumbs.db`, `.vscode/`, `.idea/`, `coverage/`, `*.tsbuildinfo`), then add six short files: **CONTRIBUTING.md** (dev setup, the lint/typecheck/test commands, the commit convention the log already follows consistently — codify it, it is a real asset — and the "comments are load-bearing" rule from [140](#140-write-architecturemd-and-the-two-contributor-guides)); **SECURITY.md** (private reporting via GitHub Security Advisories, a response window, and scope — the extension only, not the AI sites' own security); **CHANGELOG.md** backfilled from the git history, which is clean enough to backfill from and which the store listing needs anyway; **three issue forms**, of which `selector-broken.yml` is the one that matters ("which service / what happened / paste your diagnostic report"); a **PR template** with a five-box checklist (grid mode, tabs mode, light+dark, permissions revoked, lint+typecheck pass); and **CODE_OF_CONDUCT.md** (Contributor Covenant, verbatim). Plus `dependabot.yml` for `github-actions` and the promo npm project, which pins its dependencies with no update path.

### 139. Automate releases and single-source the version

**Impact:** High · **Effort:** M · **Type:** Add

**Today:** `1.0.6` is written in the manifest and hand-duplicated three times in [install.html](website/install.html) — twice inside prose describing what the user will see in Chrome, so it goes stale invisibly — with nothing checking they agree. Bumping a version means editing four strings across two files, running a PowerShell script on Windows, and uploading through the store's web UI by hand. There are no tags, no GitHub Releases, and the shipped zip is committed to the repo while `dist/` is otherwise gitignored — so the only copy of the exact bytes submitted to the store lives on one machine, which makes a store rejection impossible to reproduce. The packaging script also uses `Compress-Archive`, which embeds each file's last-write time, so two runs from the same commit produce different bytes and different hashes — meaning a user *cannot* verify that the published zip is what the tag builds, which is the one verification that would make "no server, no tracking" checkable rather than asserted.

**Do this:** Make the manifest authoritative and add a `sync-version` script that rewrites the site's occurrences (mark them `<span data-version>` so it is a DOM query, not a regex on prose), with an equality assertion in CI. Port the packaging logic to Node so it runs anywhere, **preserving both existing guards verbatim** — re-read the finished archive and fail on any forbidden path, and fail unless `manifest.json` is at the zip root; they are the best part of that script. Make it deterministic: enumerate files sorted by relative path, stamp every entry's timestamp to the commit date, fixed compression, print the SHA-256. Add a tag-triggered `release.yml` that runs lint/typecheck/test, verifies the tag matches the manifest version, packages, and attaches the zip plus its `.sha256` to a GitHub Release. Optionally add a **manually-approved** publish job using the store's API (`environment: chrome-web-store`, so it needs a click) — a bad selector shipped to the store costs days of review to undo, while a bad GitHub Release costs nothing. Once [12](#12-move-the-registry-into-a-data-module-with-a-remotely-refreshable-selector-manifest) exists, add a third workflow that validates and publishes `selectors.json`, so selector fixes ship without a release at all.

### 140. Write ARCHITECTURE.md and the two contributor guides

**Impact:** Critical · **Effort:** M · **Type:** Add

**Today:** The individual comments are excellent; what is missing is the map that tells you which file to open, and the guide that tells a user how to fix the thing that broke. A newcomer must infer from source that there are no static `content_scripts` and scripts are registered at runtime per granted host; that `CONTENT_SCRIPT_FILES` is the canonical injection set; that `chrome.permissions` does not exist in a content script, hence the storage mirror; that `chrome.permissions.request` needs an extension page *and* an unspent user gesture, hence the entire permissions-window detour; that grid iframes only work because of the DNR rules; and that the payload is keyed by tab id so a reload re-renders. Every one of those facts is documented — in a comment, in the file where it happens, discoverable only by reading all 7,300 lines. Meanwhile the registry comment says *"If a service stops working, updating the selector here usually fixes it. Contributions welcome!"* and nothing anywhere says **how**: not how to find a selector, not that the options page ships a one-click **Test service** button that does exactly this job, not what a good selector looks like, not which `inputType` to choose, not where to put the change.

**Do this:** Three documents, none long.
- **`ARCHITECTURE.md`** (~2 pages, four sections): a **surfaces** table (file → what it is → what loads it → what it may call, including the `chrome.permissions`/`chrome.commands`/`matchMedia` availability matrix per context, which drives several of the odder design choices); one **send-pipeline** diagram covering both branches end to end; the **permission dance** (why site access is optional, why the request needs its own page, what a grant republishes, what happens on revoke); and a **storage map** naming every key, its area, its lifetime, its writers and its shape — naming the writers is what surfaces the races in [91](#91-serialize-storage-writes-with-one-helper) and [134](#134-give-prompt-history-one-owner).
- **`docs/FIXING-SELECTORS.md`** — the flagship. Nine steps with screenshots: confirm the symptom; copy the diagnostic report ([137](#137-add-a-logger-and-a-user-facing-diagnostics-report)), which names the failing selector; inspect the composer; pick a selector most-stable-first (`id` → `data-testid` → `aria-label` → structural) and explain why the registry always lists two or three comma-separated fallbacks; choose the `inputType`; paste it into Settings and press **Test service** — green means done; repeat for the submit button; open a PR editing one entry in the services module; *or* file an issue with the report and let a maintainer do it. **Steps 1–7 need no git and no build.** Publish it on the website too, linked from the FAQ's "a tool stopped working" answer, so users hit it at the moment they are motivated.
- **`docs/ADDING-A-PROVIDER.md`** — the same shape: prototype entirely through the custom-provider form with no code, verify with Test service, then promote to a built-in with one registry entry, one manifest pattern and two icons. Move the registry's field reference here.

Finally, add a **"Comments are load-bearing"** section to CONTRIBUTING.md stating the rule the code already follows: *a comment explains why the code is the way it is — a constraint, a Chrome API rule, a site quirk, or a bug this shape prevents. If you move code, move its comment. If you delete code, quote its comment in the PR and say why the constraint no longer applies.* Every refactor in this audit is a chance to destroy reasoning that took 111 commits to accumulate. While codifying it, fix the handful of stale ones — a doc comment claiming a 30s timeout for a 10s constant, a log string hard-coding "10s" instead of interpolating it, a comment describing a message-passing mechanism that [12](#12-move-the-registry-into-a-data-module-with-a-remotely-refreshable-selector-manifest) removes, and two stacked section headers with the first one's content missing.

---

# Growth, Store & Distribution

### 141. Flip every CTA to the Chrome Web Store

**Impact:** Critical · **Effort:** M · **Type:** Fix

**Today:** Every install path in the marketing says "not yet". [install.html](website/install.html) leads with *"Not on the Chrome Web Store yet — you load the folder yourself"* and its primary button downloads a GitHub archive; the landing page's hero, header and footer buttons all point at that install manual; two separate FAQ entries answer "Is it on the Chrome Web Store?" with "Not yet"; and the README's install section is `git clone` plus Load unpacked. Meanwhile `dist/puchne-1.0.6.zip` is already built. So every visitor is routed to `chrome://extensions`, Developer mode, and a folder they must never move — the install page literally warns *"Move it and Puchne stops"*. That converts developers and loses everyone else, and it will make the site look abandoned the day the listing goes live.

**Do this:** Swap all twelve places in one pass: the install page's hero becomes **"Add to Chrome — Free"** pointing straight at the store item, with Load-unpacked demoted into a collapsed "Install from source" block above the maintainer section; both FAQ answers become "Yes — get it here"; the landing page's header and footer buttons point at the **store URL directly** rather than at the install page (removing a hop); and the README leads with a store badge and keeps `git clone` as the second option. Add `"homepage_url"` to the manifest so Chrome's own extensions page links back to the site. To make this a one-line change next time, see [154](#154-fix-the-website-performance-and-the-nine-duplicated-headers).

### 142. Rewrite the store title and short description

**Impact:** Critical · **Effort:** S · **Type:** Improve

**Today:** The manifest name is **"Puchne - Ask Every AI at Once"** — 29 of the 75 characters allowed, containing zero of what people actually type: *chatgpt claude gemini side by side*, *compare ai*, *multi ai chat*, *ask multiple ai*. "Ask Every AI at Once" is a good tagline and a bad query. The 132-character description uses 96, spends twelve of them on "Open source." (which nobody searches), and omits Perplexity and Grok — both supported, both high-volume queries.

**Do this:** The store name field is the heaviest-weighted ranking signal, so make it carry the brand *and* the terms. Recommended name: **"Puchne — Ask ChatGPT, Claude & Gemini at Once"** (45 chars, best keyword-to-brand ratio); alternatives are *"Puchne: Multi-AI Chat, Side by Side"* (owns the category term) or *"Puchne — Compare AI Answers Side by Side"* (owns the intent). Recommended description: **"One prompt to ChatGPT, Claude, Gemini, Perplexity, Grok, Copilot & DeepSeek. Compare AI answers side by side. Free, no API key."** (127 chars — names all seven providers and both intent phrases). Keep "open source" for the detailed description, where it converts, rather than the 132-char field, where it only costs.

### 143. Build the listing kit

**Impact:** Critical · **Effort:** L · **Type:** Add

**Today:** The listing's required art does not exist. `docs/screenshots/` holds six 1440px-wide captures at various heights — none is 1280×800 or 640×400, the only sizes the store accepts — and three of the six are the **settings page**, which sells nothing. There is no 440×280 promo tile and no 1400×560 marquee anywhere in the repo. The 36-second launch film and its poster exist and are unused by the listing.

**Do this:** Five 1280×800 screenshots with the caption baked into a band at the top (the store shows no captions of its own), ordered payoff-first:
1. **The grid with three real answers** — *"One prompt. Three answers. One tab."*
2. **The overlay over an article, chips lit** — *"Ctrl+Shift+X on any page. Pick your tools. Send."*
3. **Right-click on a selection** — *"Select any text → Ask Puchne."*
4. **The follow-up bar mid-type** — *"One follow-up box. Every AI answers again."*
5. **The permissions window** — *"No account. No server. You grant one site at a time."*

The **440×280 tile** must be readable at 50%, because that is how it renders in search rows: the mark, "Puchne", and "Ask every AI at once" on the dark ground with the orange accent. The **1400×560 marquee**: the grid's three columns bleeding off the right edge, the panel on the left, the tagline — nothing under 24px. Structure the detailed description as hook → "How it works" in three numbered steps → a feature list that spells the seven provider names out again (it is indexed too) → "Why it's different" (grid view, no API keys, no account) → privacy (zero host permissions at install) → open source with the repo link → **known limits** (sites redesign; here's how to fix a selector). Category: Productivity → Workflow & Planning. The video field accepts a YouTube URL only, so upload the film unlisted with a keyword title — and cut a **separate 15-second version starting at the grid scene**, because the 36-second film opens with the problem statement and store viewers bounce before the payoff.

### 144. Fix `og:image` and the share cards

**Impact:** Critical · **Effort:** S · **Type:** Fix

**Today:** All eight site pages set `og:image` to a **relative** path. The Open Graph spec requires absolute URLs and most crawlers — X, Slack, Discord, LinkedIn — will not resolve a relative one, so every launch post will render as a bare text link. `twitter:card` appears on one page only; there is no `og:url`, no `og:site_name`, no `twitter:title`/`description`/`image`, and no `rel=canonical` anywhere. And the image itself is a logo-on-black poster showing none of the product, so even once fixed the card sells nothing.

**Do this:** Set absolute `og:image`, per-page `og:url`, `og:site_name`, `twitter:card: summary_large_image`, `twitter:title`/`description`/`image` and `rel=canonical` on every page. Create a purpose-built 1200×630 `og-card.png` that is the **grid screenshot with the tagline overlaid**, not the logo poster; keep the poster as the `<video>` poster only. Verify with the X Card Validator and a Slack unfurl before the launch posts go out. A link dropped in a subreddit or a Slack that renders as a product card with the grid visible is worth several times the click-through of a bare URL.

### 145. Add the SEO plumbing

**Impact:** High · **Effort:** S · **Type:** Add

**Today:** `website/` contains nine HTML pages and `.nojekyll` — no `sitemap.xml`, no `robots.txt`, no `rel=canonical` and no structured data anywhere. Nine well-written documentation pages with good titles are the site's real long-tail asset ("how to fix an AI extension selector", "ask multiple AI at once") and none of it has discoverable structure.

**Do this:** Add `sitemap.xml` listing the eight indexable pages (the 404 is already noindex) and `robots.txt` pointing at it. Add `rel=canonical` to each page. Add a `SoftwareApplication` JSON-LD block to the landing page (name, `applicationCategory: BrowserApplication`, `operatingSystem: Chrome`, `offers` price 0, `aggregateRating` once reviews exist, `downloadUrl` = the store item) and a `FAQPage` block to [faq.html](website/faq.html) reusing its existing `<details>` content verbatim — that page is already structured exactly for it. Submit the sitemap in Search Console. This is the only acquisition channel that compounds without spend.

### 146. Rewrite the hero

**Impact:** High · **Effort:** M · **Type:** Improve

**Today:** The hero is a CSS-drawn "stage" — fake chips, a typed line, four skeleton cards. It is beautifully made and it is still a **diagram**: in three seconds a cold visitor learns that "something fans out to four boxes" but never sees Chrome, a real answer, or the moment that sells the product. The only real grid image appears once on the features page and never on the landing page, and the actual screenshots sit roughly 2,000 pixels down. The headline is a tagline, not a claim — it never says what the thing is (a Chrome extension) or what you get (answers side by side) — and the lead repeats it instead of supplying the missing noun.

**Do this:** Keep the stage as the *second* beat. Headline: **"Ask ChatGPT, Claude and Gemini the same question. At once."** — that puts the searched names in an H1. Subhead: *"A free Chrome extension that sends your prompt to ChatGPT, Claude, Gemini, Copilot, DeepSeek, Perplexity and Grok at the same time — and shows every answer in one tab. No API keys, no account, no tracking."* Under it, the real grid screenshot at full width with a play affordance. Move the seven-logo tools strip **above the fold** — seven recognisable logos are the fastest possible explanation of what this is. And change the secondary button from "Watch 36s" to "Watch the 36-second film"; "36s" reads as a file size.

### 147. README: badges, a GIF, and an honest comparison

**Impact:** High · **Effort:** M · **Type:** Improve

**Today:** No badges of any kind, and the hero image is the compose panel — the *setup*, not the punchline — while the grid is described in text and never shown. GitHub is where Show HN and Reddit traffic lands, and there is no signal of liveness (version, users, rating, license, CI), which is what a visitor scans for before deciding whether the project is maintained. There is also no comparison section anywhere, and the FAQ's "The project" section covers the name and contributing but never names an alternative.

**Do this:** Put a badge row on line one — store version, users, rating, MIT, and CI once it exists — with an "Add to Chrome" link directly under it. Replace the hero image with the GIF the promo project can already render (`npm run render:gif`), showing type → send → three answers streaming, capped at ~5 MB and ~10 seconds so it autoplays. Then add a **"Why not just use…"** table and be straight: ChatHub is the closest analogue and also side-by-side, but freemium and closed-source, where Puchne is MIT with no paid tier; Sider and Monica are polished all-in-one sidebars that resell inference and require an account, where Puchne drives the tabs you already pay for; Poe is a hosted product with its own subscription and logins; TypingMind is a BYO-API-key front end — better if you have keys, useless if you only have consumer subscriptions, which is Puchne's exact audience; AnythingLLM and Msty are local desktop apps for local models and RAG, a different problem. Follow it with a blunt **"Where Puchne loses"** list: it drives web UIs, so a redesign can break a provider until a selector is fixed (link the guide); grid view depends on stripping framing headers, so a provider that hardens against it falls back to tabs; no mobile; no conversation history of its own; no local models yet. Naming the weaknesses is what makes the strengths believable — and it pre-empts the 1-star review that starts "it stopped working with Claude". It also captures the "ChatHub alternative" and "Sider alternative" queries, which are the highest-intent searches in this category.

### 148. Ask for reviews at the right moment

**Impact:** High · **Effort:** S · **Type:** Add

**Today:** No review prompt anywhere, and no counter to base one on — nothing persists a cumulative send count. Store ranking is driven by rating *count* as much as value, and an extension under ~20 reviews sits below competitors regardless of quality; organic review rate for a free utility is roughly 1 in 500 installs without an ask.

**Do this:** Add a `stats` object in `chrome.storage.local` (`{sends, distinctDays, firstSendAt, reviewPromptState}`) incremented where the send status starts. Show a single-line strip in the grid footer **only** when `sends >= 5` **and** `distinctDays >= 3` **and** the last send had no failures **and** the state is unset: *"Getting value from Puchne? A store review helps a lot."* — [Sure] opens the review URL, [Not now] re-arms at 25 sends, [Never] is permanent. Never a modal, never in the first session, never after a failed send, never twice. Record only the state, never what was asked. Reviews then arrive from people in the middle of a good session rather than only from people angry enough to seek out the form.

### 149. Measure activation without tracking

**Impact:** High · **Effort:** S · **Type:** Add

**Today:** There is no analytics, telemetry or tracking code anywhere — and "No account. No server. No tracking." is a headline promise on five pages. But shipping blind means you cannot tell whether people install and never send, or send once and stop; those two failures have completely different fixes.

**Do this:** Three tiers, and the honest answer is that you should take the first two and skip the third. **(1) Local-only counters** — the `stats` object above, used exclusively to drive in-product logic (the review ask, the first-run checklist, a "you've compared 50 prompts" milestone). Nothing leaves the device; the privacy page gains one line saying so. The trade-off is real: you get zero aggregate visibility and optimise from store reviews and issues alone. **(2) The store dashboard**, which is free and already yours — weekly active users against installs is a genuine activation proxy, and the uninstall-rate curve tells you whether you lose people on day 1 or day 7. Make it the primary metric. **(3) `chrome.runtime.setUninstallURL`** — this *is* a network request at uninstall time, carrying no data but the fact of an uninstall, and it must be disclosed in the privacy page and the store's data-use form or it contradicts the promise. Recommendation: do (1) and (2). The information from (3) is worth less than the asterisk it puts on "no tracking" — and the offboarding value can be recovered without it (see [150](#150-ship-a-changelog-an-in-product-whats-new-and-an-offboarding-path)).

### 150. Ship a changelog, an in-product "What's new", and an offboarding path

**Impact:** High · **Effort:** S · **Type:** Add

**Today:** `onInstalled`'s `"update"` branch does exactly one thing — a theme migration. There is no release-notes surface on any of the six extension surfaces, no CHANGELOG in the repo, and no changelog page on the site. This matters more here than for most products, because Puchne's maintenance loop is almost entirely selector repair: a site changes, Puchne breaks, someone reports it, a fix ships — and the user who reported it, the most valuable user the project has, has no way to learn their fix landed. From their side the product broke and stayed broken, and a silent auto-update is indistinguishable from abandonment. Users also lose their prompt history and any custom providers on uninstall with no warning and no way to keep them.

**Do this:** Add a `RELEASE_NOTES` map keyed by version and a stored `lastSeenVersion`; on the next panel open after an update, show one dismissible line — *"Updated to 1.0.7 — ChatGPT and Grok selectors fixed"* — linking to the full notes. Publish `CHANGELOG.md` and a `changelog.html` generated from it, and read the version from `chrome.runtime.getManifest().version` everywhere instead of hard-coding it ([139](#139-automate-releases-and-single-source-the-version)). Pair it with **Export my data** in Settings → Maintenance so leaving is not the same as losing everything. Users see the project is alive and that their bug report mattered — the cheapest retention mechanism an open-source extension has.

### 151. Build the contributor on-ramp for selector fixes

**Impact:** High · **Effort:** S · **Type:** Add

**Today:** Selector rot is the project's structural risk — seven providers redesigning independently — and the fix is a one-line change in one registry entry. That is the single most delegatable maintenance task in the codebase, and there is no path for a stranger to do it: no issue template, no CONTRIBUTING, and the FAQ says selector fixes are "the most valuable" while linking only to the issues page.

**Do this:** This is [138](#138-add-the-repo-baseline-and-ignore-node_modules-at-the-root) and [140](#140-write-architecturemd-and-the-two-contributor-guides) viewed from the growth side, and it is worth restating as a growth item because it is the mechanism by which this product survives: a `broken-provider.yml` issue form asking which provider, what you see, the working selector if found, and the diagnostic report; a five-minute "fix a broken selector" guide whose first seven steps need no git; both linked from the README, the FAQ, and the in-product failure state ([2](#2-wire-the-three-orphaned-recovery-handlers-into-a-last-send-sheet)); and a `good first issue` label on every selector issue the canary opens. When Gemini redesigns on a Saturday, a user fixes it before the maintainer wakes up — and Puchne stops being a single point of failure.

### 152. Run the launch sequence in this order

**Impact:** High · **Effort:** M · **Type:** Add

**Today:** Three rendered cuts of the launch film (16:9, square, vertical) sit unused, the zip is built, and the site is live saying "not on the store yet". All the assets exist and none has been posted.

**Do this:** Ordering matters more than copy — the listing must be live and reviewed **before** any traffic arrives, or the whole spike lands on a Developer-mode tutorial.
- **Day −7:** submit to the store. Budget for the long end of review (1–14 days), because this package requests broad optional host permissions and modifies response headers. Write the permission justifications as part of the submission, not after: state plainly for `declarativeNetRequestWithHostAccess` that grid view removes framing headers **only** for sub-frame requests, **only** for granted AI hosts, **only** inside Puchne's own grid tab via session rules scoped by `tabId` and deleted when the tab closes, and that no request is inspected, logged or redirected — which is only true once [116](#116-scope-the-header-stripping-rules-to-the-grid-tab) ships, and is precisely why that finding is a launch blocker. Add a note-for-reviewer pointing at the public commit matching the uploaded zip with line links to the DNR lifecycle, the permission model and the consent UI. Set the privacy form to no data collected in every category. Add *"Not affiliated with OpenAI, Anthropic, Google, Microsoft, DeepSeek, Perplexity or xAI"* to the description for the trademark check.
- **Day −2:** ship the og fixes and the store links; upload the film to YouTube; cut a 12-second silent GIF of type → send → three answers.
- **Day 0, Tuesday 00:01 PT:** Product Hunt — tagline *"One prompt. Every AI. Side by side."*, square cut as the gallery video, first comment telling the Gujarati naming story and stating plainly that it is MIT with no paid tier and no server, which is the differentiator that wins in that audience.
- **Day 0, morning ET:** Show HN — *"Show HN: Puchne – send one prompt to ChatGPT, Claude and Gemini at once (MIT)"*, leading the body with the **architecture** (no server, no API keys, optional host permissions granted per site, session-scoped DNR rules for framing) because HN rewards the how, not the what. Be in the thread for six hours.
- **Day 1:** r/ChatGPT (GIF first, titled as the workflow not the tool), r/ChromeExtensions, r/SideProject. Skip r/chrome, which is mostly support traffic.
- **Day 2:** X thread — GIF first, naming story third, store link last.
- **Days 3–7:** reply to every store review and every issue within a day. That response rate is visible to future visitors and does more for conversion than any post.

### 153. Monetization, rated honestly

**Impact:** Medium · **Effort:** M · **Type:** Improve

**Today:** MIT licensed, no server, no account, no telemetry — and the site says "Free, MIT licensed, no paid tier" in two places. Every monetization option has to be scored against how much of that it spends.

**Do this:**
| Option | Verdict |
|---|---|
| **Stay free forever** | **Best fit.** The zero-server, zero-account claim *is* the competitive position against ChatHub/Sider/Monica. The moment there is a licence check there is a server, and the pitch changes. Treat the project as reputation and portfolio value — and be loud that there is no paid tier, because that is itself the marketing. |
| **GitHub Sponsors + `FUNDING.yml`** | **Do it now.** Strong fit, zero cost, nothing promised away. One modest line in the README and the options footer — never in the send path. |
| **Ko-fi / one-off tips** | Fine, low yield, no downside. Redundant if Sponsors is set up; pick one. |
| **Paid "Pro" tier** (API mode, prompt library, export) | **Poor fit, and worse than it looks.** Offline licence checks are trivially bypassed in an MIT codebase where anyone can delete the check and rebuild; online checks mean a server, an account and a privacy-page rewrite. API mode also fights the core promise — the point is using subscriptions you already pay for. If you ever want revenue, the honest version is a separate paid product, not a gate inside this one. |
| **Paid companion desktop app** | Poor fit. A different product with a different build system, and no build step exists here yet. |
| **Sponsored provider listings** | **Reject — and say why out loud.** The value of the provider list is that its membership and ordering are *neutral*. Selling a slot in a tool whose purpose is impartial comparison is self-refuting, it is a store deceptive-behaviour risk if undisclosed, and it is the one thing that would make the privacy-first framing look like a marketing posture. |

### 154. Fix the website performance and the nine duplicated headers

**Impact:** Medium · **Effort:** M · **Type:** Perf

**Today:** `site.css` is ~66 KB of unminified, render-blocking CSS in every page head (GitHub Pages will gzip it to roughly 12 KB, so it is survivable), but the images are not: the video poster is ~733 KB — and it is also the `og:image` for all eight pages — and two screenshots are ~300 KB each, all PNG with no WebP, adding up to roughly 1.8 MB on the landing page, arriving on a phone on mobile data on launch day. The deploy workflow uploads the folder as-is with no build step. Separately, [website/README.md](website/README.md) states the structural problem plainly: *"Each page carries its own header and footer markup. There are nine copies; that is the price of having no build step."* That was a reasonable trade for static content, and it stops being reasonable the week you need to change one URL in every header, every footer, every hero and two FAQ answers under launch-day pressure — which is exactly when a missed copy ships.

**Do this:** Add a minimal build step to the Pages workflow between checkout and upload: minify the CSS and generate `.webp` alongside every `.png` with a `<picture>` fallback. Re-export the poster — it is a flat two-colour composition and should be well under 100 KB. Inline the ~6 KB of critical hero CSS and load the rest non-blocking. Keep the "no build step" property of the *source* tree, so `open index.html` still works. For the duplication, the cheap fix is enough and can ship today: extract the store URL and version into a tiny `config.js` that the site script stamps into elements marked `data-store-link` and `data-version`, so [141](#141-flip-every-cta-to-the-chrome-web-store) and every future version bump become a one-line edit.

### 155. Keep the name — stop making it do the explaining

**Impact:** Medium · **Effort:** S · **Type:** Improve

**Today:** "Puchne" is genuinely good branding: it means something, it is short, it is memorable once heard, and the Gujarati origin is a real story that plays well on Product Hunt and HN. It is also unsearchable (zero existing volume, nobody will guess it), hard to spell from hearing, and ambiguous to pronounce for most of the audience. Those are two different problems, and today the name is asked to solve both — the H1 is the tagline, the meaning is explained only in a footer, and the store title leads with the brand and nothing else.

**Do this:** Keep the name unchanged and split the jobs. **Cold surfaces lead with the function** — the H1, the `og:title`, the Show HN title, the Product Hunt tagline all say what it does before what it is called ([142](#142-rewrite-the-store-title-and-short-description), [146](#146-rewrite-the-hero)). **Warm surfaces lead with the story** — the PH first comment, the HN thread, the README, the footer, and now the extension itself ([83](#83-tell-the-gujarati-story-in-product-and-rewrite-the-microcopy)) — because the origin converts among people already paying attention. Add a pronunciation gloss the first time the name appears on the site ("Puchne — POOCH-nay"), and `lang="gu"` on the Gujarati spans. People then find the extension by what it does and remember it by what it is called, instead of the name having to do both and doing neither.

### 156. Fill in the manifest metadata, the browser matrix, and the managed-deployment path

**Impact:** Medium · **Effort:** M · **Type:** Add

**Today:** The manifest declares no `short_name`, no `minimum_chrome_version` and no `homepage_url`, while the code guards `sidePanel` (Chrome 116+) and `storage.session.setAccessLevel` at runtime and the install page advertises "Chrome 114+" — a number nothing enforces and which contradicts the sidePanel guard, so a user on 110 can install and get half a product with no explanation. On browsers: Edge Add-ons accepts the same MV3 zip with a separate free listing and a much emptier search index — the highest reach-per-effort available — with `chrome.sidePanel` as the only functional gap, which the existing install-page copy already half-explains. Firefox is a real port whose blocker is `chrome.sidePanel` → `sidebar_action` (plus an event page instead of a worker and no `tabGroups`), and its users are the most privacy-motivated audience on the web, which is exactly Puchne's pitch — but verify the framing rules actually strip headers there before promising grid view. Safari is a trap: Xcode, a paid developer membership, App Store review, a native wrapper to maintain, and the grid's entire premise depends on rewriting response headers, which is the least portable thing in the codebase. And there is no managed-deployment path at all — a university, newsroom or company that wants Puchne on 500 machines with a fixed provider list and history off has no way to do it, which is also the only distribution channel that doesn't go through store discovery.

**Do this:** Add `"short_name": "Puchne"`, `"minimum_chrome_version": "116"` (matching the highest API actually depended on, which turns the two runtime guards into belt-and-braces) and `"homepage_url"`, and derive the install page's number from the manifest. Publish a browser support matrix in the README and on the install page — Chrome 116+ / Edge / Opera supported, Brave with a Shields caveat for grid view, Arc supported, Firefox planned with the specific gaps named, Safari not supported **and why**. Submit the existing zip to Edge Add-ons with the same copy and screenshots, gating the sidebar toggle on `chrome.sidePanel` existing. Then add a `managed_schema.json` covering `enabledServices`, `customProviders`, `allowCustomProviders`, `enableHistory` and `gridView`, merged in `getSettings()` with managed values winning (`{...defaults, ...sync, ...managed}`) and rendered as locked rows with a "Set by your organisation" note — paired with `ExtensionSettings` policy docs so an admin can force-install and pre-grant host permissions in one policy file. Explicitly **do not** ship a userscript or bookmarklet version: it cannot register content scripts, cannot frame a grid of origins, and cannot request host permissions, so it would be a strictly worse product wearing the same name.

---

## Suggested roadmap

### v1.1 — Stop the silent failures
*Goal: nothing the product does can fail without the user finding out, and nothing it reports as sent is unsent.*

[1](#1-give-grid-mode-a-failure-surface--today-it-has-none), [2](#2-wire-the-three-orphaned-recovery-handlers-into-a-last-send-sheet), [3](#3-stop-fillprosemirror-from-submitting-the-previous-draft), [4](#4-stop-reporting-success-you-havent-verified), [5](#5-give-the-content-script-a-deadline-inside-the-workers), [8](#8-run-the-login-check-in-grid-mode-and-tighten-its-heuristic), [9](#9-match-frames-by-origin-and-prune-session-tabs-on-navigation), [10](#10-make-re-injection-idempotent-and-version-aware), [11](#11-key-grid-payloads-by-id-not-tab-id), [15](#15-resume-parked-sends-from-any-grant-path-and-stop-lying-about-whats-pending), [16](#16-rescope-or-delete-the-cookie-auto-dismisser), [17](#17-delete-the-page-load-delay-setting), [18](#18-fix-the-mv3-lifetime-bugs-and-close-the-compatibility-guards), [19](#19-detect-offline-and-stop-misdiagnosing-it), [20](#20-make-the-first-icon-click-always-do-something), [29](#29-apply-one-destructive-action-pattern--and-stop-reset-all-eating-custom-providers), [58](#58-send-the-prompt-to-each-cell-as-it-loads-not-after-the-slowest-one), [59](#59-set-allow-and-sandbox-on-the-cell-iframes), [60](#60-detect-a-blocked-cell-and-give-it-a-real-reason-and-a-retry), [116](#116-scope-the-header-stripping-rules-to-the-grid-tab), [117](#117-stop-deleting-the-whole-content-security-policy-header), [118](#118-stop-reading-text-out-of-password-fields), [119](#119-replace-http-with-localhost), [122](#122-trim-web_accessible_resources-and-turn-on-use_dynamic_url), [123](#123-move-tabgroups-to-optional_permissions), [125](#125-disclose-settings-sync-tighten-the-csp-and-anchor-the-rule-patterns), [128](#128-create-one-settings-schema-module), [137](#137-add-a-logger-and-a-user-facing-diagnostics-report) — plus, before any traffic arrives: [141](#141-flip-every-cta-to-the-chrome-web-store), [142](#142-rewrite-the-store-title-and-short-description), [143](#143-build-the-listing-kit), [144](#144-fix-ogimage-and-the-share-cards), [152](#152-run-the-launch-sequence-in-this-order).

### v1.2 — Make it feel premium
*Goal: every moment where the user currently wonders whether it worked becomes a moment where they can see that it did.*

[6](#6-replace-the-first-match-generic-fallback-with-a-scored-heuristic), [7](#7-preserve-newlines-in-rich-editors), [12](#12-move-the-registry-into-a-data-module-with-a-remotely-refreshable-selector-manifest), [13](#13-build-the-selector-canary-and-a-ci-gate), [21](#21-build-a-first-run-welcome), [22](#22-fix-the-consent-flow-one-surface-honest-copy-and-say-that-granting-enables), [23](#23-explain-grid-vs-tabs-allow-a-per-send-override-and-give-failed-cells-an-escape-hatch), [24](#24-reuse-tabs-groups-and-the-grid-tab-add-close-this-session), [25](#25-add-undo-and-target-naming-to-direct-sends-and-multicasts), [27](#27-give-the-grids-empty-and-all-failed-states-somewhere-to-go), [30](#30-rewrite-the-prompts-ask-puchne-generates), [31](#31-show-prompt-size-before-a-multicast-multiplies-it-and-show-recents-before-they-exist), [32](#32-declare-incognito-behaviour-and-handle-the-second-profile), [33](#33-trim-the-settings-surface), [61](#61-fix-the-4--and-7-cell-layouts-and-add-a-responsive-floor), [62](#62-make-focus-sticky-and-keyboard-reachable-demote-hover-expand), [63](#63-add-per-cell-zoom-and-per-cell-controls), [64](#64-upgrade-the-follow-up-bar-and-wire-it-immediately), [67](#67-stop-animating-grid-template-and-drop-will-change), [69](#69-split-reset-layout-persist-closed-cells-and-key-layouts-per-service-set), [70](#70-create-one-shared-token-layer)–[83](#83-tell-the-gujarati-story-in-product-and-rewrite-the-microcopy) (the whole visual system), [84](#84-replace-the-600ms-of-unconditional-sleeps-in-fillandsubmit)–[97](#97-call-destroy-cap-concurrent-cells-and-debounce-savelayout) (performance), [98](#98-label-every-control-on-the-options-page)–[112](#112-give-the-grid-structure-and-fix-its-tab-order) (accessibility), [126](#126-put-a-what-leaves-your-device-screen-inside-the-extension), [138](#138-add-the-repo-baseline-and-ignore-node_modules-at-the-root)–[140](#140-write-architecturemd-and-the-two-contributor-guides), [146](#146-rewrite-the-hero)–[151](#151-build-the-contributor-on-ramp-for-selector-fixes).

### v1.3 — Own the comparison
*Goal: Puchne stops being a sender and becomes the tool you use when the answer matters.*

[35](#35-read-the-answers-back-out-of-the-grid-frames) **first — everything else here is blocked on it** — then [36](#36-ship-copy-all-and-export-to-markdown), [37](#37-build-a-consensus-and-disagreement-view), [38](#38-save-comparisons-as-named-reopenable-sessions), [39](#39-turn-recents-into-a-searchable-pinnable-prompt-library), [40](#40-add-a-template-library-with-variables), [41](#41-add-per-service-prefixsuffix-and-a-global-modifier), [42](#42-support-model-variants), [43](#43-add-a-temporary-chat-toggle-and-an-honest-one-line-disclosure), [45](#45-grow-the-provider-list-and-make-adding-one-a-non-developer-task), [46](#46-make-custom-providers-shareable), [47](#47-make-local-and-self-hosted-models-a-headline-feature), [49](#49-add-quick-switch-profiles), [50](#50-replace-the-single-ask-puchne-menu-item-with-a-set-of-one-click-actions), [51](#51-add-regenerate-edit-and-resend-and-a-real-turn-history), [53](#53-let-the-user-crown-a-winner-and-keep-a-local-scoreboard), [54](#54-add-a-ctrlk-command-palette-and-an-omnibox-keyword), [65](#65-add-synchronized-scrolling), [66](#66-show-latency-and-answer-length-badges), [68](#68-bound-the-memory-cost-and-add-suspend), [113](#113-adopt-chromei18n)–[115](#115-fix-rtl--and-ship-dirauto-today), [147](#147-readme-badges-a-gif-and-an-honest-comparison), [153](#153-monetization-rated-honestly)–[156](#156-fill-in-the-manifest-metadata-the-browser-matrix-and-the-managed-deployment-path).

### v2.0 — API mode & beyond
*Goal: for the power user, Puchne stops being fragile — no selector rot, no framing failures, real model selection, real streaming, reproducible comparisons.*

[48](#48-offer-an-optional-bring-your-own-key-api-mode) as the spine, with [37](#37-build-a-consensus-and-disagreement-view) Tier 2 (real LLM synthesis), [52](#52-enable-prompt-chaining-and-judging), [44](#44-send-the-page-screenshot-or-a-selected-image-not-just-text), [55](#55-put-an-ask-the-others-pill-on-ai-pages), [56](#56-pop-the-compose-bar-out-into-a-floating-window), [57](#57-add-voice-input), and the code-quality work that makes a second delivery mode tractable: [129](#129-type-check-the-existing-js-with-no-build-step)–[136](#136-add-error-handling-to-gridjs-and-namespace-the-injected-globals), [139](#139-automate-releases-and-single-source-the-version). Scheduled and recurring prompts become coherent **only here**, where a run can fetch quietly into the sessions store without stealing focus — do not build them in web mode.

---

## Appendix: quick wins

Every S-effort item, one line each.

- [ ] **3** — Verify the fill in `fillProseMirror` and stop returning `true` unconditionally (wrong-prompt bug)
- [ ] **5** — Pass a deadline into `fillAndSubmit` so the content script gives up before the worker does
- [ ] **9** — Compare parsed origins instead of `startsWith`, and prune session tabs on `tabs.onUpdated`
- [ ] **10** — Guard the top-level `class` in `prompt-panel.js`; stamp the load guard with the extension version
- [ ] **15** — Call `resumePendingSend()` from `permissions.onAdded`; move `addToHistory` after the grant
- [ ] **16** — Require *both* conditions in the cookie dismisser (or delete it) and stop the observer on first success
- [ ] **17** — Delete the Page Load Delay setting and its key
- [ ] **18** — Swap the badge `setTimeout` for `chrome.alarms`; remove the leaked listener in `waitForTabLoad`'s timeout branch
- [ ] **19** — Check `navigator.onLine` before `handleMulticast` opens anything
- [ ] **20** — Give `action.onClicked` a real fallback surface on restricted pages
- [ ] **27** — Give `showEmpty` an "Open settings" button and move `initHeaderControls()` above the early return
- [ ] **29** — `structuredClone` the defaults on reset; preserve custom providers unless explicitly ticked
- [ ] **31** — Add a character/token counter under the prompt box; show the recents placeholder on first run
- [ ] **34** — Fix the command description so it names the surface it actually opens
- [ ] **41** — Add `servicePrompts` and apply it in `resolveTargets`
- [ ] **47** — Replace `http://*/*` with `http://localhost/*` + `http://127.0.0.1/*` and add local-model presets
- [ ] **51** — Keep grid prompts in an array; add ↻ resend and ↑/↓ recall to the follow-up bar
- [ ] **57** — Add a mic button to the panel using `SpeechRecognition`
- [ ] **59** — Set `allow` and `sandbox` on the cell iframes before assigning `src`
- [ ] **67** — Delete `will-change` from `.grid-container`; skip the transition above 3 cells; add `contain`
- [ ] **69** — Split "Reset layout" into "Even out" and "Restore all"; persist closed cells
- [ ] **72** — Add `--brand-text` / `--brand-on`; fix the send arrow, the focus rings and `--bg-hover`
- [ ] **79** — Replace `transition: none` on `.chip` with real transitions plus a `:active` scale
- [ ] **82** — Define six z-index tiers; stop the overlay and the follow-up bar sharing the max value
- [ ] **87** — Delete `prompt-panel.js` and `content.js` from `options.html` and `grid.html`
- [ ] **88** — Drop the top-level `setupContextMenus()`; replace `storage.local.get(null)` on startup
- [ ] **91** — Collapse the three promise queues into one `updateStored(area, key, fn)` helper
- [ ] **93** — rAF-coalesce `initResize.onMove` and `initDrag.onMove`
- [ ] **94** — Re-export the service icons at 48/96px (−240 KB, ~55% of the zip)
- [ ] **96** — Scope the login scan to page chrome; extract from `article/main` instead of `body.innerText`
- [ ] **98** — Wire `aria-labelledby`/`aria-describedby` on every options control in one loop
- [ ] **99** — Bail out of the follow-up focus guard within 200ms of a Tab keypress
- [ ] **101** — Set `inert` alongside every `collapsed` class toggle
- [ ] **106** — Give the cell buttons, toast close, spinners and toggles a 24×24 minimum; expand the handle hit areas
- [ ] **107** — Convert the options sidebar to `role="tablist"` with roving tabindex and a non-colour cue
- [ ] **108** — Add `aria-checked` to the mode radios and `aria-pressed` to the tool chips
- [ ] **109** — Make the confirm modal a `<dialog>`; add `role="alert"` to the two error containers
- [ ] **112** — Move `.grid-header` above `.grid-container` in the DOM and restore order with CSS
- [ ] **115** — Add `dir="auto"` to all four text inputs and the history text (do this today)
- [ ] **118** — Drop `password` and `tel` from the selection-capture regex
- [ ] **119** — Reject non-https provider URLs in the add form
- [ ] **122** — Remove `grid.html` and `cookie-dismiss.js` from `web_accessible_resources`; add `use_dynamic_url`
- [ ] **125** — Add one sync-disclosure line near AI Tools; tighten the CSP with `connect-src 'none'`
- [ ] **127** — Add the ten-line no-remote-code CI gate
- [ ] **130** — Add `eslint.config.js` and `.editorconfig` (and skip Prettier)
- [ ] **134** — Route all three history writers through one owner
- [ ] **138** — Add `node_modules/` to the root `.gitignore` **before** adding any tooling
- [ ] **144** — Make `og:image` absolute and add `twitter:*`, `og:url` and `rel=canonical` on all eight pages
- [ ] **145** — Add `sitemap.xml`, `robots.txt`, and the `SoftwareApplication` + `FAQPage` JSON-LD
- [ ] **148** — Add the local `stats` counter and the conditional review ask
- [ ] **149** — Ship local-only counters; use the store dashboard as the activation metric
- [ ] **150** — Add `CHANGELOG.md` and the one-line "What's new" strip after an update
- [ ] **151** — Add the `broken-provider.yml` issue form and label selector issues `good first issue`
- [ ] **155** — Add the pronunciation gloss and `lang="gu"` on the Gujarati spans
