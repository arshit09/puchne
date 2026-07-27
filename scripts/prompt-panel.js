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
 *  and its disabled-state explanation, prompt history, the
 *  per-service delivery status list, and the shortcut hint.
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
    this.sendStatus = null;

    this._chipFingerprint = "";
    this._statusPollTimer = null;
    this._dismissedAt = 0;

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
    this.renderServiceChips(true);
    this.renderHistory();
    this.updateShortcutHint();
    await this.loadStatus();
    this.watchStatus();
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
    this.theme = settings.theme || "dark";
    applyTheme(this.themeTarget, this.theme);

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
    await this.loadStatus();
  }

  // ── Markup ─────────────────────────────────────────────────

  getHTML() {
    const gear = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>`;

    return `
      <header class="header" id="panelHeader">
        <div class="logo">
          <img src="${chrome.runtime.getURL("icons/app/icon-48.png")}" width="22" height="22" alt="Puchne"/>
          <h1>Puchne</h1>
        </div>
        <div class="header-actions" id="headerActions">
          <button id="settingsBtn" class="icon-btn" title="Settings">${gear}</button>
        </div>
      </header>

      <p class="section-label" id="chipsLabel">Send to</p>
      <div id="serviceChips" class="service-chips"></div>

      <p class="section-label">Your prompt</p>
      <div class="input-area">
        <textarea id="promptInput" placeholder="Type your prompt here…" rows="3" autofocus></textarea>
        <div class="input-footer">
          <button id="sendBtn" class="send-btn" disabled title="Send Multicast">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
        </div>
      </div>
      <p class="panel-hint hidden" id="panelHint"></p>

      <div id="statusSection" class="status-section hidden">
        <div class="status-head">
          <p class="section-label">Delivery</p>
          <button id="statusDismiss" class="text-btn" title="Hide delivery status">Dismiss</button>
        </div>
        <ul id="statusList" class="status-list"></ul>
      </div>

      <div id="historySection" class="history-section hidden">
        <p class="history-label">Recent prompts</p>
        <ul id="historyList" class="history-list"></ul>
        <p class="history-note">Stored locally on this device only.</p>
      </div>

      <footer class="footer">
        <div class="shortcut-hint" id="shortcutHint">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="shortcut-icon">
            <rect x="2" y="4" width="20" height="16" rx="2" ry="2"/>
            <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10"/>
          </svg>
          <span class="shortcut-label">Shortcut:</span>
          <span id="shortcutText"></span>
        </div>
      </footer>
    `;
  }

  /** Injects host-specific header buttons (e.g. the popup's theme toggle). */
  renderHeaderActions() {
    const actions = this.$("headerActions");
    this.headerActions.forEach((action) => {
      const btn = document.createElement("button");
      btn.id = action.id;
      btn.className = "icon-btn";
      btn.title = action.title || "";
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
    promptInput.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });
    promptInput.addEventListener("keyup", (e) => e.stopPropagation());
    promptInput.addEventListener("keypress", (e) => e.stopPropagation());
    promptInput.addEventListener("input", () => this.updateSendButton());

    this.$("settingsBtn").addEventListener("click", () => {
      chrome.runtime.sendMessage({ action: "openOptions" });
      this.onOpenSettings?.();
    });

    this.$("statusDismiss").addEventListener("click", () => this.hideStatus());

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
    const label = this.$("chipsLabel");
    const hideChips = mode === "none";
    chipsEl.style.display = hideChips ? "none" : "flex";
    label.style.display = hideChips ? "none" : "";
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
      const chip = document.createElement("button");
      chip.className = "chip";
      chip.dataset.id = service.id;
      // A locked chip says so on hover: the click opens an access prompt
      // rather than simply switching the service on.
      chip.title = granted ? service.name : `${service.name} — click to allow site access`;
      if (this.enabledServiceIds.includes(service.id)) chip.classList.add("active");
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

    // A new send un-dismisses the status list.
    this._dismissedAt = 0;

    // Paint an optimistic pending row per service immediately, so there is
    // feedback in the same frame as the click rather than whenever the
    // worker gets round to writing its first status update.
    this.renderStatus({
      query,
      startedAt: Date.now(),
      services: this.enabledServiceIds
        .map((id) => this.allServices.find((s) => s.id === id))
        .filter(Boolean)
        .map((s) => ({ id: s.id, name: s.name, iconPath: s.iconPath, iconPathDark: s.iconPathDark, status: "pending" })),
    });

    chrome.runtime.sendMessage({ action: "multicast", query }, () => {
      clearTimeout(abortTimer);
      void chrome.runtime.lastError;
      promptInput.value = "";
      resetUI();
      this.renderHistory();
      this.watchStatus();
      this.onSent?.();
    });
  }

  // ── Delivery status ────────────────────────────────────────

  /**
   * Reads the live status the background worker publishes to storage.session.
   * Content scripts can only reach that area when the worker has opened it
   * to untrusted contexts, so every access is best-effort.
   */
  async loadStatus() {
    try {
      const data = await chrome.storage.session.get(SEND_STATUS_KEY);
      const status = data[SEND_STATUS_KEY];
      if (!status) return;
      // Session storage outlives a popup, so an old record is still sitting
      // there long after it stopped being interesting. Only adopt a fresh one.
      const isStale = Date.now() - (status.startedAt || 0) > SEND_STATUS_STALE_MS;
      if (!this.sendStatus && isStale) return;
      this.renderStatus(status);
    } catch {
      // storage.session unreachable here — the optimistic rows still show.
    }
  }

  /**
   * Subscribes to status updates. storage.onChanged is the primary signal;
   * a slow poll backs it up for contexts where session-area events don't
   * reach us. It stops once every service reaches a final state, and gives
   * up after SEND_STATUS_POLLS so an unreachable status area can't leave a
   * timer running forever.
   */
  watchStatus() {
    if (!this._statusListener) {
      this._statusListener = (changes, area) => {
        if (area === "session" && changes[SEND_STATUS_KEY]?.newValue) {
          this.renderStatus(changes[SEND_STATUS_KEY].newValue);
        }
      };
      try {
        chrome.storage.onChanged.addListener(this._statusListener);
      } catch {
        this._statusListener = null;
      }
    }

    clearInterval(this._statusPollTimer);
    let ticks = 0;
    this._statusPollTimer = setInterval(() => {
      if (this.isStatusSettled() || ++ticks > SEND_STATUS_POLLS) {
        clearInterval(this._statusPollTimer);
        this._statusPollTimer = null;
        return;
      }
      this.loadStatus();
    }, SEND_STATUS_POLL_MS);
  }

  isStatusSettled() {
    const services = this.sendStatus?.services || [];
    return services.length > 0 && services.every((s) => s.status === "submitted" || s.status === "failed");
  }

  hideStatus() {
    // Remembered so a still-running send's next update doesn't immediately
    // put the list back up; only a newer send may re-open it.
    this._dismissedAt = Date.now();
    this.sendStatus = null;
    this.$("statusSection").classList.add("hidden");
    clearInterval(this._statusPollTimer);
    this._statusPollTimer = null;
  }

  renderStatus(status) {
    if (this._dismissedAt && (status?.startedAt || 0) <= this._dismissedAt) return;
    // Ignore a stale storage read that would overwrite a newer local paint.
    if (this.sendStatus?.id && status?.id && status.id < this.sendStatus.id) return;
    this.sendStatus = status;

    const section = this.$("statusSection");
    const list = this.$("statusList");
    const services = status?.services || [];

    if (services.length === 0) {
      section.classList.add("hidden");
      return;
    }

    section.classList.remove("hidden");
    list.innerHTML = "";

    const isDark = (this.themeTarget.dataset.theme || "dark") === "dark";

    services.forEach((svc) => {
      const li = document.createElement("li");
      li.className = `status-item state-${svc.status}`;

      const icon = (isDark && svc.iconPathDark) ? svc.iconPathDark : svc.iconPath;
      const row = document.createElement("div");
      row.className = "status-row";
      row.innerHTML = `
        ${icon ? `<img class="service-icon" src="${chrome.runtime.getURL(icon)}" alt="" />` : ""}
        <span class="status-name">${svc.name}</span>
        <span class="status-badge">${this.statusLabel(svc.status)}</span>
      `;
      li.appendChild(row);

      if (svc.status === "failed") {
        if (svc.error) {
          const why = document.createElement("p");
          why.className = "status-error";
          why.textContent = svc.error;
          why.title = svc.error;
          li.appendChild(why);
        }

        const actions = document.createElement("div");
        actions.className = "status-actions";

        if (svc.needsPermission) {
          // Retrying or editing a selector fixes nothing here — the only way
          // forward is granting the site.
          actions.append(
            // No pending send is attached: the other services in this record
            // already got the prompt, and resuming it would send it twice.
            this.actionButton("Grant access", () => this.requestAccess([svc.id])),
            this.actionButton("Open in tab", () =>
              chrome.runtime.sendMessage({ action: "openServiceTab", serviceId: svc.id })
            )
          );
        } else {
          actions.append(
            this.actionButton("Retry", () =>
              chrome.runtime.sendMessage({ action: "retryService", serviceId: svc.id })
            ),
            this.actionButton("Open in tab", () =>
              chrome.runtime.sendMessage({ action: "openServiceTab", serviceId: svc.id })
            ),
            this.actionButton("Edit selector", () => {
              chrome.runtime.sendMessage({ action: "editServiceSelector", serviceId: svc.id });
              this.onOpenSettings?.();
            })
          );
        }
        li.appendChild(actions);
      }

      list.appendChild(li);
    });
  }

  statusLabel(state) {
    return {
      pending: "Pending",
      filled: "Filled",
      submitted: "Submitted",
      failed: "Failed",
    }[state] || state;
  }

  actionButton(label, onClick) {
    const btn = document.createElement("button");
    btn.className = "status-action";
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
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

      const textWrapper = document.createElement("div");
      textWrapper.className = "history-item-content";
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
      deleteBtn.className = "history-delete-btn";
      deleteBtn.title = "Remove from recents";
      deleteBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
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
    clearInterval(this._statusPollTimer);
    this._statusPollTimer = null;
    if (this._statusListener) {
      try { chrome.storage.onChanged.removeListener(this._statusListener); } catch {}
      this._statusListener = null;
    }
    if (this._permissionListener) {
      try { chrome.storage.onChanged.removeListener(this._permissionListener); } catch {}
      this._permissionListener = null;
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
