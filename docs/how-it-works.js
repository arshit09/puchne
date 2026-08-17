/* ============================================================
 *  Puchne — How It Works : behaviour
 *  Flow player, gallery, reference tables, theme + detail toggles.
 * ============================================================ */

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* ── Theme (mirrors constants.js applyTheme) ───────────────── */
const ICON_MOON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const ICON_SUN = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
const ICON_MONITOR = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;

const THEME_CYCLE = ["system", "light", "dark"];
const THEME_UI = {
  system: { icon: ICON_MONITOR, label: "Theme: match system" },
  light: { icon: ICON_SUN, label: "Theme: light" },
  dark: { icon: ICON_MOON, label: "Theme: dark" },
};

function resolveTheme(pref) {
  if (pref === "dark" || pref === "light") return pref;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function applyTheme(pref) {
  document.documentElement.dataset.themePref = pref;
  document.documentElement.dataset.theme = resolveTheme(pref);
  const btn = $("themeBtn");
  btn.innerHTML = THEME_UI[pref].icon;
  btn.title = btn.ariaLabel = THEME_UI[pref].label;
  try { localStorage.setItem("puchne-docs-theme", pref); } catch {}
}
applyTheme(localStorage.getItem("puchne-docs-theme") || "system");
$("themeBtn").addEventListener("click", () => {
  const cur = document.documentElement.dataset.themePref;
  applyTheme(THEME_CYCLE[(THEME_CYCLE.indexOf(cur) + 1) % 3]);
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (document.documentElement.dataset.themePref === "system") applyTheme("system");
});

/* ── Technical detail toggle ───────────────────────────────── */
const techBtn = $("techToggle");
function setTech(on) {
  document.body.classList.toggle("hide-tech", !on);
  techBtn.setAttribute("aria-pressed", String(on));
  try { localStorage.setItem("puchne-docs-tech", on ? "1" : "0"); } catch {}
}
setTech(localStorage.getItem("puchne-docs-tech") === "1");
techBtn.addEventListener("click", () => setTech(document.body.classList.contains("hide-tech")));

/* ── Screen rendering ──────────────────────────────────────── */
function renderScreen(key, mockArgs) {
  const s = SCREENS[key];
  if (!s) return "";
  if (s.img) return `<img src="${s.img}" alt="${esc(s.cap)}">`;
  return `<div class="mockwrap">${MOCKS[s.mock](mockArgs || {})}</div>`;
}

/* ── Gallery ───────────────────────────────────────────────────
   One line by default; the full description and the file pills only
   appear with Technical detail on. */
$("shotGrid").innerHTML = GALLERY.map((g, i) => {
  const s = SCREENS[g.screen];
  const media = s.img
    ? `<button class="shot-media" data-shot="${i}" aria-label="Enlarge ${esc(g.title)}"><img src="${s.img}" alt="${esc(g.title)}"></button>`
    : `<div class="shot-media" style="cursor:default"><div class="mockwrap">${MOCKS[s.mock]({})}</div></div>`;
  return `<article class="shot">
    ${media}
    <div class="shot-body">
      <h3>${esc(g.title)}</h3>
      <p class="shot-short">${esc(g.short)}</p>
      <p class="tech">${g.body}</p>
      <div class="shot-files tech">
        ${g.acc ? `<span class="pill acc">${esc(g.acc)}</span>` : ""}
        ${g.files.map((f) => `<span class="pill">${esc(f)}</span>`).join("")}
      </div>
    </div>
  </article>`;
}).join("");

/* ── Lightbox ──────────────────────────────────────────────── */
const lb = $("lightbox");
function openLb(src, cap) {
  $("lbImg").src = src; $("lbCap").textContent = cap;
  lb.classList.add("open"); $("lbClose").focus();
}
function closeLb() { lb.classList.remove("open"); $("lbImg").src = ""; }
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-shot]");
  if (b) { const g = GALLERY[+b.dataset.shot]; openLb(SCREENS[g.screen].img, g.title); return; }
  if (e.target.closest("#lbClose") || e.target === lb) closeLb();
  const st = e.target.closest("[data-stageimg]");
  if (st) openLb(st.dataset.stageimg, st.dataset.stagecap || "");
});
$("lbClose").addEventListener("click", closeLb);

/* ── Flow player ───────────────────────────────────────────── */
let flowIdx = 0, stepIdx = 0, playing = false, timer = null;
const SPEEDS = { 1: 6500, 2: 5000, 3: 3500, 4: 2400, 5: 1500 };

const flow = () => FLOWS[flowIdx];
const step = () => flow().steps[stepIdx];

/* lanes */
$("lanes").insertAdjacentHTML("afterbegin", LANES.map((l) =>
  `<div class="lane" data-lane="${l.id}"><div class="ln">${esc(l.name)}</div><div class="lm tech">${esc(l.meta)}</div></div>`
).join(""));

/* flow tabs */
$("flowTabs").innerHTML = FLOWS.map((f, i) =>
  `<button class="flow-tab" role="tab" data-flow="${i}" aria-selected="${i === 0}">
     <span class="ft-n">${i + 1}. ${esc(f.name)}</span><span class="ft-m">${esc(f.meta)}</span>
   </button>`).join("");
$("flowTabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-flow]");
  if (b) selectFlow(+b.dataset.flow);
});

function selectFlow(i, keepPlaying) {
  flowIdx = i; stepIdx = 0;
  document.querySelectorAll("[data-flow]").forEach((el, n) =>
    el.setAttribute("aria-selected", String(n === i)));
  renderSteps();
  render();
  if (!keepPlaying) pause();
  location.hash = `flow=${flow().id}`;
}

function renderSteps() {
  $("stepOl").innerHTML = flow().steps.map((s, i) =>
    `<li><button class="step-btn" data-step="${i}"><span class="num">${i + 1}</span><span class="lbl">${esc(s.t)}</span></button></li>`
  ).join("");
}
$("stepOl").addEventListener("click", (e) => {
  const b = e.target.closest("[data-step]");
  if (b) { stepIdx = +b.dataset.step; render(); pause(); }
});

function movePacket(from, to) {
  const p = $("packet"), wrap = $("lanes");
  const a = wrap.querySelector(`[data-lane="${from}"]`), b = wrap.querySelector(`[data-lane="${to}"]`);
  if (!a || !b) return;
  const wr = wrap.getBoundingClientRect();
  const cx = (el) => el.getBoundingClientRect().left - wr.left + el.offsetWidth / 2 - 5.5;
  p.classList.remove("fly");
  p.style.transition = "none";
  p.style.left = cx(a) + "px";
  requestAnimationFrame(() => {
    p.style.transition = "";
    p.classList.add("fly");
    p.style.left = cx(b) + "px";
    setTimeout(() => p.classList.remove("fly"), 900);
  });
}

function storePills(store) {
  return store.map((s) => `
    <div style="margin-bottom:8px">
      <span class="storepill ${s.area}"><span class="op">${esc(s.op)}</span> ${esc(s.area)} › ${esc(s.key)}</span>
      <div class="storeshape">${esc(s.shape)}</div>
    </div>`).join("");
}

function render() {
  const s = step(), f = flow();

  /* step list state */
  $("stepOl").querySelectorAll(".step-btn").forEach((b, i) => {
    b.setAttribute("aria-current", String(i === stepIdx));
    b.classList.toggle("done", i < stepIdx);
  });
  const cur = $("stepOl").querySelector('[aria-current="true"]');
  if (cur) cur.scrollIntoView({ block: "nearest" });

  /* lanes */
  $("lanes").querySelectorAll(".lane").forEach((l) =>
    l.classList.toggle("on", l.dataset.lane === s.from || l.dataset.lane === s.to));
  movePacket(s.from, s.to);

  /* screen */
  const sc = SCREENS[s.screen];
  const zoom = sc && sc.img ? ` data-stageimg="${sc.img}" data-stagecap="${esc(sc.cap)}" style="cursor:zoom-in"` : "";
  $("screenWrap").innerHTML = `
    <div class="frame"${zoom}>
      ${renderScreen(s.screen, s.mockArgs)}
      ${s.focus ? `<div class="focusbox" style="left:${s.focus.x}%;top:${s.focus.y}%;width:${s.focus.w}%;height:${s.focus.h}%"></div>` : ""}
    </div>
    ${sc ? `<span class="screen-cap tech">${esc(sc.cap)}</span>` : ""}`;

  /* detail */
  const kv = [];
  if (s.api) kv.push(["Call", `<code class="inl">${esc(s.api)}</code>`]);
  if (s.payload) kv.push(["Payload", `<pre class="code">${esc(s.payload)}</pre>`]);
  if (s.store) kv.push(["Storage", storePills(s.store)]);
  if (s.note) kv.push(["Note", `<p class="note">${s.note}</p>`]);
  if (s.ref) kv.push(["Source", `<span class="ref">${esc(s.ref)}</span>`]);

  $("detail").innerHTML = `
    <div class="detail-head">
      <h3>${esc(s.t)}</h3>
      <span class="idx">step ${stepIdx + 1} of ${f.steps.length} · ${esc(f.name)}</span>
    </div>
    <p class="say">${s.say}</p>
    <div class="kv tech">
      ${kv.map(([k, v]) => `<div class="kvrow"><div class="kvk">${k}</div><div class="kvv">${v}</div></div>`).join("")}
    </div>`;
  $("detail").scrollTop = 0;

  /* controls */
  $("btnPrev").disabled = stepIdx === 0 && flowIdx === 0;
  $("btnNext").disabled = stepIdx === f.steps.length - 1 && !$("chainAll").checked && flowIdx === FLOWS.length - 1;
  const total = FLOWS.reduce((n, x) => n + x.steps.length, 0);
  const done = FLOWS.slice(0, flowIdx).reduce((n, x) => n + x.steps.length, 0) + stepIdx + 1;
  $("progressBar").style.width = ($("chainAll").checked
    ? (done / total) * 100
    : ((stepIdx + 1) / f.steps.length) * 100) + "%";
}

function next() {
  if (stepIdx < flow().steps.length - 1) { stepIdx++; render(); return true; }
  if ($("chainAll").checked && flowIdx < FLOWS.length - 1) { selectFlow(flowIdx + 1, true); return true; }
  return false;
}
function prev() {
  if (stepIdx > 0) { stepIdx--; render(); return; }
  if (flowIdx > 0) { selectFlow(flowIdx - 1, playing); stepIdx = flow().steps.length - 1; render(); }
}

function tick() {
  if (!next()) { pause(); return; }
  schedule();
}
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(tick, SPEEDS[$("speed").value]);
}
function play() {
  playing = true;
  $("btnPlay").textContent = "⏸ Pause";
  const f = flow();
  if (stepIdx === f.steps.length - 1 && !($("chainAll").checked && flowIdx < FLOWS.length - 1)) {
    stepIdx = 0; render();
  }
  schedule();
}
function pause() {
  playing = false; clearTimeout(timer);
  $("btnPlay").textContent = "▶ Play";
}

$("btnPlay").addEventListener("click", () => (playing ? pause() : play()));
$("btnNext").addEventListener("click", () => { pause(); next(); });
$("btnPrev").addEventListener("click", () => { pause(); prev(); });
$("btnReset").addEventListener("click", () => { pause(); stepIdx = 0; render(); });
$("chainAll").addEventListener("change", render);
$("speed").addEventListener("input", () => {
  $("speedLabel").textContent = (SPEEDS[$("speed").value] / 1000).toFixed(1) + "s";
  if (playing) schedule();
});
window.addEventListener("resize", () => { const s = step(); movePacket(s.from, s.to); });

document.addEventListener("keydown", (e) => {
  if (lb.classList.contains("open") && e.key === "Escape") { closeLb(); return; }
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
  if (e.key === " ") { e.preventDefault(); playing ? pause() : play(); }
  else if (e.key === "ArrowRight") { e.preventDefault(); pause(); next(); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); pause(); prev(); }
  else if (e.key >= "1" && e.key <= String(FLOWS.length)) {
    document.getElementById("flows").scrollIntoView();
    selectFlow(+e.key - 1);
  }
});

/* deep link */
const hashFlow = (location.hash.match(/flow=([\w-]+)/) || [])[1];
const hi = FLOWS.findIndex((f) => f.id === hashFlow);
renderSteps();
if (hi >= 0) selectFlow(hi); else render();
$("speedLabel").textContent = (SPEEDS[3] / 1000).toFixed(1) + "s";

/* ── Storage tables ────────────────────────────────────────── */
$("storageTables").innerHTML = STORAGE_AREAS.map((a) => `
  <div class="area-head">
    <span class="area-tag ${a.area}">${a.area}</span>
    <h3>${esc(a.title)}</h3>
  </div>
  <p class="muted" style="margin-bottom:12px">${esc(a.sub)}</p>
  <div class="tablewrap"><table>
    <thead><tr><th>Key <span style="font-weight:400;text-transform:none;letter-spacing:0">(the “row”)</span></th><th>Value shape</th><th>Written by</th><th>Read by</th><th>Lifetime</th></tr></thead>
    <tbody>${a.rows.map((r) => `<tr>
      <td><span class="k">${esc(r.key)}</span></td>
      <td><code>${esc(r.shape)}</code></td>
      <td>${esc(r.by)}</td>
      <td>${esc(r.read)}</td>
      <td>${esc(r.life)}</td>
    </tr>`).join("")}</tbody>
  </table></div>`).join("");

$("settingsTable").innerHTML = `
  <thead><tr><th>Field</th><th>Default</th><th>What it does</th></tr></thead>
  <tbody>${SETTINGS_FIELDS.map(([k, d, w]) =>
    `<tr><td><span class="k">${esc(k)}</span></td><td><code>${esc(d)}</code></td><td>${esc(w)}</td></tr>`
  ).join("")}</tbody>`;

/* ── Message tables ────────────────────────────────────────── */
$("msgInTable").innerHTML = `
  <thead><tr><th>action</th><th>Sent by</th><th>What the worker does</th><th>Response</th></tr></thead>
  <tbody>${MSG_IN.map(([a, s, d, r]) =>
    `<tr><td><span class="k">${esc(a)}</span></td><td>${esc(s)}</td><td>${d}</td><td><code>${esc(r)}</code></td></tr>`
  ).join("")}</tbody>`;

$("msgOutTable").innerHTML = `
  <thead><tr><th>action</th><th>Target</th><th>What the content script does</th><th>Response</th></tr></thead>
  <tbody>${MSG_OUT.map(([a, t, d, r]) =>
    `<tr><td><span class="k">${esc(a)}</span></td><td>${esc(t)}</td><td>${esc(d)}</td><td><code>${esc(r)}</code></td></tr>`
  ).join("")}</tbody>`;

/* ── Reference tables ──────────────────────────────────────── */
/* Grok ships a currentColor SVG, so it needs inverting in dark mode; ChatGPT
   ships two marks and picks by theme. Same rules the extension itself uses. */
const LOGO = {
  chatgpt: `<img class="tlogo only-light" src="${ICON("chatgpt_dark.png")}" alt=""><img class="tlogo only-dark" src="${ICON("chatgpt_light.png")}" alt="">`,
  claude: `<img class="tlogo" src="${ICON("claude.png")}" alt="">`,
  gemini: `<img class="tlogo" src="${ICON("gemini.png")}" alt="">`,
  copilot: `<img class="tlogo" src="${ICON("copilot.png")}" alt="">`,
  deepseek: `<img class="tlogo" src="${ICON("deepseek.png")}" alt="">`,
  perplexity: `<img class="tlogo" src="${ICON("perplexity.png")}" alt="">`,
  grok: `<img class="tlogo inv" src="${ICON("grok.svg")}" alt="">`,
};

$("registryTable").innerHTML = `
  <thead><tr><th>Tool</th><th class="tech">id</th><th>URL</th><th>inputType</th><th>submitType</th><th class="tech">Selector chain (fallbacks in order)</th><th class="tech">Origins asked for</th></tr></thead>
  <tbody>${REGISTRY.map((r) =>
    `<tr><td style="white-space:nowrap">${LOGO[r[0]] || ""}${esc(r[1])}</td>
     <td class="tech"><span class="k">${esc(r[0])}</span></td><td><code>${esc(r[2])}</code></td>
     <td><code>${esc(r[3])}</code></td><td><code>${esc(r[4])}</code></td>
     <td class="tech"><code>${esc(r[5])}</code></td><td class="tech"><code>${esc(r[6])}</code></td></tr>`
  ).join("")}</tbody>`;

$("timingTable").innerHTML = `
  <thead><tr><th>Constant</th><th>Value</th><th>Why it exists</th><th class="tech">Source</th></tr></thead>
  <tbody>${TIMINGS.map(([k, v, w, r]) =>
    `<tr><td><span class="k">${esc(k)}</span></td><td><code>${esc(v)}</code></td><td>${esc(w)}</td><td class="tech"><span class="ref">${esc(r)}</span></td></tr>`
  ).join("")}</tbody>`;

$("glossary").innerHTML = GLOSSARY.map(([q, a]) =>
  `<details class="disc"><summary>${esc(q)}</summary><div class="dbody">${a}</div></details>`
).join("");

/* ── Reveal on scroll ──────────────────────────────────────────
   Deliberately NOT IntersectionObserver-gated. The hidden state is only ever
   applied once this code has run (html.rv-on), a plain scroll handler does the
   revealing, and a failsafe timer shows everything regardless — so no failure
   mode of this decoration can leave documentation invisible. */
(function reveal() {
  const items = [...document.querySelectorAll(".rv")];
  const showAll = () => items.forEach((el) => el.classList.add("in"));
  if (!items.length) return;

  document.documentElement.classList.add("rv-on");

  // Throttled on a timestamp rather than requestAnimationFrame: rAF is paused
  // whenever the page isn't visible, which would strand elements at opacity 0.
  // check() is seven getBoundingClientRect calls — cheap enough to run directly.
  let last = 0, ran = false;
  const check = () => {
    ran = true;
    last = Date.now();
    for (const el of items) {
      if (el.classList.contains("in")) continue;
      if (el.getBoundingClientRect().top < innerHeight * 0.92) el.classList.add("in");
    }
  };
  const onScroll = () => { if (Date.now() - last >= 80) check(); };

  // Wait for load before the first check: the screenshots are unsized until
  // then, so an early measurement puts the whole page inside the viewport and
  // reveals everything at once. setTimeout rather than rAF so this does not
  // depend on the page being visible.
  const kick = () => setTimeout(check, 40);
  if (document.readyState === "complete") kick();
  else addEventListener("load", kick, { once: true });

  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  document.addEventListener("visibilitychange", check);
  // Last resort: if check() never even ran, drop the effect and show everything.
  setTimeout(() => { if (!ran) showAll(); }, 4000);
})();
