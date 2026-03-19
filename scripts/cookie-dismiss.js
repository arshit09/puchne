/**
 * ============================================================
 *  PromptBlast — Cookie Consent Auto-Dismisser
 * ============================================================
 *
 *  Injected into grid iframes to automatically handle cookie
 *  consent banners. Iframes inside the chrome-extension:// grid
 *  page get a partitioned cookie jar, so consent given in the
 *  main browser doesn't carry over.
 *
 *  Reads window.__promptBlastCookieMode ("accept" | "reject")
 *  set by the background script before this file is injected.
 * ============================================================
 */

(function dismissCookieBanners() {
  if (window.__promptBlastCookieDismissed) return;
  window.__promptBlastCookieDismissed = true;

  const mode = window.__promptBlastCookieMode || "accept";

  // ── Accept-mode selectors & text ──────────────────────────
  const ACCEPT_SELECTORS = [
    'button[id*="accept" i]',
    'button[class*="accept" i]',
    'button[data-testid*="accept" i]',
    'a[id*="accept" i]',
    '#onetrust-accept-btn-handler',
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
    '[data-cookiefirst-action="accept"]',
    '.cookie-consent-accept',
    '.cc-accept',
    '.cc-btn.cc-dismiss',
    '[aria-label*="accept cookies" i]',
    '[aria-label*="accept all" i]',
    '[aria-label*="allow cookies" i]',
    '[aria-label*="consent" i][aria-label*="accept" i]',
    'button[data-testid="cookie-policy-banner-accept"]',
  ];

  const ACCEPT_TEXT = /^(accept|accept all|agree|allow|allow all|got it|ok|okay|i agree|consent|continue|acknowledge)$/i;

  // ── Reject-mode selectors & text ──────────────────────────
  const REJECT_SELECTORS = [
    'button[id*="reject" i]',
    'button[class*="reject" i]',
    'button[data-testid*="reject" i]',
    'a[id*="reject" i]',
    '#onetrust-reject-all-handler',
    '#CybotCookiebotDialogBodyButtonDecline',
    '[data-cookiefirst-action="reject"]',
    '.cookie-consent-reject',
    '.cc-deny',
    '[aria-label*="reject cookies" i]',
    '[aria-label*="reject all" i]',
    '[aria-label*="deny cookies" i]',
    '[aria-label*="decline" i]',
  ];

  const REJECT_TEXT = /^(reject|reject all|decline|decline all|deny|deny all|refuse|no thanks|only necessary|necessary only|essential only)$/i;

  // ── Pick selectors & text pattern based on mode ───────────
  const BUTTON_SELECTORS = mode === "reject" ? REJECT_SELECTORS : ACCEPT_SELECTORS;
  const TEXT_PATTERN = mode === "reject" ? REJECT_TEXT : ACCEPT_TEXT;

  // Generic banner selectors (used in both modes for fallback)
  const BANNER_SELECTORS = [
    '.cookie-banner button',
    '.cookie-notice button',
    '[class*="cookie-banner"] button',
    '[class*="cookie-consent"] button',
    '[id*="cookie-banner"] button',
    '[id*="cookie-consent"] button',
  ];

  const BANNER_CONTAINER = [
    '[class*="cookie" i]', '[class*="consent" i]', '[class*="banner" i]',
    '[id*="cookie" i]', '[id*="consent" i]', '[id*="banner" i]',
    '[class*="privacy" i]', '[id*="privacy" i]', '[role="dialog"]', '[role="alertdialog"]',
  ].join(', ');

  function tryDismiss() {
    // Strategy 1: Click buttons matching mode-specific selectors
    for (const sel of BUTTON_SELECTORS) {
      try {
        const buttons = document.querySelectorAll(sel);
        for (const btn of buttons) {
          if (btn.offsetParent !== null || btn.offsetWidth > 0) {
            const text = (btn.textContent || btn.innerText || '').trim();
            if (TEXT_PATTERN.test(text) || sel.includes(mode === "reject" ? 'reject' : 'accept') || sel.includes('consent')) {
              btn.click();
              return true;
            }
          }
        }
      } catch (_) {}
    }

    // Strategy 2: Check generic banner buttons for matching text
    for (const sel of BANNER_SELECTORS) {
      try {
        const buttons = document.querySelectorAll(sel);
        for (const btn of buttons) {
          if (btn.offsetParent !== null || btn.offsetWidth > 0) {
            const text = (btn.textContent || btn.innerText || '').trim();
            if (TEXT_PATTERN.test(text)) {
              btn.click();
              return true;
            }
          }
        }
      } catch (_) {}
    }

    // Strategy 3: Find any visible button with matching text inside a banner container
    try {
      const allButtons = document.querySelectorAll('button, a[role="button"], [role="button"]');
      for (const btn of allButtons) {
        const text = (btn.textContent || btn.innerText || '').trim();
        if (TEXT_PATTERN.test(text) && btn.offsetParent !== null) {
          const parent = btn.closest(BANNER_CONTAINER);
          if (parent) {
            btn.click();
            return true;
          }
        }
      }
    } catch (_) {}

    return false;
  }

  // Run immediately, then retry a few times for lazy-loaded banners
  let attempts = 0;
  const MAX_ATTEMPTS = 10;
  const INTERVAL = 800;

  function tick() {
    if (attempts >= MAX_ATTEMPTS) return;
    attempts++;
    if (tryDismiss()) return;
    setTimeout(tick, INTERVAL);
  }

  setTimeout(tick, 500);

  // Also observe DOM for dynamically injected banners
  const observer = new MutationObserver(() => {
    if (attempts < MAX_ATTEMPTS) {
      tryDismiss();
    } else {
      observer.disconnect();
    }
  });
  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
  });

  setTimeout(() => observer.disconnect(), MAX_ATTEMPTS * INTERVAL + 2000);
})();
