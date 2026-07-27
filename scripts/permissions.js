// ── Optional Host Permissions ────────────────────────────────
// Puchne installs with no site access at all. Every AI host lives in
// `optional_host_permissions` and is requested the first time that service
// is actually used, so the install prompt stays near-empty and the provider
// list can grow without widening what a new user is asked to accept.
//
// This file is the single place that knows how a service maps onto match
// patterns and how to tell whether those patterns have been granted. It is
// loaded in every context that needs the answer:
//
//   - the service worker  (importScripts)
//   - the extension pages (<script> in popup/options/grid/permissions)
//   - the content scripts (the panel greys out chips it cannot send to)
//
// chrome.permissions does not exist in a content script, so reads fall back
// to the storage.local mirror the worker keeps in sync on every grant and
// revoke.
//
// Classic script, re-injected on demand by ensureContentScript(): top-level
// declarations must stay `var`/`function` so a second injection into the
// same page cannot throw.

/**
 * The match patterns a service needs before Puchne can drive it.
 * @param {Object} service — an AI_SERVICES entry
 * @returns {string[]}
 */
function servicePatterns(service) {
  if (Array.isArray(service?.origins) && service.origins.length > 0) {
    return service.origins;
  }
  try {
    return [new URL(service.url).origin + "/*"];
  } catch {
    return [];
  }
}

/**
 * The de-duplicated union of every pattern a set of services needs — one
 * chrome.permissions.request covers the whole set in a single prompt.
 * @param {Array} services
 * @returns {string[]}
 */
function servicesPatterns(services) {
  const seen = new Set();
  (services || []).forEach((service) => {
    servicePatterns(service).forEach((pattern) => seen.add(pattern));
  });
  return [...seen];
}

/** Splits "scheme://host/path" into its parts, or null if it isn't one. */
function parseMatchPattern(pattern) {
  const match = /^(\*|https?|file|ftp):\/\/([^/]*)(\/.*)$/.exec(pattern);
  if (!match) return null;
  return { scheme: match[1], host: match[2], path: match[3] };
}

/** True when a granted host wildcard covers the host a service needs. */
function hostCovers(grantedHost, requiredHost) {
  if (grantedHost === "*") return true;
  if (grantedHost === requiredHost) return true;
  if (grantedHost.startsWith("*.")) {
    const base = grantedHost.slice(2);
    return requiredHost === base || requiredHost.endsWith("." + base);
  }
  return false;
}

/**
 * Whether one granted pattern satisfies a required one. Usually an exact
 * string match — we only ever request the patterns from the manifest — but
 * a user who grants a broader pattern by hand (or "on all sites" from the
 * extensions menu) must not be told they still lack access.
 * @param {string} granted
 * @param {string} required
 */
function patternCovers(granted, required) {
  if (!granted || !required) return false;
  if (granted === required || granted === "<all_urls>") return true;

  const g = parseMatchPattern(granted);
  const r = parseMatchPattern(required);
  if (!g || !r) return false;
  if (g.scheme !== "*" && g.scheme !== r.scheme) return false;
  if (!hostCovers(g.host, r.host)) return false;
  return g.path === "/*" || g.path === r.path;
}

/**
 * @param {Object} service
 * @param {string[]} grantedOrigins — patterns currently granted
 * @returns {boolean} true only when every pattern the service needs is covered
 */
function isServiceGranted(service, grantedOrigins) {
  const required = servicePatterns(service);
  if (required.length === 0) return false;
  const granted = grantedOrigins || [];
  return required.every((pattern) => granted.some((g) => patternCovers(g, pattern)));
}

/**
 * Reads the currently granted host patterns. Uses chrome.permissions where
 * it exists (authoritative) and the worker's storage.local mirror in content
 * scripts, which have no permissions API.
 * @returns {Promise<string[]>}
 */
async function readGrantedOrigins() {
  if (chrome.permissions?.getAll) {
    try {
      const permissions = await chrome.permissions.getAll();
      return permissions.origins || [];
    } catch {
      // Fall through to the mirror.
    }
  }
  try {
    const stored = await chrome.storage.local.get(GRANTED_ORIGINS_KEY);
    return stored[GRANTED_ORIGINS_KEY] || [];
  } catch {
    return [];
  }
}

/**
 * Splits services into the ones Puchne may drive and the ones still waiting
 * on a grant.
 * @param {Array} services
 * @param {string[]} grantedOrigins
 * @returns {{allowed: Array, blocked: Array}}
 */
function partitionByAccess(services, grantedOrigins) {
  const allowed = [];
  const blocked = [];
  (services || []).forEach((service) => {
    (isServiceGranted(service, grantedOrigins) ? allowed : blocked).push(service);
  });
  return { allowed, blocked };
}
