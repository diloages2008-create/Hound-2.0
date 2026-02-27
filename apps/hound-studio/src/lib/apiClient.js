import { mockStudioRequest } from "./mockApi.js";

const API_BASE =
  import.meta.env.VITE_HOUND_API_BASE ||
  "https://rbhlvbutqzgqogsrqwet.supabase.co/functions/v1/api-v1";
const API_MODE = import.meta.env.VITE_HOUND_API_MODE || "live";

const TOKEN_KEY = "hound_studio_access_token";
const REFRESH_KEY = "hound_studio_refresh_token";

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY) || "";
}

function setSession(accessToken, refreshToken = "") {
  if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
  else localStorage.removeItem(TOKEN_KEY);

  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  else localStorage.removeItem(REFRESH_KEY);
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

function setToken(token) {
  setSession(token || "", getRefreshToken());
}

async function rawRequest(path, options = {}, auth = false) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (auth) {
    const token = getToken();
    if (!token) {
      throw new Error("No access token found. Login first.");
    }
    headers.Authorization = `Bearer ${token}`;
  }

  if (API_MODE === "mock") {
    return mockStudioRequest(path, { ...options, headers });
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed: ${response.status}`);
    error.status = response.status;
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

export async function signupArtist(body) {
  const result = await request("/v1/auth/artist/signup", {
    method: "POST",
    body: JSON.stringify(body)
  });
  if (result.accessToken || result.refreshToken) {
    setSession(result.accessToken || "", result.refreshToken || "");
  }
  return result;
}

export async function signupListener(body) {
  const result = await request("/v1/auth/listener/signup", {
    method: "POST",
    body: JSON.stringify(body)
  });
  if (result.accessToken || result.refreshToken) {
    setSession(result.accessToken || "", result.refreshToken || "");
  }
  return result;
}

export async function loginArtist(body) {
  const result = await request("/v1/auth/artist/login", {
    method: "POST",
    body: JSON.stringify(body)
  });
  setSession(result.accessToken || "", result.refreshToken || "");
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

export async function getStudioProfile() {
  return request("/v1/studio/profile", { method: "GET" }, true);
}

export async function updateStudioProfile(body) {
  return request(
    "/v1/studio/profile",
    {
      method: "PUT",
      body: JSON.stringify(body)
    },
    true
  );
}

export async function createRelease(body) {
  return request(
    "/v1/studio/releases",
    {
      method: "POST",
      body: JSON.stringify(body)
    },
    true
  );
}

export async function listStudioReleases() {
  return request("/v1/studio/releases", { method: "GET" }, true);
}

export async function createMasterUploadIntent(releaseId, body) {
  return request(
    `/v1/studio/releases/${releaseId}/uploads/master-intent`,
    { method: "POST", body: JSON.stringify(body) },
    true
  );
}

export async function createCoverUploadIntent(releaseId, body) {
  return request(
    `/v1/studio/releases/${releaseId}/uploads/cover-intent`,
    { method: "POST", body: JSON.stringify(body) },
    true
  );
}

export async function completeUpload(assetId, body = {}) {
  return request(`/v1/studio/uploads/${assetId}/complete`, {
    method: "POST",
    body: JSON.stringify(body)
  }, true);
}

export async function submitRelease(releaseId, body) {
  return request(`/v1/studio/releases/${releaseId}/submit`, {
    method: "POST",
    body: JSON.stringify(body)
  }, true);
}

export async function publishRelease(releaseId) {
  return request(`/v1/studio/releases/${releaseId}/publish`, { method: "POST" }, true);
}

export { API_BASE, API_MODE, getToken, getRefreshToken, clearSession, setSession, setToken };
