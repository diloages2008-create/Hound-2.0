const API_BASE =
  import.meta.env.VITE_HOUND_API_BASE ||
  "https://rbhlvbutqzgqogsrqwet.supabase.co/functions/v1/api-v1";
const SUPABASE_ANON =
  import.meta.env.VITE_SUPABASE_ANON ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "";

const TOKEN_KEY = "hound_den_access_token";
const REFRESH_KEY = "hound_den_refresh_token";

function readStorage(key) {
  return sessionStorage.getItem(key) || localStorage.getItem(key) || "";
}

export function getToken() {
  return readStorage(TOKEN_KEY);
}

export function getRefreshToken() {
  return readStorage(REFRESH_KEY);
}

function setSession(accessToken, refreshToken = "", rememberMe = true) {
  const store = rememberMe ? localStorage : sessionStorage;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  if (accessToken) store.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) store.setItem(REFRESH_KEY, refreshToken);
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
}

async function rawRequest(path, options = {}, auth = false) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (auth) {
    const token = getToken();
    if (!token) throw new Error("No access token found. Login first.");
    headers.Authorization = `Bearer ${token}`;
  } else if (!headers.Authorization && SUPABASE_ANON) {
    headers.Authorization = `Bearer ${SUPABASE_ANON}`;
  }

  if (SUPABASE_ANON && !headers.apikey) {
    headers.apikey = SUPABASE_ANON;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed: ${response.status}`);
    error.status = response.status;
    error.payload = payload || null;
    throw error;
  }
  return payload;
}

async function refreshSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  const result = await rawRequest("/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken })
  });
  setSession(result.accessToken || "", result.refreshToken || "");
  return result;
}

async function request(path, options = {}, auth = false) {
  try {
    return await rawRequest(path, options, auth);
  } catch (error) {
    if (auth && error?.status === 401) {
      try {
        await refreshSession();
        return await rawRequest(path, options, auth);
      } catch {
        clearSession();
      }
    }
    throw error;
  }
}

export async function loginAdmin(body) {
  const rememberMe = body?.rememberMe !== false;
  const result = await request("/v1/auth/admin/login", {
    method: "POST",
    body: JSON.stringify(body)
  });
  setSession(result.accessToken || "", result.refreshToken || "", rememberMe);
  return result;
}

export async function getAuthMe() {
  return request("/v1/auth/me", { method: "GET" }, true);
}

export async function logout() {
  try {
    await request("/v1/auth/logout", { method: "POST" }, true);
  } finally {
    clearSession();
  }
}

export async function getAdminDashboard() {
  return request("/v1/admin/dashboard", { method: "GET" }, true);
}

export async function listAdminArtists(params = {}) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return request(`/v1/admin/artists${query ? `?${query}` : ""}`, { method: "GET" }, true);
}

export async function runAdminArtistAction(artistId, body) {
  return request(`/v1/admin/artists/${artistId}/actions`, {
    method: "POST",
    body: JSON.stringify(body)
  }, true);
}

export async function listAdminReleases(params = {}) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  if (params.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return request(`/v1/admin/releases${query ? `?${query}` : ""}`, { method: "GET" }, true);
}

export async function getAdminRelease(releaseId) {
  return request(`/v1/admin/releases/${releaseId}`, { method: "GET" }, true);
}

export async function runAdminReleaseAction(releaseId, body) {
  return request(`/v1/admin/releases/${releaseId}/actions`, {
    method: "POST",
    body: JSON.stringify(body)
  }, true);
}

export async function listAdminJobs(params = {}) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return request(`/v1/admin/jobs${query ? `?${query}` : ""}`, { method: "GET" }, true);
}

export async function runAdminJobAction(jobId, body) {
  return request(`/v1/admin/jobs/${jobId}/actions`, {
    method: "POST",
    body: JSON.stringify(body)
  }, true);
}

export async function listAdminModerationFlags(params = {}) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return request(`/v1/admin/moderation/flags${query ? `?${query}` : ""}`, { method: "GET" }, true);
}

export async function runAdminModerationAction(flagId, body) {
  return request(`/v1/admin/moderation/flags/${flagId}/actions`, {
    method: "POST",
    body: JSON.stringify(body)
  }, true);
}

export async function listAdminReports(params = {}) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.category) search.set("category", params.category);
  if (params.app) search.set("app", params.app);
  if (params.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return request(`/v1/admin/reports${query ? `?${query}` : ""}`, { method: "GET" }, true);
}

export async function createModerationFlagFromReport(reportId, body) {
  return request(`/v1/admin/reports/${reportId}/flag`, {
    method: "POST",
    body: JSON.stringify(body)
  }, true);
}

export async function listAdminAuditEvents(params = {}) {
  const search = new URLSearchParams();
  if (params.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return request(`/v1/admin/audit${query ? `?${query}` : ""}`, { method: "GET" }, true);
}

export async function searchAdminEverything(params = {}) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  const query = search.toString();
  return request(`/v1/admin/search${query ? `?${query}` : ""}`, { method: "GET" }, true);
}
