/**
 * ============================================================
 *  Puchne — Access Request Window
 * ============================================================
 *
 *  Opened by the worker (openAccessWindow) whenever a surface
 *  needs a site Puchne hasn't been allowed yet. It exists for
 *  one reason: chrome.permissions.request() only works from an
 *  extension page, in a real user gesture, with no await in
 *  between — conditions the worker, the overlay and the popup
 *  can't all satisfy.
 *
 *  The window explains what is being asked for, then hands the
 *  answer back to the worker, which switches the services on
 *  and releases any send that was waiting on it.
 * ============================================================
 */

const params = new URLSearchParams(window.location.search);
const requestedIds = (params.get("ids") || "").split(",").filter(Boolean);

const listEl = document.getElementById("serviceList");
const titleEl = document.getElementById("title");
const errorEl = document.getElementById("accessError");
const allowBtn = document.getElementById("allowBtn");
const cancelBtn = document.getElementById("cancelBtn");

// Resolved before the click: the request must be the first thing the gesture
// does, so nothing may be awaited inside the handler.
let services = [];
let origins = [];

document.addEventListener("DOMContentLoaded", async () => {
  const stored = await chrome.storage.sync.get("settings");
  applyTheme(document.documentElement, stored.settings?.theme || "dark");

  const all = await fetchServices();
  services = requestedIds
    .map((id) => all.find((s) => s.id === id))
    .filter(Boolean);

  if (services.length === 0) {
    // Nothing recognisable to ask for — don't leave an empty window around.
    window.close();
    return;
  }

  origins = servicesPatterns(services);
  titleEl.textContent =
    services.length === 1
      ? `Allow Puchne to use ${services[0].name}?`
      : `Allow Puchne to use these ${services.length} AI tools?`;

  renderServices();
  document.body.classList.add("ready");
  allowBtn.focus();
});

function fetchServices() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "getServices" }, (res) => {
      if (chrome.runtime.lastError) { resolve([]); return; }
      resolve(res?.services || []);
    });
  });
}

function renderServices() {
  const isDark = document.documentElement.dataset.theme === "dark";
  listEl.innerHTML = "";

  services.forEach((service) => {
    const icon = (isDark && service.iconPathDark) ? service.iconPathDark : service.iconPath;
    const item = document.createElement("li");
    item.className = "access-item";
    item.innerHTML = `
      <img src="../${icon}" alt="" class="access-icon" />
      <div class="access-item-text">
        <p class="access-name"></p>
        <p class="access-host"></p>
      </div>
    `;
    item.querySelector(".access-name").textContent = service.name;
    item.querySelector(".access-host").textContent = servicePatterns(service)
      .map(hostOf)
      .join(", ");
    listEl.appendChild(item);
  });
}

/** "https://chatgpt.com/*" → "chatgpt.com" */
function hostOf(pattern) {
  const parsed = parseMatchPattern(pattern);
  return parsed ? parsed.host : pattern;
}

allowBtn.addEventListener("click", () => {
  if (origins.length === 0) return;

  errorEl.classList.add("hidden");
  allowBtn.disabled = true;

  // Callback form on purpose: awaiting anything first would spend the user
  // gesture and Chrome would reject the request outright.
  chrome.permissions.request({ origins }, (granted) => {
    if (chrome.runtime.lastError || !granted) {
      allowBtn.disabled = false;
      showError(
        chrome.runtime.lastError
          ? chrome.runtime.lastError.message
          : "Access wasn't granted, so Puchne can't use these tools yet."
      );
      return;
    }

    chrome.runtime.sendMessage(
      { action: "accessGranted", serviceIds: services.map((s) => s.id) },
      () => {
        void chrome.runtime.lastError;
        window.close();
      }
    );
  });
});

cancelBtn.addEventListener("click", () => {
  // Drop the parked send too — declining the sites means declining the send.
  chrome.runtime.sendMessage({ action: "cancelPendingSend" }, () => {
    void chrome.runtime.lastError;
    window.close();
  });
});

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}
