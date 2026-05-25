const ACTION_LIMIT = 30;
const SESSION_KEY = "hound_studio_session_id";
const actions = [];
let lastErrorMessage = "";
let initialized = false;

function nowIso() {
  return new Date().toISOString();
}

function safeString(value, fallback = "") {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  return String(value);
}

function trimActions() {
  if (actions.length > ACTION_LIMIT) {
    actions.splice(0, actions.length - ACTION_LIMIT);
  }
}

function getSessionId() {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const generated =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `studio-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_KEY, generated);
    return generated;
  } catch {
    return `studio-${Date.now()}`;
  }
}

function summarizeTarget(target) {
  if (!target || typeof target !== "object" || !("tagName" in target)) return {};
  const element = target;
  const text = safeString(
    element.getAttribute?.("aria-label") || element.textContent || ""
  )
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 100);
  return {
    tag: safeString(element.tagName || "").toLowerCase(),
    id: safeString(element.id || ""),
    text
  };
}

export function recordStudioAction(action, details = {}) {
  actions.push({
    at: nowIso(),
    action: safeString(action || "unknown").slice(0, 128),
    details: details && typeof details === "object" ? details : {}
  });
  trimActions();
}

export function recordStudioError(error) {
  const message =
    typeof error === "string"
      ? error
      : safeString(error?.message || error?.error || "unknown error");
  lastErrorMessage = message.slice(0, 1024);
  recordStudioAction("error", { message: lastErrorMessage });
}

export function initializeStudioDiagnostics() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  getSessionId();

  document.addEventListener(
    "click",
    (event) => {
      recordStudioAction("click", summarizeTarget(event.target));
    },
    true
  );

  const previousPushState = history.pushState.bind(history);
  history.pushState = function patchedPushState(...args) {
    const result = previousPushState(...args);
    recordStudioAction("route_change", { route: window.location.pathname });
    return result;
  };

  const previousReplaceState = history.replaceState.bind(history);
  history.replaceState = function patchedReplaceState(...args) {
    const result = previousReplaceState(...args);
    recordStudioAction("route_replace", { route: window.location.pathname });
    return result;
  };

  window.addEventListener("popstate", () => {
    recordStudioAction("route_pop", { route: window.location.pathname });
  });

  window.addEventListener("error", (event) => {
    recordStudioError(event.error || event.message || "window error");
  });

  window.addEventListener("unhandledrejection", (event) => {
    recordStudioError(event.reason || "unhandled rejection");
  });
}

export function getStudioIssuePayload(route = "") {
  const viewport =
    typeof window !== "undefined"
      ? { width: window.innerWidth, height: window.innerHeight }
      : {};
  const networkState =
    typeof navigator !== "undefined" && navigator.connection
      ? {
          effectiveType: navigator.connection.effectiveType || "",
          downlink: navigator.connection.downlink ?? null,
          rtt: navigator.connection.rtt ?? null,
          saveData: !!navigator.connection.saveData
        }
      : {};
  return {
    sessionId: getSessionId(),
    route: route || (typeof window !== "undefined" ? window.location.pathname : "unknown"),
    timestamp: nowIso(),
    actions: actions.slice(-ACTION_LIMIT),
    lastErrorMessage,
    platform: "web",
    appVersion: typeof import.meta !== "undefined" ? import.meta.env?.VITE_APP_VERSION || "studio-web" : "studio-web",
    environment: typeof import.meta !== "undefined" ? import.meta.env?.VITE_APP_ENV || "dev" : "dev",
    reportCategory: "bug",
    accountType: "artist",
    errorMessage: lastErrorMessage,
    browserInfo: {
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      language: typeof navigator !== "undefined" ? navigator.language : "",
      platform: typeof navigator !== "undefined" ? navigator.platform : "",
      viewport
    },
    deviceInfo: {
      browser: typeof navigator !== "undefined" ? navigator.userAgent : "",
      os: typeof navigator !== "undefined" ? navigator.platform : "",
      viewport
    },
    networkState
  };
}
