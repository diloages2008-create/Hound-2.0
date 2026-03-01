import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EDGE_SUPABASE_URL = Deno.env.get("EDGE_SUPABASE_URL") ?? "";
const EDGE_SERVICE_ROLE_KEY = Deno.env.get("EDGE_SERVICE_ROLE_KEY") ?? "";
const STORAGE_BUCKET_MASTERS = Deno.env.get("STORAGE_BUCKET_MASTERS") ?? "hound-masters";
const STORAGE_BUCKET_COVERS = Deno.env.get("STORAGE_BUCKET_COVERS") ?? "hound-covers";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS"
};

const supabase = createClient(EDGE_SUPABASE_URL, EDGE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

type AppRole = "artist" | "listener" | "admin";

type AuthContext = {
  userId: string;
  email: string | null;
  role: AppRole | null;
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

function buildCoverUrl(coverAssetId: string | null) {
  if (!coverAssetId) return "https://cdn.hound.fm/assets/default-cover.jpg";
  return `https://cdn.hound.fm/assets/${coverAssetId}`;
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

  const { data: appUser, error: appUserError } = await supabase
    .from("app_users")
    .select("user_id, role, email")
    .eq("user_id", userId)
    .maybeSingle();

  if (appUserError) {
    return { error: json({ error: appUserError.message }, 400), context: null };
  }

  const role = (appUser?.role as AppRole | null) ?? null;
  if (requiredRole && role !== requiredRole) {
    return { error: json({ error: `forbidden: requires ${requiredRole} role` }, 403), context: null };
  }

  const context: AuthContext = { userId, email, role };
  return { error: null, context };
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
      const session = await createUserWithRole(email, password, "listener");
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
        role: auth.context.role
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
        const { error: telemetryError } = await supabase.from("listener_events").delete().in("track_id", trackIds);
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
      if (suggestionsError) return json({ error: suggestionsError.message }, 400);

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
      const { error: telemetryError } = await supabase.from("listener_events").delete().eq("track_id", deleteTrackId);
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
        return json({ error: `track not ready for publish: ${notReady.track_id}` }, 400);
      }

      const { data: pendingJobs } = await supabase
        .from("transcode_jobs")
        .select("job_id, status")
        .eq("release_id", publishReleaseId)
        .in("status", ["queued", "in_progress", "failed"]);
      if (pendingJobs && pendingJobs.length > 0) {
        return json({ error: "transcode jobs are not fully completed" }, 400);
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
      const { data: releases, error } = await supabase
        .from("releases")
        .select("release_id, title, genre, mood_tags, cover_asset_id, artist_id, artist_profiles!inner(stage_name)")
        .eq("status", "live")
        .limit(24);

      if (error) return json({ error: error.message }, 400);

      const albums = (releases ?? []).map((entry: any) => ({
        albumId: entry.release_id,
        title: entry.title,
        artistName: entry.artist_profiles.stage_name,
        coverUrl: buildCoverUrl(entry.cover_asset_id),
        genre: entry.genre,
        moodTags: entry.mood_tags ?? []
      }));

      const featuredAlbum = albums[0] ?? null;
      const featuredArtist = featuredAlbum
        ? { artistId: (releases?.[0] as any).artist_id, stageName: featuredAlbum.artistName }
        : null;

      return json({
        featuredAlbum,
        featuredArtist,
        rails: [
          { key: "new-week", title: "New This Week", albums: albums.slice(0, 8) },
          { key: "deep-cuts", title: "Deep Cuts", albums: albums.slice(8, 16) }
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

      return json({
        album: {
          albumId: release.release_id,
          title: release.title,
          artistName: release.artist_profiles.stage_name,
          coverUrl: buildCoverUrl(release.cover_asset_id),
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
      const { data: track, error } = await supabase
        .from("tracks")
        .select("track_id, stream_manifest_path, release_id")
        .eq("track_id", streamTrackId)
        .single();

      if (error || !track) return json({ error: "track not found" }, 404);

      const { data: releaseRow, error: releaseError } = await supabase
        .from("releases")
        .select("release_id")
        .eq("release_id", track.release_id)
        .eq("status", "live")
        .maybeSingle();
      if (releaseError || !releaseRow) return json({ error: "track not available" }, 404);

      const manifestUrl = track.stream_manifest_path
        ? `https://cdn.hound.fm/${track.stream_manifest_path}`
        : `https://cdn.hound.fm/manifests/${track.track_id}/index.m3u8`;

      return json({ trackId: track.track_id, manifestUrl, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() });
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

      return json({
        albums: (albums ?? []).map((album: any) => ({
          albumId: album.release_id,
          title: album.title,
          artistName: album.artist_profiles.stage_name,
          coverUrl: buildCoverUrl(album.cover_asset_id),
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
