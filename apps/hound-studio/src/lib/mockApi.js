const USERS_KEY = "hound_studio_mock_users";
const RELEASES_KEY = "hound_studio_mock_releases";
const ASSETS_KEY = "hound_studio_mock_assets";
const REPORTS_KEY = "hound_studio_mock_issue_reports";

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

function getAdmin(users, userId) {
  return users.find((item) => item.userId === userId && item.role === "admin") || null;
}

export async function mockStudioRequest(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const headers = options.headers || {};
  const body = parseBody(options);

  const users = readJson(USERS_KEY, []);
  const releases = readJson(RELEASES_KEY, []);
  const assets = readJson(ASSETS_KEY, []);
  const reports = readJson(REPORTS_KEY, []);

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

  if (method === "POST" && path === "/v1/auth/admin/login") {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "").trim();
    let user = users.find((item) => item.email === email && item.password === password && item.role === "admin");
    if (!user) {
      user = {
        userId: id("admin"),
        role: "admin",
        adminScope: "super_admin",
        accountStatus: "active",
        email,
        password,
        createdAt: nowIso()
      };
      users.push(user);
      writeJson(USERS_KEY, users);
    }
    return {
      accessToken: `mock-token:${user.userId}`,
      refreshToken: `mock-refresh:${user.userId}`,
      userId: user.userId,
      role: "admin",
      adminScope: user.adminScope || "super_admin"
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
    return {
      userId,
      email: user.email || null,
      role: user.role || null,
      adminScope: user.adminScope || null,
      accountStatus: user.accountStatus || "active"
    };
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

  const readinessMatch = path.match(/^\/v1\/studio\/releases\/([^/]+)\/readiness$/);
  if (method === "GET" && readinessMatch) {
    ensureAuth(headers);
    const releaseId = readinessMatch[1];
    const release = releases.find((item) => item.releaseId === releaseId);
    if (!release) throw new Error("release not found");
    const ready = release.status === "in_transcode" || release.status === "submitted" || release.status === "live";
    return {
      releaseId,
      releaseStatus: release.status,
      ready,
      summary: {
        hasTracks: Array.isArray(release.tracks) && release.tracks.length > 0,
        allTracksReady: ready,
        hasPendingJobs: !ready,
        releaseTransitionReady: release.status !== "draft"
      },
      pendingJobs: ready ? [] : [{ job_id: "mock-job-1", status: "queued", track_id: "mock-track" }],
      tracks: (release.tracks || []).map((track, index) => ({
        trackId: track.trackId || `mock-track-${index + 1}`,
        readiness: {
          manifestReady: ready,
          durationReady: true,
          loudnessReady: true,
          masterProcessed: ready,
          masterStatus: ready ? "processed" : "uploaded"
        }
      }))
    };
  }

  if (method === "POST" && path === "/v1/client/issues") {
    const reportId = id("report");
    reports.push({
      reportId,
      app: body.app || "studio",
      route: body.route || "/",
      sessionId: body.sessionId || "mock-session",
      createdAt: nowIso()
    });
    writeJson(REPORTS_KEY, reports);
    return { reportId, report_id: reportId };
  }

  if (method === "GET" && path === "/v1/operator/overview") {
    ensureAuth(headers);
    const uploadsToday = assets.filter((asset) => asset.kind === "master_audio" || asset.kind === "cover_art").length;
    const transcodeQueued = releases.filter((release) => release.status === "submitted").length;
    const transcodeFailed24h = 0;
    const oldestJobAgeMinutes = transcodeQueued > 0 ? 3 : 0;
    return {
      generatedAt: nowIso(),
      metrics: {
        uploadsToday,
        transcodeQueued,
        transcodeFailed24h,
        oldestJobAgeMinutes,
        playAttempts24h: 0,
        playFailures24h: 0
      }
    };
  }

  if (method === "GET" && path === "/v1/admin/dashboard") {
    const userId = ensureAuth(headers);
    if (!getAdmin(users, userId)) throw new Error("forbidden: admin role required");
    const totalUsers = users.length;
    const totalArtists = users.filter((item) => item.role === "artist").length;
    const draftsPendingReview = releases.filter((item) => item.status === "draft").length;
    const releasesProcessing = releases.filter((item) => item.status === "submitted" || item.status === "in_transcode").length;
    const recentPublishes = releases.filter((item) => item.status === "live").length;
    const storageUsageBytes = assets.reduce((sum, asset) => sum + Number(asset.byteSize || 1000000), 0);
    return {
      generatedAt: nowIso(),
      healthStatus: releasesProcessing > 10 ? "warning" : "healthy",
      metrics: {
        totalUsers,
        activeListeners: users.filter((item) => item.role === "listener").length,
        totalArtists,
        draftsPendingReview,
        releasesProcessing,
        failedTranscodes: 0,
        recentPublishes,
        recentErrors: reports.length,
        storageUsageBytes,
        eventIngestHealth: { status: "ok", eventsLast30m: 0 }
      },
      top: { tracks: [], releases: [], artists: [] },
      latest: { supportFlags: [], reports: reports.slice(-6).reverse() }
    };
  }

  if (method === "GET" && path.startsWith("/v1/admin/artists")) {
    const userId = ensureAuth(headers);
    if (!getAdmin(users, userId)) throw new Error("forbidden: admin role required");
    const qMatch = path.match(/[?&]q=([^&]+)/);
    const q = qMatch ? decodeURIComponent(qMatch[1]).toLowerCase() : "";
    const artists = users
      .filter((item) => item.role === "artist")
      .map((item) => ({
        artistId: item.artistId || id("artist"),
        displayName: item.profile?.stageName || item.email?.split("@")[0] || "Artist",
        email: item.email || null,
        onboardingStatus: "approved",
        verificationStatus: "unverified",
        strikesOrFlags: 0,
        linkedReleases: releases.filter((release) => release.artistId === item.artistId).length,
        rightsStatus: "unknown",
        payoutStatus: "not_configured",
        accountStatus: item.accountStatus || "active",
        createdAt: item.createdAt || nowIso(),
        lastActiveAt: item.lastActiveAt || null
      }))
      .filter((artist) => !q || artist.displayName.toLowerCase().includes(q) || String(artist.email || "").toLowerCase().includes(q));
    return { artists };
  }

  const adminArtistAction = path.match(/^\/v1\/admin\/artists\/([^/]+)\/actions$/);
  if (method === "POST" && adminArtistAction) {
    const userId = ensureAuth(headers);
    if (!getAdmin(users, userId)) throw new Error("forbidden: admin role required");
    return { ok: true, action: body.action || "noop" };
  }

  if (method === "GET" && path.startsWith("/v1/admin/releases")) {
    const userId = ensureAuth(headers);
    if (!getAdmin(users, userId)) throw new Error("forbidden: admin role required");
    const detailMatch = path.match(/^\/v1\/admin\/releases\/([^/?]+)$/);
    if (detailMatch) {
      const releaseId = detailMatch[1];
      const release = releases.find((item) => item.releaseId === releaseId);
      if (!release) throw new Error("release not found");
      return {
        release: {
          releaseId,
          title: release.title,
          artistId: release.artistId,
          artistName: users.find((item) => item.artistId === release.artistId)?.profile?.stageName || "Unknown",
          type: release.releaseType || "album",
          status: release.status || "draft",
          genre: release.genre || "Unknown",
          moodTags: release.moodTags || [],
          about: release.about || "",
          releaseDate: release.releaseDate || null,
          submissionDate: release.createdAt || nowIso(),
          publishDate: release.status === "live" ? nowIso() : null,
          approvedAt: null,
          isHidden: false,
          isFeatured: false,
          priorityRank: 0,
          moderationNotes: "",
          coverStatus: "uploaded",
          coverAsset: null
        },
        tracks: (release.tracks || []).map((track, index) => ({
          trackId: track.trackId || `mock-track-${index + 1}`,
          title: track.title || `Track ${index + 1}`,
          trackNumber: track.trackNumber || index + 1,
          durationSec: track.durationSec || null,
          hlsManifestPath: track.streamManifestPath || null,
          hlsManifestStatus: track.streamManifestPath ? "present" : "missing",
          audioAssetHealth: "processed",
          masterAsset: null
        })),
        processingHistory: [],
        adminActionHistory: []
      };
    }
    const list = releases.map((release) => ({
      releaseId: release.releaseId,
      title: release.title,
      artistId: release.artistId,
      artistName: users.find((item) => item.artistId === release.artistId)?.profile?.stageName || "Unknown",
      type: release.releaseType || "album",
      status: release.status || "draft",
      isHidden: false,
      isFeatured: false,
      priorityRank: 0,
      submissionDate: release.createdAt || nowIso(),
      publishDate: release.status === "live" ? nowIso() : null,
      releaseDate: release.releaseDate || null,
      trackCount: (release.tracks || []).length
    }));
    return { releases: list };
  }

  const releaseAction = path.match(/^\/v1\/admin\/releases\/([^/]+)\/actions$/);
  if (method === "POST" && releaseAction) {
    const userId = ensureAuth(headers);
    if (!getAdmin(users, userId)) throw new Error("forbidden: admin role required");
    return { releaseId: releaseAction[1], status: "updated", updatedAt: nowIso() };
  }

  if (method === "GET" && path.startsWith("/v1/admin/jobs")) {
    const userId = ensureAuth(headers);
    if (!getAdmin(users, userId)) throw new Error("forbidden: admin role required");
    return { jobs: [] };
  }

  const jobAction = path.match(/^\/v1\/admin\/jobs\/([^/]+)\/actions$/);
  if (method === "POST" && jobAction) {
    const userId = ensureAuth(headers);
    if (!getAdmin(users, userId)) throw new Error("forbidden: admin role required");
    return { jobId: jobAction[1], status: body.action === "retry" ? "queued" : "failed", updatedAt: nowIso() };
  }

  if (method === "GET" && path.startsWith("/v1/admin/moderation/flags")) {
    const userId = ensureAuth(headers);
    if (!getAdmin(users, userId)) throw new Error("forbidden: admin role required");
    return { flags: [] };
  }

  const flagAction = path.match(/^\/v1\/admin\/moderation\/flags\/([^/]+)\/actions$/);
  if (method === "POST" && flagAction) {
    const userId = ensureAuth(headers);
    if (!getAdmin(users, userId)) throw new Error("forbidden: admin role required");
    return { flag: { flagId: flagAction[1], status: "resolved", updatedAt: nowIso() } };
  }

  if (method === "GET" && path.startsWith("/v1/admin/reports")) {
    const userId = ensureAuth(headers);
    if (!getAdmin(users, userId)) throw new Error("forbidden: admin role required");
    return {
      reports: reports.map((report) => ({
        report_id: report.reportId,
        user_id: null,
        account_type: "artist",
        app_surface: report.app || "studio",
        platform: "web",
        app_version: "mock",
        environment: "dev",
        route: report.route || "/",
        report_category: "bug",
        user_description: "",
        error_code: null,
        error_message: null,
        failed_request_url: null,
        response_status: null,
        worker_job_id: null,
        release_id: null,
        track_id: null,
        artist_id: null,
        playback_session_id: report.sessionId || null,
        client_timestamp: report.createdAt || nowIso(),
        browser_info: {},
        device_info: {},
        network_state: {},
        client_actions: [],
        metadata: {},
        created_at: report.createdAt || nowIso()
      }))
    };
  }

  const reportFlag = path.match(/^\/v1\/admin\/reports\/([^/]+)\/flag$/);
  if (method === "POST" && reportFlag) {
    const userId = ensureAuth(headers);
    if (!getAdmin(users, userId)) throw new Error("forbidden: admin role required");
    return {
      flag: {
        flag_id: id("flag"),
        target_type: "release",
        target_id: null,
        status: "open",
        category: body.category || "other",
        created_at: nowIso()
      }
    };
  }

  if (method === "GET" && path.startsWith("/v1/admin/audit")) {
    const userId = ensureAuth(headers);
    if (!getAdmin(users, userId)) throw new Error("forbidden: admin role required");
    return { events: [] };
  }

  if (method === "GET" && path.startsWith("/v1/admin/search")) {
    const userId = ensureAuth(headers);
    if (!getAdmin(users, userId)) throw new Error("forbidden: admin role required");
    return { results: { artists: [], users: [], releases: [], tracks: [], jobs: [], reports: [] } };
  }

  throw new Error(`mock route not found: ${method} ${path}`);
}
