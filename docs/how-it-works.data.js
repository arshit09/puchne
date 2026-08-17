/* ============================================================
 *  Puchne — How It Works : data
 *
 *  Every entry below traces to a file and line in this repo.
 *  Refs are written as "path:line" against Puchne v1.0.6.
 * ============================================================ */

/* ── Lanes (the five contexts + you) ───────────────────────── */
const LANES = [
  { id: "you",     name: "You",             meta: "gesture" },
  { id: "surface", name: "Surface",         meta: "popup · overlay · page" },
  { id: "worker",  name: "Service worker",  meta: "background.js" },
  { id: "content", name: "Content script",  meta: "content.js" },
  { id: "site",    name: "AI site",         meta: "chatgpt · claude…" },
  { id: "storage", name: "Storage",         meta: "sync · local · session" },
];

/* ── Screens ───────────────────────────────────────────────── */
const SCREENS = {
  compose:   { img: "screenshots/popup.png",                 cap: "Compose panel — the in-page overlay" },
  grid:      { img: "screenshots/grid-view.png",             cap: "Grid view — pages/grid.html" },
  ctx:       { img: "screenshots/context-menu.png",          cap: "Ask Puchne — the right-click menu" },
  setTools:  { img: "screenshots/settings-ai-tools.png",     cap: "Settings › AI Tools" },
  setAppear: { img: "screenshots/settings-appearance.png",   cap: "Settings › Appearance" },
  setBehav:  { img: "screenshots/settings-behavior.png",     cap: "Settings › Behavior" },
  setAsk:    { img: "screenshots/settings-ask-puchne.png",   cap: "Settings › Ask Puchne" },
  access:    { mock: "access",   cap: "Access window — pages/permissions.html" },
  followup:  { mock: "followup", cap: "Follow-up bar — injected into every session tab" },
  toast:     { mock: "toast",    cap: "Login toast — scripts/content.js" },
  tabs:      { mock: "tabs",     cap: "New tabs mode — one Chrome tab group" },
  keys:      { mock: "keys",     cap: "Keyboard shortcut" },
  worker:    { mock: "worker",   cap: "Service worker — scripts/background.js" },
  frame:     { mock: "frame",    cap: "Inside the AI site's own composer" },
};

/* ── Mocks for the surfaces with no screenshot ─────────────── */
const ICON = (f) => `../icons/services/${f}`;
const APPICON = "../icons/app/icon-48.png";

const MOCKS = {
  access: () => `
    <div class="mock mock-access">
      <div class="mock-card">
        <div class="hd">
          <img src="${APPICON}" alt="">
          <div>
            <h4>Allow Puchne to use these 2 AI tools?</h4>
            <p class="sub">Puchne asks for one site at a time, only when you use it.</p>
          </div>
        </div>
        <div class="mock-row"><img src="${ICON('copilot.png')}" alt=""><div><div class="n">Copilot</div><div class="h">copilot.microsoft.com</div></div></div>
        <div class="mock-row"><img src="${ICON('grok.svg')}" alt=""><div><div class="n">Grok</div><div class="h">grok.com</div></div></div>
        <p class="sub" style="margin-top:10px">Access lets Puchne open these sites and type your prompt into them.</p>
        <div class="mock-acts">
          <span class="mock-btn">Not now</span>
          <span class="mock-btn pri">Continue</span>
        </div>
      </div>
    </div>`,

  followup: () => `
    <div class="mock">
      <div class="mock-followup">
        <span class="dots">⠿</span>
        <img src="${APPICON}" alt="">
        <span class="ph">Ask a follow-up question to all Active AIs…</span>
        <span class="snd">➤</span>
        <span class="dots">⤡</span>
      </div>
      <p class="muted" style="text-align:center;margin-top:12px;font-size:.76rem">
        Bottom-right by default — bottom-centre sat on top of ChatGPT's own composer.
      </p>
    </div>`,

  toast: () => `
    <div class="mock">
      <div class="mock-toast">
        <img src="${ICON('claude.png')}" alt="">
        <div>
          <div class="tt">Sign in to Claude</div>
          <div class="tx">Puchne can't send prompts here until you're signed in. Log in once and the next multicast will work.</div>
        </div>
        <span class="cl">&times;</span>
      </div>
      <p class="muted" style="text-align:center;margin-top:12px;font-size:.76rem">
        A corner toast, not a modal — it never touches the host page's scroll position.
      </p>
    </div>`,

  tabs: () => `
    <div class="mock mock-tabs">
      <div class="mock-tabstrip">
        <div class="mock-group">
          <span class="glabel">Puchne</span>
          <span class="mock-tab act"><img src="${ICON('chatgpt_light.png')}" alt="">ChatGPT</span>
          <span class="mock-tab"><img src="${ICON('claude.png')}" alt="">Claude</span>
          <span class="mock-tab"><img src="${ICON('gemini.png')}" alt="">Gemini</span>
        </div>
      </div>
      <div style="padding:16px 14px 18px">
        <div class="mock-followup" style="max-width:none">
          <span class="dots">⠿</span>
          <img src="${APPICON}" alt="">
          <span class="ph">Ask a follow-up question to all Active AIs…</span>
          <span class="snd">➤</span>
        </div>
      </div>
    </div>`,

  keys: (a = {}) => `
    <div class="mock mock-keys">
      <div class="row">${(a.keys || ["Ctrl", "Shift", "X"]).map((k) => `<kbd>${k}</kbd>`).join('<span style="color:var(--text-muted)">+</span>')}</div>
      <p class="cap">${a.cap || "on any web page"}</p>
    </div>`,

  worker: (a = {}) => `
    <div class="mock mock-worker">
      <div class="wh"><span class="dot"></span> service worker — scripts/background.js</div>
      <div class="wb">${(a.lines || []).map((l) =>
        l.startsWith("//") ? `<div class="cm">${l}</div>`
                           : `<div><span class="fn">›</span> ${l}</div>`).join("")}</div>
    </div>`,

  frame: (a = {}) => `
    <div class="mock mock-frame">
      <div class="fh"><img src="${ICON(a.icon || 'claude.png')}" alt="">${a.name || "Claude"}</div>
      <div class="fb">
        <div class="composer">
          <span class="txt">${a.text || ""}<span class="cursor"></span></span>
          <span class="sendbtn">${a.sent ? "✓" : "➤"}</span>
        </div>
      </div>
    </div>`,
};

/* ── Screens gallery ───────────────────────────────────────── */
const GALLERY = [
  {
    screen: "compose", short: "The box you type in. One component, three hosts.", title: "Compose panel",
    body: "The box you actually type in. One class — <b>PuchnePromptPanel</b> — rendered into three different hosts: the toolbar popup, the Chrome side panel, and this floating overlay on any page. Chips toggle tools; a padlocked chip means that site hasn't been allowed yet, and clicking it asks instead of switching on.",
    files: ["scripts/prompt-panel.js", "pages/popup.html", "styles/panel.css"], acc: "shared by 3 surfaces",
  },
  {
    screen: "grid", short: "Every tool tiled in one tab.", title: "Grid view",
    body: "The default answer surface. One tab, every tool tiled as an iframe, all showing the same prompt. Drag a header to swap cells, drag an edge to resize, double-click to maximise, hover to expand, <b>Alt+1…9</b> to jump. The follow-up box in the footer re-sends to every frame.",
    files: ["pages/grid.html", "pages/grid.js", "rules/grid_headers.json"], acc: "default: on",
  },
  {
    screen: "tabs", short: "A real tab per tool, in one group.", title: "New tabs mode",
    body: "The alternative to the grid: a real browser tab per tool, optionally collected into one Chrome tab group titled “Puchne”. Chosen when Settings › Behavior › Grid view is switched off. Each tab gets the follow-up bar injected into it.",
    files: ["scripts/background.js", "scripts/content.js"], acc: "gridView: false",
  },
  {
    screen: "followup", short: "One question, every tool already open.", title: "Follow-up bar",
    body: "A draggable, collapsible pill injected into every tab of an active session. Typing here sends one question to all of them at once. Its position is remembered per website, and it collapses to a small pill in place rather than sending you to settings to hide it.",
    files: ["scripts/content.js"], acc: "PuchneFollowUpBar",
  },
  {
    screen: "ctx", short: "Select, right-click, ask.", title: "Ask Puchne (right-click)",
    body: "Select text anywhere, right-click, and the menu item is there — same as <b>Ctrl+Shift+S</b>. With no selection it grabs the page title, URL and the first 2 500 characters of text instead. Settings decides whether it opens the panel first or fires straight off.",
    files: ["scripts/background.js"], acc: "contextMenus + commands",
  },
  {
    screen: "access", short: "The only place Chrome lets Puchne ask.", title: "Access window",
    body: "A 480×620 popup that exists for exactly one reason: Chrome only accepts <b>permissions.request()</b> from an extension page, inside a real user gesture, with nothing awaited first. The worker, the overlay and the popup can't all satisfy that — so every ask routes through here.",
    files: ["pages/permissions.html", "pages/permissions-page.js"], acc: "the only legal asker",
  },
  {
    screen: "setTools", short: "Toggle, grant, override, or add your own.", title: "Settings › AI Tools",
    body: "Switch tools on and off, grant or withdraw one site, override the CSS selectors Puchne types into (with a one-click Test that opens a hidden tab and reports back), or add a tool that isn't on the list — Mistral, Qwen, Kimi, a self-hosted UI.",
    files: ["pages/options.html", "pages/options.js"], acc: "section-tools",
  },
  {
    screen: "setAppear", short: "Theme, placement, labels.", title: "Settings › Appearance",
    body: "Theme (system / light / dark), where the overlay sits on the page, whether to dock as a Chrome side panel, how chips are labelled, and whether recent prompts are kept. A live preview updates as you change them.",
    files: ["pages/options.html"], acc: "section-appearance",
  },
  {
    screen: "setBehav", short: "Grid or tabs — and everything around the send.", title: "Settings › Behavior",
    body: "The big fork: grid view or new tabs. Plus auto-submit, tab grouping, the follow-up bar, hover-to-expand and its dwell delay, cookie-banner handling, and how long to wait before typing.",
    files: ["pages/options.html"], acc: "section-behavior",
  },
  {
    screen: "setAsk", short: "Panel first, or straight out.", title: "Settings › Ask Puchne",
    body: "Whether the right-click menu and <b>Ctrl+Shift+S</b> show you the prompt first or send it immediately, and which tools that send reaches — everything currently enabled, or a fixed set you pick here.",
    files: ["pages/options.html"], acc: "askAction · askTargetMode",
  },
  {
    screen: "toast", short: "This site needs a sign-in first.", title: "Login toast",
    body: "Shown only in tabs Puchne opened itself, and only when the composer never appears within 5 seconds <i>and</i> a sign-in marker is on the page. Deliberately a corner toast: the previous full-screen version overwrote the host page's own <code>body.overflow</code>.",
    files: ["scripts/content.js"], acc: "PuchneLoginToast",
  },
];

/* ── Flows ─────────────────────────────────────────────────── */
const FLOWS = [
  {
    id: "send",
    name: "Send a prompt",
    meta: "grid view · first use",
    blurb: "The full path, from keystroke to a typed-and-submitted prompt in three iframes — including the permission detour the very first time.",
    steps: [
      {
        t: "You press Ctrl+Shift+X",
        say: "The shortcut is bound in the manifest to <b>_execute_action</b>, so Chrome treats it as identical to clicking the toolbar icon. Either way the worker's <b>action.onClicked</b> listener fires.",
        from: "you", to: "worker", screen: "keys",
        mockArgs: { keys: ["Ctrl", "Shift", "X"], cap: "…or click the Puchne toolbar icon" },
        api: "chrome.commands → _execute_action → chrome.action.onClicked",
        ref: "manifest.json:55 · scripts/background.js:701",
        note: "If <b>Dock as sidebar</b> is on, the worker has already called <code>sidePanel.setPanelBehavior({openPanelOnActionClick:true})</code> — Chrome then opens the side panel itself and <code>onClicked</code> never fires at all.",
      },
      {
        t: "Worker tells the page to open the overlay",
        say: "The worker can't draw anything. It messages the content script sitting in the active tab's top frame and asks it to toggle the overlay.",
        from: "worker", to: "content", screen: "worker",
        mockArgs: { lines: ["// chrome.action.onClicked", "skip chrome:// edge:// about: URLs", "tabs.sendMessage(tab.id, …, {frameId: 0})"] },
        api: 'chrome.tabs.sendMessage(tab.id, { action: "toggleOverlay" }, { frameId: 0 })',
        payload: '{ action: "toggleOverlay" }',
        ref: "scripts/background.js:701-728",
        note: 'If that throws <code>"Could not establish connection"</code> — no content script in this tab yet — the worker injects the four content-script files with <code>chrome.scripting.executeScript</code> and sends the message again.',
      },
      {
        t: "The overlay mounts, sealed off from the page",
        say: "The panel is built inside a <b>closed</b> shadow root at the maximum z-index. The host page's CSS can't style it, and the host page's JavaScript can't reach into it — which matters when the host page is an AI chat site with opinions about focus.",
        from: "content", to: "content", screen: "compose",
        focus: { x: 15.4, y: 28.6, w: 69.3, h: 55.2 },
        api: 'container.attachShadow({ mode: "closed" }) → shadow.adoptedStyleSheets = [panel.css, overlay.css]',
        ref: "scripts/content.js:213-276",
        note: "Both stylesheets are fetched and parsed once per page, then shared by every shadow root that adopts them.",
      },
      {
        t: "Panel asks the worker which tools exist",
        say: "The registry lives in the worker, so the panel requests it rather than importing it. What comes back is the seven built-ins plus anything you added yourself.",
        from: "surface", to: "worker", screen: "compose",
        focus: { x: 17.9, y: 44.7, w: 64.4, h: 6.1 },
        api: 'chrome.runtime.sendMessage({ action: "getServices" })',
        payload: '// response\n{ services: [ ...AI_SERVICES, ...settings.customProviders ] }',
        ref: "scripts/prompt-panel.js:96 · scripts/background.js:947",
      },
      {
        t: "…and which of those sites are actually allowed",
        say: "Enabled and allowed are two different things. A tool you switched on but never granted renders as a padlocked chip.",
        from: "surface", to: "worker", screen: "compose",
        focus: { x: 17.9, y: 44.7, w: 64.4, h: 6.1 },
        api: 'chrome.runtime.sendMessage({ action: "getPermissionState" }) → worker calls chrome.permissions.getAll()',
        payload: '// response\n{ grantedOrigins: ["https://chatgpt.com/*", …],\n  grantedIds:     ["chatgpt", "claude", "gemini"] }',
        ref: "scripts/prompt-panel.js:111 · scripts/background.js:955",
        note: "This is a message and not a direct call because <code>chrome.permissions</code> simply does not exist in a content script.",
      },
      {
        t: "Panel reads your settings and your recents",
        say: "Two storage reads paint the rest of the panel: which tools are on and in what order, the theme, chip style — and the list of prompts you've sent before.",
        from: "surface", to: "storage", screen: "compose",
        api: 'chrome.storage.sync.get("settings") · chrome.storage.local.get("promptHistory")',
        store: [
          { area: "sync", key: "settings", op: "read", shape: "{ enabledServices, serviceOrder, theme, chipDisplay, gridView, autoSubmit, … }" },
          { area: "local", key: "promptHistory", op: "read", shape: "[{ text, timestamp }] — newest first, capped at historyLimit (20)" },
        ],
        ref: "scripts/prompt-panel.js:190-239",
      },
      {
        t: "You type a prompt and press Enter",
        say: "Enter sends, Shift+Enter adds a newline. Every key event on this box is stopped from propagating — otherwise the AI site underneath, which has its own Enter handler, would also react.",
        from: "you", to: "surface", screen: "compose",
        focus: { x: 17.9, y: 56.7, w: 64.4, h: 16.2 },
        api: "keydown / keyup / keypress / paste → e.stopPropagation()",
        ref: "scripts/prompt-panel.js:342-359",
        note: "<b>paste</b> is stopped too, and that was a real bug: AI chat sites attach a document-level paste listener to catch images pasted anywhere, don't check whether the paste landed in <i>their</i> input, and call <code>preventDefault()</code> — swallowing pastes into this box.",
      },
      {
        t: "Two of the chosen tools have never been allowed",
        say: "Rather than queue up a send that can only fail, the panel saves what it can, records the prompt in your recents, and hands the ask off — passing the prompt along so it isn't lost.",
        from: "surface", to: "worker", screen: "compose",
        focus: { x: 77.5, y: 65, w: 3.9, h: 6.6 },
        api: 'chrome.runtime.sendMessage({ action: "requestServiceAccess", serviceIds, pendingSend: { query } })',
        store: [
          { area: "sync", key: "settings", op: "write", shape: "enabledServices: [...], serviceOrder: [...] — merged in, other keys untouched" },
          { area: "local", key: "promptHistory", op: "write", shape: "unshift({ text, timestamp }), de-duplicated, sliced to the limit" },
        ],
        ref: "scripts/prompt-panel.js:618-643",
        note: "The prompt deliberately stays in the box: you might decline, and this surface may not even exist by the time the answer comes back.",
      },
      {
        t: "Worker parks the send and opens the access window",
        say: "The prompt is stashed in session storage with a timestamp, then a small popup window opens to do the actual asking.",
        from: "worker", to: "surface", screen: "worker",
        mockArgs: { lines: ["// openAccessWindow(ids, pendingSend)", "storage.session.set({ pendingSend })", 'windows.create({ url: "pages/permissions.html?ids=copilot,grok" })'] },
        api: 'chrome.windows.create({ url: "pages/permissions.html?ids=…", type: "popup", width: 480, height: 620 })',
        store: [{ area: "session", key: "pendingSend", op: "write", shape: "{ query, serviceIds, targetIds, at: Date.now() }" }],
        ref: "scripts/background.js:370-401",
        note: "An already-open access window is re-used and re-pointed rather than stacking a second one on top.",
      },
      {
        t: "You click Continue",
        say: "This window exists solely so this one line can run legally. Chrome refuses <b>permissions.request()</b> unless it is called from an extension page, during a real click, with nothing awaited beforehand.",
        from: "you", to: "surface", screen: "access",
        api: 'chrome.permissions.request({ origins: ["https://copilot.microsoft.com/*", "https://grok.com/*"] })',
        ref: "pages/permissions-page.js:97-124",
        note: "The services and origins are resolved <i>before</i> the click, on page load — awaiting anything inside the handler would spend the user gesture and Chrome would reject the request outright.",
      },
      {
        t: "The grant lands — three things get republished",
        say: "A grant changes what Puchne can do, so everything derived from it is rebuilt: the mirror content scripts read, the content script registered on allowed hosts, and any already-open tab that just became reachable.",
        from: "worker", to: "storage", screen: "worker",
        mockArgs: { lines: ["// handleAccessGranted → syncHostAccess()", "permissions.getAll()", "storage.local.set({ grantedOrigins })", "scripting.updateContentScripts([puchne-service-hosts])", "scripting.executeScript → back-fill open tabs"] },
        api: 'chrome.scripting.registerContentScripts([{ id: "puchne-service-hosts", matches, js: [4 files], runAt: "document_idle" }])',
        store: [
          { area: "local", key: "grantedOrigins", op: "write", shape: '["https://chatgpt.com/*", "https://claude.ai/*", …] — the mirror content scripts read' },
          { area: "sync", key: "settings", op: "write", shape: "enabledServices — asking for a site counts as intent to use it" },
        ],
        ref: "scripts/background.js:269-326 · 408-427",
        note: "There is no static <code>content_scripts</code> block in the manifest at all. This single dynamic registration, rewritten on every change, is what puts the follow-up bar on an allowed AI page.",
      },
      {
        t: "The parked send is released",
        say: "The prompt you typed before the interruption is read back, deleted, and sent — unless it has gone stale.",
        from: "worker", to: "worker", screen: "worker",
        mockArgs: { lines: ["// resumePendingSend()", "storage.session.get(pendingSend)", "storage.session.remove(pendingSend)", "if (age > 5 min) → drop it", "handleMulticast(query, targetIds)"] },
        api: "resumePendingSend() → handleMulticast(query, targetIds)",
        store: [{ area: "session", key: "pendingSend", op: "delete", shape: "read once, then removed — dropped entirely if older than 5 minutes" }],
        ref: "scripts/background.js:434-449",
        note: "By five minutes you have moved on, and firing a forgotten prompt at six tabs is worse than losing it.",
      },
      {
        t: "Worker resolves what to actually send to",
        say: "The registry entry for each tool is merged with any selector you overrode in Settings, then split into what Puchne may drive and what it may not.",
        from: "worker", to: "worker", screen: "worker",
        mockArgs: { lines: ["// handleMulticast(query, ids)", "resolveTargets(settings, ids)", "  ← merges settings.customSelectors[id]", "partitionTargets(targets)", "  → { allowed, blocked }"] },
        api: "resolveTargets(settings, ids) → partitionTargets(targets)",
        ref: "scripts/background.js:208-221 · 1328-1350",
        note: "Blocked services are recorded as failed rather than silently dropped — this is the path a permission revoked <i>between</i> composing and sending takes.",
      },
      {
        t: "Grid view is on, so one tab opens",
        say: "A single extension page, <b>pages/grid.html</b>, that will host every tool as an iframe.",
        from: "worker", to: "surface", screen: "worker",
        mockArgs: { lines: ["// settings.gridView === true", 'tabs.create({ url: runtime.getURL("pages/grid.html"), active: true })', "  → tab 42"] },
        api: 'chrome.tabs.create({ url: chrome.runtime.getURL("pages/grid.html"), active: true })',
        ref: "scripts/background.js:1353-1356",
      },
      {
        t: "The grid's payload is written, keyed by tab id",
        say: "The new tab can't be handed an object directly, so the worker writes everything it needs into local storage under that tab's own id, then starts a status record for its own bookkeeping.",
        from: "worker", to: "storage", screen: "worker",
        mockArgs: { lines: ["storage.local.set({ gridData_42: { … } })", "storage.session.set({ sendStatus: { … } })"] },
        api: 'chrome.storage.local.set({ ["gridData_" + gridTab.id]: { … } })',
        store: [
          { area: "local", key: "gridData_42", op: "write", shape: "{ query, autoSubmit, cookieConsent, delayMs,\n  targets: [{ id, name, url, inputType, selector,\n              submitType, buttonSel, waitMs, iconPath, iconPathDark }] }" },
          { area: "session", key: "sendStatus", op: "write", shape: '{ id, query, mode: "grid", gridTabId: 42, startedAt,\n  services: [{ id, name, url, status: "pending" }] }' },
        ],
        ref: "scripts/background.js:1356-1380",
        note: "Keyed by tab id so reloading the grid re-renders the same layout. The key is deleted in <code>chrome.tabs.onRemoved</code>, and any survivors are swept on the next browser start.",
      },
      {
        t: "Grid page wakes up and finds its payload",
        say: "The page asks Chrome which tab it is, then reads its own key. On a cold open the worker may not have written it yet — so instead of giving up, it waits.",
        from: "surface", to: "storage", screen: "grid",
        focus: { x: 0, y: 10.5, w: 100, h: 4 },
        api: "chrome.tabs.getCurrent() → readGridData(tabId)",
        store: [
          { area: "local", key: "gridData_42", op: "read", shape: "waits up to 5 s on chrome.storage.onChanged if the key hasn't landed yet" },
          { area: "local", key: "gridLayout", op: "read", shape: "{ cols, rows, colFracs, rowFracs, cellOrder } — reused only if the dimensions still match" },
        ],
        ref: "pages/grid.js:1135-1152 · 1234-1248",
      },
      {
        t: "Cells are built and the iframes navigate, staggered",
        say: "Booting seven single-page apps in the same instant is the jankiest moment in the whole product, so each iframe's navigation is held back 200 ms behind the last. Each cell then has 12 seconds to load before it gives up and shows an error.",
        from: "surface", to: "site", screen: "grid",
        focus: { x: 0.3, y: 11.1, w: 33, h: 82.4 },
        api: "createCell(service, { delay: i * GRID_STAGGER_MS }) → iframe.src = service.url",
        ref: "pages/grid.js:871-1005",
      },
      {
        t: "Frame-blocking headers are stripped on the way in",
        say: "Every one of these sites sends headers that forbid being embedded. Eight static declarativeNetRequest rules remove them — but only on sub-frame requests, and only for hosts you have granted.",
        from: "site", to: "surface", screen: "grid",
        api: "declarativeNetRequest — modifyHeaders: remove X-Frame-Options, Content-Security-Policy",
        payload: '{ "condition": { "urlFilter": "||claude.ai", "resourceTypes": ["sub_frame"] },\n  "action": { "type": "modifyHeaders", "responseHeaders": [\n    { "header": "X-Frame-Options", "operation": "remove" },\n    { "header": "Content-Security-Policy", "operation": "remove" } ] } }',
        ref: "rules/grid_headers.json · manifest.json:23",
        note: "The permission is <code>declarativeNetRequestWithHostAccess</code>, so a rule is inert on any site you haven't allowed. Nothing else about the response is touched, and no request body is ever read.",
      },
      {
        t: "Grid asks the worker to inject into the frames that made it",
        say: "The page can't reach inside a cross-origin iframe, and it can't inject scripts. It reports which cells loaded and which didn't, and lets the worker do the rest.",
        from: "surface", to: "worker", screen: "grid",
        api: 'chrome.runtime.sendMessage({ action: "injectGridQueries", … })',
        payload: '{ action: "injectGridQueries",\n  tabId: 42,\n  targets: [ …services whose iframe loaded… ],\n  query: "Explain quantum computing like I\'m 12 …",\n  autoSubmit: true,\n  cookieConsent: "accept",\n  delayMs: 2000,\n  failedIds: ["perplexity"] }',
        ref: "pages/grid.js:1278-1296",
      },
      {
        t: "Worker locates each service's sub-frame by id",
        say: "It enumerates every frame in the grid tab and picks the one whose URL starts with that service's origin. Cookie banners get dismissed first, because an iframe inside an extension page gets its own partitioned cookie jar — consent you gave in normal browsing doesn't carry over.",
        from: "worker", to: "content", screen: "worker",
        mockArgs: { lines: ["// injectIntoGridFrame(tabId, target, query, opts)", "webNavigation.getAllFrames({ tabId: 42 })", "  → frameId 7  (https://claude.ai/…)", "scripting.executeScript → cookie-dismiss.js", "scripting.executeScript → 4 content-script files"] },
        api: "chrome.webNavigation.getAllFrames({ tabId }) → chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] } })",
        ref: "scripts/background.js:1194-1229",
        note: "cookie-dismiss.js retries 10 times at 800 ms and also watches for banners injected later — it clicks accept or reject depending on Settings › Behavior.",
      },
      {
        t: "fillQuery reaches the content script inside the frame",
        say: "One message carries everything needed to drive that specific site: the prompt, the selectors, how to type, and how to submit.",
        from: "worker", to: "content", screen: "frame",
        mockArgs: { name: "Claude", icon: "claude.png", text: "" },
        api: "chrome.tabs.sendMessage(tabId, { action: 'fillQuery', … }, { frameId })",
        payload: '{ action: "fillQuery",\n  query: "Explain quantum computing like I\'m 12 …",\n  autoSubmit: true,\n  waitMs: 2000,\n  inputType: "prosemirror",\n  selector: \'div.ProseMirror[contenteditable="true"], …\',\n  submitType: "button",\n  buttonSel: \'button[aria-label="Send message"], …\' }',
        ref: "scripts/background.js:1230-1255",
        note: "The worker arms a 15 second timeout on this message. If the frame never answers, the service is recorded as failed rather than hanging the whole send.",
      },
      {
        t: "The content script hunts for the prompt box",
        say: "A MutationObserver resolves the instant the editor mounts, backed by a once-a-second poll for up to 30 seconds. If the site's own selector finds nothing — a redesign — it falls back to generic patterns for that input type.",
        from: "content", to: "site", screen: "frame",
        mockArgs: { name: "Claude", icon: "claude.png", text: "" },
        api: "waitForElement(selector) — MutationObserver + 1 s poll × 30, then GENERIC_INPUT_FALLBACKS",
        ref: "scripts/content.js:458-493 · 804-854",
        note: "<b>A genuine gotcha:</b> Settings shows a “delay before typing” of 2000 ms, but the content script applies <code>Math.min(waitMs, SETTLE_CAP_MS)</code> — capped at <b>300 ms</b>. The observer is what actually does the waiting; the setting only sizes the settle window <i>after</i> the editor is found.",
      },
      {
        t: "It types the prompt in a way the framework notices",
        say: "Setting <code>.value</code> is not enough — these are React and ProseMirror editors that ignore anything they didn't cause themselves. Three strategies, chosen by the registry's <b>inputType</b>.",
        from: "content", to: "site", screen: "frame",
        mockArgs: { name: "Claude", icon: "claude.png", text: "Explain quantum computing like I'm 12 — one analogy, no jargon." },
        api: "fillTextarea · fillContentEditable · fillProseMirror",
        payload: '// textarea        → the native value setter, then input + change\n// contenteditable → a text node, then beforeinput + input + textInput\n// prosemirror     → an InputEvent carrying a DataTransfer,\n//                   inputType: "insertFromPaste"',
        ref: "scripts/content.js:557-696",
      },
      {
        t: "It presses send",
        say: "For button-submit sites it retries the click six times, 300 ms apart, because most of them only enable the send button a beat after they notice input. Only if the button never becomes clickable does it fall back to a synthetic Enter — otherwise the prompt would go twice.",
        from: "content", to: "site", screen: "frame",
        mockArgs: { name: "Claude", icon: "claude.png", text: "Explain quantum computing like I'm 12 — one analogy, no jargon.", sent: true },
        api: "clickSubmitButton(buttonSel) — 6 attempts × 300 ms → else pressEnter(el)",
        ref: "scripts/content.js:706-785",
      },
      {
        t: "The result comes back and is recorded",
        say: "Each service's outcome is patched into the session status record — filled but not submitted, submitted, or failed with a human-readable reason.",
        from: "content", to: "storage", screen: "worker",
        mockArgs: { lines: ["// stateFromResult(response) → markService(id, patch)", "{ ok: true, filled: true, submitted: true }", '  → status: "submitted"'] },
        api: "stateFromResult(result) → markService(serviceId, patch)",
        store: [{ area: "session", key: "sendStatus", op: "write", shape: 'services[i] = { …, status: "submitted", error: null, needsPermission: false }' }],
        ref: "scripts/background.js:518-531 · 1105-1110",
        note: "<b>Nothing in the UI renders sendStatus today.</b> It exists so the worker can re-run a single service (<code>retryService</code>) and so the toolbar badge knows whether anything failed. The delivery list that used to show it has been removed.",
      },
    ],
  },

  {
    id: "tabsmode",
    name: "New tabs mode",
    meta: "gridView: false",
    blurb: "The other half of the send: real browser tabs instead of iframes, a tab group, a login check, and the follow-up bar getting mounted.",
    steps: [
      {
        t: "Grid view is switched off",
        say: "One checkbox in Settings › Behavior decides which of two completely different code paths <b>handleMulticast</b> takes.",
        from: "you", to: "storage", screen: "setBehav",
        api: "settings.gridView === false",
        store: [{ area: "sync", key: "settings", op: "write", shape: "gridView: false" }],
        ref: "pages/options.js:1428 · scripts/background.js:1353",
      },
      {
        t: "One tab per service, all at once",
        say: "Opened in parallel and in the background, so the browser starts all of them loading rather than one after another.",
        from: "worker", to: "site", screen: "worker",
        mockArgs: { lines: ["// handleMulticast — tabs branch", "Promise.all(targets.map(s =>", "  tabs.create({ url: s.url, active: false })", "))"] },
        api: "Promise.all(targets.map(s => chrome.tabs.create({ url: s.url, active: false })))",
        ref: "scripts/background.js:1389-1395",
      },
      {
        t: "The session is recorded — in session storage, on purpose",
        say: "Which tool landed in which tab. This is what makes follow-ups possible, and it must not survive a browser restart.",
        from: "worker", to: "storage", screen: "worker",
        mockArgs: { lines: ["storage.session.set({ activeSessionTabs })", "// NOT storage.local — see the note"] },
        api: "chrome.storage.session.set({ activeSessionTabs })",
        store: [{ area: "session", key: "activeSessionTabs", op: "write", shape: "[{ tabId: 88, target: { id, name, url, selector, … } }, …]" }],
        ref: "scripts/background.js:1400-1401",
        note: "Tab ids are recycled after a restart. A persisted list would attach the follow-up bar to whatever unrelated tab inherited the number.",
      },
      {
        t: "Optionally, they're gathered into one tab group",
        say: "If Settings › Behavior › Group tabs is on, Chrome bundles them under a blue group labelled “Puchne”.",
        from: "worker", to: "site", screen: "tabs",
        api: 'chrome.tabs.group({ tabIds }) → chrome.tabGroups.update(groupId, { title: "Puchne", color: "blue", collapsed: false })',
        ref: "scripts/background.js:1404-1416",
      },
      {
        t: "The first tab is activated immediately",
        say: "Before any injection has finished — so you can see that something is happening rather than staring at the page you were on.",
        from: "worker", to: "you", screen: "tabs",
        api: "chrome.tabs.update(tabs[0].id, { active: true })",
        ref: "scripts/background.js:1423",
      },
      {
        t: "Each tab is waited for, then injected",
        say: "Per tab and in parallel: wait for the load to complete (10 s cap), make sure the content script is present, trigger a login check, then send the same <b>fillQuery</b> message the grid path uses.",
        from: "worker", to: "content", screen: "worker",
        mockArgs: { lines: ["// per tab, in parallel", "waitForTabLoad(tabId)        // 10 s cap", "ensureContentScript(tabId)", 'tabs.sendMessage(… "checkLogin")', "injectQuery(tabId, service, …)  // 15 s cap"] },
        api: "waitForTabLoad → ensureContentScript → checkLogin → injectQuery",
        ref: "scripts/background.js:1426-1441",
      },
      {
        t: "If a site wants a login, a toast says so",
        say: "The check is deliberately conservative: it only fires when the composer <i>never</i> appears within 5 seconds and a sign-in marker is visible on the page. And it only runs in tabs Puchne opened itself.",
        from: "content", to: "you", screen: "toast",
        api: "initLoginCheck() → PuchneLoginToast",
        ref: "scripts/content.js:951-1017",
        note: "Dismisses itself after 12 seconds, pauses that timer while you hover it, and is a fixed-position corner card that never touches the host page's layout or scroll.",
      },
      {
        t: "Every session tab grows a follow-up bar",
        say: "The content script checks session storage directly first — that read is served by the browser process, so an ordinary page load outside a session costs nothing and doesn't wake the worker. Only if a session looks live does it ask the worker, which alone knows this tab's id.",
        from: "content", to: "worker", screen: "followup",
        api: 'chrome.storage.session.get("activeSessionTabs") → chrome.runtime.sendMessage({ action: "amIInActiveSession" })',
        store: [
          { area: "session", key: "activeSessionTabs", op: "read", shape: "cheap local check first — avoids waking the service worker" },
          { area: "local", key: "followUpBar", op: "read", shape: '{ "https://claude.ai": { left, top, collapsed } } — placement remembered per origin' },
        ],
        ref: "scripts/content.js:1465-1487",
        note: "The bar defaults to the bottom <b>right</b>. Bottom-centre sat directly on top of ChatGPT's and Claude's own composers. Anything dragged off-screen is clamped back into view on resize.",
      },
      {
        t: "Failures raise the toolbar badge",
        say: "If any service failed, a red “!” appears on the extension icon for ten seconds. That is the only failure surface the product currently has.",
        from: "worker", to: "you", screen: "worker",
        mockArgs: { lines: ["const failures = results.filter(…)", 'action.setBadgeText({ text: "!" })', 'action.setBadgeBackgroundColor({ color: "#e74c3c" })', "setTimeout(clear, 10_000)"] },
        api: 'chrome.action.setBadgeText({ text: "!" })',
        ref: "scripts/background.js:1448-1458",
        note: "Only the tabs path and the follow-up path set the badge. The grid path never does.",
      },
      {
        t: "Closing a tab cleans up after itself",
        say: "Each close prunes that tab out of the session list and drops any grid payload it owned. Closing a whole tab group fires this many times in a row, so the read-modify-write is serialised through one queue.",
        from: "you", to: "storage", screen: "worker",
        mockArgs: { lines: ["// chrome.tabs.onRemoved", "storage.local.remove(`gridData_${tabId}`)", "pruneSessionTab(tabId)"] },
        api: "chrome.tabs.onRemoved → pruneSessionTab(tabId)",
        store: [
          { area: "session", key: "activeSessionTabs", op: "write", shape: "filtered; the key is removed entirely once the last session tab closes" },
          { area: "local", key: "gridData_<tabId>", op: "delete", shape: "deleted with the tab" },
        ],
        ref: "scripts/background.js:652-695",
      },
    ],
  },

  {
    id: "followup",
    name: "Send a follow-up",
    meta: "one box → every open tool",
    blurb: "Keep going without retyping. Two implementations of the same idea — one for tabs, one for the grid.",
    steps: [
      {
        t: "You type into the bar and hit send",
        say: "The bar carries a snapshot of the session it was mounted with, and passes it along.",
        from: "you", to: "worker", screen: "followup",
        api: 'chrome.runtime.sendMessage({ action: "followUpMulticast", query, tabs })',
        payload: '{ action: "followUpMulticast",\n  query: "Now give me the version for a physicist.",\n  tabs: [{ tabId: 88, target: {…} }, …] }',
        ref: "scripts/content.js:1380-1401",
      },
      {
        t: "The worker prefers its own list over yours",
        say: "The sender's list is a snapshot taken when its page loaded. The stored list is pruned every time a tab closes — so if the two disagree, the stored one wins.",
        from: "worker", to: "storage", screen: "worker",
        mockArgs: { lines: ["const { activeSessionTabs } = await storage.session.get(…)", "const sessionTabs = activeSessionTabs?.length", "  ? activeSessionTabs", "  : tabsFromSender"] },
        api: 'chrome.storage.session.get("activeSessionTabs")',
        store: [{ area: "session", key: "activeSessionTabs", op: "read", shape: "the authoritative list — kept pruned by chrome.tabs.onRemoved" }],
        ref: "scripts/background.js:1570-1581",
      },
      {
        t: "A follow-up gets its own status record",
        say: "It is a new send, not a continuation, so the previous record is replaced rather than patched.",
        from: "worker", to: "storage", screen: "worker",
        mockArgs: { lines: ['startSendStatus(query, targets, "tabs")'] },
        api: "startSendStatus(query, sessionTabs.map(t => t.target), 'tabs')",
        store: [{ area: "session", key: "sendStatus", op: "write", shape: '{ id, query, mode: "tabs", startedAt, services: [ …all pending… ] }' }],
        ref: "scripts/background.js:1584",
      },
      {
        t: "Access is re-checked, because a session outlives it",
        say: "You can revoke a site in Settings while its tab is still sitting open. The tab stays there; it just stops being injectable.",
        from: "worker", to: "worker", screen: "worker",
        mockArgs: { lines: ["const granted = await grantedOrigins()", "activeTabs = sessionTabs.filter(t =>", "  isServiceGranted(t.target, granted))", "markBlocked(the rest)"] },
        api: "grantedOrigins() → isServiceGranted(target, granted)",
        ref: "scripts/background.js:1586-1596",
      },
      {
        t: "Injected with no wait at all",
        say: "The tabs are already loaded and hydrated, so the settle window is zero. Everything else is the same <b>fillQuery</b> path as the first send.",
        from: "worker", to: "content", screen: "frame",
        mockArgs: { name: "Claude", icon: "claude.png", text: "Now give me the version for a physicist.", sent: true },
        api: "injectQuery(tabId, target, query, autoSubmit, /* waitMs */ 0)",
        ref: "scripts/background.js:1609",
      },
      {
        t: "In the grid, it's the header box instead",
        say: "Same idea, different plumbing: the grid's own footer form re-posts <b>injectGridQueries</b> for the cells that loaded, with cookie handling off (already dealt with) and no delay.",
        from: "surface", to: "worker", screen: "grid",
        focus: { x: 26.6, y: 95.4, w: 37.5, h: 4.2 },
        api: 'chrome.runtime.sendMessage({ action: "injectGridQueries", followUp: true, cookieConsent: "off", delayMs: 0, … })',
        ref: "pages/grid.js:1298-1341",
        note: "There is a focus guard around this box: injecting a prompt focuses the editor inside each iframe, which would otherwise steal the caret out from under you mid-sentence.",
      },
      {
        t: "Re-opening a closed cell replays the last prompt",
        say: "Close a cell and it goes into the “Closed” menu. Bring it back and the grid re-sends the prompt into it, so you get its answer rather than a blank chat.",
        from: "surface", to: "worker", screen: "grid",
        api: "reopenService(service) → mountService → injectRestored(loadPromise)",
        ref: "pages/grid.js:1056-1094",
      },
    ],
  },

  {
    id: "ask",
    name: "Ask Puchne",
    meta: "right-click · Ctrl+Shift+S",
    blurb: "Selection or whole page, straight into the prompt box — or straight out to your tools, depending on one setting.",
    steps: [
      {
        t: "You select text and right-click",
        say: "Two menu items are registered: one for selections, one for the page or a frame with nothing selected.",
        from: "you", to: "worker", screen: "ctx",
        focus: { x: 26.4, y: 65, w: 22, h: 4.8 },
        api: 'chrome.contextMenus.create({ id: "puchne-ask-selection", contexts: ["selection"] })',
        ref: "scripts/background.js:732-751",
        note: "The same handler is reached from <kbd>Ctrl+Shift+S</kbd> via <code>chrome.commands.onCommand</code>. Both funnel into <code>handleAskPuchne</code>.",
      },
      {
        t: "With nothing selected, it reads the page instead",
        say: "The worker asks the content script for context and builds a prompt around it. Page text is squashed to single spaces and cut at 2 500 characters.",
        from: "worker", to: "content", screen: "ctx",
        focus: { x: 22.6, y: 44.2, w: 53, h: 6.9 },
        api: 'chrome.tabs.sendMessage(tabId, { action: "getSelectionOrPage" }, { frameId })',
        payload: '// response\n{ selectionText, title, url,\n  text: document.body.innerText.replace(/\\s+/g," ").slice(0, 2500) }\n\n// becomes\n"About this page (Title - URL):\\n\\n<text>\\n\\n' +
          'Can you summarize and explain key points from this page?"',
        ref: "scripts/content.js:75-85 · scripts/background.js:753-771",
      },
      {
        t: "One setting decides what happens next",
        say: "<b>Panel</b> opens the compose box with the text already in it, so you can edit before sending. <b>Direct</b> skips the panel entirely and sends immediately.",
        from: "worker", to: "storage", screen: "setAsk",
        api: 'settings.askAction — "panel" | "direct"',
        store: [{ area: "sync", key: "settings", op: "read", shape: 'askAction: "panel", askTargetMode: "enabled" | "custom", askTargetIds: []' }],
        ref: "scripts/background.js:784-791",
      },
      {
        t: "Panel mode — three fallbacks deep",
        say: "If you dock as a sidebar, the prompt is parked and the side panel opened. On a <code>chrome://</code> page, where no content script can run, it parks the prompt and opens the options page instead. Otherwise the overlay opens right there on the page.",
        from: "worker", to: "surface", screen: "compose",
        focus: { x: 17.9, y: 56.7, w: 64.4, h: 16.2 },
        api: 'chrome.tabs.sendMessage(tab.id, { action: "openOverlayWithPrompt", promptText }, { frameId: 0 })',
        store: [{ area: "session", key: "pendingPrompt", op: "write", shape: "the prompt text — read once by the panel on init, then deleted" }],
        ref: "scripts/background.js:865-908 · scripts/prompt-panel.js:604-614",
      },
      {
        t: "Direct mode — the worker does the panel's job",
        say: "It resolves the target set, checks access, and — because no panel opened to do it — writes your recents itself.",
        from: "worker", to: "storage", screen: "worker",
        mockArgs: { lines: ["// sendPromptDirect(tab, promptText, settings)", "askTargetIds(settings)   // custom set or enabled", "partitionTargets(targets)", "addToHistory(promptText, settings)", "handleMulticast(promptText, ids)"] },
        api: "askTargetIds(settings) → partitionTargets → addToHistory → handleMulticast",
        store: [{ area: "local", key: "promptHistory", op: "write", shape: "same shape and ordering the panel writes — newest first, de-duplicated, trimmed" }],
        ref: "scripts/background.js:817-863",
        note: "Nothing to send to, or no site access at all, falls back to the panel — silently dropping the text after a right-click would look like the menu item did nothing.",
      },
      {
        t: "From here it rejoins the main send",
        say: "<code>handleMulticast</code> is the same function the compose panel calls. Everything downstream — grid or tabs, injection, status — is identical.",
        from: "worker", to: "site", screen: "grid",
        api: "handleMulticast(promptText, ids)",
        ref: "scripts/background.js:1328",
      },
    ],
  },

  {
    id: "settings",
    name: "Change a setting",
    meta: "options page · custom tools",
    blurb: "How a click in Settings reaches storage without clobbering the other surfaces, and how the one-click selector test works.",
    steps: [
      {
        t: "The options page loads your settings over the defaults",
        say: "Every control is populated from one object, spread over a defaults block so a setting added in a later version simply appears.",
        from: "surface", to: "storage", screen: "setTools",
        focus: { x: 3.3, y: 12.1, w: 21.5, h: 33.2 },
        api: 'chrome.storage.sync.get("settings") → { ...DEFAULTS, ...stored.settings }',
        store: [{ area: "sync", key: "settings", op: "read", shape: "24 keys — see the settings table below" }],
        ref: "pages/options.js:98-128",
      },
      {
        t: "Every control calls the same debounced save",
        say: "There is no Save button. Each change schedules a write 300 ms later, so dragging a slider produces one storage write rather than fifty.",
        from: "you", to: "surface", screen: "setBehav",
        api: "save() → clearTimeout → setTimeout(_doSave, 300)",
        ref: "pages/options.js:1405-1418",
      },
      {
        t: "The write re-reads first, so nothing is clobbered",
        say: "This page doesn't own every key. <b>serviceOrder</b>, for instance, is written by dragging chips in the overlay. So the stored object is read, spread, and only this page's keys overwritten.",
        from: "surface", to: "storage", screen: "setBehav",
        api: "const stored = await chrome.storage.sync.get('settings'); … chrome.storage.sync.set({ settings })",
        store: [{ area: "sync", key: "settings", op: "write", shape: "{ ...stored.settings, ...this page's 24 keys } — serviceOrder survives" }],
        ref: "pages/options.js:1420-1450",
        note: "The compose panel does the mirror image of this: <code>saveSettings()</code> writes only <code>enabledServices</code> and <code>serviceOrder</code>, merged into whatever the options page last wrote.",
      },
      {
        t: "Some settings need the worker to act",
        say: "Docking as a sidebar isn't just a stored flag — it changes what clicking the toolbar icon does, and only the worker can tell Chrome that.",
        from: "surface", to: "worker", screen: "setAppear",
        api: 'chrome.runtime.sendMessage({ action: "setSidebarMode", useSidebar }) → chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick })',
        ref: "scripts/background.js:576-583 · 992-995",
      },
      {
        t: "History is trimmed to the new limit right away",
        say: "Lowering the recents limit takes effect immediately rather than at the next send.",
        from: "surface", to: "storage", screen: "setAppear",
        api: "chrome.storage.local.set({ promptHistory: history.slice(0, settings.historyLimit) })",
        store: [{ area: "local", key: "promptHistory", op: "write", shape: "sliced to historyLimit (default 20)" }],
        ref: "pages/options.js:1452-1461",
      },
      {
        t: "Testing a custom tool opens a real hidden tab",
        say: "The most involved thing this page does. It checks access, opens the site in a background tab, injects the content script, types “Puchne test”, waits 600 ms to see whether the send button lights up — then closes the tab in a <code>finally</code>, whatever happened.",
        from: "surface", to: "worker", screen: "worker",
        mockArgs: { lines: ['// action: "testService"', "isServiceGranted(…) || bail with a reason", "tabs.create({ url, active: false })", "waitForTabLoad → ensureContentScript", "sleep(min(waitMs, 5000))", 'tabs.sendMessage(… "testSelector")', "finally → tabs.remove(tab.id)"] },
        api: 'chrome.runtime.sendMessage({ action: "testService", url, selector, buttonSel, inputType, waitMs })',
        payload: '// response\n{ ok: true, inputFound: true, buttonFound: true }',
        ref: "scripts/background.js:1033-1081 · scripts/content.js:120-148",
        note: "Access is checked up front on purpose: opening the tab would work without it, but injecting the test into it would not — so it says why instead of reporting a mystery failure.",
      },
      {
        t: "Reset puts everything back",
        say: "Overwrites settings with the defaults object, drops your recents, and reloads the page. Site grants are <i>not</i> revoked by this — those are withdrawn per tool on the AI Tools row.",
        from: "you", to: "storage", screen: "setTools",
        api: "chrome.storage.sync.set({ settings: DEFAULTS }) · chrome.storage.local.remove('promptHistory')",
        store: [
          { area: "sync", key: "settings", op: "write", shape: "replaced wholesale with DEFAULTS" },
          { area: "local", key: "promptHistory", op: "delete", shape: "removed" },
        ],
        ref: "pages/options.js:1486-1495",
      },
    ],
  },

  {
    id: "boot",
    name: "Install & cold start",
    meta: "the worker is not persistent",
    blurb: "What runs on install, on update, and every single time Chrome decides to respawn a worker it killed for being idle.",
    steps: [
      {
        t: "On install: defaults are written, menus are created",
        say: "The one moment the settings object is materialised into storage rather than merged over on read.",
        from: "worker", to: "storage", screen: "worker",
        mockArgs: { lines: ["// chrome.runtime.onInstalled — reason: install", "storage.sync.set({ settings })", "contextMenus.create × 2", 'storage.local.remove("activeSessionTabs")  // legacy key'] },
        api: "chrome.runtime.onInstalled → chrome.storage.sync.set({ settings })",
        store: [{ area: "sync", key: "settings", op: "write", shape: "the DEFAULTS object — enabledServices: chatgpt, claude, gemini · gridView: true · autoSubmit: true · theme: system" }],
        ref: "scripts/background.js:614-625",
        note: "Zero websites are granted at this point. The install prompt asks for no host access at all.",
      },
      {
        t: "On update: a one-time theme migration",
        say: "The old options page wrote <code>theme</code> on every save, so nearly everyone has a literal “dark” stored whether they chose it or not — storage cannot tell a deliberate choice from a written-through default. This flips everyone to “system” exactly once and latches that it has.",
        from: "worker", to: "storage", screen: "worker",
        mockArgs: { lines: ["// reason: update", "if (themeSystemMigrated) return", "settings.theme = THEME_DEFAULT   // 'system'", "storage.local.set({ themeSystemMigrated: true })"] },
        api: "migrateThemeToSystem()",
        store: [
          { area: "sync", key: "settings", op: "write", shape: 'theme: "system"' },
          { area: "local", key: "themeSystemMigrated", op: "write", shape: "true — a one-shot latch, so anyone who then picks light or dark keeps it" },
        ],
        ref: "scripts/background.js:636-646",
      },
      {
        t: "On every worker startup: session storage is opened up",
        say: "Content scripts can't read <code>storage.session</code> unless the worker says they may — and the access level resets on every browser restart, so this runs at the top of the file each time.",
        from: "worker", to: "storage", screen: "worker",
        mockArgs: { lines: ["// top-level IIFE, runs on every respawn", "storage.session.setAccessLevel({", '  accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" })'] },
        api: 'chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" })',
        ref: "scripts/background.js:586-611",
        note: "This is what lets the follow-up bar check for a live session without a round-trip to the worker — that read is served by the browser process and costs nothing on an ordinary page load.",
      },
      {
        t: "Permissions are re-derived, never trusted from last time",
        say: "You can revoke a site from Chrome's own extensions menu while the worker is asleep. So on every startup the granted set is read fresh, the mirror rewritten, and the registered content script narrowed or dropped.",
        from: "worker", to: "storage", screen: "worker",
        mockArgs: { lines: ["await syncHostAccess()", "  permissions.getAll()", "  storage.local.set({ grantedOrigins })", "  registerServiceScripts(granted)", "await applySidebarMode(settings.useSidebar)"] },
        api: "syncHostAccess() → chrome.permissions.getAll() → registerServiceScripts(granted)",
        store: [{ area: "local", key: "grantedOrigins", op: "write", shape: "rewritten from the real permission set on every startup" }],
        ref: "scripts/background.js:269-326 · 586-594",
      },
      {
        t: "Stale grid payloads are swept",
        say: "Tabs closed while the browser was shut down never fire <code>onRemoved</code>, so their payload keys would linger forever. Browser start sweeps every one of them.",
        from: "worker", to: "storage", screen: "worker",
        mockArgs: { lines: ["// chrome.runtime.onStartup", "const all = await storage.local.get(null)", 'stale = keys.filter(k => k.startsWith("gridData_"))', "storage.local.remove(stale)"] },
        api: "chrome.runtime.onStartup → chrome.storage.local.remove(staleKeys)",
        store: [{ area: "local", key: "gridData_*", op: "delete", shape: "every key with the gridData_ prefix" }],
        ref: "scripts/background.js:660-664",
        note: "<code>activeSessionTabs</code> needs no sweep — it lives in session storage, which dies with the browser anyway.",
      },
      {
        t: "And it all happens again on the next event",
        say: "The worker is not persistent. Chrome tears it down when it goes idle and respawns it on the next message, alarm or click — which is why nothing above is written as one-time setup, and why in-memory state doesn't exist here.",
        from: "worker", to: "worker", screen: "worker",
        mockArgs: { lines: ["// MV3: no persistent background page", "// every listener must survive a cold respawn", "// every piece of state lives in chrome.storage"] },
        api: "Manifest V3 service worker lifecycle",
        ref: "manifest.json:37-39",
        note: "It also explains a pattern you see repeatedly in the source: read-modify-write on storage is funnelled through a serialising promise queue, because several respawned listeners can race on the same key.",
      },
    ],
  },
];

/* ── Storage map ───────────────────────────────────────────── */
const STORAGE_AREAS = [
  {
    area: "sync", title: "chrome.storage.sync",
    sub: "Follows your signed-in Chrome profile between machines. 100 KB total, 8 KB per key. Exactly one key is used.",
    rows: [
      { key: "settings", shape: "One object, 24 fields — see the breakdown below.",
        by: "options.js (debounced) · prompt-panel.saveSettings · popup.js theme toggle · grid.js hover toggle · worker on install, update and grant",
        read: "Every surface, on every open.",
        life: "Forever, and it syncs." },
    ],
  },
  {
    area: "local", title: "chrome.storage.local",
    sub: "This device only. Survives browser restarts. Never leaves the machine.",
    rows: [
      { key: "promptHistory", shape: "[{ text, timestamp }] — newest first, de-duplicated, capped at settings.historyLimit",
        by: "prompt-panel.addToHistory · background.addToHistory (direct Ask Puchne sends) · options.js on trim",
        read: "The compose panel's “Recent prompts” list.", life: "Forever, or until you clear it." },
      { key: "grantedOrigins", shape: '["https://chatgpt.com/*", "https://claude.ai/*", …]',
        by: "background.syncHostAccess — on every grant, revoke and worker startup",
        read: "Content scripts, which have no chrome.permissions API of their own.", life: "Mirrors the real permission set." },
      { key: "gridLayout", shape: "{ cols, rows, colFracs, rowFracs, cellOrder }",
        by: "grid.js saveLayout — after every resize, drag, close and reset",
        read: "grid.js on open, and only reused if the dimensions still match.", life: "Forever." },
      { key: "gridData_<tabId>", shape: "{ query, autoSubmit, cookieConsent, delayMs, targets: [ …10 fields each… ] }",
        by: "background.handleMulticast, immediately after creating the grid tab",
        read: "That one grid tab, waiting up to 5 s for it to land.", life: "Deleted on tabs.onRemoved; survivors swept on browser start." },
      { key: "followUpBar", shape: '{ "https://claude.ai": { left, top, collapsed }, … }',
        by: "PuchneFollowUpBar on drag end and on collapse",
        read: "The bar itself, keyed by the current origin.", life: "Forever, per website." },
      { key: "themeSystemMigrated", shape: "true",
        by: "background.migrateThemeToSystem, once", read: "The same function, to know not to run again.", life: "A permanent one-shot latch." },
      { key: "highlightShortcut", shape: "true",
        by: "The panel's shortcut hint, when clicked", read: "The options page on load, which then removes it.", life: "One-shot hand-off." },
      { key: "editSelectorFor", shape: '"chatgpt"',
        by: 'background, on the "editServiceSelector" message', read: "The options page on load, which opens that editor and removes it.", life: "One-shot hand-off." },
    ],
  },
  {
    area: "session", title: "chrome.storage.session",
    sub: "In memory. Dies with the browser. Opened to content scripts by setAccessLevel on every worker startup.",
    rows: [
      { key: "sendStatus", shape: "{ id, query, mode: 'grid'|'tabs', gridTabId?, startedAt,\n  services: [{ id, name, url, iconPath, status: 'pending'|'filled'|'submitted'|'failed', error?, tabId?, needsPermission? }] }",
        by: "background — startSendStatus, then markService per result, all through one serialising queue",
        read: "The worker only. No UI renders it today; it backs retryService and the failure badge.",
        life: "Until the next send, or the browser closes." },
      { key: "activeSessionTabs", shape: "[{ tabId, target: { …full service definition… } }]",
        by: "background.handleMulticast, tabs path", read: "The follow-up bar, and the worker on every follow-up.",
        life: "Dies with the browser — deliberately, because tab ids get recycled." },
      { key: "pendingSend", shape: "{ query, serviceIds, targetIds, at }",
        by: "background.openAccessWindow, before the permission prompt",
        read: "resumePendingSend, once the grant lands. Dropped if older than 5 minutes.", life: "Minutes at most." },
      { key: "pendingPrompt", shape: '"the prompt text"',
        by: "background, when handing a prompt to the side panel or the options page",
        read: "The compose panel on init, which removes it immediately.", life: "One-shot hand-off." },
    ],
  },
];

const SETTINGS_FIELDS = [
  ["enabledServices", '["chatgpt","claude","gemini"]', "Which tools a send goes to. Also written by chip clicks in the panel."],
  ["serviceOrder", "[]", "Chip order. Owned by drag-and-drop in the panel, not by the options page."],
  ["gridView", "true", "The big fork: one tiled tab, or one browser tab per tool."],
  ["autoSubmit", "true", "Press send for you, or leave the prompt in the box to edit."],
  ["groupTabs", "false", "Collect new tabs into one Chrome tab group."],
  ["useSidebar", "false", "Dock the panel as a Chrome side panel instead of a popup."],
  ["overlayPosition", '"center"', "Where the in-page overlay sits: top, center or bottom."],
  ["chipDisplay", '"logo-name"', "logo-name · logo · name · none."],
  ["theme", '"system"', "Stored preference. Only ever resolved to light or dark before it reaches CSS."],
  ["delayMs", "2000", "Settle wait before typing — capped at 300 ms by the content script."],
  ["hoverExpand", "true", "Grid: enlarge the cell under the cursor."],
  ["hoverExpandMin", "2", "Minimum number of cells before hover-to-expand does anything."],
  ["hoverExpandDelay", "200", "Dwell required before expanding, so a cursor crossing the grid doesn't cascade reflows."],
  ["cookieConsent", '"accept"', "accept · reject · off — what cookie-dismiss.js clicks in grid frames."],
  ["enableHistory", "true", "Record prompts at all."],
  ["showRecents", "true", "Show the recents list in the panel."],
  ["historyLimit", "20", "How many prompts to keep."],
  ["showFollowUpInput", "true", "The follow-up bar and the grid's footer box."],
  ["showShortcutHint", "true", "The shortcut line at the bottom of the panel."],
  ["askAction", '"panel"', "Ask Puchne: open the panel prefilled, or send straight away."],
  ["askTargetMode", '"enabled"', "enabled · custom — which tools a direct Ask Puchne send reaches."],
  ["askTargetIds", "[]", "The custom set, used only when askTargetMode is custom."],
  ["customSelectors", "{}", "Per-service selector overrides: { chatgpt: { selector, buttonSel } }."],
  ["customProviders", "[]", "Your own tools — Mistral, Qwen, a self-hosted UI. Same shape as a registry entry."],
];

/* ── Message catalog ───────────────────────────────────────── */
const MSG_IN = [
  ["getServices", "Panel · options · permissions window · content script", "The registry: built-ins plus your custom providers.", "{ services: [...] }"],
  ["getPermissionState", "Panel", "Which sites are granted right now.", "{ grantedOrigins, grantedIds }"],
  ["requestServiceAccess", "Panel (locked chip, or a send needing a site)", "Opens the access window; optionally parks a send behind it.", "{ ok }"],
  ["accessGranted", "The access window, after Chrome confirms", "Re-syncs the mirror and scripts, enables the services, releases the parked send.", "{ ok }"],
  ["cancelPendingSend", "The access window's “Not now”", "Drops the parked send — declining the sites means declining the send.", "{ ok }"],
  ["multicast", "Compose panel", "The main send.", "{ ok } — returns immediately; the work outlives the reply"],
  ["followUpMulticast", "The follow-up bar", "Re-sends to every tab in the active session.", "{ ok }"],
  ["injectGridQueries", "The grid page", "Finds each service's sub-frame and fills it. Also used for grid follow-ups.", "{ ok, results }"],
  ["amIInActiveSession", "Content script, on page load", "Tells a tab whether it belongs to a live session.", "{ isInSession, activeSessionTabs }"],
  ["testService", "Options page", "Opens a hidden tab, types a test string, reports whether the selectors hit.", "{ ok, inputFound, buttonFound }"],
  ["setSidebarMode", "Options page", "Flips whether the toolbar icon opens the side panel.", "{ ok }"],
  ["openOptions", "Panel · content script", "Focuses the existing options tab, or opens one.", "{ ok }"],
  ["getShortcut", "Panel, when it can't reach chrome.commands itself", "The current _execute_action shortcut.", "{ shortcut }"],
  ["editServiceSelector", "—", "Parks a service id, opens options. <b>No caller today.</b>", "{ ok }"],
  ["openServiceTab", "—", "Opens one service in a tab. <b>No caller today.</b>", "{ ok }"],
  ["retryService", "—", "Re-runs one service from the current status record, reusing its tab or frame. <b>No caller today</b> — the delivery list that offered it was removed.", "{ ok, … }"],
];

const MSG_OUT = [
  ["fillQuery", "Any tab or grid sub-frame", "Find the composer, type the prompt, optionally submit.", "{ ok, filled, submitted } | { ok: false, error }"],
  ["toggleOverlay", "Top frame of the active tab", "Show or hide the in-page compose overlay.", "{ ok }"],
  ["openOverlayWithPrompt", "Top frame of the active tab", "Open the overlay with text already in the box.", "{ ok }"],
  ["getSelectionOrPage", "Top frame", "Selected text, or title + URL + the first 2 500 chars of the page.", "{ selectionText, title, url, text }"],
  ["getPageContext", "The frame that was right-clicked", "Same, without the selection.", "{ title, url, text }"],
  ["checkLogin", "Tabs Puchne opened itself", "Run the login heuristic and toast if the site needs a sign-in.", "{ ok }"],
  ["testSelector", "The hidden test tab", "Type “Puchne test”, wait 600 ms, report whether input and button were found.", "{ ok, inputFound, buttonFound }"],
];

/* ── Service registry ──────────────────────────────────────── */
const REGISTRY = [
  ["chatgpt", "ChatGPT", "chatgpt.com/", "prosemirror", "button", "#prompt-textarea → [data-testid] → div.ProseMirror", "chatgpt.com/* + chat.openai.com/*"],
  ["claude", "Claude", "claude.ai/new", "prosemirror", "button", "div.ProseMirror[contenteditable] → [data-testid] → [contenteditable]", "claude.ai/*"],
  ["gemini", "Gemini", "gemini.google.com/app", "contenteditable", "button", ".ql-editor → [data-testid] → [contenteditable][role=textbox]", "gemini.google.com/*"],
  ["copilot", "Copilot", "copilot.microsoft.com/", "textarea", "enter", "#userInput → textarea[name] → [data-testid] → placeholder match", "copilot.microsoft.com/*"],
  ["deepseek", "DeepSeek", "chat.deepseek.com/", "textarea", "enter", "textarea#chat-input → placeholder match → any textarea", "chat.deepseek.com/*"],
  ["perplexity", "Perplexity", "www.perplexity.ai/", "contenteditable", "button", "#ask-input → [data-testid] → placeholder match", "www.perplexity.ai/*"],
  ["grok", "Grok", "grok.com/", "prosemirror", "button", 'div.ProseMirror[aria-label="Ask Grok anything"] → textarea → [contenteditable]', "grok.com/*"],
];

/* ── Timings ───────────────────────────────────────────────── */
const TIMINGS = [
  ["MAX_RETRIES × RETRY_INTERVAL", "30 × 1 s", "How long the content script hunts for a composer before giving up.", "constants.js:7-8"],
  ["SETTLE_CAP_MS", "300 ms", "Hard cap on the settle wait after the composer is found — this is what overrides the 2000 ms “delay” setting.", "constants.js:10"],
  ["SUBMIT_DELAY", "100 ms", "Pause between filling the box and pressing send.", "constants.js:9"],
  ["clickSubmitButton", "6 × 300 ms ≈ 1.5 s", "Retries clicking send, because most sites enable the button a beat after they see input.", "content.js:770-785"],
  ["GRID_STAGGER_MS", "200 ms", "Gap between grid iframe navigations, so seven SPAs don't boot in the same frame.", "constants.js:11"],
  ["iframe load timeout", "12 s", "Per grid cell, before it shows “could not be embedded”.", "grid.js:993-1000"],
  ["GRID_DATA_WAIT_MS", "5 s", "How long the grid page waits for the worker to write its payload.", "constants.js:15"],
  ["TAB_LOAD_TIMEOUT", "10 s", "Longest wait for a tab to reach status “complete”.", "constants.js:12"],
  ["INJECT_TIMEOUT_MS", "15 s", "Per-tab safety net on the fillQuery message, so Promise.allSettled can't hang.", "constants.js:13"],
  ["PENDING_SEND_MAX_AGE_MS", "5 min", "After this, a send parked behind a permission prompt is dropped rather than fired.", "constants.js:28"],
  ["LOGIN_TOAST_MS", "12 s", "How long the sign-in toast stays up. Paused while you hover it.", "content.js:868"],
  ["cookie-dismiss retries", "10 × 800 ms", "Plus a MutationObserver for banners injected later.", "cookie-dismiss.js:134-160"],
  ["options save debounce", "300 ms", "Batches rapid setting changes into one storage write.", "options.js:1414"],
  ["MAX_HISTORY", "20", "Default recents cap. Configurable in Settings › Appearance.", "constants.js:6"],
];

/* ── Glossary ──────────────────────────────────────────────── */
const GLOSSARY = [
  ["Why a closed shadow root?", "The overlay renders on arbitrary websites. A closed shadow root means the host page's CSS cannot style it and the host page's JS cannot query into it — which matters because AI chat sites actively fight for focus. There is even a <code>focusin</code> guard that hands focus back, because from the page's side <code>document.activeElement</code> never resolves past the overlay's container, and some sites read that as “nothing is focused” and grab it."],
  ["Why three ways to type?", "Modern chat UIs are React, Quill or ProseMirror. Setting <code>.value</code> updates the DOM but not the framework's state, so the send button stays disabled and the text vanishes on the next render. Textareas get the native value setter (which React's synthetic system does observe), contenteditables get a real text node plus <code>beforeinput</code>/<code>input</code>, and ProseMirror gets an <code>InputEvent</code> carrying a <code>DataTransfer</code> — i.e. it is told a paste happened."],
  ["Why does the grid need header stripping?", "Every one of these sites sends <code>X-Frame-Options</code> or a frame-ancestors CSP that forbids embedding. Eight declarativeNetRequest rules strip those two response headers, on sub-frame requests only, and only for hosts you granted. Nothing else about the response is modified and no request body is ever read."],
  ["What is FLIP, and why is it everywhere?", "First–Last–Invert–Play: measure where things are, move them, measure again, snap them back with a transform, then animate the transform away. It is how chips reorder while you drag and how grid cells swap. The reorder itself always happens; the animation is only the travel, which is why every FLIP block starts with an early return on <code>prefers-reduced-motion</code>."],
  ["Why so many promise queues?", "The service worker gets torn down and respawned constantly, and several of its listeners can fire at once — seven injections finishing together, or a tab group closing and firing <code>onRemoved</code> once per tab. Read-modify-write on a storage key is not atomic, so <code>sendStatusQueue</code>, <code>hostAccessQueue</code> and <code>sessionPruneQueue</code> each serialise their own key."],
  ["Theme: preference vs resolved", "The stored value is <code>system | light | dark</code>; the stylesheets only ever see <code>light | dark</code>. <code>applyTheme()</code> writes both — <code>data-theme</code> for CSS and <code>data-theme-pref</code> so a surface can tell “dark because you asked” from “dark because the OS is”. A <code>matchMedia</code> watcher repaints open surfaces when the OS flips, which matters because chips carry theme-specific service logos."],
];
