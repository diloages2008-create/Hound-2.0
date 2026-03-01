import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EDGE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EDGE_SERVICE_ROLE_KEY || "";
const MASTERS_BUCKET = process.env.STORAGE_BUCKET_MASTERS || "hound-masters";
const STREAMS_BUCKET = process.env.STORAGE_BUCKET_STREAMS || "hound-streams";
const POLL_MS = Number(process.env.WORKER_POLL_MS || 3000);
const WORKER_ID = process.env.WORKER_ID || `worker-${process.pid}`;
const CONCURRENCY = Math.max(1, Number(process.env.WORKER_CONCURRENCY || 1));

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error("Missing Supabase envs: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (EDGE_* aliases still supported)");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function execCommand(cmd, args, { cwd } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} exited ${code}: ${stderr || stdout}`));
    });
  });
}

async function fetchJob() {
  const { data, error } = await supabase.rpc("claim_transcode_job", { p_worker_id: WORKER_ID });
  if (!error && Array.isArray(data) && data.length > 0) return data[0];
  if (!error) return null;

  // Fallback path for projects where the SQL claim function has not been applied yet.
  const nowIso = new Date().toISOString();
  const { data: candidateRows, error: candidateError } = await supabase
    .from("transcode_jobs")
    .select("job_id, release_id, track_id, source_asset_id, attempts, max_attempts")
    .in("status", ["queued", "failed"])
    .lte("next_retry_at", nowIso)
    .order("created_at", { ascending: true })
    .limit(1);
  if (candidateError) throw new Error(candidateError.message);
  if (!candidateRows || candidateRows.length === 0) return null;

  const candidate = candidateRows[0];
  const { data: claimedRows, error: claimError } = await supabase
    .from("transcode_jobs")
    .update({
      status: "in_progress",
      locked_by: WORKER_ID,
      locked_at: nowIso,
      started_at: nowIso,
      updated_at: nowIso
    })
    .eq("job_id", candidate.job_id)
    .in("status", ["queued", "failed"])
    .select("job_id, release_id, track_id, source_asset_id, attempts, max_attempts")
    .limit(1);
  if (claimError) throw new Error(claimError.message);
  if (!claimedRows || claimedRows.length === 0) return null;
  return claimedRows[0];
}

async function updateJob(jobId, patch) {
  const { error } = await supabase.from("transcode_jobs").update({ ...patch, updated_at: new Date().toISOString() }).eq("job_id", jobId);
  if (error) throw new Error(error.message);
}

async function failJob(job, message) {
  const attempts = Number(job.attempts || 0) + 1;
  const maxAttempts = Number(job.max_attempts || 3);
  const exhausted = attempts >= maxAttempts;
  const backoffSec = Math.min(300, 2 ** attempts * 5);

  await updateJob(job.job_id, {
    status: exhausted ? "failed" : "queued",
    attempts,
    locked_at: null,
    locked_by: null,
    next_retry_at: new Date(Date.now() + backoffSec * 1000).toISOString(),
    error_message: message
  });

  if (job.source_asset_id) {
    await supabase.from("upload_assets").update({ status: exhausted ? "failed" : "uploaded" }).eq("asset_id", job.source_asset_id);
  }
}

async function downloadMaster(asset) {
  const { data, error } = await supabase.storage.from(asset.storage_bucket || MASTERS_BUCKET).download(asset.storage_path);
  if (error || !data) throw new Error(error?.message || "failed to download master");
  const buffer = Buffer.from(await data.arrayBuffer());
  const ext = path.extname(asset.storage_path) || ".wav";
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "hound-job-"));
  const inputPath = path.join(tempDir, `master${ext}`);
  await fs.writeFile(inputPath, buffer);
  return { tempDir, inputPath };
}

async function measureDurationSec(inputPath) {
  const { stdout } = await execCommand("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    inputPath
  ]);
  const duration = Number(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("invalid duration from ffprobe");
  return Math.round(duration);
}

async function measureLoudnessLufs(inputPath) {
  const { stderr } = await execCommand("ffmpeg", [
    "-hide_banner",
    "-nostats",
    "-i",
    inputPath,
    "-af",
    "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json",
    "-f",
    "null",
    "-"
  ]);

  // Prefer direct extraction from ffmpeg loudnorm output. This is resilient to
  // non-JSON noise lines that can appear around the stats block.
  const inputMatch = stderr.match(/"input_i"\s*:\s*"?(?<value>-?\d+(?:\.\d+)?)"?/);
  if (inputMatch?.groups?.value) {
    const i = Number(inputMatch.groups.value);
    if (Number.isFinite(i)) return Number(i.toFixed(2));
  }

  // Fallback: parse the last JSON-like block if present.
  const jsonMatch = stderr.match(/\{[\s\S]*?\}/g);
  if (jsonMatch && jsonMatch.length > 0) {
    try {
      const parsed = JSON.parse(jsonMatch[jsonMatch.length - 1]);
      const i = Number(parsed.input_i);
      if (Number.isFinite(i)) return Number(i.toFixed(2));
    } catch {
      // continue to hard failure below
    }
  }

  throw new Error("unable to parse loudness stats");
}

async function transcodeToHls(inputPath, outDir) {
  await fs.mkdir(outDir, { recursive: true });
  const manifestPath = path.join(outDir, "index.m3u8");
  const segPattern = path.join(outDir, "segment_%03d.ts");
  await execCommand("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-hls_time",
    "6",
    "-hls_playlist_type",
    "vod",
    "-hls_segment_filename",
    segPattern,
    manifestPath
  ]);
  return manifestPath;
}

async function uploadHlsFiles(trackId, outDir) {
  const files = await fs.readdir(outDir);
  const uploads = [];
  for (const file of files) {
    if (!(file.endsWith(".m3u8") || file.endsWith(".ts"))) continue;
    const fullPath = path.join(outDir, file);
    const content = await fs.readFile(fullPath);
    const storagePath = `manifests/${trackId}/${file}`;
    const contentType = file.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp2t";
    const { error } = await supabase.storage.from(STREAMS_BUCKET).upload(storagePath, content, {
      contentType,
      upsert: true
    });
    if (error) throw new Error(error.message);
    uploads.push({ file, storagePath, contentType, byteSize: content.length });
  }
  return uploads;
}

async function writeHlsAssets(ownerUserId, uploads) {
  if (!uploads.length) return;
  const rows = uploads.map((item) => ({
    owner_user_id: ownerUserId,
    kind: item.file.endsWith(".m3u8") ? "hls_manifest" : "hls_segment",
    storage_bucket: STREAMS_BUCKET,
    storage_path: item.storagePath,
    content_type: item.contentType,
    byte_size: item.byteSize,
    status: "processed"
  }));
  const { error } = await supabase.from("upload_assets").insert(rows);
  if (error) throw new Error(error.message);
}

async function processJob(job) {
  const { data: jobRow, error: jobReadError } = await supabase
    .from("transcode_jobs")
    .select("job_id, release_id, track_id, source_asset_id, attempts, max_attempts")
    .eq("job_id", job.job_id)
    .single();
  if (jobReadError || !jobRow) throw new Error(jobReadError?.message || "job read failed");

  const { data: track, error: trackError } = await supabase
    .from("tracks")
    .select("track_id, title, master_asset_id, release_id")
    .eq("track_id", jobRow.track_id)
    .single();
  if (trackError || !track) throw new Error(trackError?.message || "track not found");

  const { data: asset, error: assetError } = await supabase
    .from("upload_assets")
    .select("asset_id, owner_user_id, storage_bucket, storage_path, status")
    .eq("asset_id", jobRow.source_asset_id)
    .single();
  if (assetError || !asset) throw new Error(assetError?.message || "source asset not found");
  if (asset.status !== "uploaded") throw new Error("source asset not uploaded");

  const { tempDir, inputPath } = await downloadMaster(asset);
  try {
    const durationSec = await measureDurationSec(inputPath);
    const loudnessLufs = await measureLoudnessLufs(inputPath);

    const outDir = path.join(tempDir, "hls");
    await transcodeToHls(inputPath, outDir);
    const uploads = await uploadHlsFiles(track.track_id, outDir);
    await writeHlsAssets(asset.owner_user_id, uploads);

    const manifestUpload = uploads.find((item) => item.file === "index.m3u8");
    if (!manifestUpload) throw new Error("manifest not generated");

    const { error: trackUpdateError } = await supabase
      .from("tracks")
      .update({
        stream_manifest_path: manifestUpload.storagePath,
        duration_sec: durationSec,
        loudness_lufs: loudnessLufs
      })
      .eq("track_id", track.track_id);
    if (trackUpdateError) throw new Error(trackUpdateError.message);

    const { error: assetUpdateError } = await supabase
      .from("upload_assets")
      .update({ status: "processed" })
      .eq("asset_id", asset.asset_id);
    if (assetUpdateError) throw new Error(assetUpdateError.message);

    await updateJob(job.job_id, {
      status: "completed",
      completed_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      error_message: null,
      attempts: Number(job.attempts || 0) + 1
    });

    console.log(`[worker] completed job=${job.job_id} track=${track.track_id}`);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function workerLoop(slot) {
  while (true) {
    try {
      const job = await fetchJob();
      if (!job) {
        await sleep(POLL_MS);
        continue;
      }
      console.log(`[worker:${slot}] claimed job=${job.job_id} track=${job.track_id}`);
      await processJob(job);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[worker:${slot}] error`, message);
      if (message.includes("job_id")) {
        // no-op fallback
      }
      await sleep(1000);
    }
  }
}

async function loopWithFailureHandling(slot) {
  while (true) {
    let job = null;
    try {
      job = await fetchJob();
      if (!job) {
        await sleep(POLL_MS);
        continue;
      }
      console.log(`[worker:${slot}] claimed job=${job.job_id} track=${job.track_id}`);
      await processJob(job);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[worker:${slot}] failure`, message);
      if (job?.job_id) {
        await failJob(job, message).catch((inner) => {
          console.error(`[worker:${slot}] failJob error`, inner?.message || inner);
        });
      }
      await sleep(1000);
    }
  }
}

const ENVIRONMENT = process.env.NODE_ENV || "development";
console.log(
  `[worker] boot worker_id=${WORKER_ID} env=${ENVIRONMENT} concurrency=${CONCURRENCY} poll_ms=${POLL_MS} masters_bucket=${MASTERS_BUCKET} streams_bucket=${STREAMS_BUCKET}`
);
for (let i = 0; i < CONCURRENCY; i += 1) {
  loopWithFailureHandling(i + 1);
}
