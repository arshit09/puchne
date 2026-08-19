/**
 * ============================================================
 *  Puchne — Shared Prompt Panel
 * ============================================================
 *
 *  One implementation of the compose UI, used by BOTH surfaces:
 *
 *    - the in-page overlay   (scripts/content.js → PuchneOverlay)
 *    - the popup / side panel (pages/popup.js)
 *
 *  Everything the two surfaces share lives here: service chips
 *  (including drag-to-reorder), the prompt box, the send button
 *  and its disabled-state explanation, prompt history, and the
 *  shortcut hint.
 *
 *  The hosts keep only what is genuinely theirs — the overlay
 *  owns its backdrop/drag/focus-trap, the popup owns its theme
 *  toggle and side-panel layout — and pass it in as options.
 *
 *  Loaded as a classic script (no modules): it is a content
 *  script on AI hosts and a <script> tag in popup.html, so the
 *  class is exposed on the global object.
 *
 *  Site access is optional and per service, so the chips also
 *  carry that state: a service that hasn't been allowed yet
 *  renders locked and its click asks for the site instead of
 *  switching it on. See scripts/permissions.js.
 *
 *  Styling lives in styles/panel.css, which both surfaces load.
 * ============================================================
 */

class PuchnePromptPanel {
  /**
   * @param {Object}      opts
   * @param {HTMLElement} opts.mount        — element the panel renders itself into
   * @param {HTMLElement} opts.themeTarget  — element that carries data-theme (host root)
   * @param {"overlay"|"popup"} opts.variant
   * @param {Array}       [opts.headerActions] — extra header buttons:
   *                        { id, title, html, onClick }
   * @param {Function}    [opts.onOpenSettings] — called after the settings button is used
   * @param {Function}    [opts.onSent]         — called once a send has been dispatched
   */
  constructor({ mount, themeTarget, variant = "popup", headerActions = [], onOpenSettings, onSent }) {
    this.mount = mount;
    this.themeTarget = themeTarget || mount;
    this.variant = variant;
    this.headerActions = headerActions;
    this.onOpenSettings = onOpenSettings;
    this.onSent = onSent;

    this.allServices = [];
    this.enabledServiceIds = [];
    // Services whose site access the user has actually granted. Everything
    // else renders as a locked chip that asks before it can be turned on.
    this.grantedIds = [];
    this.promptHistory = [];
    this.historyLimit = MAX_HISTORY;
    this.enableHistory = true;
    this.showRecents = true;
    this.chipDisplay = "logo-name";
    this.showShortcutHint = true;

    this._chipFingerprint = "";

    this.initPromise = this.init();
  }

  /** Scoped lookup — ids are unique inside the mount on both surfaces. */
  $(id) {
    return this.mount.querySelector(`#${id}`);
  }

  async init() {
    this.mount.classList.add("pb-panel");
    this.mount.dataset.variant = this.variant;
    this.mount.innerHTML = this.getHTML();

    this.renderHeaderActions();
    this.allServices = await this.fetchServices();
    await this.loadPermissionState();
    await this.loadSettings();
    await this.loadHistory();

    this.setupListeners();
    this.watchPermissions();
    this.watchSystemThemeChanges();
    this.renderServiceChips(true);
    this.renderHistory();
    this.updateShortcutHint();
    await this.checkPendingPrompt();
  }

  // ── Data loading ───────────────────────────────────────────

  fetchServices() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "getServices" }, (res) => {
        if (chrome.runtime.lastError) { resolve([]); return; }
        resolve(res?.services || []);
      });
    });
  }

  // ── Host access ────────────────────────────────────────────
  // Site access is optional and per service: the worker owns the answer,
  // because chrome.permissions is unreachable from the overlay's content
  // script.

  /** Asks the worker which services Puchne is currently allowed to drive. */
  loadPermissionState() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "getPermissionState" }, (res) => {
        if (chrome.runtime.lastError) { resolve(); return; }
        this.grantedIds = res?.grantedIds || [];
        resolve();
      });
    });
  }

  /**
   * Repaints when access changes. The grant happens in a separate window, so
   * the panel that asked for it only finds out through the worker's
   * storage.local mirror — which is also readable from a content script,
   * unlike chrome.permissions.onAdded.
   */
  watchPermissions() {
    if (this._permissionListener) return;

    this._permissionListener = (changes, area) => {
      if (area !== "local" || !changes[GRANTED_ORIGINS_KEY]) return;
      const granted = changes[GRANTED_ORIGINS_KEY].newValue || [];
      this.grantedIds = this.allServices
        .filter((s) => isServiceGranted(s, granted))
        .map((s) => s.id);
      // The worker switches a service on as it grants it, so re-read
      // settings before repainting or the chip would stay inactive.
      this.loadSettings().then(() => this.renderServiceChips(true));
    };

    try {
      chrome.storage.onChanged.addListener(this._permissionListener);
    } catch {
      this._permissionListener = null;
    }
  }

  /**
   * On the "system" preference the OS can change the theme out from under an
   * already-open panel, and the chips have to repaint because they carry
   * theme-specific service logos.
   */
  watchSystemThemeChanges() {
    if (this._unwatchTheme) return;
    this._unwatchTheme = watchSystemTheme(() => {
      if (this.theme !== "system") return;
      this.resolvedTheme = applyTheme(this.themeTarget, this.theme);
      this.renderServiceChips(true);
    });
  }

  /**
   * Hands the ask to pages/permissions.html — Chrome only accepts
   * permissions.request() from an extension page with a user gesture.
   * @param {string[]} serviceIds
   * @param {{query: string}} [pendingSend] — resumed by the worker once granted
   */
  requestAccess(serviceIds, pendingSend) {
    if (!serviceIds || serviceIds.length === 0) return;
    chrome.runtime.sendMessage(
      { action: "requestServiceAccess", serviceIds, pendingSend: pendingSend || null },
      () => void chrome.runtime.lastError
    );
  }

  /** Enabled services that still need a grant before they can be sent to. */
  missingAccessIds() {
    return this.enabledServiceIds.filter((id) => !this.grantedIds.includes(id));
  }

  serviceName(id) {
    return this.allServices.find((s) => s.id === id)?.name || id;
  }

  /**
   * Reads every setting the panel cares about and applies the ones that
   * only affect presentation. Called on init and again each time the
   * overlay is re-opened, so options-page changes land without a reload.
   */
  async loadSettings() {
    const stored = await chrome.storage.sync.get("settings");
    const settings = stored.settings || {};
    // Kept so hosts can read their own keys (overlayPosition, useSidebar…)
    // off the same read instead of hitting storage again.
    this.settings = settings;

    this.enabledServiceIds = settings.enabledServices || ["chatgpt", "claude", "gemini"];
    this.applyServiceOrder(settings.serviceOrder);

    this.historyLimit = settings.historyLimit || MAX_HISTORY;
    // History defaults ON — an opt-out, not an opt-in, so recents are
    // discoverable. Nothing leaves the device; see the note under the list.
    this.enableHistory = settings.enableHistory !== false;
    this.showRecents = settings.showRecents !== false;
    this.chipDisplay = settings.chipDisplay || "logo-name";
    this.showShortcutHint = settings.showShortcutHint !== false;
    // The preference, which may be "system"; applyTheme returns what that
    // actually resolved to, and the chips need the resolved one to pick
    // between light and dark service logos.
    this.theme = settings.theme || THEME_DEFAULT;
    this.resolvedTheme = applyTheme(this.themeTarget, this.theme);

    return settings;
  }

  /**
   * Sorts allServices by the user's saved drag order. Services missing from
   * the saved order (e.g. newly added ones) keep their registry position at
   * the end of the list.
   */
  applyServiceOrder(serviceOrder) {
    if (!serviceOrder) return;
    this.allServices.sort((a, b) => {
      const indexA = serviceOrder.indexOf(a.id);
      const indexB = serviceOrder.indexOf(b.id);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }

  /** Loads history, normalising the legacy plain-string entry format. */
  async loadHistory() {
    const data = await chrome.storage.local.get("promptHistory");
    this.promptHistory = (data.promptHistory || []).map((h) =>
      typeof h === "string" ? { text: h, timestamp: Date.now() } : h
    );
  }

  /** Re-reads everything from storage and repaints. Used when re-opening. */
  async refresh() {
    await this.loadPermissionState();
    await this.loadSettings();
    await this.loadHistory();
    this.renderServiceChips();
    this.renderHistory();
    this.updateShortcutHint();
    await this.checkPendingPrompt();
  }

  // ── Markup ─────────────────────────────────────────────────

  getHTML() {
    const gear = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>`;

    return `
      <header class="header" id="panelHeader">
        <div class="logo">
          <img src="${chrome.runtime.getURL("icons/app/icon-48.png")}" width="22" height="22" alt=""/>
          <h1 id="panelTitle">Puchne</h1>
        </div>
        <div class="header-actions" id="headerActions">
          <button type="button" id="settingsBtn" class="icon-btn" title="Settings" aria-label="Settings">${gear}</button>
        </div>
      </header>

      <div id="serviceChips" class="service-chips" role="group" aria-label="Send to"></div>

      <div class="input-area">
        <textarea id="promptInput" placeholder="Type your prompt here…" rows="3" autofocus
                  aria-label="Your prompt" aria-describedby="panelHint"></textarea>
        <div class="input-footer">
          <button type="button" id="sendBtn" class="send-btn" disabled title="Send Multicast" aria-label="Send Multicast">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
        </div>
      </div>
      <p class="panel-hint hidden" id="panelHint" role="status"></p>

      <div id="historySection" class="history-section hidden">
        <p class="history-label" id="historyLabel">Recent prompts</p>
        <ul id="historyList" class="history-list" aria-labelledby="historyLabel"></ul>
        <p class="history-note">Stored locally on this device only.</p>
      </div>

      <footer class="footer">
        <button type="button" class="shortcut-hint" id="shortcutHint">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="shortcut-icon" aria-hidden="true">
            <rect x="2" y="4" width="20" height="16" rx="2" ry="2"/>
            <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10"/>
          </svg>
          <span class="shortcut-label">Shortcut:</span>
          <span id="shortcutText"></span>
        </button>
      </footer>
    `;
  }

  /** Injects host-specific header buttons (e.g. the popup's theme toggle). */
  renderHeaderActions() {
    const actions = this.$("headerActions");
    this.headerActions.forEach((action) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.id = action.id;
      btn.className = "icon-btn";
      btn.title = action.title || "";
      // These are icon-only, so title alone would leave them unnamed on the
      // screen readers that ignore it.
      if (action.title) btn.setAttribute("aria-label", action.title);
      btn.innerHTML = action.html || "";
      if (action.onClick) btn.addEventListener("click", () => action.onClick(btn));
      actions.insertBefore(btn, actions.firstChild);
    });
  }

  // ── Listeners ──────────────────────────────────────────────

  setupListeners() {
    const promptInput = this.$("promptInput");
    const sendBtn = this.$("sendBtn");

    sendBtn.addEventListener("click", () => this.handleSend());

    // Enter sends, Shift+Enter inserts a newline. The key events are stopped
    // so the host page (an AI site with its own Enter handler) never sees them.
    //
    // Escape and Tab are the exceptions: they belong to the surface hosting
    // this panel, which closes the overlay on one and traps focus with the
    // other. Stopping those too meant neither ever fired, because the overlay
    // puts focus in this box the moment it opens. The overlay's own handler
    // stops Escape from carrying on to the host page.
    promptInput.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" && e.key !== "Tab") e.stopPropagation();
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });
    promptInput.addEventListener("keyup", (e) => e.stopPropagation());
    promptInput.addEventListener("keypress", (e) => e.stopPropagation());
    // Paste is its own event, not a keydown — AI chat sites commonly attach a
    // document/window-level "paste" listener of their own (to catch images
    // pasted anywhere on the page for their composer) and it doesn't check
    // whether the paste actually landed in *their* input. Left unstopped,
    // that handler sees this box's paste too, calls preventDefault(), and
    // swallows it or redirects it into their own textbox. Stopping it here,
    // at the target, keeps it from ever reaching a bubble-phase listener on
    // the host page.
    promptInput.addEventListener("paste", (e) => e.stopPropagation());
    promptInput.addEventListener("input", () => this.updateSendButton());

    this.$("settingsBtn").addEventListener("click", () => {
      chrome.runtime.sendMessage({ action: "openOptions" });
      this.onOpenSettings?.();
    });

    this.$("shortcutHint").addEventListener("click", async () => {
      await chrome.storage.local.set({ highlightShortcut: true });
      chrome.runtime.sendMessage({ action: "openOptions" });
      this.onOpenSettings?.();
    });
  }

  focusInput() {
    this.$("promptInput")?.focus();
  }

  // ── Service chips ──────────────────────────────────────────

  renderServiceChips(force = false) {
    const mode = this.chipDisplay || "logo-name";
    const theme = this.themeTarget.dataset.theme || "dark";
    const fp = [
      mode,
      theme,
      this.enabledServiceIds.slice().sort().join(","),
      this.grantedIds.slice().sort().join(","),
      this.allServices.map((s) => s.id).join(","),
    ].join("|");
    if (!force && fp === this._chipFingerprint) {
      this.updateSendButton();
      return;
    }
    this._chipFingerprint = fp;

    const chipsEl = this.$("serviceChips");
    const hideChips = mode === "none";
    chipsEl.style.display = hideChips ? "none" : "flex";
    chipsEl.innerHTML = "";

    if (hideChips) {
      this.updateSendButton();
      return;
    }

    const isDark = theme === "dark";
    const showLogo = mode === "logo-name" || mode === "logo";
    const showName = mode === "logo-name" || mode === "name";

    let draggedChip = null;

    this.allServices.forEach((service) => {
      const granted = this.grantedIds.includes(service.id);
      const active = this.enabledServiceIds.includes(service.id);
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.dataset.id = service.id;
      // A locked chip says so on hover: the click opens an access prompt
      // rather than simply switching the service on.
      chip.title = granted ? service.name : `${service.name} — click to allow site access`;
      // In "logo" mode the chip has no text at all, so the name has to be
      // spelled out here. The locked state is part of it because the click
      // does something different — it asks for access instead of toggling.
      chip.setAttribute(
        "aria-label",
        granted ? service.name : `${service.name} — allow site access`
      );
      // On/off is a border colour on screen; this is the same fact for
      // anyone who can't see the border. Locked chips aren't toggles yet,
      // so they get no pressed state.
      if (granted) chip.setAttribute("aria-pressed", String(active));
      if (active) chip.classList.add("active");
      if (!granted) chip.classList.add("needs-access");

      const icon = (isDark && service.iconPathDark) ? service.iconPathDark : service.iconPath;
      chip.innerHTML = [
        showLogo ? `<img src="${chrome.runtime.getURL(icon)}" class="service-icon" alt="" />` : "",
        showName ? service.name : "",
        granted ? "" : PuchnePromptPanel.LOCK_ICON,
      ].join("");

      chip.addEventListener("click", () => this.toggleService(service.id));

      // ── Drag-to-reorder ──
      chip.draggable = true;

      chip.addEventListener("dragstart", (e) => {
        draggedChip = chip;
        e.dataTransfer.setData("text/plain", service.id);
        e.dataTransfer.effectAllowed = "move";
        // setTimeout ensures the drag ghost looks normal before opacity is applied
        setTimeout(() => (chip.style.opacity = "0.5"), 0);
      });

      chip.addEventListener("dragend", () => {
        draggedChip = null;
        chip.style.opacity = "1";

        const newOrder = Array.from(chipsEl.children).map((c) => c.dataset.id);
        this.allServices.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
        this._chipFingerprint = ""; // order changed — force the next repaint
        this.saveSettings();

        Array.from(chipsEl.children).forEach((c) => {
          c.style.transform = "";
          c.style.transition = "";
        });
      });

      chip.addEventListener("dragover", (e) => {
        e.preventDefault(); // allow drop
        e.dataTransfer.dropEffect = "move";
      });

      chip.addEventListener("dragenter", (e) => {
        e.preventDefault();
        if (!draggedChip || draggedChip === chip) return;

        const children = Array.from(chipsEl.children);
        const firstRects = new Map();
        children.forEach((c) => firstRects.set(c, c.getBoundingClientRect()));

        const draggedIndex = children.indexOf(draggedChip);
        const targetIndex = children.indexOf(chip);
        if (draggedIndex < targetIndex) {
          chip.after(draggedChip);
        } else {
          chip.before(draggedChip);
        }

        // The reorder above is the actual result; the FLIP below is only the
        // travel between the two states, so reduced motion just skips it.
        if (prefersReducedMotion()) return;

        // FLIP animation
        children.forEach((c) => {
          const first = firstRects.get(c);
          const last = c.getBoundingClientRect();
          const dx = first.left - last.left;
          const dy = first.top - last.top;
          if (dx === 0 && dy === 0) return;

          c.style.transition = "none";
          c.style.transform = `translate(${dx}px, ${dy}px)`;
          c.style.pointerEvents = "none";
          requestAnimationFrame(() => {
            c.style.transition = "transform 0.25s cubic-bezier(0.2, 0, 0, 1)";
            c.style.transform = "";
            setTimeout(() => (c.style.pointerEvents = ""), 250);
          });
        });
      });

      chip.addEventListener("drop", (e) => {
        e.preventDefault();
        // Reordering already happened in dragenter; dragend persists it
      });

      chipsEl.appendChild(chip);
    });

    this.updateSendButton();
  }

  toggleService(id) {
    const index = this.enabledServiceIds.indexOf(id);

    // Turning on a service Puchne has no access to would only queue up a
    // failed delivery, so ask Chrome first. The worker switches the chip on
    // itself once the grant lands.
    if (index < 0 && !this.grantedIds.includes(id)) {
      this.requestAccess([id]);
      return;
    }

    if (index >= 0) {
      this.enabledServiceIds.splice(index, 1);
    } else {
      this.enabledServiceIds.push(id);
    }
    this.renderServiceChips();
    this.saveSettings();
  }

  // ── Send button + why-it-is-disabled hint ──────────────────

  /**
   * Keeps the send button in sync with the two things that gate it, and —
   * unlike a bare disabled button — says which one is missing.
   */
  updateSendButton() {
    const promptInput = this.$("promptInput");
    const sendBtn = this.$("sendBtn");
    const hint = this.$("panelHint");

    const hasQuery = promptInput.value.trim().length > 0;
    const hasServices = this.enabledServiceIds.length > 0;
    sendBtn.disabled = !(hasQuery && hasServices);

    if (!hasServices) {
      hint.classList.remove("hidden");
      hint.innerHTML =
        this.chipDisplay === "none"
          ? `No AI tools are selected. <button class="link-btn" id="hintSettingsBtn">Open settings</button> to enable one.`
          : `No AI tools are selected — pick at least one above to send.`;
      const hintBtn = this.$("hintSettingsBtn");
      hintBtn?.addEventListener("click", () => {
        chrome.runtime.sendMessage({ action: "openOptions" });
        this.onOpenSettings?.();
      });
      return;
    }

    // Sending is still allowed here — it just asks for the missing sites
    // first and goes out on its own once they're allowed.
    const missing = this.missingAccessIds();
    if (missing.length > 0) {
      const names = missing.map((id) => this.serviceName(id)).join(", ");
      hint.classList.remove("hidden");
      hint.innerHTML =
        `Puchne needs your permission to open ${names}. ` +
        `<button class="link-btn" id="hintGrantBtn">Allow access</button>`;
      this.$("hintGrantBtn")?.addEventListener("click", () => this.requestAccess(missing));
      return;
    }

    hint.classList.add("hidden");
    hint.textContent = "";
  }

  setPrompt(text) {
    const promptInput = this.$("promptInput");
    if (promptInput && typeof text === "string") {
      promptInput.value = text;
      this.updateSendButton();
      promptInput.focus();
      promptInput.selectionStart = promptInput.selectionEnd = promptInput.value.length;
    }
  }

  async checkPendingPrompt() {
    try {
      const data = await chrome.storage.session.get("pendingPrompt");
      if (data && data.pendingPrompt) {
        await chrome.storage.session.remove("pendingPrompt");
        this.setPrompt(data.pendingPrompt);
      }
    } catch {
      // ignore
    }
  }

  // ── Sending ────────────────────────────────────────────────

  async handleSend() {
    const promptInput = this.$("promptInput");
    const sendBtn = this.$("sendBtn");
    const query = promptInput.value.trim();
    if (!query || this.enabledServiceIds.length === 0) return;

    // First use of a service: hand the prompt to the worker to hold, ask for
    // the sites, and let the send go out by itself once Chrome says yes. The
    // prompt stays in the box in case the user declines — and because this
    // surface may well be gone by the time the answer arrives.
    const missing = this.missingAccessIds();
    if (missing.length > 0) {
      await this.saveSettings();
      this.addToHistory(query);
      this.renderHistory();
      this.requestAccess(missing, { query });

      // On the surfaces that survive the access window (overlay, side panel)
      // this is the only sign the send is parked rather than lost. The next
      // repaint after the answer replaces it.
      const hint = this.$("panelHint");
      hint.classList.remove("hidden");
      hint.textContent =
        `Waiting for permission to use ${missing.map((id) => this.serviceName(id)).join(", ")}…`;
      return;
    }

    sendBtn.disabled = true;
    sendBtn.classList.add("sending");
    promptInput.disabled = true;

    const resetUI = () => {
      sendBtn.classList.remove("sending");
      promptInput.disabled = false;
      this.updateSendButton();
    };

    // Safety valve: re-enable the UI if the callback never fires
    const abortTimer = setTimeout(resetUI, 15000);

    await this.saveSettings();
    this.addToHistory(query);

    chrome.runtime.sendMessage({ action: "multicast", query }, () => {
      clearTimeout(abortTimer);
      void chrome.runtime.lastError;
      promptInput.value = "";
      resetUI();
      this.renderHistory();
      this.onSent?.();
    });
  }

  // ── History ────────────────────────────────────────────────

  addToHistory(query) {
    if (!this.enableHistory) return;
    this.promptHistory = this.promptHistory.filter((h) => h.text !== query);
    this.promptHistory.unshift({ text: query, timestamp: Date.now() });
    this.promptHistory = this.promptHistory.slice(0, this.historyLimit || MAX_HISTORY);
    chrome.storage.local.set({ promptHistory: this.promptHistory });
  }

  deleteFromHistory(prompt) {
    this.promptHistory = this.promptHistory.filter((h) => h.text !== prompt);
    chrome.storage.local.set({ promptHistory: this.promptHistory });
    this.renderHistory();
  }

  renderHistory() {
    const section = this.$("historySection");
    const list = this.$("historyList");

    if (!this.showRecents || this.promptHistory.length === 0) {
      section.classList.add("hidden");
      return;
    }

    section.classList.remove("hidden");
    list.innerHTML = "";

    this.promptHistory.forEach((entry) => {
      const prompt = entry.text;
      const li = document.createElement("li");
      li.className = "history-item";
      li.title = prompt;

      // A button, not a div: recalling a prompt is an action, and this is the
      // only way to reach it without a mouse.
      const textWrapper = document.createElement("button");
      textWrapper.type = "button";
      textWrapper.className = "history-item-content";
      textWrapper.setAttribute("aria-label", `Use prompt: ${prompt}`);
      textWrapper.addEventListener("click", () => {
        const input = this.$("promptInput");
        input.value = prompt;
        input.focus();
        this.updateSendButton();
      });

      const text = document.createElement("span");
      text.className = "history-item-text";
      text.textContent = prompt;
      textWrapper.appendChild(text);

      if (entry.timestamp) {
        const time = document.createElement("span");
        time.className = "history-item-time";
        time.textContent = formatRelativeTime(entry.timestamp);
        textWrapper.appendChild(time);
      }

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "history-delete-btn";
      deleteBtn.title = "Remove from recents";
      // Every row's button is the same icon, so the name has to carry which
      // prompt it removes.
      deleteBtn.setAttribute("aria-label", `Remove "${prompt}" from recents`);
      deleteBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.deleteFromHistory(prompt);
      });

      li.appendChild(textWrapper);
      li.appendChild(deleteBtn);
      list.appendChild(li);
    });
  }

  // ── Shortcut hint ──────────────────────────────────────────

  async updateShortcutHint() {
    const hint = this.$("shortcutHint");
    const hintText = this.$("shortcutText");
    if (!hint || !hintText) return;

    if (!this.showShortcutHint) {
      hint.style.display = "none";
      return;
    }
    hint.style.display = "flex";
    hint.title = "Click to change shortcut";

    // The commands API is only reachable from extension pages, so the
    // overlay asks the worker; both fall back to the manifest's suggestion.
    let shortcut = "";
    try {
      if (chrome.commands?.getAll) {
        const commands = await chrome.commands.getAll();
        shortcut = commands.find((c) => c.name === "_execute_action")?.shortcut || "";
      } else {
        const res = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: "getShortcut" }, (r) => {
            if (chrome.runtime.lastError) { resolve(null); return; }
            resolve(r);
          });
        });
        shortcut = res?.shortcut || "";
      }
    } catch {
      shortcut = "";
    }

    if (shortcut) {
      hintText.textContent = shortcut.replace(/\+/g, " + ");
    } else {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      hintText.textContent = isMac ? "⌃ ⇧ X" : "Ctrl + Shift + X";
    }
  }

  // ── Persistence ────────────────────────────────────────────

  /**
   * Persists only the two keys this panel owns, merged into whatever the
   * options page has written, so neither surface clobbers the other.
   */
  async saveSettings() {
    const stored = await chrome.storage.sync.get("settings");
    const settings = stored.settings || {};
    settings.enabledServices = this.enabledServiceIds;
    settings.serviceOrder = this.allServices.map((s) => s.id);
    return chrome.storage.sync.set({ settings });
  }

  /** Detaches listeners/timers. Called when a host tears the panel down. */
  destroy() {
    if (this._permissionListener) {
      try { chrome.storage.onChanged.removeListener(this._permissionListener); } catch {}
      this._permissionListener = null;
    }
    if (this._unwatchTheme) {
      this._unwatchTheme();
      this._unwatchTheme = null;
    }
  }
}

// The padlock on a chip for a service that hasn't been allowed yet.
PuchnePromptPanel.LOCK_ICON = `<svg class="chip-lock" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="4" y="11" width="16" height="10" rx="2"/>
  <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
</svg>`;

/**
 * Returns a human-readable relative time string (e.g. "2h ago").
 * Shared by the panel and any host that renders timestamps.
 * @param {number} timestamp - Unix timestamp in ms
 */
function formatRelativeTime(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}
