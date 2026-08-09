/**
 * ============================================================
 *  Puchne — website behaviour
 * ============================================================
 *
 *  Five small things, no dependencies:
 *    1. Theme (system / light / dark) with a remembered choice
 *    2. The mobile nav toggle
 *    3. Copy buttons on code blocks
 *    4. Scroll-spy for the docs sidebar
 *    5. Reveal-on-scroll for [data-reveal]
 *
 *  The theme — and the `js` class the reveal styles hang off — are
 *  also applied by an inline snippet in each page's <head>, so the
 *  first paint is already the right colour and nothing flashes in
 *  before it is meant to.
 * ============================================================
 */
(function () {
  "use strict";

  var STORE_KEY = "puchne-site-theme";

  // ── Theme ──────────────────────────────────────────────────
  function systemTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function stored() {
    try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; }
  }

  function apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    var btn = document.querySelector("[data-theme-toggle]");
    if (btn) btn.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
  }

  apply(stored() || systemTheme());

  var toggle = document.querySelector("[data-theme-toggle]");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      apply(next);
      try { localStorage.setItem(STORE_KEY, next); } catch (e) { /* private mode */ }
    });
  }

  // Follow the OS until the visitor picks a side.
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function (e) {
    if (!stored()) apply(e.matches ? "dark" : "light");
  });

  // ── Mobile nav ─────────────────────────────────────────────
  var navToggle = document.querySelector("[data-nav-toggle]");
  var nav = document.getElementById("primary-nav");
  if (navToggle && nav) {
    navToggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(open));
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        nav.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  // ── Header brand ↔ hero lockup ─────────────────────────────
  // A page whose hero carries its own icon and wordmark doesn't need the
  // header repeating them, so the header brand hides while the hero one
  // is in view and fades in the moment it tucks under the header. Both
  // halves are JS-only: with scripting off the header brand just stays.
  var heroBrand = document.querySelector("[data-hero-brand]");
  var header = document.querySelector(".site-header");
  if (heroBrand && header && "IntersectionObserver" in window) {
    header.classList.add("brand-swap");

    // Shrink the viewport by the sticky header, so "gone" means gone
    // behind it rather than off the bottom of the screen.
    var navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--nav-h"), 10) || 64;

    new IntersectionObserver(function (entries) {
      header.classList.toggle("brand-shown", !entries[0].isIntersecting);
    }, { rootMargin: -(navH + 4) + "px 0px 0px 0px", threshold: 0 }).observe(heroBrand);
  }

  // ── Copy buttons ───────────────────────────────────────────
  document.querySelectorAll(".code").forEach(function (block) {
    var pre = block.querySelector("pre");
    if (!pre) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy-btn";
    btn.textContent = "Copy";
    btn.addEventListener("click", function () {
      navigator.clipboard.writeText(pre.innerText.trim()).then(function () {
        btn.textContent = "Copied";
        setTimeout(function () { btn.textContent = "Copy"; }, 1600);
      }, function () {
        btn.textContent = "Press Ctrl+C";
        setTimeout(function () { btn.textContent = "Copy"; }, 1600);
      });
    });
    block.appendChild(btn);
  });

  // ── Docs scroll-spy ────────────────────────────────────────
  var docsNav = document.querySelector(".docs-nav");
  if (docsNav && "IntersectionObserver" in window) {
    var links = Array.prototype.slice.call(docsNav.querySelectorAll('a[href^="#"]'));
    var sections = links
      .map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); })
      .filter(Boolean);

    var setActive = function (id) {
      links.forEach(function (a) {
        a.classList.toggle("active", a.getAttribute("href") === "#" + id);
      });
    };

    var visible = new Set();
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      });
      // The topmost section still on screen wins.
      for (var i = 0; i < sections.length; i++) {
        if (visible.has(sections[i].id)) { setActive(sections[i].id); return; }
      }
    }, { rootMargin: "-80px 0px -70% 0px", threshold: 0 });

    sections.forEach(function (s) { observer.observe(s); });
    if (sections.length) setActive(sections[0].id);
  }

  // ── Reveal on scroll ───────────────────────────────────────
  // The CSS hides [data-reveal] only while the `js` class is set, so a
  // visitor with scripting off sees everything. Reduced motion keeps the
  // elements visible too — this only ever adds the entrance.
  var reveals = [].slice.call(document.querySelectorAll("[data-reveal]"));
  var show = function (el) { el.classList.add("in"); };

  reveals.forEach(function (el, i) {
    el.style.setProperty("--d", ((i % 4) * 70) + "ms");
  });

  if (!("IntersectionObserver" in window)) {
    reveals.forEach(show);
  } else {
    var observed = false;
    var revealer = new IntersectionObserver(function (entries, obs) {
      observed = true;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        show(entry.target);
        obs.unobserve(entry.target); // once is enough
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

    reveals.forEach(function (el) { revealer.observe(el); });

    // Failsafe. An observer that never reports — a background tab that is
    // never composited, an odd embedded view — would otherwise leave the page
    // looking empty. Losing the entrance is fine; losing the content is not.
    setTimeout(function () {
      if (observed) return;
      revealer.disconnect();
      reveals.forEach(show);
    }, 1600);
  }
})();
