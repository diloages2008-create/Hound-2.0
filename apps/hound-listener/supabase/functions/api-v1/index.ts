import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EDGE_SUPABASE_URL = Deno.env.get("EDGE_SUPABASE_URL") ?? "";
const EDGE_SERVICE_ROLE_KEY = Deno.env.get("EDGE_SERVICE_ROLE_KEY") ?? "";
const STORAGE_BUCKET_MASTERS = Deno.env.get("STORAGE_BUCKET_MASTERS") ?? "hound-masters";
const STORAGE_BUCKET_COVERS = Deno.env.get("STORAGE_BUCKET_COVERS") ?? "hound-covers";
const STORAGE_BUCKET_STREAMS = Deno.env.get("STORAGE_BUCKET_STREAMS") ?? "hound-streams";
const BETA_INVITE_ONLY = (Deno.env.get("BETA_INVITE_ONLY") ?? "true").toLowerCase() !== "false";
const BETA_MAX_SIGNUPS = Number(Deno.env.get("BETA_MAX_SIGNUPS") ?? "5");
const BETA_ALLOWLIST_EMAILS = new Set(
  String(Deno.env.get("BETA_ALLOWLIST_EMAILS") ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
};

const supabase = createClient(EDGE_SUPABASE_URL, EDGE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

type AppRole = "artist" | "listener" | "admin";
type AdminScope = "super_admin" | "ops_admin" | "content_admin" | "support_viewer";

type AuthContext = {
  userId: string;
  email: string | null;
  role: AppRole | null;
  adminScope: AdminScope | null;
  accountStatus: "active" | "suspended" | null;
};

type AlbumCard = {
  albumId: string;
  title: string;
  artistName: string;
  coverUrl: string;
  genre: string;
  moodTags: string[];
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders
    }
  });
}

function getRoutePath(pathname: string) {
  const marker = "/api-v1";
  const idx = pathname.indexOf(marker);
  if (idx < 0) return pathname;
  const path = pathname.slice(idx + marker.length);
  return path || "/";
}

function buildDefaultCoverUrl() {
  return "https://cdn.hound.fm/assets/default-cover.jpg";
}

function buildPublicObjectUrl(bucket: string, storagePath: string) {
  const base = EDGE_SUPABASE_URL.replace(/\/+$/, "");
  const objectPath = storagePath.replace(/^\/+/, "");
  return `${base}/storage/v1/object/public/${bucket}/${objectPath}`;
}

async function resolveStreamManifestBucket(streamManifestPath: string | null) {
  if (!streamManifestPath) return STORAGE_BUCKET_STREAMS;
  const normalizedPath = streamManifestPath.replace(/^\/+/, "");
  const { data } = await supabase
    .from("upload_assets")
    .select("storage_bucket")
    .eq("kind", "hls_manifest")
    .eq("storage_path", normalizedPath)
    .maybeSingle();
  return data?.storage_bucket || STORAGE_BUCKET_STREAMS;
}

async function resolveCoverUrlsByAssetIds(coverAssetIds: string[]) {
  const ids = Array.from(new Set(coverAssetIds.filter((id) => typeof id === "string" && id.length > 0)));
  if (ids.length === 0) return new Map<string, string>();

  const { data } = await supabase
    .from("upload_assets")
    .select("asset_id, storage_bucket, storage_path")
    .in("asset_id", ids);

  const urlByAssetId = new Map<string, string>();
  for (const row of data ?? []) {
    const bucket = row.storage_bucket || STORAGE_BUCKET_COVERS;
    const path = row.storage_path;
    if (!path) continue;
    urlByAssetId.set(row.asset_id, buildPublicObjectUrl(bucket, path));
  }
  return urlByAssetId;
}

function buildUploadUrl(assetId: string) {
  return `https://upload.hound.fm/put/${assetId}`;
}

function canReleaseTransition(from: string, to: string) {
  if (to === "rejected") return true;
  if (from === "draft" && to === "submitted") return true;
  if (from === "submitted" && to === "in_transcode") return true;
  if (from === "in_transcode" && to === "live") return true;
  return false;
}

function nowIso() {
  return new Date().toISOString();
}

function isMissingTableError(error: { message?: string; code?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42P01") return true;
  const message = String(error.message ?? "").toLowerCase();
  return message.includes("could not find the table") || message.includes("does not exist");
}

function isMissingColumnError(error: { message?: string; code?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "42703") return true;
  const message = String(error.message ?? "").toLowerCase();
  return message.includes("column") && message.includes("does not exist");
}

async function fetchAppUserById(userId: string) {
  const primary = await supabase
    .from("app_users")
    .select("user_id, role, email, admin_scope, account_status")
    .eq("user_id", userId)
    .maybeSingle();
  if (!primary.error) return primary;
  if (!isMissingColumnError(primary.error)) return primary;
  return await supabase
    .from("app_users")
    .select("user_id, role, email")
    .eq("user_id", userId)
    .maybeSingle();
}

async function parseJson(req: Request) {
  return await req.json().catch(() => ({}));
}

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function getPathParam(routePath: string, regex: RegExp, index = 1) {
  const match = routePath.match(regex);
  return match ? match[index] : null;
}

async function ensureAuth(req: Request, requiredRole?: AppRole) {
  const token = getBearerToken(req);
  if (!token) return { error: json({ error: "missing bearer token" }, 401), context: null };

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return { error: json({ error: "invalid bearer token" }, 401), context: null };
  }

  const userId = authData.user.id;
  const email = authData.user.email ?? null;

  const { data: appUser, error: appUserError } = await fetchAppUserById(userId);

  if (appUserError) {
    return { error: json({ error: appUserError.message }, 400), context: null };
  }

  const role = (appUser?.role as AppRole | null) ?? null;
  if (requiredRole && role !== requiredRole) {
    return { error: json({ error: `forbidden: requires ${requiredRole} role` }, 403), context: null };
  }

  const context: AuthContext = {
    userId,
    email,
    role,
    adminScope: (appUser?.admin_scope as AdminScope | null) ?? null,
    accountStatus: (appUser?.account_status as "active" | "suspended" | null) ?? null
  };
  return { error: null, context };
}

async function resolveOptionalAuth(req: Request) {
  const token = getBearerToken(req);
  if (!token) return null;

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return null;

  const userId = authData.user.id;
  const email = authData.user.email ?? null;
  const { data: appUser } = await fetchAppUserById(userId);

  return {
    userId,
    email: appUser?.email ?? email,
    role: (appUser?.role as AppRole | null) ?? null,
    adminScope: (appUser?.admin_scope as AdminScope | null) ?? null,
    accountStatus: (appUser?.account_status as "active" | "suspended" | null) ?? null
  } satisfies AuthContext;
}

async function ensureAdmin(req: Request, allowedScopes: AdminScope[] = []) {
  const auth = await ensureAuth(req);
  if (auth.error || !auth.context) return { error: auth.error, context: null };
  if (auth.context.role !== "admin") {
    return { error: json({ error: "forbidden: admin role required" }, 403), context: null };
  }
  if (auth.context.accountStatus && auth.context.accountStatus !== "active") {
    return { error: json({ error: "admin account suspended" }, 403), context: null };
  }
  if (allowedScopes.length > 0) {
    if (!auth.context.adminScope || !allowedScopes.includes(auth.context.adminScope)) {
      return { error: json({ error: "forbidden: insufficient admin scope" }, 403), context: null };
    }
  }
  return { error: null, context: auth.context };
}

async function writeAdminAuditEvent(options: {
  actorUserId: string;
  actorAdminScope: AdminScope | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabase.from("admin_audit_events").insert({
      actor_user_id: options.actorUserId,
      actor_admin_scope: options.actorAdminScope ?? null,
      action: options.action,
      entity_type: options.entityType,
      entity_id: options.entityId ?? null,
      reason: options.reason ?? null,
      metadata: options.metadata ?? {}
    });
  } catch {
    // best effort; operational actions must still complete
  }
}

function isIgnorableDeleteError(error: { message?: string; code?: string } | null | undefined) {
  return !error || isMissingTableError(error);
}

function toIsoOrNow(raw: unknown) {
  const value = typeof raw === "string" ? raw : String(raw ?? "");
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return nowIso();
  return new Date(parsed).toISOString();
}

function toNonEmptyString(raw: unknown) {
  if (typeof raw !== "string") return "";
  return raw.trim();
}

function sanitizeActions(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-30)
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const value = entry as Record<string, unknown>;
      const at = toIsoOrNow(value.at ?? value.timestamp ?? nowIso());
      const action = toNonEmptyString(value.action ?? value.type ?? "unknown").slice(0, 128);
      const details = value.details && typeof value.details === "object" ? value.details : {};
      return { at, action, details };
    })
    .filter(Boolean);
}

function sanitizeBrowserInfo(raw: unknown) {
  if (!raw || typeof raw !== "object") return {};
  const value = raw as Record<string, unknown>;
  return {
    userAgent: toNonEmptyString(value.userAgent ?? value.user_agent).slice(0, 512),
    language: toNonEmptyString(value.language).slice(0, 64),
    platform: toNonEmptyString(value.platform).slice(0, 128),
    viewport:
      value.viewport && typeof value.viewport === "object"
        ? value.viewport
        : {}
  };
}

function sanitizeObject(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw;
}

async function enforceClosedBetaSignup(email: string, role: "artist" | "listener", inviteTokenRaw: unknown) {
  if (!BETA_INVITE_ONLY) return { error: null, inviteToken: null as string | null };

  const normalizedEmail = email.trim().toLowerCase();
  const isAllowlisted = BETA_ALLOWLIST_EMAILS.has(normalizedEmail);
  const inviteToken = String(inviteTokenRaw ?? "").trim();

  if (!isAllowlisted) {
    if (!inviteToken) {
      return { error: json({ error: "closed beta: invite required" }, 403), inviteToken: null };
    }

    const { data: invite, error: inviteError } = await supabase
      .from("beta_signup_invites")
      .select("invite_token, role, max_uses, used_count, expires_at, revoked")
      .eq("invite_token", inviteToken)
      .maybeSingle();

    if (inviteError) {
      return { error: json({ error: inviteError.message }, 400), inviteToken: null };
    }
    if (!invite || invite.revoked) {
      return { error: json({ error: "invite token invalid or revoked" }, 403), inviteToken: null };
    }
    if (invite.role && invite.role !== role) {
      return { error: json({ error: `invite token restricted to ${invite.role}` }, 403), inviteToken: null };
    }
    if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
      return { error: json({ error: "invite token expired" }, 403), inviteToken: null };
    }
    const maxUses = Number(invite.max_uses ?? 1);
    const usedCount = Number(invite.used_count ?? 0);
    if (maxUses > 0 && usedCount >= maxUses) {
      return { error: json({ error: "invite token exhausted" }, 403), inviteToken: null };
    }
  }

  if (Number.isFinite(BETA_MAX_SIGNUPS) && BETA_MAX_SIGNUPS > 0) {
    const { count, error: countError } = await supabase
      .from("app_users")
      .select("user_id", { count: "exact", head: true })
      .in("role", ["artist", "listener"]);
    if (countError) {
      return { error: json({ error: countError.message }, 400), inviteToken: null };
    }
    if ((count ?? 0) >= BETA_MAX_SIGNUPS) {
      return { error: json({ error: `closed beta capacity reached (${BETA_MAX_SIGNUPS})` }, 403), inviteToken: null };
    }
  }

  return { error: null, inviteToken: isAllowlisted ? null : inviteToken };
}

async function consumeInviteToken(inviteToken: string | null) {
  if (!inviteToken) return;
  const { data: row } = await supabase
    .from("beta_signup_invites")
    .select("used_count, max_uses")
    .eq("invite_token", inviteToken)
    .maybeSingle();

  if (!row) return;
  const usedCount = Number(row.used_count ?? 0) + 1;
  const maxUses = Number(row.max_uses ?? 0);
  const nextUsedCount = maxUses > 0 ? Math.min(usedCount, maxUses) : usedCount;

  await supabase
    .from("beta_signup_invites")
    .update({ used_count: nextUsedCount, last_used_at: nowIso() })
    .eq("invite_token", inviteToken);
}

async function mapReleasesToAlbums(releases: any[]) {
  const coverUrlByAssetId = await resolveCoverUrlsByAssetIds(
    (releases ?? []).map((entry: any) => entry.cover_asset_id).filter(Boolean)
  );

  return (releases ?? []).map((entry: any) => ({
    albumId: entry.release_id,
    title: entry.title,
    artistName: entry.artist_profiles.stage_name,
    coverUrl: coverUrlByAssetId.get(entry.cover_asset_id) ?? buildDefaultCoverUrl(),
    genre: entry.genre,
    moodTags: entry.mood_tags ?? []
  })) as AlbumCard[];
}

async function fetchLiveAlbumsByReleaseIds(releaseIds: string[]) {
  const orderedIds = Array.from(new Set(releaseIds.filter((id) => typeof id === "string" && id.length > 0)));
  if (orderedIds.length === 0) return [] as AlbumCard[];

  const { data: releases, error } = await supabase
    .from("releases")
    .select("release_id, title, genre, mood_tags, cover_asset_id, artist_profiles!inner(stage_name)")
    .in("release_id", orderedIds)
    .eq("status", "live");
  if (error) throw new Error(error.message);

  const albumRows = await mapReleasesToAlbums(releases ?? []);
  const albumById = new Map(albumRows.map((album) => [album.albumId, album]));
  return orderedIds.map((id) => albumById.get(id)).filter(Boolean) as AlbumCard[];
}

async function writeStreamAttempt(options: {
  requestedTrackId: string;
  trackId?: string | null;
  listenerUserId?: string | null;
  success: boolean;
  failureReason?: string | null;
}) {
  try {
    await supabase.from("listener_stream_attempts").insert({
      requested_track_id: options.requestedTrackId,
      track_id: options.trackId ?? null,
      listener_user_id: options.listenerUserId ?? null,
      success: options.success,
      failure_reason: options.failureReason ?? null,
      attempted_at: nowIso()
    });
  } catch {
    // best effort metrics logging
  }
}

async function ensureAppUser(userId: string, email: string | null, role: AppRole) {
  const { data: existing, error: readError } = await supabase
    .from("app_users")
    .select("user_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) throw new Error(readError.message);
  if (existing) return existing;

  const { data: inserted, error: insertError } = await supabase
    .from("app_users")
    .insert({ user_id: userId, email: email ?? `unknown+${userId}@hound.local`, role })
    .select("user_id, role")
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message ?? "failed to create app user");
  }

  return inserted;
}

async function getArtistProfileByUserId(userId: string) {
  const { data: artist } = await supabase
    .from("artist_profiles")
    .select("artist_id")
    .eq("user_id", userId)
    .single();
  return artist;
}

async function createUserWithRole(email: string, password: string, role: AppRole) {
  const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  if (createUserError || !createdUser.user) {
    throw new Error(createUserError?.message ?? "failed to create auth user");
  }

  await ensureAppUser(createdUser.user.id, email, role);

  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (loginError || !loginData.user || !loginData.session?.access_token) {
    throw new Error(loginError?.message ?? "failed to create session");
  }

  return loginData;
}

async function createUploadAsset(ownerUserId: string, kind: string, fileName: string, contentType: string) {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${kind}/${ownerUserId}/${crypto.randomUUID()}-${safeFileName}`;
  const storageBucket = kind === "cover_art" ? STORAGE_BUCKET_COVERS : STORAGE_BUCKET_MASTERS;
  const { data: asset, error } = await supabase
    .from("upload_assets")
    .insert({
      owner_user_id: ownerUserId,
      kind,
      storage_bucket: storageBucket,
      storage_path: storagePath,
      content_type: contentType,
      status: "pending"
    })
    .select("asset_id, storage_path, storage_bucket")
    .single();

  if (error || !asset) throw new Error(error?.message ?? "failed to create upload asset");

  const signed = await supabase.storage.from(storageBucket).createSignedUploadUrl(storagePath);
  const uploadUrl = signed.data?.signedUrl || buildUploadUrl(asset.asset_id);

  return {
    assetId: asset.asset_id,
    uploadUrl,
    publicPath: asset.storage_path,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const routePath = getRoutePath(url.pathname);

  try {
    if (req.method === "POST" && routePath === "/v1/auth/artist/signup") {
      const body = await parseJson(req);
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "").trim();
      const stageName = String(body.stageName ?? "").trim();
      const ownsMasters = Boolean(body.ownsMasters);
      const rightsStatement = String(body.rightsStatement ?? "").trim();

      if (!email || !password || !stageName) {
        return json({ error: "email, password, and stageName are required" }, 400);
      }

      const gate = await enforceClosedBetaSignup(email, "artist", body.inviteToken);
      if (gate.error) return gate.error;

      const session = await createUserWithRole(email, password, "artist");
      const userId = session.user.id;

      const { data: profile, error: profileError } = await supabase
        .from("artist_profiles")
        .insert({ user_id: userId, stage_name: stageName, onboarding_status: "pending" })
        .select("artist_id")
        .single();

      if (profileError || !profile) {
        return json({ error: profileError?.message ?? "failed to create artist profile" }, 400);
      }

      await supabase.from("artist_rights_attestations").insert({
        artist_id: profile.artist_id,
        owns_masters: ownsMasters,
        rights_statement: rightsStatement || null
      });
      await consumeInviteToken(gate.inviteToken);

      return json(
        {
          accessToken: session.session?.access_token,
          refreshToken: session.session?.refresh_token,
          userId,
          artistId: profile.artist_id
        },
        201
      );
    }

    if (req.method === "POST" && routePath === "/v1/auth/listener/signup") {
      const body = await parseJson(req);
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "").trim();
      if (!email || !password) return json({ error: "email and password are required" }, 400);

      const gate = await enforceClosedBetaSignup(email, "listener", body.inviteToken);
      if (gate.error) return gate.error;

      const session = await createUserWithRole(email, password, "listener");
      await consumeInviteToken(gate.inviteToken);
      return json({
        accessToken: session.session?.access_token,
        refreshToken: session.session?.refresh_token,
        userId: session.user.id
      }, 201);
    }

    if (req.method === "POST" && (routePath === "/v1/auth/artist/login" || routePath === "/v1/auth/listener/login")) {
      const body = await parseJson(req);
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "").trim();
      if (!email || !password) return json({ error: "email and password are required" }, 400);

      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError || !loginData.user || !loginData.session?.access_token) {
        return json({ error: loginError?.message ?? "invalid credentials" }, 401);
      }

      const requestedRole: AppRole = routePath.includes("listener") ? "listener" : "artist";
      await ensureAppUser(loginData.user.id, loginData.user.email ?? null, requestedRole);

      const { data: artistProfile } = await supabase
        .from("artist_profiles")
        .select("artist_id")
        .eq("user_id", loginData.user.id)
        .maybeSingle();

      return json({
        accessToken: loginData.session.access_token,
        refreshToken: loginData.session.refresh_token,
        userId: loginData.user.id,
        artistId: artistProfile?.artist_id ?? null
      });
    }

    if (req.method === "POST" && routePath === "/v1/auth/admin/login") {
      const body = await parseJson(req);
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "").trim();
      if (!email || !password) return json({ error: "email and password are required" }, 400);

      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError || !loginData.user || !loginData.session?.access_token) {
        return json({ error: loginError?.message ?? "invalid credentials" }, 401);
      }

      let { data: adminUser, error: adminUserError } = await supabase
        .from("app_users")
        .select("user_id, role, admin_scope, account_status")
        .eq("user_id", loginData.user.id)
        .maybeSingle();
      if (adminUserError && isMissingColumnError(adminUserError)) {
        const fallback = await supabase
          .from("app_users")
          .select("user_id, role")
          .eq("user_id", loginData.user.id)
          .maybeSingle();
        adminUser = fallback.data ? { ...fallback.data, admin_scope: null, account_status: "active" } : null;
        adminUserError = fallback.error;
      }

      if (adminUserError) return json({ error: adminUserError.message }, 400);
      if (!adminUser || adminUser.role !== "admin") {
        return json({ error: "forbidden: admin role required" }, 403);
      }
      if (adminUser.account_status && adminUser.account_status !== "active") {
        return json({ error: "admin account suspended" }, 403);
      }

      await writeAdminAuditEvent({
        actorUserId: loginData.user.id,
        actorAdminScope: (adminUser.admin_scope as AdminScope | null) ?? null,
        action: "admin_login",
        entityType: "auth",
        entityId: loginData.user.id,
        metadata: { ipHint: req.headers.get("x-forwarded-for") ?? null }
      });

      return json({
        accessToken: loginData.session.access_token,
        refreshToken: loginData.session.refresh_token,
        userId: loginData.user.id,
        role: "admin",
        adminScope: adminUser.admin_scope ?? null
      });
    }

    if (req.method === "POST" && routePath === "/v1/auth/refresh") {
      const body = await parseJson(req);
      const refreshToken = String(body.refreshToken ?? "").trim();
      if (!refreshToken) return json({ error: "refreshToken is required" }, 400);

      const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
      if (error || !data.session?.access_token || !data.user) {
        return json({ error: error?.message ?? "refresh failed" }, 401);
      }

      return json({
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        userId: data.user.id
      });
    }

    if (req.method === "GET" && routePath === "/v1/auth/me") {
      const auth = await ensureAuth(req);
      if (auth.error || !auth.context) return auth.error;
      return json({
        userId: auth.context.userId,
        email: auth.context.email,
        role: auth.context.role,
        adminScope: auth.context.adminScope,
        accountStatus: auth.context.accountStatus
      });
    }

    if (req.method === "POST" && routePath === "/v1/auth/logout") {
      const auth = await ensureAuth(req);
      if (auth.error || !auth.context) return auth.error;
      try {
        await supabase.auth.admin.signOut(auth.context.userId);
      } catch {
        // best effort signout; client still clears tokens
      }
      return json({ ok: true });
    }

    if (req.method === "POST" && routePath === "/v1/client/issues") {
      const optionalAuth = await resolveOptionalAuth(req);
      const body = await parseJson(req);
      const appSurface = toNonEmptyString(body.app ?? body.appSurface ?? "unknown").toLowerCase();
      const sessionId = toNonEmptyString(body.sessionId).slice(0, 128);
      const route = toNonEmptyString(body.route ?? body.page).slice(0, 256);
      const eventTimestamp = toIsoOrNow(body.timestamp);
      const actions = sanitizeActions(body.actions ?? body.clientActions);
      const browserInfo = sanitizeBrowserInfo(body.browserInfo ?? body.browser);
      const lastErrorMessage = toNonEmptyString(body.lastErrorMessage ?? body.lastError).slice(0, 1024);
      const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
      const accountType = toNonEmptyString(body.accountType ?? optionalAuth?.role ?? "").slice(0, 32);
      const platform = toNonEmptyString(body.platform).slice(0, 64);
      const appVersion = toNonEmptyString(body.appVersion).slice(0, 64);
      const environment = toNonEmptyString(body.environment).slice(0, 32);
      const reportCategory = toNonEmptyString(body.reportCategory ?? body.category).slice(0, 64);
      const userDescription = toNonEmptyString(body.description ?? body.userDescription).slice(0, 4000);
      const errorCode = toNonEmptyString(body.errorCode).slice(0, 128);
      const errorMessage = toNonEmptyString(body.errorMessage ?? body.lastErrorMessage ?? body.lastError).slice(0, 2048);
      const stackTrace = toNonEmptyString(body.stackTrace).slice(0, 12000);
      const failedRequestUrl = toNonEmptyString(body.failedRequestUrl).slice(0, 1024);
      const responseStatusRaw = Number(body.responseStatus);
      const responseStatus = Number.isFinite(responseStatusRaw) ? responseStatusRaw : null;
      const playbackSessionId = toNonEmptyString(body.playbackSessionId).slice(0, 128);
      const releaseId = toNonEmptyString(body.releaseId).slice(0, 64) || null;
      const trackId = toNonEmptyString(body.trackId).slice(0, 64) || null;
      const artistId = toNonEmptyString(body.artistId).slice(0, 64) || null;
      const workerJobId = toNonEmptyString(body.workerJobId ?? body.jobId).slice(0, 64) || null;
      const deviceInfo = sanitizeObject(body.deviceInfo);
      const networkState = sanitizeObject(body.networkState);

      if (!["studio", "listener"].includes(appSurface)) {
        return json({ error: "app must be 'studio' or 'listener'" }, 400);
      }
      if (!sessionId) {
        return json({ error: "sessionId is required" }, 400);
      }
      if (!route) {
        return json({ error: "route is required" }, 400);
      }

      const { data, error } = await supabase
        .from("client_issue_reports")
        .insert({
          app_surface: appSurface,
          session_id: sessionId,
          user_id: optionalAuth?.userId ?? null,
          route,
          client_timestamp: eventTimestamp,
          last_error_message: lastErrorMessage || null,
          browser_info: browserInfo,
          client_actions: actions,
          metadata,
          account_type: accountType || null,
          platform: platform || null,
          app_version: appVersion || null,
          environment: environment || null,
          device_info: deviceInfo,
          network_state: networkState,
          report_category: reportCategory || null,
          user_description: userDescription || null,
          error_code: errorCode || null,
          error_message: errorMessage || null,
          stack_trace: stackTrace || null,
          failed_request_url: failedRequestUrl || null,
          response_status: responseStatus,
          worker_job_id: workerJobId,
          release_id: releaseId,
          track_id: trackId,
          artist_id: artistId,
          playback_session_id: playbackSessionId || null
        })
        .select("report_id")
        .single();

      if (error || !data) return json({ error: error?.message ?? "failed to store issue report" }, 400);
      return json({ reportId: data.report_id, report_id: data.report_id }, 201);
    }

    if (req.method === "GET" && routePath === "/v1/operator/overview") {
      const auth = await ensureAuth(req);
      if (auth.error || !auth.context) return auth.error;
      if (!auth.context.role || !["artist", "admin"].includes(auth.context.role)) {
        return json({ error: "forbidden: operator access requires artist/admin role" }, 403);
      }

      const now = new Date();
      const startTodayUtc = new Date(now);
      startTodayUtc.setUTCHours(0, 0, 0, 0);
      const last24Iso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      const [uploadsTodayRes, queuedRes, failed24Res, oldestJobRes, attempts24Res, failures24Res] = await Promise.all([
        supabase
          .from("upload_assets")
          .select("asset_id", { count: "exact", head: true })
          .in("kind", ["master_audio", "cover_art"])
          .gte("created_at", startTodayUtc.toISOString()),
        supabase
          .from("transcode_jobs")
          .select("job_id", { count: "exact", head: true })
          .eq("status", "queued"),
        supabase
          .from("transcode_jobs")
          .select("job_id", { count: "exact", head: true })
          .eq("status", "failed")
          .gte("updated_at", last24Iso),
        supabase
          .from("transcode_jobs")
          .select("job_id, created_at")
          .in("status", ["queued", "in_progress"])
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("listener_stream_attempts")
          .select("attempt_id", { count: "exact", head: true })
          .gte("attempted_at", last24Iso),
        supabase
          .from("listener_stream_attempts")
          .select("attempt_id", { count: "exact", head: true })
          .eq("success", false)
          .gte("attempted_at", last24Iso)
      ]);

      if (uploadsTodayRes.error) return json({ error: uploadsTodayRes.error.message }, 400);
      if (queuedRes.error) return json({ error: queuedRes.error.message }, 400);
      if (failed24Res.error) return json({ error: failed24Res.error.message }, 400);
      if (oldestJobRes.error) return json({ error: oldestJobRes.error.message }, 400);
      if (attempts24Res.error) return json({ error: attempts24Res.error.message }, 400);
      if (failures24Res.error) return json({ error: failures24Res.error.message }, 400);

      const oldestCreatedAt = oldestJobRes.data?.created_at ? new Date(oldestJobRes.data.created_at).getTime() : null;
      const oldestJobAgeMinutes = oldestCreatedAt
        ? Math.max(0, Math.floor((Date.now() - oldestCreatedAt) / 60000))
        : 0;

      return json({
        generatedAt: nowIso(),
        metrics: {
          uploadsToday: uploadsTodayRes.count ?? 0,
          transcodeQueued: queuedRes.count ?? 0,
          transcodeFailed24h: failed24Res.count ?? 0,
          oldestJobAgeMinutes,
          playAttempts24h: attempts24Res.count ?? 0,
          playFailures24h: failures24Res.count ?? 0
        }
      });
    }

    if (req.method === "GET" && routePath === "/v1/admin/dashboard") {
      const admin = await ensureAdmin(req);
      if (admin.error || !admin.context) return admin.error;

      const now = new Date();
      const last24Iso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const last30MinIso = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
      const last7DaysIso = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [
        usersCountRes,
        artistsCountRes,
        draftReleasesRes,
        processingReleasesRes,
        failedTranscodesRes,
        recentPublishesRes,
        uploadAssetsRes,
        playEventsRes,
        recentIssueReportsRes,
        openFlagsRes,
        ingestEventsRes
      ] = await Promise.all([
        supabase.from("app_users").select("user_id", { count: "exact", head: true }),
        supabase.from("artist_profiles").select("artist_id", { count: "exact", head: true }),
        supabase.from("releases").select("release_id", { count: "exact", head: true }).eq("status", "draft"),
        supabase
          .from("releases")
          .select("release_id", { count: "exact", head: true })
          .in("status", ["submitted", "in_transcode"]),
        supabase.from("transcode_jobs").select("job_id", { count: "exact", head: true }).eq("status", "failed"),
        supabase
          .from("releases")
          .select("release_id", { count: "exact", head: true })
          .eq("status", "live")
          .gte("updated_at", last24Iso),
        supabase.from("upload_assets").select("byte_size, status").limit(2000),
        supabase
          .from("listener_play_events")
          .select("listener_user_id, track_id, created_at")
          .gte("created_at", last7DaysIso)
          .order("created_at", { ascending: false })
          .limit(3000),
        supabase
          .from("client_issue_reports")
          .select("report_id, report_category, created_at, app_surface")
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("moderation_flags")
          .select("flag_id, category, status, created_at")
          .in("status", ["open", "in_review", "escalated"])
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("listener_event_log")
          .select("event_id", { count: "exact", head: true })
          .gte("event_time", last30MinIso)
      ]);

      if (usersCountRes.error) return json({ error: usersCountRes.error.message }, 400);
      if (artistsCountRes.error) return json({ error: artistsCountRes.error.message }, 400);
      if (draftReleasesRes.error) return json({ error: draftReleasesRes.error.message }, 400);
      if (processingReleasesRes.error) return json({ error: processingReleasesRes.error.message }, 400);
      if (failedTranscodesRes.error) return json({ error: failedTranscodesRes.error.message }, 400);
      if (recentPublishesRes.error) return json({ error: recentPublishesRes.error.message }, 400);
      if (uploadAssetsRes.error) return json({ error: uploadAssetsRes.error.message }, 400);
      if (playEventsRes.error) return json({ error: playEventsRes.error.message }, 400);
      if (recentIssueReportsRes.error) return json({ error: recentIssueReportsRes.error.message }, 400);
      if (openFlagsRes.error && !isMissingTableError(openFlagsRes.error)) {
        return json({ error: openFlagsRes.error.message }, 400);
      }

      const storageUsageBytes = (uploadAssetsRes.data ?? []).reduce(
        (sum: number, row: any) => sum + Number(row.byte_size ?? 0),
        0
      );

      const activeListeners = new Set(
        (playEventsRes.data ?? [])
          .filter((row: any) => row.created_at && new Date(row.created_at).getTime() >= new Date(last30MinIso).getTime())
          .map((row: any) => row.listener_user_id)
          .filter(Boolean)
      ).size;

      const events = playEventsRes.data ?? [];
      const trackCounts = new Map<string, number>();
      for (const event of events) {
        if (!event.track_id) continue;
        trackCounts.set(event.track_id, (trackCounts.get(event.track_id) ?? 0) + 1);
      }
      const topTrackIds = Array.from(trackCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([trackId]) => trackId);

      const { data: topTracksRows } = topTrackIds.length
        ? await supabase
            .from("tracks")
            .select("track_id, title, release_id")
            .in("track_id", topTrackIds)
        : { data: [] as any[] };
      const topTrackMap = new Map((topTracksRows ?? []).map((row: any) => [row.track_id, row]));
      const topTracks = topTrackIds.map((trackId) => ({
        trackId,
        title: topTrackMap.get(trackId)?.title ?? "Unknown",
        plays: trackCounts.get(trackId) ?? 0,
        releaseId: topTrackMap.get(trackId)?.release_id ?? null
      }));

      const releaseCounts = new Map<string, number>();
      for (const track of topTracks) {
        if (!track.releaseId) continue;
        releaseCounts.set(track.releaseId, (releaseCounts.get(track.releaseId) ?? 0) + track.plays);
      }
      const topReleaseIds = Array.from(releaseCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([releaseId]) => releaseId);
      const { data: topReleasesRows } = topReleaseIds.length
        ? await supabase
            .from("releases")
            .select("release_id, title, artist_id")
            .in("release_id", topReleaseIds)
        : { data: [] as any[] };
      const topReleaseMap = new Map((topReleasesRows ?? []).map((row: any) => [row.release_id, row]));
      const topReleases = topReleaseIds.map((releaseId) => ({
        releaseId,
        title: topReleaseMap.get(releaseId)?.title ?? "Unknown",
        plays: releaseCounts.get(releaseId) ?? 0,
        artistId: topReleaseMap.get(releaseId)?.artist_id ?? null
      }));

      const artistCounts = new Map<string, number>();
      for (const release of topReleases) {
        if (!release.artistId) continue;
        artistCounts.set(release.artistId, (artistCounts.get(release.artistId) ?? 0) + release.plays);
      }
      const topArtistIds = Array.from(artistCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([artistId]) => artistId);
      const { data: topArtistsRows } = topArtistIds.length
        ? await supabase
            .from("artist_profiles")
            .select("artist_id, stage_name")
            .in("artist_id", topArtistIds)
        : { data: [] as any[] };
      const topArtistMap = new Map((topArtistsRows ?? []).map((row: any) => [row.artist_id, row]));
      const topArtists = topArtistIds.map((artistId) => ({
        artistId,
        stageName: topArtistMap.get(artistId)?.stage_name ?? "Unknown",
        plays: artistCounts.get(artistId) ?? 0
      }));

      const failedTranscodes = failedTranscodesRes.count ?? 0;
      const processingCount = processingReleasesRes.count ?? 0;
      const recentErrors = (recentIssueReportsRes.data ?? []).length + failedTranscodes;
      const healthStatus =
        failedTranscodes > 10 || processingCount > 30 || recentErrors > 30
          ? "on_fire"
          : failedTranscodes > 0 || recentErrors > 5
            ? "warning"
            : "healthy";

      return json({
        generatedAt: nowIso(),
        healthStatus,
        metrics: {
          totalUsers: usersCountRes.count ?? 0,
          activeListeners,
          totalArtists: artistsCountRes.count ?? 0,
          draftsPendingReview: draftReleasesRes.count ?? 0,
          releasesProcessing: processingCount,
          failedTranscodes,
          recentPublishes: recentPublishesRes.count ?? 0,
          recentErrors,
          storageUsageBytes,
          eventIngestHealth:
            ingestEventsRes.error && isMissingTableError(ingestEventsRes.error)
              ? { status: "unknown", eventsLast30m: null }
              : { status: (ingestEventsRes.count ?? 0) > 0 ? "ok" : "degraded", eventsLast30m: ingestEventsRes.count ?? 0 }
        },
        top: {
          tracks: topTracks,
          releases: topReleases,
          artists: topArtists
        },
        latest: {
          supportFlags: openFlagsRes.data ?? [],
          reports: recentIssueReportsRes.data ?? []
        }
      });
    }

    if (req.method === "GET" && routePath === "/v1/admin/artists") {
      const admin = await ensureAdmin(req);
      if (admin.error || !admin.context) return admin.error;

      const url = new URL(req.url);
      const query = toNonEmptyString(url.searchParams.get("q") ?? "").toLowerCase();
      const limitRaw = Number(url.searchParams.get("limit") ?? "50");
      const limit = Math.max(1, Math.min(200, Number.isFinite(limitRaw) ? limitRaw : 50));

      const { data: artists, error } = await supabase
        .from("artist_profiles")
        .select("artist_id, stage_name, onboarding_status, created_at, user_id, app_users!inner(email, account_status, last_active_at)")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) return json({ error: error.message }, 400);

      const artistIds = (artists ?? []).map((artist: any) => artist.artist_id);
      const [releaseRowsRes, rightsRowsRes, flagsRowsRes] = await Promise.all([
        artistIds.length
          ? supabase.from("releases").select("release_id, artist_id").in("artist_id", artistIds)
          : Promise.resolve({ data: [], error: null } as any),
        artistIds.length
          ? supabase
              .from("artist_rights_attestations")
              .select("artist_id, attested_at, owns_masters")
              .in("artist_id", artistIds)
              .order("attested_at", { ascending: false })
          : Promise.resolve({ data: [], error: null } as any),
        artistIds.length
          ? supabase
              .from("moderation_flags")
              .select("flag_id, target_id, status")
              .eq("target_type", "artist")
              .in("target_id", artistIds)
          : Promise.resolve({ data: [], error: null } as any)
      ]);

      if (releaseRowsRes.error) return json({ error: releaseRowsRes.error.message }, 400);
      if (rightsRowsRes.error) return json({ error: rightsRowsRes.error.message }, 400);
      if (flagsRowsRes.error && !isMissingTableError(flagsRowsRes.error)) {
        return json({ error: flagsRowsRes.error.message }, 400);
      }

      const releaseCountByArtistId = new Map<string, number>();
      for (const row of releaseRowsRes.data ?? []) {
        releaseCountByArtistId.set(row.artist_id, (releaseCountByArtistId.get(row.artist_id) ?? 0) + 1);
      }

      const rightsByArtistId = new Map<string, any>();
      for (const row of rightsRowsRes.data ?? []) {
        if (!rightsByArtistId.has(row.artist_id)) rightsByArtistId.set(row.artist_id, row);
      }

      const flagsByArtistId = new Map<string, number>();
      for (const row of flagsRowsRes.data ?? []) {
        if (row.status === "resolved" || row.status === "dismissed") continue;
        flagsByArtistId.set(row.target_id, (flagsByArtistId.get(row.target_id) ?? 0) + 1);
      }

      const mapped = (artists ?? [])
        .map((artist: any) => ({
          artistId: artist.artist_id,
          displayName: artist.stage_name,
          email: artist.app_users?.email ?? null,
          onboardingStatus: artist.onboarding_status,
          verificationStatus: rightsByArtistId.get(artist.artist_id)?.owns_masters ? "verified" : "unverified",
          strikesOrFlags: flagsByArtistId.get(artist.artist_id) ?? 0,
          linkedReleases: releaseCountByArtistId.get(artist.artist_id) ?? 0,
          rightsStatus: rightsByArtistId.get(artist.artist_id)
            ? rightsByArtistId.get(artist.artist_id).owns_masters
              ? "owns_masters"
              : "attested_other"
            : "unknown",
          payoutStatus: "not_configured",
          accountStatus: artist.app_users?.account_status ?? "active",
          createdAt: artist.created_at,
          lastActiveAt: artist.app_users?.last_active_at ?? null
        }))
        .filter((item: any) => {
          if (!query) return true;
          return item.displayName.toLowerCase().includes(query) || String(item.email ?? "").toLowerCase().includes(query);
        });

      return json({ artists: mapped });
    }

    const adminArtistActionId = getPathParam(routePath, /^\/v1\/admin\/artists\/([0-9a-f-]+)\/actions$/i);
    if (req.method === "POST" && adminArtistActionId) {
      const admin = await ensureAdmin(req, ["super_admin", "ops_admin", "content_admin"]);
      if (admin.error || !admin.context) return admin.error;
      const body = await parseJson(req);
      const action = toNonEmptyString(body.action).toLowerCase();
      const reason = toNonEmptyString(body.reason).slice(0, 1024);
      if (!reason) return json({ error: "reason is required for artist actions" }, 400);

      const { data: artist, error: artistError } = await supabase
        .from("artist_profiles")
        .select("artist_id, user_id, onboarding_status, stage_name")
        .eq("artist_id", adminArtistActionId)
        .maybeSingle();
      if (artistError) return json({ error: artistError.message }, 400);
      if (!artist) return json({ error: "artist not found" }, 404);

      if (action === "delete_permanent") {
        if (artist.user_id === admin.context.userId) {
          return json({ error: "cannot permanently delete your own admin account" }, 400);
        }

        const { data: releases, error: releasesError } = await supabase
          .from("releases")
          .select("release_id")
          .eq("artist_id", adminArtistActionId);
        if (releasesError) return json({ error: releasesError.message }, 400);
        const releaseIds = (releases ?? []).map((release: any) => release.release_id);

        let trackIds: string[] = [];
        if (releaseIds.length > 0) {
          const { data: tracks, error: tracksError } = await supabase
            .from("tracks")
            .select("track_id")
            .in("release_id", releaseIds);
          if (tracksError) return json({ error: tracksError.message }, 400);
          trackIds = (tracks ?? []).map((track: any) => track.track_id);
        }

        if (trackIds.length > 0) {
          const cleanupTrackOps = await Promise.all([
            supabase.from("track_credits").delete().in("track_id", trackIds),
            supabase.from("listener_play_events").delete().in("track_id", trackIds),
            supabase.from("listener_event_log").delete().in("track_id", trackIds),
            supabase.from("listener_track_saves").delete().in("track_id", trackIds),
            supabase.from("client_issue_reports").delete().in("track_id", trackIds),
            supabase.from("moderation_flags").delete().eq("target_type", "track").in("target_id", trackIds)
          ]);
          for (const result of cleanupTrackOps) {
            if (!isIgnorableDeleteError(result.error)) return json({ error: result.error?.message ?? "track cleanup failed" }, 400);
          }
        }

        if (releaseIds.length > 0) {
          const cleanupReleaseOps = await Promise.all([
            supabase.from("transcode_jobs").delete().in("release_id", releaseIds),
            supabase.from("client_issue_reports").delete().in("release_id", releaseIds),
            supabase.from("moderation_flags").delete().eq("target_type", "release").in("target_id", releaseIds),
            supabase.from("release_suggestions").delete().in("source_release_id", releaseIds),
            supabase.from("release_suggestions").delete().in("target_release_id", releaseIds)
          ]);
          for (const result of cleanupReleaseOps) {
            if (!isIgnorableDeleteError(result.error)) return json({ error: result.error?.message ?? "release cleanup failed" }, 400);
          }
        }

        const cleanupArtistOps = await Promise.all([
          supabase.from("releases").delete().eq("artist_id", adminArtistActionId),
          supabase.from("artist_rights_attestations").delete().eq("artist_id", adminArtistActionId),
          supabase.from("client_issue_reports").delete().eq("artist_id", adminArtistActionId),
          supabase.from("moderation_flags").delete().eq("target_type", "artist").eq("target_id", adminArtistActionId),
          supabase.from("artist_profiles").delete().eq("artist_id", adminArtistActionId)
        ]);
        for (const result of cleanupArtistOps) {
          if (!isIgnorableDeleteError(result.error)) return json({ error: result.error?.message ?? "artist cleanup failed" }, 400);
        }

        const { error: appUserDeleteError } = await supabase
          .from("app_users")
          .delete()
          .eq("user_id", artist.user_id);
        if (appUserDeleteError) return json({ error: appUserDeleteError.message }, 400);

        const authDeleteResult = await supabase.auth.admin.deleteUser(artist.user_id);
        if (authDeleteResult.error) return json({ error: authDeleteResult.error.message }, 400);

        await writeAdminAuditEvent({
          actorUserId: admin.context.userId,
          actorAdminScope: admin.context.adminScope,
          action: "artist_delete_permanent",
          entityType: "artist",
          entityId: adminArtistActionId,
          reason,
          metadata: { stageName: artist.stage_name ?? null, releaseCount: releaseIds.length, trackCount: trackIds.length }
        });

        return json({ ok: true, artistId: adminArtistActionId, deleted: true });
      }

      if (action === "verify") {
        const ownsMasters = body.ownsMasters !== false;
        const { data: row, error: rightsError } = await supabase
          .from("artist_rights_attestations")
          .insert({
            artist_id: adminArtistActionId,
            owns_masters: ownsMasters,
            rights_statement: reason,
            attested_at: nowIso()
          })
          .select("attestation_id, artist_id, owns_masters, attested_at")
          .single();
        if (rightsError || !row) return json({ error: rightsError?.message ?? "failed to verify artist" }, 400);
        await writeAdminAuditEvent({
          actorUserId: admin.context.userId,
          actorAdminScope: admin.context.adminScope,
          action: "artist_verify",
          entityType: "artist",
          entityId: adminArtistActionId,
          reason
        });
        return json({ ok: true, verification: row });
      }

      if (action === "approve_onboarding" || action === "reject_onboarding") {
        const nextStatus = action === "approve_onboarding" ? "approved" : "rejected";
        const { data: updated, error: updateError } = await supabase
          .from("artist_profiles")
          .update({ onboarding_status: nextStatus, updated_at: nowIso() })
          .eq("artist_id", adminArtistActionId)
          .select("artist_id, onboarding_status")
          .single();
        if (updateError || !updated) return json({ error: updateError?.message ?? "failed to update onboarding status" }, 400);
        await writeAdminAuditEvent({
          actorUserId: admin.context.userId,
          actorAdminScope: admin.context.adminScope,
          action: `artist_${action}`,
          entityType: "artist",
          entityId: adminArtistActionId,
          reason
        });
        return json({ ok: true, artist: updated });
      }

      if (action === "suspend" || action === "reinstate") {
        const accountStatus = action === "suspend" ? "suspended" : "active";
        const { data: updatedUser, error: userError } = await supabase
          .from("app_users")
          .update({ account_status: accountStatus })
          .eq("user_id", artist.user_id)
          .select("user_id, account_status")
          .single();
        if (userError || !updatedUser) return json({ error: userError?.message ?? "failed to update account status" }, 400);
        await writeAdminAuditEvent({
          actorUserId: admin.context.userId,
          actorAdminScope: admin.context.adminScope,
          action: `artist_${action}`,
          entityType: "artist",
          entityId: adminArtistActionId,
          reason
        });
        return json({ ok: true, account: updatedUser });
      }

      return json({ error: `unsupported artist action: ${action}` }, 400);
    }

    if (req.method === "GET" && routePath === "/v1/admin/releases") {
      const admin = await ensureAdmin(req);
      if (admin.error || !admin.context) return admin.error;

      const url = new URL(req.url);
      const statusFilter = toNonEmptyString(url.searchParams.get("status") ?? "").toLowerCase();
      const q = toNonEmptyString(url.searchParams.get("q") ?? "").toLowerCase();
      const limitRaw = Number(url.searchParams.get("limit") ?? "80");
      const limit = Math.max(1, Math.min(250, Number.isFinite(limitRaw) ? limitRaw : 80));

      let queryBuilder = supabase
        .from("releases")
        .select("release_id, title, release_type, status, genre, mood_tags, release_date, created_at, updated_at, is_hidden, is_featured, priority_rank, published_at, approved_at, artist_id, artist_profiles!inner(stage_name)")
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (statusFilter && statusFilter !== "all" && statusFilter !== "hidden") {
        queryBuilder = queryBuilder.eq("status", statusFilter);
      }
      if (statusFilter === "hidden") {
        queryBuilder = queryBuilder.eq("is_hidden", true);
      }
      if (q) {
        queryBuilder = queryBuilder.ilike("title", `%${q}%`);
      }

      const { data: releases, error } = await queryBuilder;
      if (error) return json({ error: error.message }, 400);

      const releaseIds = (releases ?? []).map((release: any) => release.release_id);
      const { data: trackRows, error: trackError } = releaseIds.length
        ? await supabase.from("tracks").select("track_id, release_id").in("release_id", releaseIds)
        : { data: [], error: null as any };
      if (trackError) return json({ error: trackError.message }, 400);

      const trackCountByReleaseId = new Map<string, number>();
      for (const row of trackRows ?? []) {
        trackCountByReleaseId.set(row.release_id, (trackCountByReleaseId.get(row.release_id) ?? 0) + 1);
      }

      return json({
        releases: (releases ?? []).map((release: any) => ({
          releaseId: release.release_id,
          title: release.title,
          artistId: release.artist_id,
          artistName: release.artist_profiles?.stage_name ?? "Unknown",
          type: release.release_type,
          status: release.status,
          isHidden: !!release.is_hidden,
          isFeatured: !!release.is_featured,
          priorityRank: release.priority_rank ?? 0,
          submissionDate: release.created_at,
          publishDate: release.published_at ?? null,
          releaseDate: release.release_date,
          trackCount: trackCountByReleaseId.get(release.release_id) ?? 0
        }))
      });
    }

    const adminReleaseId = getPathParam(routePath, /^\/v1\/admin\/releases\/([0-9a-f-]+)$/i);
    if (req.method === "GET" && adminReleaseId) {
      const admin = await ensureAdmin(req);
      if (admin.error || !admin.context) return admin.error;

      const { data: release, error: releaseError } = await supabase
        .from("releases")
        .select("release_id, artist_id, title, release_type, status, genre, mood_tags, about, release_date, created_at, updated_at, is_hidden, is_featured, priority_rank, moderation_notes, approved_at, published_at, cover_asset_id, artist_profiles!inner(stage_name)")
        .eq("release_id", adminReleaseId)
        .maybeSingle();
      if (releaseError) return json({ error: releaseError.message }, 400);
      if (!release) return json({ error: "release not found" }, 404);

      const { data: tracks, error: tracksError } = await supabase
        .from("tracks")
        .select("track_id, title, track_number, duration_sec, stream_manifest_path, master_asset_id, created_at")
        .eq("release_id", adminReleaseId)
        .order("track_number", { ascending: true });
      if (tracksError) return json({ error: tracksError.message }, 400);

      const trackAssetIds = (tracks ?? []).map((track: any) => track.master_asset_id).filter(Boolean);
      const assetIds = Array.from(new Set([release.cover_asset_id, ...trackAssetIds].filter(Boolean)));
      const { data: assets, error: assetsError } = assetIds.length
        ? await supabase
            .from("upload_assets")
            .select("asset_id, kind, storage_bucket, storage_path, status, byte_size, checksum_sha256, content_type")
            .in("asset_id", assetIds)
        : { data: [], error: null as any };
      if (assetsError) return json({ error: assetsError.message }, 400);
      const assetById = new Map((assets ?? []).map((asset: any) => [asset.asset_id, asset]));

      const { data: jobs, error: jobsError } = await supabase
        .from("transcode_jobs")
        .select("job_id, track_id, source_asset_id, status, attempts, max_attempts, error_message, created_at, started_at, completed_at, updated_at")
        .eq("release_id", adminReleaseId)
        .order("created_at", { ascending: false });
      if (jobsError) return json({ error: jobsError.message }, 400);

      const { data: auditRows, error: auditError } = await supabase
        .from("admin_audit_events")
        .select("audit_id, actor_user_id, action, entity_type, entity_id, reason, metadata, created_at")
        .eq("entity_type", "release")
        .eq("entity_id", adminReleaseId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (auditError && !isMissingTableError(auditError)) return json({ error: auditError.message }, 400);

      return json({
        release: {
          releaseId: release.release_id,
          title: release.title,
          artistId: release.artist_id,
          artistName: release.artist_profiles?.stage_name ?? "Unknown",
          type: release.release_type,
          status: release.status,
          genre: release.genre,
          moodTags: release.mood_tags ?? [],
          about: release.about ?? "",
          releaseDate: release.release_date,
          submissionDate: release.created_at,
          publishDate: release.published_at,
          approvedAt: release.approved_at,
          isHidden: !!release.is_hidden,
          isFeatured: !!release.is_featured,
          priorityRank: release.priority_rank ?? 0,
          moderationNotes: release.moderation_notes ?? "",
          coverStatus: release.cover_asset_id ? assetById.get(release.cover_asset_id)?.status ?? "missing" : "missing",
          coverAsset: release.cover_asset_id ? assetById.get(release.cover_asset_id) ?? null : null
        },
        tracks: (tracks ?? []).map((track: any) => {
          const master = track.master_asset_id ? assetById.get(track.master_asset_id) : null;
          return {
            trackId: track.track_id,
            title: track.title,
            trackNumber: track.track_number,
            durationSec: track.duration_sec ?? null,
            hlsManifestPath: track.stream_manifest_path ?? null,
            hlsManifestStatus: track.stream_manifest_path ? "present" : "missing",
            audioAssetHealth: master?.status ?? "unknown",
            masterAsset: master
          };
        }),
        processingHistory: jobs ?? [],
        adminActionHistory: auditRows ?? []
      });
    }

    const adminReleaseActionId = getPathParam(routePath, /^\/v1\/admin\/releases\/([0-9a-f-]+)\/actions$/i);
    if (req.method === "POST" && adminReleaseActionId) {
      const admin = await ensureAdmin(req, ["super_admin", "ops_admin", "content_admin"]);
      if (admin.error || !admin.context) return admin.error;
      const body = await parseJson(req);
      const action = toNonEmptyString(body.action).toLowerCase();
      const reason = toNonEmptyString(body.reason).slice(0, 1024);
      const priorityRaw = Number(body.priorityRank ?? body.priority);
      const priorityRank = Number.isFinite(priorityRaw) ? priorityRaw : null;

      if (!reason) return json({ error: "reason is required for admin release actions" }, 400);

      const { data: existing, error: existingError } = await supabase
        .from("releases")
        .select("release_id, status, is_hidden, is_featured, priority_rank")
        .eq("release_id", adminReleaseActionId)
        .maybeSingle();
      if (existingError) return json({ error: existingError.message }, 400);
      if (!existing) return json({ error: "release not found" }, 404);

      const patch: Record<string, unknown> = { updated_at: nowIso(), moderation_notes: reason };
      if (action === "delete_permanent") {
        const { data: tracks, error: tracksReadError } = await supabase
          .from("tracks")
          .select("track_id")
          .eq("release_id", adminReleaseActionId);
        if (tracksReadError) return json({ error: tracksReadError.message }, 400);

        const trackIds = (tracks ?? []).map((track: any) => track.track_id);
        if (trackIds.length > 0) {
          const cleanupTrackOps = await Promise.all([
            supabase.from("track_credits").delete().in("track_id", trackIds),
            supabase.from("listener_play_events").delete().in("track_id", trackIds),
            supabase.from("listener_event_log").delete().in("track_id", trackIds),
            supabase.from("listener_track_saves").delete().in("track_id", trackIds),
            supabase.from("client_issue_reports").delete().in("track_id", trackIds),
            supabase.from("moderation_flags").delete().eq("target_type", "track").in("target_id", trackIds)
          ]);
          for (const result of cleanupTrackOps) {
            if (!isIgnorableDeleteError(result.error)) return json({ error: result.error?.message ?? "track cleanup failed" }, 400);
          }
        }

        const cleanupReleaseOps = await Promise.all([
          supabase.from("transcode_jobs").delete().eq("release_id", adminReleaseActionId),
          supabase.from("client_issue_reports").delete().eq("release_id", adminReleaseActionId),
          supabase.from("moderation_flags").delete().eq("target_type", "release").eq("target_id", adminReleaseActionId),
          supabase.from("release_suggestions").delete().or(`source_release_id.eq.${adminReleaseActionId},target_release_id.eq.${adminReleaseActionId}`),
          supabase.from("tracks").delete().eq("release_id", adminReleaseActionId)
        ]);
        for (const result of cleanupReleaseOps) {
          if (!isIgnorableDeleteError(result.error)) return json({ error: result.error?.message ?? "release cleanup failed" }, 400);
        }

        const { error: releaseDeleteError } = await supabase
          .from("releases")
          .delete()
          .eq("release_id", adminReleaseActionId);
        if (releaseDeleteError) return json({ error: releaseDeleteError.message }, 400);

        await writeAdminAuditEvent({
          actorUserId: admin.context.userId,
          actorAdminScope: admin.context.adminScope,
          action: "release_delete_permanent",
          entityType: "release",
          entityId: adminReleaseActionId,
          reason,
          metadata: { fromStatus: existing.status, trackCount: trackIds.length }
        });

        return json({ ok: true, releaseId: adminReleaseActionId, deleted: true });
      } else if (action === "approve") {
        patch.status = "in_transcode";
        patch.approved_at = nowIso();
      } else if (action === "reject") {
        patch.status = "rejected";
      } else if (action === "unpublish") {
        patch.status = "submitted";
        patch.is_hidden = true;
      } else if (action === "republish") {
        patch.status = "live";
        patch.is_hidden = false;
        patch.published_at = nowIso();
      } else if (action === "hide") {
        patch.is_hidden = true;
      } else if (action === "unhide") {
        patch.is_hidden = false;
      } else if (action === "feature") {
        patch.is_featured = true;
      } else if (action === "unfeature") {
        patch.is_featured = false;
      } else if (action === "set_priority") {
        if (priorityRank === null) return json({ error: "priorityRank is required" }, 400);
        patch.priority_rank = priorityRank;
      } else {
        return json({ error: `unsupported release action: ${action}` }, 400);
      }

      const { data: updated, error: updateError } = await supabase
        .from("releases")
        .update(patch)
        .eq("release_id", adminReleaseActionId)
        .select("release_id, status, is_hidden, is_featured, priority_rank, moderation_notes, approved_at, published_at, updated_at")
        .single();
      if (updateError || !updated) return json({ error: updateError?.message ?? "failed to update release" }, 400);

      await writeAdminAuditEvent({
        actorUserId: admin.context.userId,
        actorAdminScope: admin.context.adminScope,
        action: `release_${action}`,
        entityType: "release",
        entityId: adminReleaseActionId,
        reason,
        metadata: {
          fromStatus: existing.status,
          toStatus: updated.status,
          fromHidden: existing.is_hidden,
          toHidden: updated.is_hidden
        }
      });

      return json({
        releaseId: updated.release_id,
        status: updated.status,
        isHidden: !!updated.is_hidden,
        isFeatured: !!updated.is_featured,
        priorityRank: updated.priority_rank ?? 0,
        moderationNotes: updated.moderation_notes ?? "",
        approvedAt: updated.approved_at,
        publishedAt: updated.published_at,
        updatedAt: updated.updated_at
      });
    }

    const adminTrackActionId = getPathParam(routePath, /^\/v1\/admin\/tracks\/([0-9a-f-]+)\/actions$/i);
    if (req.method === "POST" && adminTrackActionId) {
      const admin = await ensureAdmin(req, ["super_admin", "ops_admin", "content_admin"]);
      if (admin.error || !admin.context) return admin.error;
      const body = await parseJson(req);
      const action = toNonEmptyString(body.action).toLowerCase();
      const reason = toNonEmptyString(body.reason).slice(0, 1024);
      if (action !== "delete_permanent") return json({ error: `unsupported track action: ${action}` }, 400);
      if (!reason) return json({ error: "reason is required for permanent track deletion" }, 400);

      const { data: track, error: trackError } = await supabase
        .from("tracks")
        .select("track_id, release_id, title, master_asset_id, stream_manifest_path")
        .eq("track_id", adminTrackActionId)
        .maybeSingle();
      if (trackError) return json({ error: trackError.message }, 400);
      if (!track) return json({ error: "track not found" }, 404);

      const cleanupOps = await Promise.all([
        supabase.from("listener_play_events").delete().eq("track_id", adminTrackActionId),
        supabase.from("listener_event_log").delete().eq("track_id", adminTrackActionId),
        supabase.from("listener_track_saves").delete().eq("track_id", adminTrackActionId),
        supabase.from("transcode_jobs").delete().eq("track_id", adminTrackActionId),
        supabase.from("client_issue_reports").delete().eq("track_id", adminTrackActionId),
        supabase.from("moderation_flags").delete().eq("target_type", "track").eq("target_id", adminTrackActionId)
      ]);

      for (const result of cleanupOps) {
        if (result.error && !isMissingTableError(result.error)) {
          return json({ error: result.error.message }, 400);
        }
      }

      const { error: deleteTrackError } = await supabase.from("tracks").delete().eq("track_id", adminTrackActionId);
      if (deleteTrackError) return json({ error: deleteTrackError.message }, 400);

      let masterAssetDeleted = false;
      if (track.master_asset_id) {
        const { count: refsCount, error: refsError } = await supabase
          .from("tracks")
          .select("track_id", { count: "exact", head: true })
          .eq("master_asset_id", track.master_asset_id);
        if (refsError) return json({ error: refsError.message }, 400);
        if ((refsCount ?? 0) === 0) {
          const { error: deleteAssetError } = await supabase
            .from("upload_assets")
            .delete()
            .eq("asset_id", track.master_asset_id);
          if (deleteAssetError && !isMissingTableError(deleteAssetError)) {
            return json({ error: deleteAssetError.message }, 400);
          }
          masterAssetDeleted = !deleteAssetError;
        }
      }

      let manifestAssetDeleted = false;
      let segmentAssetsDeleted = false;
      if (track.stream_manifest_path) {
        const normalizedManifestPath = String(track.stream_manifest_path).replace(/^\/+/, "");
        const { error: manifestDeleteError } = await supabase
          .from("upload_assets")
          .delete()
          .eq("kind", "hls_manifest")
          .eq("storage_path", normalizedManifestPath);
        if (manifestDeleteError && !isMissingTableError(manifestDeleteError)) {
          return json({ error: manifestDeleteError.message }, 400);
        }
        manifestAssetDeleted = !manifestDeleteError;

        const slashIndex = normalizedManifestPath.lastIndexOf("/");
        if (slashIndex > 0) {
          const baseDir = normalizedManifestPath.slice(0, slashIndex);
          const { error: segmentDeleteError } = await supabase
            .from("upload_assets")
            .delete()
            .eq("kind", "hls_segment")
            .like("storage_path", `${baseDir}/%`);
          if (segmentDeleteError && !isMissingTableError(segmentDeleteError)) {
            return json({ error: segmentDeleteError.message }, 400);
          }
          segmentAssetsDeleted = !segmentDeleteError;
        }
      }

      await writeAdminAuditEvent({
        actorUserId: admin.context.userId,
        actorAdminScope: admin.context.adminScope,
        action: "track_delete_permanent",
        entityType: "track",
        entityId: adminTrackActionId,
        reason,
        metadata: {
          releaseId: track.release_id,
          title: track.title,
          masterAssetDeleted,
          manifestAssetDeleted,
          segmentAssetsDeleted
        }
      });

      return json({
        ok: true,
        trackId: adminTrackActionId,
        releaseId: track.release_id,
        deleted: {
          track: true,
          masterAssetDeleted,
          manifestAssetDeleted,
          segmentAssetsDeleted
        }
      });
    }

    if (req.method === "GET" && routePath === "/v1/admin/jobs") {
      const admin = await ensureAdmin(req);
      if (admin.error || !admin.context) return admin.error;
      const url = new URL(req.url);
      const statusFilter = toNonEmptyString(url.searchParams.get("status") ?? "").toLowerCase();
      const limitRaw = Number(url.searchParams.get("limit") ?? "120");
      const limit = Math.max(1, Math.min(300, Number.isFinite(limitRaw) ? limitRaw : 120));

      let jobsQuery = supabase
        .from("transcode_jobs")
        .select("job_id, release_id, track_id, source_asset_id, status, attempts, max_attempts, error_message, locked_by, locked_at, next_retry_at, created_at, updated_at, started_at, completed_at, releases(title, artist_profiles(stage_name))")
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (statusFilter && statusFilter !== "all") {
        jobsQuery = jobsQuery.eq("status", statusFilter);
      }

      const { data, error } = await jobsQuery;
      if (error) return json({ error: error.message }, 400);

      return json({
        jobs: (data ?? []).map((job: any) => ({
          jobId: job.job_id,
          releaseId: job.release_id,
          releaseTitle: job.releases?.title ?? "Unknown",
          artistName: job.releases?.artist_profiles?.stage_name ?? "Unknown",
          trackId: job.track_id,
          sourceAssetId: job.source_asset_id,
          status: job.status,
          attempts: job.attempts ?? 0,
          maxAttempts: job.max_attempts ?? 0,
          retryCount: job.attempts ?? 0,
          workerHeartbeat: job.locked_at ?? null,
          failureReason: job.error_message ?? null,
          logsHint: job.error_message ? "see failureReason" : "no_error",
          createdAt: job.created_at,
          updatedAt: job.updated_at,
          startedAt: job.started_at,
          completedAt: job.completed_at
        }))
      });
    }

    const adminJobActionId = getPathParam(routePath, /^\/v1\/admin\/jobs\/([0-9a-f-]+)\/actions$/i);
    if (req.method === "POST" && adminJobActionId) {
      const admin = await ensureAdmin(req, ["super_admin", "ops_admin"]);
      if (admin.error || !admin.context) return admin.error;
      const body = await parseJson(req);
      const action = toNonEmptyString(body.action).toLowerCase();
      const reason = toNonEmptyString(body.reason).slice(0, 1024);
      if (!reason) return json({ error: "reason is required for admin job actions" }, 400);

      const { data: existing, error: existingError } = await supabase
        .from("transcode_jobs")
        .select("job_id, status, attempts, max_attempts")
        .eq("job_id", adminJobActionId)
        .maybeSingle();
      if (existingError) return json({ error: existingError.message }, 400);
      if (!existing) return json({ error: "job not found" }, 404);

      let patch: Record<string, unknown>;
      if (action === "retry") {
        patch = {
          status: "queued",
          next_retry_at: nowIso(),
          error_message: null,
          locked_at: null,
          locked_by: null,
          updated_at: nowIso()
        };
      } else if (action === "cancel") {
        patch = {
          status: "failed",
          error_message: `cancelled_by_admin: ${reason}`,
          updated_at: nowIso(),
          completed_at: nowIso()
        };
      } else {
        return json({ error: `unsupported job action: ${action}` }, 400);
      }

      const { data: updated, error: updateError } = await supabase
        .from("transcode_jobs")
        .update(patch)
        .eq("job_id", adminJobActionId)
        .select("job_id, status, attempts, max_attempts, error_message, updated_at")
        .single();
      if (updateError || !updated) return json({ error: updateError?.message ?? "failed to update job" }, 400);

      await writeAdminAuditEvent({
        actorUserId: admin.context.userId,
        actorAdminScope: admin.context.adminScope,
        action: `job_${action}`,
        entityType: "job",
        entityId: adminJobActionId,
        reason,
        metadata: { fromStatus: existing.status, toStatus: updated.status }
      });

      return json({
        jobId: updated.job_id,
        status: updated.status,
        attempts: updated.attempts,
        maxAttempts: updated.max_attempts,
        failureReason: updated.error_message ?? null,
        updatedAt: updated.updated_at
      });
    }

    if (req.method === "GET" && routePath === "/v1/admin/moderation/flags") {
      const admin = await ensureAdmin(req);
      if (admin.error || !admin.context) return admin.error;
      const url = new URL(req.url);
      const statusFilter = toNonEmptyString(url.searchParams.get("status") ?? "").toLowerCase();
      const limitRaw = Number(url.searchParams.get("limit") ?? "120");
      const limit = Math.max(1, Math.min(250, Number.isFinite(limitRaw) ? limitRaw : 120));

      let queryBuilder = supabase
        .from("moderation_flags")
        .select("flag_id, target_type, target_id, source_report_id, category, status, notes, created_by_user_id, assigned_admin_user_id, created_at, updated_at, resolved_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (statusFilter && statusFilter !== "all") {
        queryBuilder = queryBuilder.eq("status", statusFilter);
      }

      const { data, error } = await queryBuilder;
      if (error && isMissingTableError(error)) return json({ flags: [] });
      if (error) return json({ error: error.message }, 400);
      return json({ flags: data ?? [] });
    }

    const moderationFlagActionId = getPathParam(routePath, /^\/v1\/admin\/moderation\/flags\/([0-9a-f-]+)\/actions$/i);
    if (req.method === "POST" && moderationFlagActionId) {
      const admin = await ensureAdmin(req, ["super_admin", "ops_admin", "content_admin"]);
      if (admin.error || !admin.context) return admin.error;
      const body = await parseJson(req);
      const action = toNonEmptyString(body.action).toLowerCase();
      const reason = toNonEmptyString(body.reason).slice(0, 1024);
      if (!reason) return json({ error: "reason is required for moderation actions" }, 400);

      const { data: flag, error: flagError } = await supabase
        .from("moderation_flags")
        .select("flag_id, target_type, target_id, status, notes")
        .eq("flag_id", moderationFlagActionId)
        .maybeSingle();
      if (flagError) return json({ error: flagError.message }, 400);
      if (!flag) return json({ error: "flag not found" }, 404);

      const patch: Record<string, unknown> = {
        updated_at: nowIso(),
        notes: [flag.notes, reason].filter(Boolean).join("\n")
      };

      if (action === "start_review") {
        patch.status = "in_review";
      } else if (action === "escalate") {
        patch.status = "escalated";
      } else if (action === "resolve") {
        patch.status = "resolved";
        patch.resolved_at = nowIso();
      } else if (action === "dismiss") {
        patch.status = "dismissed";
        patch.resolved_at = nowIso();
      } else if (action === "hide_content") {
        if (flag.target_type === "release" && flag.target_id) {
          await supabase.from("releases").update({ is_hidden: true, updated_at: nowIso() }).eq("release_id", flag.target_id);
        }
        patch.status = "resolved";
        patch.resolved_at = nowIso();
      } else if (action === "suspend_artist") {
        if (flag.target_type !== "artist" || !flag.target_id) return json({ error: "flag target is not an artist" }, 400);
        const { data: artist } = await supabase
          .from("artist_profiles")
          .select("user_id")
          .eq("artist_id", flag.target_id)
          .maybeSingle();
        if (artist?.user_id) {
          await supabase.from("app_users").update({ account_status: "suspended" }).eq("user_id", artist.user_id);
        }
        patch.status = "resolved";
        patch.resolved_at = nowIso();
      } else {
        return json({ error: `unsupported moderation action: ${action}` }, 400);
      }

      const { data: updated, error: updateError } = await supabase
        .from("moderation_flags")
        .update(patch)
        .eq("flag_id", moderationFlagActionId)
        .select("flag_id, status, notes, updated_at, resolved_at")
        .single();
      if (updateError || !updated) return json({ error: updateError?.message ?? "failed to update flag" }, 400);

      await writeAdminAuditEvent({
        actorUserId: admin.context.userId,
        actorAdminScope: admin.context.adminScope,
        action: `moderation_${action}`,
        entityType: "moderation_flag",
        entityId: moderationFlagActionId,
        reason,
        metadata: { targetType: flag.target_type, targetId: flag.target_id }
      });

      return json({ flag: updated });
    }

    if (req.method === "GET" && routePath === "/v1/admin/reports") {
      const admin = await ensureAdmin(req);
      if (admin.error || !admin.context) return admin.error;
      const url = new URL(req.url);
      const category = toNonEmptyString(url.searchParams.get("category") ?? "").toLowerCase();
      const appSurface = toNonEmptyString(url.searchParams.get("app") ?? "").toLowerCase();
      const q = toNonEmptyString(url.searchParams.get("q") ?? "").toLowerCase();
      const limitRaw = Number(url.searchParams.get("limit") ?? "120");
      const limit = Math.max(1, Math.min(300, Number.isFinite(limitRaw) ? limitRaw : 120));

      let queryBuilder = supabase
        .from("client_issue_reports")
        .select("report_id, user_id, account_type, app_surface, platform, app_version, environment, route, report_category, user_description, error_code, error_message, failed_request_url, response_status, worker_job_id, release_id, track_id, artist_id, playback_session_id, client_timestamp, browser_info, device_info, network_state, client_actions, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (category) queryBuilder = queryBuilder.eq("report_category", category);
      if (appSurface) queryBuilder = queryBuilder.eq("app_surface", appSurface);

      const { data: reports, error } = await queryBuilder;
      if (error) return json({ error: error.message }, 400);

      const filtered = (reports ?? []).filter((report: any) => {
        if (!q) return true;
        return (
          String(report.report_id ?? "").toLowerCase().includes(q) ||
          String(report.user_description ?? "").toLowerCase().includes(q) ||
          String(report.error_message ?? "").toLowerCase().includes(q) ||
          String(report.route ?? "").toLowerCase().includes(q)
        );
      });
      return json({ reports: filtered });
    }

    const reportFlagRoute = getPathParam(routePath, /^\/v1\/admin\/reports\/([0-9a-f-]+)\/flag$/i);
    if (req.method === "POST" && reportFlagRoute) {
      const admin = await ensureAdmin(req, ["super_admin", "ops_admin", "content_admin"]);
      if (admin.error || !admin.context) return admin.error;
      const body = await parseJson(req);
      const category = toNonEmptyString(body.category || "other").toLowerCase();
      const reason = toNonEmptyString(body.reason).slice(0, 1024);
      if (!reason) return json({ error: "reason is required to create moderation flag" }, 400);

      const { data: report, error: reportError } = await supabase
        .from("client_issue_reports")
        .select("report_id, release_id, track_id, artist_id")
        .eq("report_id", reportFlagRoute)
        .maybeSingle();
      if (reportError) return json({ error: reportError.message }, 400);
      if (!report) return json({ error: "report not found" }, 404);

      const targetType = report.track_id ? "track" : report.release_id ? "release" : report.artist_id ? "artist" : "user";
      const targetId = report.track_id ?? report.release_id ?? report.artist_id ?? null;
      const { data: flag, error: flagError } = await supabase
        .from("moderation_flags")
        .insert({
          target_type: targetType,
          target_id: targetId,
          source_report_id: report.report_id,
          category: category || "other",
          status: "open",
          notes: reason,
          created_by_user_id: admin.context.userId
        })
        .select("flag_id, target_type, target_id, status, category, created_at")
        .single();
      if (flagError || !flag) return json({ error: flagError?.message ?? "failed to create moderation flag" }, 400);

      await writeAdminAuditEvent({
        actorUserId: admin.context.userId,
        actorAdminScope: admin.context.adminScope,
        action: "moderation_flag_create",
        entityType: "report",
        entityId: reportFlagRoute,
        reason,
        metadata: { createdFlagId: flag.flag_id, category: flag.category }
      });

      return json({ flag });
    }

    if (req.method === "GET" && routePath === "/v1/admin/audit") {
      const admin = await ensureAdmin(req);
      if (admin.error || !admin.context) return admin.error;
      const limitRaw = Number(new URL(req.url).searchParams.get("limit") ?? "150");
      const limit = Math.max(1, Math.min(500, Number.isFinite(limitRaw) ? limitRaw : 150));
      const { data, error } = await supabase
        .from("admin_audit_events")
        .select("audit_id, actor_user_id, actor_admin_scope, action, entity_type, entity_id, reason, metadata, created_at, app_users(email)")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error && isMissingTableError(error)) return json({ events: [] });
      if (error) return json({ error: error.message }, 400);
      return json({
        events: (data ?? []).map((event: any) => ({
          auditId: event.audit_id,
          actorUserId: event.actor_user_id,
          actorEmail: event.app_users?.email ?? null,
          actorAdminScope: event.actor_admin_scope,
          action: event.action,
          entityType: event.entity_type,
          entityId: event.entity_id,
          reason: event.reason,
          metadata: event.metadata ?? {},
          createdAt: event.created_at
        }))
      });
    }

    if (req.method === "GET" && routePath === "/v1/admin/users") {
      const admin = await ensureAdmin(req);
      if (admin.error || !admin.context) return admin.error;
      const url = new URL(req.url);
      const q = toNonEmptyString(url.searchParams.get("q") ?? "").toLowerCase();
      const roleFilter = toNonEmptyString(url.searchParams.get("role") ?? "").toLowerCase();
      const limitRaw = Number(url.searchParams.get("limit") ?? "120");
      const limit = Math.max(1, Math.min(300, Number.isFinite(limitRaw) ? limitRaw : 120));

      let queryBuilder = supabase
        .from("app_users")
        .select("user_id, email, role, admin_scope, account_status, created_at, last_active_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (roleFilter) queryBuilder = queryBuilder.eq("role", roleFilter);

      const { data: users, error } = await queryBuilder;
      if (error) return json({ error: error.message }, 400);

      const userIds = (users ?? []).map((user: any) => user.user_id);
      const [artistProfilesRes, savedRes, playsRes] = await Promise.all([
        userIds.length
          ? supabase.from("artist_profiles").select("artist_id, user_id, stage_name").in("user_id", userIds)
          : Promise.resolve({ data: [], error: null } as any),
        userIds.length
          ? supabase.from("listener_track_saves").select("listener_user_id, saved").in("listener_user_id", userIds)
          : Promise.resolve({ data: [], error: null } as any),
        userIds.length
          ? supabase.from("listener_play_events").select("listener_user_id, created_at").in("listener_user_id", userIds)
          : Promise.resolve({ data: [], error: null } as any)
      ]);
      if (artistProfilesRes.error) return json({ error: artistProfilesRes.error.message }, 400);
      if (savedRes.error && !isMissingTableError(savedRes.error)) return json({ error: savedRes.error.message }, 400);
      if (playsRes.error && !isMissingTableError(playsRes.error)) return json({ error: playsRes.error.message }, 400);

      const artistByUserId = new Map((artistProfilesRes.data ?? []).map((artist: any) => [artist.user_id, artist]));
      const savesCountByUserId = new Map<string, number>();
      for (const row of savedRes.data ?? []) {
        if (!row.saved) continue;
        savesCountByUserId.set(row.listener_user_id, (savesCountByUserId.get(row.listener_user_id) ?? 0) + 1);
      }
      const playsCountByUserId = new Map<string, number>();
      let latestPlayByUserId = new Map<string, string>();
      for (const row of playsRes.data ?? []) {
        playsCountByUserId.set(row.listener_user_id, (playsCountByUserId.get(row.listener_user_id) ?? 0) + 1);
        const existing = latestPlayByUserId.get(row.listener_user_id);
        if (!existing || new Date(row.created_at).getTime() > new Date(existing).getTime()) {
          latestPlayByUserId.set(row.listener_user_id, row.created_at);
        }
      }

      const filtered = (users ?? [])
        .map((user: any) => ({
          userId: user.user_id,
          email: user.email,
          role: user.role,
          adminScope: user.admin_scope ?? null,
          accountStatus: user.account_status ?? "active",
          createdAt: user.created_at,
          lastActiveAt: user.last_active_at ?? latestPlayByUserId.get(user.user_id) ?? null,
          artistId: artistByUserId.get(user.user_id)?.artist_id ?? null,
          artistName: artistByUserId.get(user.user_id)?.stage_name ?? null,
          savedLibraryCount: savesCountByUserId.get(user.user_id) ?? 0,
          telemetrySummary: { playEvents: playsCountByUserId.get(user.user_id) ?? 0 }
        }))
        .filter((user: any) => {
          if (!q) return true;
          return (
            String(user.userId).toLowerCase().includes(q) ||
            String(user.email).toLowerCase().includes(q) ||
            String(user.artistName ?? "").toLowerCase().includes(q)
          );
        });

      return json({ users: filtered });
    }

    const adminUserActionId = getPathParam(routePath, /^\/v1\/admin\/users\/([0-9a-f-]+)\/actions$/i);
    if (req.method === "POST" && adminUserActionId) {
      const admin = await ensureAdmin(req, ["super_admin", "ops_admin"]);
      if (admin.error || !admin.context) return admin.error;
      const body = await parseJson(req);
      const action = toNonEmptyString(body.action).toLowerCase();
      const reason = toNonEmptyString(body.reason).slice(0, 1024);
      if (!reason) return json({ error: "reason is required for user actions" }, 400);
      if (adminUserActionId === admin.context.userId && action === "delete_permanent") {
        return json({ error: "cannot permanently delete your own admin account" }, 400);
      }

      const { data: targetUser, error: targetUserError } = await supabase
        .from("app_users")
        .select("user_id, email, role, admin_scope, account_status")
        .eq("user_id", adminUserActionId)
        .maybeSingle();
      if (targetUserError) return json({ error: targetUserError.message }, 400);
      if (!targetUser) return json({ error: "user not found" }, 404);

      if (action === "suspend" || action === "reinstate") {
        const accountStatus = action === "suspend" ? "suspended" : "active";
        const { data: updatedUser, error: userError } = await supabase
          .from("app_users")
          .update({ account_status: accountStatus })
          .eq("user_id", adminUserActionId)
          .select("user_id, account_status")
          .single();
        if (userError || !updatedUser) return json({ error: userError?.message ?? "failed to update account status" }, 400);
        await writeAdminAuditEvent({
          actorUserId: admin.context.userId,
          actorAdminScope: admin.context.adminScope,
          action: `user_${action}`,
          entityType: "user",
          entityId: adminUserActionId,
          reason
        });
        return json({ ok: true, account: updatedUser });
      }

      if (action === "delete_permanent") {
        if (targetUser.role === "admin") {
          return json({ error: "permanent deletion for admin users is blocked" }, 400);
        }

        const { data: artistProfile, error: artistProfileError } = await supabase
          .from("artist_profiles")
          .select("artist_id")
          .eq("user_id", adminUserActionId)
          .maybeSingle();
        if (artistProfileError) return json({ error: artistProfileError.message }, 400);

        if (artistProfile?.artist_id) {
          return json({ error: "user is linked to an artist profile; delete it from Artists page with delete_permanent" }, 400);
        }

        const cleanupOps = await Promise.all([
          supabase.from("listener_play_events").delete().eq("listener_user_id", adminUserActionId),
          supabase.from("listener_event_log").delete().eq("listener_user_id", adminUserActionId),
          supabase.from("listener_track_saves").delete().eq("listener_user_id", adminUserActionId),
          supabase.from("client_issue_reports").delete().eq("user_id", adminUserActionId),
          supabase.from("upload_assets").delete().eq("owner_user_id", adminUserActionId)
        ]);
        for (const result of cleanupOps) {
          if (!isIgnorableDeleteError(result.error)) return json({ error: result.error?.message ?? "user cleanup failed" }, 400);
        }

        const { error: appUserDeleteError } = await supabase
          .from("app_users")
          .delete()
          .eq("user_id", adminUserActionId);
        if (appUserDeleteError) return json({ error: appUserDeleteError.message }, 400);

        const authDeleteResult = await supabase.auth.admin.deleteUser(adminUserActionId);
        if (authDeleteResult.error) return json({ error: authDeleteResult.error.message }, 400);

        await writeAdminAuditEvent({
          actorUserId: admin.context.userId,
          actorAdminScope: admin.context.adminScope,
          action: "user_delete_permanent",
          entityType: "user",
          entityId: adminUserActionId,
          reason,
          metadata: { role: targetUser.role, email: targetUser.email }
        });
        return json({ ok: true, userId: adminUserActionId, deleted: true });
      }

      return json({ error: `unsupported user action: ${action}` }, 400);
    }

    if (req.method === "GET" && routePath === "/v1/admin/search") {
      const admin = await ensureAdmin(req);
      if (admin.error || !admin.context) return admin.error;
      const q = toNonEmptyString(new URL(req.url).searchParams.get("q") ?? "").toLowerCase();
      if (!q) return json({ results: { artists: [], users: [], releases: [], tracks: [], jobs: [], reports: [] } });

      const [artistsRes, usersRes, releasesRes, tracksRes, jobsRes, reportsRes] = await Promise.all([
        supabase.from("artist_profiles").select("artist_id, stage_name").limit(30),
        supabase.from("app_users").select("user_id, email, role").limit(30),
        supabase.from("releases").select("release_id, title, artist_id, status").limit(30),
        supabase.from("tracks").select("track_id, title, release_id").limit(30),
        supabase.from("transcode_jobs").select("job_id, release_id, status, error_message").limit(30),
        supabase.from("client_issue_reports").select("report_id, route, report_category, created_at").limit(30)
      ]);

      if (artistsRes.error) return json({ error: artistsRes.error.message }, 400);
      if (usersRes.error) return json({ error: usersRes.error.message }, 400);
      if (releasesRes.error) return json({ error: releasesRes.error.message }, 400);
      if (tracksRes.error) return json({ error: tracksRes.error.message }, 400);
      if (jobsRes.error) return json({ error: jobsRes.error.message }, 400);
      if (reportsRes.error) return json({ error: reportsRes.error.message }, 400);

      const includes = (value: unknown) => String(value ?? "").toLowerCase().includes(q);
      return json({
        results: {
          artists: (artistsRes.data ?? []).filter((item: any) => includes(item.artist_id) || includes(item.stage_name)),
          users: (usersRes.data ?? []).filter((item: any) => includes(item.user_id) || includes(item.email)),
          releases: (releasesRes.data ?? []).filter((item: any) => includes(item.release_id) || includes(item.title)),
          tracks: (tracksRes.data ?? []).filter((item: any) => includes(item.track_id) || includes(item.title)),
          jobs: (jobsRes.data ?? []).filter((item: any) => includes(item.job_id) || includes(item.error_message)),
          reports: (reportsRes.data ?? []).filter((item: any) => includes(item.report_id) || includes(item.route))
        }
      });
    }

    if (routePath === "/v1/studio/profile") {
      const auth = await ensureAuth(req, "artist");
      if (auth.error || !auth.context) return auth.error;

      if (req.method === "GET") {
        const { data, error } = await supabase
          .from("artist_profiles")
          .select("artist_id, stage_name, bio, influences, credits, socials")
          .eq("user_id", auth.context.userId)
          .single();

        if (error || !data) return json({ error: error?.message ?? "profile not found" }, 404);

        return json({
          artistId: data.artist_id,
          stageName: data.stage_name,
          bio: data.bio,
          influences: data.influences,
          credits: data.credits,
          socials: data.socials
        });
      }

      if (req.method === "PUT") {
        const body = await parseJson(req);
        const payload = {
          stage_name: body.stageName,
          bio: body.bio,
          influences: body.influences,
          credits: body.credits,
          socials: body.socials,
          updated_at: nowIso()
        };

        const { data, error } = await supabase
          .from("artist_profiles")
          .update(payload)
          .eq("user_id", auth.context.userId)
          .select("artist_id, stage_name, bio, influences, credits, socials")
          .single();

        if (error || !data) return json({ error: error?.message ?? "failed to update profile" }, 400);

        return json({
          artistId: data.artist_id,
          stageName: data.stage_name,
          bio: data.bio,
          influences: data.influences,
          credits: data.credits,
          socials: data.socials
        });
      }
    }

    if (req.method === "POST" && routePath === "/v1/studio/releases") {
      const auth = await ensureAuth(req, "artist");
      if (auth.error || !auth.context) return auth.error;

      const artist = await getArtistProfileByUserId(auth.context.userId);
      if (!artist) return json({ error: "artist profile not found" }, 404);

      const body = await parseJson(req);
      const { data, error } = await supabase
        .from("releases")
        .insert({
          artist_id: artist.artist_id,
          title: String(body.title ?? "Untitled").trim(),
          release_type: body.releaseType ?? "album",
          genre: body.genre ?? "Unknown",
          mood_tags: Array.isArray(body.moodTags) ? body.moodTags : [],
          about: body.about ?? "",
          release_date: body.releaseDate ?? null,
          status: "draft"
        })
        .select("release_id, artist_id, title, status, genre, mood_tags, release_type, release_date, created_at")
        .single();

      if (error || !data) return json({ error: error?.message ?? "failed to create release" }, 400);
      return json({
        releaseId: data.release_id,
        artistId: data.artist_id,
        title: data.title,
        status: data.status,
        genre: data.genre,
        moodTags: data.mood_tags ?? [],
        releaseType: data.release_type,
        releaseDate: data.release_date,
        createdAt: data.created_at
      }, 201);
    }

    if (req.method === "GET" && routePath === "/v1/studio/releases") {
      const auth = await ensureAuth(req, "artist");
      if (auth.error || !auth.context) return auth.error;

      const artist = await getArtistProfileByUserId(auth.context.userId);
      if (!artist) return json({ error: "artist profile not found" }, 404);

      const { data, error } = await supabase
        .from("releases")
        .select("release_id, artist_id, title, status, genre, mood_tags, release_type, release_date, created_at")
        .eq("artist_id", artist.artist_id)
        .order("created_at", { ascending: false });

      if (error) return json({ error: error.message }, 400);

      return json({
        releases: (data ?? []).map((release: any) => ({
          releaseId: release.release_id,
          artistId: release.artist_id,
          title: release.title,
          status: release.status,
          genre: release.genre,
          moodTags: release.mood_tags ?? [],
          releaseType: release.release_type,
          releaseDate: release.release_date,
          createdAt: release.created_at
        }))
      });
    }

    const deleteReleaseId = getPathParam(routePath, /^\/v1\/studio\/releases\/([0-9a-f-]+)$/i);
    if (req.method === "DELETE" && deleteReleaseId) {
      const auth = await ensureAuth(req, "artist");
      if (auth.error || !auth.context) return auth.error;

      const artist = await getArtistProfileByUserId(auth.context.userId);
      if (!artist) return json({ error: "artist profile not found" }, 404);

      const { data: release, error: releaseError } = await supabase
        .from("releases")
        .select("release_id")
        .eq("release_id", deleteReleaseId)
        .eq("artist_id", artist.artist_id)
        .single();

      if (releaseError || !release) return json({ error: "release not found" }, 404);

      const { data: tracks, error: tracksReadError } = await supabase
        .from("tracks")
        .select("track_id")
        .eq("release_id", deleteReleaseId);
      if (tracksReadError) return json({ error: tracksReadError.message }, 400);

      const trackIds = (tracks ?? []).map((track: any) => track.track_id);
      if (trackIds.length > 0) {
        const { error: creditsError } = await supabase.from("track_credits").delete().in("track_id", trackIds);
        if (creditsError) return json({ error: creditsError.message }, 400);
        const { error: telemetryError } = await supabase.from("listener_play_events").delete().in("track_id", trackIds);
        if (telemetryError) return json({ error: telemetryError.message }, 400);
        const { error: savesError } = await supabase.from("listener_track_saves").delete().in("track_id", trackIds);
        if (savesError) return json({ error: savesError.message }, 400);
      }

      const { error: jobsError } = await supabase.from("transcode_jobs").delete().eq("release_id", deleteReleaseId);
      if (jobsError) return json({ error: jobsError.message }, 400);

      const { error: tracksDeleteError } = await supabase.from("tracks").delete().eq("release_id", deleteReleaseId);
      if (tracksDeleteError) return json({ error: tracksDeleteError.message }, 400);

      const { error: suggestionsError } = await supabase
        .from("release_suggestions")
        .delete()
        .or(`source_release_id.eq.${deleteReleaseId},target_release_id.eq.${deleteReleaseId}`);
      if (suggestionsError && !isMissingTableError(suggestionsError)) {
        return json({ error: suggestionsError.message }, 400);
      }

      const { error: releaseDeleteError } = await supabase.from("releases").delete().eq("release_id", deleteReleaseId);
      if (releaseDeleteError) return json({ error: releaseDeleteError.message }, 400);

      return json({ ok: true, releaseId: deleteReleaseId });
    }

    const deleteTrackId = getPathParam(routePath, /^\/v1\/studio\/tracks\/([0-9a-f-]+)$/i);
    if (req.method === "DELETE" && deleteTrackId) {
      const auth = await ensureAuth(req, "artist");
      if (auth.error || !auth.context) return auth.error;

      const artist = await getArtistProfileByUserId(auth.context.userId);
      if (!artist) return json({ error: "artist profile not found" }, 404);

      const { data: track, error: trackReadError } = await supabase
        .from("tracks")
        .select("track_id, release_id, releases!inner(artist_id)")
        .eq("track_id", deleteTrackId)
        .single();
      if (trackReadError || !track) return json({ error: "track not found" }, 404);

      const trackArtistId = (track as any).releases?.artist_id;
      if (trackArtistId !== artist.artist_id) return json({ error: "forbidden" }, 403);

      const { error: creditsError } = await supabase.from("track_credits").delete().eq("track_id", deleteTrackId);
      if (creditsError) return json({ error: creditsError.message }, 400);
      const { error: telemetryError } = await supabase.from("listener_play_events").delete().eq("track_id", deleteTrackId);
      if (telemetryError) return json({ error: telemetryError.message }, 400);
      const { error: savesError } = await supabase.from("listener_track_saves").delete().eq("track_id", deleteTrackId);
      if (savesError) return json({ error: savesError.message }, 400);
      const { error: jobsError } = await supabase.from("transcode_jobs").delete().eq("track_id", deleteTrackId);
      if (jobsError) return json({ error: jobsError.message }, 400);
      const { error: trackDeleteError } = await supabase.from("tracks").delete().eq("track_id", deleteTrackId);
      if (trackDeleteError) return json({ error: trackDeleteError.message }, 400);

      return json({ ok: true, trackId: deleteTrackId });
    }

    const masterIntentReleaseId = getPathParam(routePath, /^\/v1\/studio\/releases\/([0-9a-f-]+)\/uploads\/master-intent$/i);
    if (req.method === "POST" && masterIntentReleaseId) {
      const auth = await ensureAuth(req, "artist");
      if (auth.error || !auth.context) return auth.error;
      const body = await parseJson(req);
      const fileName = String(body.fileName ?? "master.wav").trim();
      const contentType = String(body.contentType ?? "audio/wav").trim();
      const intent = await createUploadAsset(auth.context.userId, "master_audio", fileName, contentType);
      return json(intent);
    }

    const coverIntentReleaseId = getPathParam(routePath, /^\/v1\/studio\/releases\/([0-9a-f-]+)\/uploads\/cover-intent$/i);
    if (req.method === "POST" && coverIntentReleaseId) {
      const auth = await ensureAuth(req, "artist");
      if (auth.error || !auth.context) return auth.error;
      const body = await parseJson(req);
      const fileName = String(body.fileName ?? "cover.jpg").trim();
      const contentType = String(body.contentType ?? "image/jpeg").trim();
      const intent = await createUploadAsset(auth.context.userId, "cover_art", fileName, contentType);
      return json(intent);
    }

    const completeAssetId = getPathParam(routePath, /^\/v1\/studio\/uploads\/([0-9a-f-]+)\/complete$/i);
    if (req.method === "POST" && completeAssetId) {
      const auth = await ensureAuth(req, "artist");
      if (auth.error || !auth.context) return auth.error;
      const body = await parseJson(req);
      const { error } = await supabase
        .from("upload_assets")
        .update({
          status: "uploaded",
          byte_size: body.byteSize ?? null,
          checksum_sha256: body.checksumSha256 ?? null
        })
        .eq("asset_id", completeAssetId)
        .eq("owner_user_id", auth.context.userId)
        .eq("status", "pending");
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, assetId: completeAssetId });
    }

    const submitReleaseId = getPathParam(routePath, /^\/v1\/studio\/releases\/([0-9a-f-]+)\/submit$/i);
    if (req.method === "POST" && submitReleaseId) {
      const auth = await ensureAuth(req, "artist");
      if (auth.error || !auth.context) return auth.error;

      const artist = await getArtistProfileByUserId(auth.context.userId);
      if (!artist) return json({ error: "artist profile not found" }, 404);

      const { data: existingRelease, error: releaseReadError } = await supabase
        .from("releases")
        .select("release_id, artist_id, status")
        .eq("release_id", submitReleaseId)
        .eq("artist_id", artist.artist_id)
        .single();

      if (releaseReadError || !existingRelease) {
        return json({ error: releaseReadError?.message ?? "release not found" }, 404);
      }

      if (!canReleaseTransition(existingRelease.status, "submitted")) {
        return json({ error: `illegal release transition: ${existingRelease.status} -> submitted` }, 400);
      }

      const body = await parseJson(req);
      const trackPayload = Array.isArray(body.tracks) ? body.tracks : [];
      if (trackPayload.length === 0) {
        return json({ error: "tracks array required for submission" }, 400);
      }

      for (const track of trackPayload) {
        const trackId = track.trackId || crypto.randomUUID();
        const masterAssetId = String(track.masterAssetId ?? "").trim();
        if (!masterAssetId) {
          return json({ error: `track ${trackId} missing masterAssetId` }, 400);
        }

        const { data: masterAsset, error: masterError } = await supabase
          .from("upload_assets")
          .select("asset_id, status, kind, owner_user_id")
          .eq("asset_id", masterAssetId)
          .eq("owner_user_id", auth.context.userId)
          .single();

        if (masterError || !masterAsset) {
          return json({ error: `master asset not found: ${masterAssetId}` }, 400);
        }
        if (masterAsset.kind !== "master_audio") {
          return json({ error: `asset is not master_audio: ${masterAssetId}` }, 400);
        }
        if (masterAsset.status !== "uploaded") {
          return json({ error: `master asset is not uploaded: ${masterAssetId}` }, 400);
        }

        const { error: trackError } = await supabase.from("tracks").upsert({
          track_id: trackId,
          release_id: submitReleaseId,
          title: String(track.title ?? "Untitled"),
          track_number: Number(track.trackNumber ?? 1),
          duration_sec: null,
          lyrics: track.lyrics ?? null,
          master_asset_id: masterAssetId,
          stream_manifest_path: null,
          loudness_lufs: null
        });
        if (trackError) return json({ error: trackError.message }, 400);

        await supabase.from("track_credits").delete().eq("track_id", trackId);
        const credits = Array.isArray(track.credits) ? track.credits : [];
        if (credits.length > 0) {
          const rows = credits.map((credit: any, index: number) => ({
            track_id: trackId,
            person_name: String(credit.personName ?? "Unknown"),
            role: String(credit.role ?? "credit"),
            sort_order: index
          }));
          await supabase.from("track_credits").insert(rows);
        }

        await supabase
          .from("transcode_jobs")
          .delete()
          .eq("release_id", submitReleaseId)
          .eq("track_id", trackId)
          .in("status", ["queued", "in_progress", "failed"]);

        const { error: jobError } = await supabase.from("transcode_jobs").insert({
          release_id: submitReleaseId,
          track_id: trackId,
          source_asset_id: masterAssetId,
          status: "queued",
          attempts: 0,
          max_attempts: 3,
          next_retry_at: nowIso(),
          updated_at: nowIso()
        });
        if (jobError) return json({ error: jobError.message }, 400);
      }

      const submitUpdate = await supabase
        .from("releases")
        .update({
          cover_asset_id: body.coverAssetId ?? null,
          status: "submitted",
          updated_at: nowIso()
        })
        .eq("release_id", submitReleaseId)
        .eq("artist_id", artist.artist_id)
        .eq("status", existingRelease.status)
        .select("release_id, artist_id, title, status, genre, mood_tags")
        .single();
      if (submitUpdate.error || !submitUpdate.data) {
        return json({ error: submitUpdate.error?.message ?? "failed to mark submitted" }, 400);
      }

      if (!canReleaseTransition("submitted", "in_transcode")) {
        return json({ error: "illegal release transition: submitted -> in_transcode" }, 400);
      }

      const { data: release, error: releaseError } = await supabase
        .from("releases")
        .update({
          status: "in_transcode",
          updated_at: nowIso()
        })
        .eq("release_id", submitReleaseId)
        .eq("artist_id", artist.artist_id)
        .eq("status", "submitted")
        .select("release_id, artist_id, title, status, genre, mood_tags")
        .single();

      if (releaseError || !release) return json({ error: releaseError?.message ?? "failed to submit release" }, 400);

      return json({
        releaseId: release.release_id,
        artistId: release.artist_id,
        title: release.title,
        status: release.status,
        genre: release.genre,
        moodTags: release.mood_tags ?? []
      });
    }

    const publishReleaseId = getPathParam(routePath, /^\/v1\/studio\/releases\/([0-9a-f-]+)\/publish$/i);
    const readinessReleaseId = getPathParam(routePath, /^\/v1\/studio\/releases\/([0-9a-f-]+)\/readiness$/i);
    if (req.method === "GET" && readinessReleaseId) {
      const auth = await ensureAuth(req, "artist");
      if (auth.error || !auth.context) return auth.error;

      const artist = await getArtistProfileByUserId(auth.context.userId);
      if (!artist) return json({ error: "artist profile not found" }, 404);

      const { data: releaseRow, error: releaseReadError } = await supabase
        .from("releases")
        .select("release_id, status, artist_id")
        .eq("release_id", readinessReleaseId)
        .eq("artist_id", artist.artist_id)
        .single();
      if (releaseReadError || !releaseRow) return json({ error: "release not found" }, 404);

      const { data: tracks } = await supabase
        .from("tracks")
        .select("track_id, stream_manifest_path, duration_sec, loudness_lufs, master_asset_id")
        .eq("release_id", readinessReleaseId);

      const trackMasterIds = (tracks ?? [])
        .map((track: any) => track.master_asset_id)
        .filter((id: string | null) => typeof id === "string" && id.length > 0);

      const { data: masterAssets } = await supabase
        .from("upload_assets")
        .select("asset_id, status")
        .in("asset_id", trackMasterIds);

      const statusByAssetId = new Map((masterAssets ?? []).map((asset: any) => [asset.asset_id, asset.status]));

      const trackReadiness = (tracks ?? []).map((track: any) => {
        const masterStatus = statusByAssetId.get(track.master_asset_id) ?? null;
        return {
          trackId: track.track_id,
          readiness: {
            manifestReady: Boolean(track.stream_manifest_path),
            durationReady: Number.isFinite(track.duration_sec) && track.duration_sec > 0,
            loudnessReady: Number.isFinite(track.loudness_lufs),
            masterProcessed: masterStatus === "processed",
            masterStatus
          }
        };
      });

      const { data: pendingJobs } = await supabase
        .from("transcode_jobs")
        .select("job_id, status, track_id")
        .eq("release_id", readinessReleaseId)
        .in("status", ["queued", "in_progress", "failed"]);

      const hasTracks = Array.isArray(tracks) && tracks.length > 0;
      const allTracksReady = trackReadiness.every((t: any) =>
        t.readiness.manifestReady &&
        t.readiness.durationReady &&
        t.readiness.loudnessReady &&
        t.readiness.masterProcessed
      );
      const hasPendingJobs = Array.isArray(pendingJobs) && pendingJobs.length > 0;
      const releaseTransitionReady = canReleaseTransition(releaseRow.status, "live");
      const ready = hasTracks && allTracksReady && !hasPendingJobs && releaseTransitionReady;

      return json({
        releaseId: releaseRow.release_id,
        releaseStatus: releaseRow.status,
        ready,
        summary: {
          hasTracks,
          allTracksReady,
          hasPendingJobs,
          releaseTransitionReady
        },
        pendingJobs: pendingJobs ?? [],
        tracks: trackReadiness
      });
    }

    if (req.method === "POST" && publishReleaseId) {
      const auth = await ensureAuth(req, "artist");
      if (auth.error || !auth.context) return auth.error;

      const artist = await getArtistProfileByUserId(auth.context.userId);
      if (!artist) return json({ error: "artist profile not found" }, 404);

      const { data: releaseRow, error: releaseReadError } = await supabase
        .from("releases")
        .select("release_id, status, artist_id")
        .eq("release_id", publishReleaseId)
        .eq("artist_id", artist.artist_id)
        .single();
      if (releaseReadError || !releaseRow) return json({ error: "release not found" }, 404);
      if (!canReleaseTransition(releaseRow.status, "live")) {
        return json({ error: `illegal release transition: ${releaseRow.status} -> live` }, 400);
      }

      const { data: tracks } = await supabase
        .from("tracks")
        .select("track_id, stream_manifest_path, duration_sec, loudness_lufs, master_asset_id")
        .eq("release_id", publishReleaseId);

      if (!tracks || tracks.length === 0) {
        return json({ error: "release not ready to publish" }, 400);
      }

      const trackMasterIds = tracks
        .map((track: any) => track.master_asset_id)
        .filter((id: string | null) => typeof id === "string" && id.length > 0);

      const { data: masterAssets } = await supabase
        .from("upload_assets")
        .select("asset_id, status")
        .in("asset_id", trackMasterIds);

      const statusByAssetId = new Map((masterAssets ?? []).map((asset: any) => [asset.asset_id, asset.status]));

      const notReady = tracks.find((track: any) => {
        const manifestReady = Boolean(track.stream_manifest_path);
        const durationReady = Number.isFinite(track.duration_sec) && track.duration_sec > 0;
        const loudnessReady = Number.isFinite(track.loudness_lufs);
        const masterProcessed = statusByAssetId.get(track.master_asset_id) === "processed";
        return !(manifestReady && durationReady && loudnessReady && masterProcessed);
      });
      if (notReady) {
        const masterStatus = statusByAssetId.get(notReady.master_asset_id) ?? null;
        const readiness = {
          manifestReady: Boolean(notReady.stream_manifest_path),
          durationReady: Number.isFinite(notReady.duration_sec) && notReady.duration_sec > 0,
          loudnessReady: Number.isFinite(notReady.loudness_lufs),
          masterProcessed: masterStatus === "processed",
          masterStatus
        };

        return json(
          {
            error: `track not ready for publish: ${notReady.track_id}`,
            details: {
              releaseId: publishReleaseId,
              trackId: notReady.track_id,
              readiness
            }
          },
          400
        );
      }

      const { data: pendingJobs } = await supabase
        .from("transcode_jobs")
        .select("job_id, status")
        .eq("release_id", publishReleaseId)
        .in("status", ["queued", "in_progress", "failed"]);
      if (pendingJobs && pendingJobs.length > 0) {
        return json(
          {
            error: "transcode jobs are not fully completed",
            details: {
              releaseId: publishReleaseId,
              pendingJobs
            }
          },
          400
        );
      }

      const { data: release, error } = await supabase
        .from("releases")
        .update({ status: "live", updated_at: nowIso() })
        .eq("release_id", publishReleaseId)
        .eq("status", "in_transcode")
        .select("release_id, artist_id, title, status, genre, mood_tags")
        .single();

      if (error || !release) return json({ error: error?.message ?? "publish failed" }, 400);
      return json({
        releaseId: release.release_id,
        artistId: release.artist_id,
        title: release.title,
        status: release.status,
        genre: release.genre,
        moodTags: release.mood_tags ?? []
      });
    }

    if (req.method === "GET" && routePath === "/v1/listener/home") {
      const optionalAuth = await resolveOptionalAuth(req);

      const { data: recentReleases, error: recentError } = await supabase
        .from("releases")
        .select("release_id, title, genre, mood_tags, cover_asset_id, artist_id, artist_profiles!inner(stage_name)")
        .eq("status", "live")
        .order("created_at", { ascending: false })
        .limit(12);
      if (recentError) return json({ error: recentError.message }, 400);

      const recentlyAdded = await mapReleasesToAlbums(recentReleases ?? []);

      const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: trendingEvents, error: trendingEventsError } = await supabase
        .from("listener_play_events")
        .select("track_id")
        .gte("play_start_time", sevenDaysAgoIso)
        .limit(5000);
      if (trendingEventsError) return json({ error: trendingEventsError.message }, 400);

      const trendingTrackIds = Array.from(
        new Set((trendingEvents ?? []).map((event: any) => event.track_id).filter(Boolean))
      );
      const { data: trendingTracks, error: trendingTracksError } = trendingTrackIds.length
        ? await supabase
            .from("tracks")
            .select("track_id, release_id")
            .in("track_id", trendingTrackIds)
        : { data: [], error: null as { message?: string } | null };
      if (trendingTracksError) return json({ error: trendingTracksError.message }, 400);

      const releaseIdByTrackId = new Map((trendingTracks ?? []).map((row: any) => [row.track_id, row.release_id]));
      const playCountByReleaseId = new Map<string, number>();
      for (const event of trendingEvents ?? []) {
        const releaseId = releaseIdByTrackId.get(event.track_id);
        if (!releaseId) continue;
        playCountByReleaseId.set(releaseId, (playCountByReleaseId.get(releaseId) ?? 0) + 1);
      }
      const trendingReleaseIds = Array.from(playCountByReleaseId.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([releaseId]) => releaseId)
        .slice(0, 12);
      const trending = await fetchLiveAlbumsByReleaseIds(trendingReleaseIds);

      let continueListening: AlbumCard[] = [];
      if (optionalAuth?.userId) {
        const { data: recentEvents, error: recentEventsError } = await supabase
          .from("listener_play_events")
          .select("track_id, play_end_time")
          .eq("listener_user_id", optionalAuth.userId)
          .order("play_end_time", { ascending: false })
          .limit(120);
        if (recentEventsError) return json({ error: recentEventsError.message }, 400);

        const continueTrackIds = Array.from(new Set((recentEvents ?? []).map((event: any) => event.track_id).filter(Boolean)));
        if (continueTrackIds.length > 0) {
          const { data: continueTracks, error: continueTracksError } = await supabase
            .from("tracks")
            .select("track_id, release_id")
            .in("track_id", continueTrackIds);
          if (continueTracksError) return json({ error: continueTracksError.message }, 400);

          const releaseByTrackId = new Map((continueTracks ?? []).map((row: any) => [row.track_id, row.release_id]));
          const orderedReleaseIds: string[] = [];
          for (const event of recentEvents ?? []) {
            const releaseId = releaseByTrackId.get(event.track_id);
            if (!releaseId || orderedReleaseIds.includes(releaseId)) continue;
            orderedReleaseIds.push(releaseId);
            if (orderedReleaseIds.length >= 12) break;
          }
          continueListening = await fetchLiveAlbumsByReleaseIds(orderedReleaseIds);
        }
      }

      const featuredAlbum = recentlyAdded[0] ?? null;
      const featuredArtist = featuredAlbum
        ? {
            artistId: (recentReleases ?? []).find((release: any) => release.release_id === featuredAlbum.albumId)?.artist_id ?? null,
            stageName: featuredAlbum.artistName
          }
        : null;

      return json({
        featuredAlbum,
        featuredArtist,
        rails: [
          { key: "recently-added", title: "Recently Added", albums: recentlyAdded.slice(0, 8) },
          { key: "trending-7d", title: "Trending (7d)", albums: trending.slice(0, 8) },
          { key: "continue-listening", title: "Continue Listening", albums: continueListening.slice(0, 8) }
        ]
      });
    }

    const albumDetailId = getPathParam(routePath, /^\/v1\/listener\/albums\/([0-9a-f-]+)$/i);
    if (req.method === "GET" && albumDetailId) {
      const { data: release, error: releaseError } = await supabase
        .from("releases")
        .select("release_id, title, genre, mood_tags, cover_asset_id, about, artist_profiles!inner(stage_name)")
        .eq("release_id", albumDetailId)
        .eq("status", "live")
        .single();

      if (releaseError || !release) return json({ error: "album not found" }, 404);

      const { data: tracks, error: tracksError } = await supabase
        .from("tracks")
        .select("track_id, title, duration_sec")
        .eq("release_id", albumDetailId)
        .order("track_number", { ascending: true });
      if (tracksError) return json({ error: tracksError.message }, 400);

      const trackIds = (tracks ?? []).map((track: any) => track.track_id);
      let credits: any[] = [];
      if (trackIds.length > 0) {
        const { data: creditRows } = await supabase
          .from("track_credits")
          .select("track_id, person_name, role, sort_order")
          .in("track_id", trackIds)
          .order("sort_order", { ascending: true });
        credits = creditRows ?? [];
      }

      const coverUrlByAssetId = await resolveCoverUrlsByAssetIds(
        release.cover_asset_id ? [release.cover_asset_id] : []
      );

      return json({
        album: {
          albumId: release.release_id,
          title: release.title,
          artistName: release.artist_profiles.stage_name,
          coverUrl: coverUrlByAssetId.get(release.cover_asset_id) ?? buildDefaultCoverUrl(),
          genre: release.genre,
          moodTags: release.mood_tags ?? []
        },
        tracks: (tracks ?? []).map((track: any) => ({
          trackId: track.track_id,
          title: track.title,
          durationSec: track.duration_sec
        })),
        credits: credits.map((credit) => ({ personName: credit.person_name, role: credit.role, trackId: credit.track_id })),
        about: release.about ?? ""
      });
    }

    const streamTrackId = getPathParam(routePath, /^\/v1\/listener\/tracks\/([0-9a-f-]+)\/stream$/i);
    if (req.method === "GET" && streamTrackId) {
      const optionalAuth = await resolveOptionalAuth(req);
      const { data: track, error } = await supabase
        .from("tracks")
        .select("track_id, stream_manifest_path, release_id, master_asset_id")
        .eq("track_id", streamTrackId)
        .single();

      if (error || !track) {
        await writeStreamAttempt({
          requestedTrackId: streamTrackId,
          trackId: null,
          listenerUserId: optionalAuth?.userId ?? null,
          success: false,
          failureReason: "track_not_found"
        });
        return json({ error: "track not found" }, 404);
      }

      const { data: releaseRow, error: releaseError } = await supabase
        .from("releases")
        .select("release_id")
        .eq("release_id", track.release_id)
        .eq("status", "live")
        .maybeSingle();
      if (releaseError || !releaseRow) {
        await writeStreamAttempt({
          requestedTrackId: streamTrackId,
          trackId: track.track_id,
          listenerUserId: optionalAuth?.userId ?? null,
          success: false,
          failureReason: "track_not_live"
        });
        return json({ error: "track not available" }, 404);
      }

      const streamBucket = await resolveStreamManifestBucket(track.stream_manifest_path);
      const manifestPath = (track.stream_manifest_path || `manifests/${track.track_id}/index.m3u8`).replace(/^\/+/, "");
      const manifestUrl =
        /^https?:\/\//i.test(track.stream_manifest_path || "")
          ? String(track.stream_manifest_path)
          : buildPublicObjectUrl(streamBucket, manifestPath);
      let fallbackUrl: string | null = null;
      if (track.master_asset_id) {
        const { data: masterAsset } = await supabase
          .from("upload_assets")
          .select("storage_bucket, storage_path")
          .eq("asset_id", track.master_asset_id)
          .maybeSingle();
        if (masterAsset?.storage_path) {
          const signed = await supabase.storage
            .from(masterAsset.storage_bucket || STORAGE_BUCKET_MASTERS)
            .createSignedUrl(masterAsset.storage_path, 15 * 60);
          fallbackUrl = signed.data?.signedUrl || null;
        }
      }

      await writeStreamAttempt({
        requestedTrackId: streamTrackId,
        trackId: track.track_id,
        listenerUserId: optionalAuth?.userId ?? null,
        success: true
      });

      return json({
        trackId: track.track_id,
        manifestUrl,
        fallbackUrl,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      });
    }

    if (req.method === "POST" && routePath === "/v1/listener/telemetry/plays") {
      const auth = await ensureAuth(req);
      if (auth.error || !auth.context) return auth.error;
      if (!auth.context.role) {
        await ensureAppUser(auth.context.userId, auth.context.email, "listener");
      }

      const body = await parseJson(req);
      const events = Array.isArray(body.events) ? body.events : [];
      if (events.length === 0) return json({ error: "events array required" }, 400);

      const rows = events.map((event) => ({
        client_event_id: event.eventId ?? null,
        listener_user_id: auth.context.userId,
        track_id: event.trackId,
        play_start_time: event.playStartTime,
        play_end_time: event.playEndTime,
        percent_listened: event.percentListened,
        skipped_early: !!event.skippedEarly,
        replayed_same_session: Number(event.replayedSameSession ?? 0),
        completed_play: !!event.completedPlay,
        manual_skip: !!event.manualSkip,
        auto_advance: !!event.autoAdvance
      }));

      const { error } = await supabase.from("listener_play_events").upsert(rows, { onConflict: "client_event_id", ignoreDuplicates: true });
      if (error) return json({ error: error.message }, 400);
      return json({ accepted: true }, 202);
    }

    if (req.method === "POST" && routePath === "/v1/listener/telemetry/events") {
      const auth = await ensureAuth(req);
      if (auth.error || !auth.context) return auth.error;
      if (!auth.context.role) {
        await ensureAppUser(auth.context.userId, auth.context.email, "listener");
      }

      const body = await parseJson(req);
      const events = Array.isArray(body.events) ? body.events : [];
      if (events.length === 0) return json({ error: "events array required" }, 400);

      const rows = events.map((event) => ({
        event_id: String(event.eventId),
        listener_user_id: auth.context.userId,
        track_id: String(event.trackId),
        event_type: String(event.eventType),
        event_time: event.eventTime || nowIso(),
        payload: event.payload && typeof event.payload === "object" ? event.payload : {}
      }));

      const { error } = await supabase.from("listener_event_log").upsert(rows, { onConflict: "event_id", ignoreDuplicates: true });
      if (error) return json({ error: error.message }, 400);
      return json({ accepted: true, count: rows.length }, 202);
    }

    const saveTrackId = getPathParam(routePath, /^\/v1\/listener\/tracks\/([0-9a-f-]+)\/save$/i);
    if (req.method === "POST" && saveTrackId) {
      const auth = await ensureAuth(req);
      if (auth.error || !auth.context) return auth.error;
      if (!auth.context.role) {
        await ensureAppUser(auth.context.userId, auth.context.email, "listener");
      }

      const body = await parseJson(req);
      const saved = body.saved !== false;
      const { error } = await supabase.from("listener_track_saves").upsert({
        listener_user_id: auth.context.userId,
        track_id: saveTrackId,
        saved,
        updated_at: nowIso()
      });
      if (error) return json({ error: error.message }, 400);
      return json({ trackId: saveTrackId, saved });
    }

    const suggestedAlbumId = getPathParam(routePath, /^\/v1\/listener\/albums\/([0-9a-f-]+)\/suggested-next$/i);
    if (req.method === "GET" && suggestedAlbumId) {
      const { data: edges } = await supabase
        .from("album_similarity_edges")
        .select("target_release_id")
        .eq("source_release_id", suggestedAlbumId)
        .order("score", { ascending: false })
        .limit(6);

      const targetIds = (edges ?? []).map((edge: any) => edge.target_release_id);
      if (targetIds.length === 0) return json({ albums: [] });

      const { data: albums } = await supabase
        .from("releases")
        .select("release_id, title, genre, mood_tags, cover_asset_id, artist_profiles!inner(stage_name)")
        .in("release_id", targetIds)
        .eq("status", "live");

      const coverUrlByAssetId = await resolveCoverUrlsByAssetIds(
        (albums ?? []).map((album: any) => album.cover_asset_id).filter(Boolean)
      );

      return json({
        albums: (albums ?? []).map((album: any) => ({
          albumId: album.release_id,
          title: album.title,
          artistName: album.artist_profiles.stage_name,
          coverUrl: coverUrlByAssetId.get(album.cover_asset_id) ?? buildDefaultCoverUrl(),
          genre: album.genre,
          moodTags: album.mood_tags ?? []
        }))
      });
    }

    return json({ error: `route not found: ${req.method} ${routePath}` }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    return json({ error: message }, 500);
  }
});
