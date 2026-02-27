const USERS_KEY = "hound_studio_mock_users";
const RELEASES_KEY = "hound_studio_mock_releases";
const ASSETS_KEY = "hound_studio_mock_assets";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function parseBody(options = {}) {
  if (!options.body) return {};
  try {
    return JSON.parse(options.body);
  } catch {
    return {};
  }
}

function getTokenUserId(headers = {}) {
  const auth = headers.Authorization || headers.authorization || "";
  const match = auth.match(/^Bearer\s+mock-token:(.+)$/i);
  return match ? match[1].trim() : "";
}

function ensureAuth(headers) {
  const userId = getTokenUserId(headers || {});
  if (!userId) throw new Error("No access token found. Login first.");
  return userId;
}

function nowIso() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function getArtist(users, userId) {
  return users.find((item) => item.userId === userId) || null;
}

export async function mockStudioRequest(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const headers = options.headers || {};
  const body = parseBody(options);

  const users = readJson(USERS_KEY, []);
  const releases = readJson(RELEASES_KEY, []);
  const assets = readJson(ASSETS_KEY, []);

  if (method === "POST" && path === "/v1/auth/artist/signup") {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    const stageName = String(body.stageName || "").trim();
    if (!email || !password || !stageName) {
      throw new Error("email, password, and stageName are required");
    }
    if (users.some((user) => user.email === email)) {
      throw new Error("User already exists");
    }
    const userId = id("user");
    const artistId = id("artist");
    users.push({
      userId,
      artistId,
      role: "artist",
      email,
      password,
      profile: {
        artistId,
        stageName,
        bio: "",
        influences: [],
        credits: [],
        socials: {}
      },
      createdAt: nowIso()
    });
    writeJson(USERS_KEY, users);
    return {
      accessToken: `mock-token:${userId}`,
      refreshToken: `mock-refresh:${userId}`,
      userId,
      artistId
    };
  }

  if (method === "POST" && path === "/v1/auth/listener/signup") {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    if (!email || !password) throw new Error("email and password are required");
    const userId = id("listener");
    users.push({ userId, role: "listener", email, password, createdAt: nowIso() });
    writeJson(USERS_KEY, users);
    return {
      accessToken: `mock-token:${userId}`,
      refreshToken: `mock-refresh:${userId}`,
      userId
    };
  }

  if (method === "POST" && (path === "/v1/auth/artist/login" || path === "/v1/auth/listener/login")) {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    const user = users.find((item) => item.email === email && item.password === password);
    if (!user) throw new Error("invalid credentials");
    return {
      accessToken: `mock-token:${user.userId}`,
      refreshToken: `mock-refresh:${user.userId}`,
      userId: user.userId,
      artistId: user.artistId || null
    };
  }

  if (method === "POST" && path === "/v1/auth/refresh") {
    const refreshToken = String(body.refreshToken || "");
    const match = refreshToken.match(/^mock-refresh:(.+)$/);
    if (!match) throw new Error("refresh failed");
    const userId = match[1];
    return {
      accessToken: `mock-token:${userId}`,
      refreshToken: `mock-refresh:${userId}`,
      userId
    };
  }

  if (method === "GET" && path === "/v1/auth/me") {
    const userId = ensureAuth(headers);
    const user = users.find((item) => item.userId === userId);
    if (!user) throw new Error("invalid bearer token");
    return { userId, email: user.email || null, role: user.role || null };
  }

  if (method === "POST" && path === "/v1/auth/logout") {
    ensureAuth(headers);
    return { ok: true };
  }

  if (path === "/v1/studio/profile") {
    const userId = ensureAuth(headers);
    const userIndex = users.findIndex((item) => item.userId === userId);
    if (userIndex < 0) throw new Error("profile not found");

    if (method === "GET") {
      return users[userIndex].profile;
    }

    if (method === "PUT") {
      users[userIndex].profile = {
        ...users[userIndex].profile,
        stageName: body.stageName ?? users[userIndex].profile.stageName,
        bio: body.bio ?? users[userIndex].profile.bio,
        influences: Array.isArray(body.influences) ? body.influences : users[userIndex].profile.influences,
        credits: Array.isArray(body.credits) ? body.credits : users[userIndex].profile.credits,
        socials: body.socials && typeof body.socials === "object" ? body.socials : users[userIndex].profile.socials
      };
      writeJson(USERS_KEY, users);
      return users[userIndex].profile;
    }
  }

  if (method === "POST" && path === "/v1/studio/releases") {
    const userId = ensureAuth(headers);
    const user = getArtist(users, userId);
    if (!user) throw new Error("artist profile not found");

    const release = {
      releaseId: id("release"),
      artistId: user.artistId,
      title: String(body.title || "Untitled"),
      status: "draft",
      genre: String(body.genre || "Unknown"),
      moodTags: Array.isArray(body.moodTags) ? body.moodTags : [],
      releaseType: body.releaseType || "album",
      about: body.about || "",
      releaseDate: body.releaseDate || null,
      tracks: [],
      createdAt: nowIso()
    };
    releases.push(release);
    writeJson(RELEASES_KEY, releases);
    return release;
  }

  if (method === "GET" && path === "/v1/studio/releases") {
    const userId = ensureAuth(headers);
    const user = getArtist(users, userId);
    if (!user) throw new Error("artist profile not found");
    return {
      releases: releases
        .filter((release) => release.artistId === user.artistId)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    };
  }

  const masterIntent = path.match(/^\/v1\/studio\/releases\/([^/]+)\/uploads\/master-intent$/);
  if (method === "POST" && masterIntent) {
    const userId = ensureAuth(headers);
    const assetId = id("asset");
    const asset = {
      assetId,
      ownerUserId: userId,
      kind: "master_audio",
      fileName: body.fileName || "master.wav",
      contentType: body.contentType || "audio/wav",
      status: "pending"
    };
    assets.push(asset);
    writeJson(ASSETS_KEY, assets);
    return {
      assetId,
      uploadUrl: `https://upload.hound.fm/mock-put/${assetId}`,
      publicPath: `master_audio/${userId}/${asset.fileName}`,
      expiresAt: new Date(Date.now() + 600000).toISOString()
    };
  }

  const coverIntent = path.match(/^\/v1\/studio\/releases\/([^/]+)\/uploads\/cover-intent$/);
  if (method === "POST" && coverIntent) {
    const userId = ensureAuth(headers);
    const assetId = id("asset");
    const asset = {
      assetId,
      ownerUserId: userId,
      kind: "cover_art",
      fileName: body.fileName || "cover.jpg",
      contentType: body.contentType || "image/jpeg",
      status: "pending"
    };
    assets.push(asset);
    writeJson(ASSETS_KEY, assets);
    return {
      assetId,
      uploadUrl: `https://upload.hound.fm/mock-put/${assetId}`,
      publicPath: `cover_art/${userId}/${asset.fileName}`,
      expiresAt: new Date(Date.now() + 600000).toISOString()
    };
  }

  const completeMatch = path.match(/^\/v1\/studio\/uploads\/([^/]+)\/complete$/);
  if (method === "POST" && completeMatch) {
    ensureAuth(headers);
    const assetId = completeMatch[1];
    const index = assets.findIndex((item) => item.assetId === assetId);
    if (index < 0) throw new Error("asset not found");
    assets[index].status = "uploaded";
    writeJson(ASSETS_KEY, assets);
    return { ok: true, assetId };
  }

  const submitMatch = path.match(/^\/v1\/studio\/releases\/([^/]+)\/submit$/);
  if (method === "POST" && submitMatch) {
    ensureAuth(headers);
    const releaseId = submitMatch[1];
    const index = releases.findIndex((release) => release.releaseId === releaseId);
    if (index < 0) throw new Error("release not found");
    releases[index].tracks = Array.isArray(body.tracks) ? body.tracks : [];
    releases[index].status = "submitted";
    writeJson(RELEASES_KEY, releases);
    return releases[index];
  }

  const publishMatch = path.match(/^\/v1\/studio\/releases\/([^/]+)\/publish$/);
  if (method === "POST" && publishMatch) {
    ensureAuth(headers);
    const releaseId = publishMatch[1];
    const index = releases.findIndex((release) => release.releaseId === releaseId);
    if (index < 0) throw new Error("release not found");
    releases[index].status = "live";
    writeJson(RELEASES_KEY, releases);
    return releases[index];
  }

  throw new Error(`mock route not found: ${method} ${path}`);
}
