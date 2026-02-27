const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const { Worker } = require("node:worker_threads");
const { app, BrowserWindow, ipcMain, dialog, protocol } = require("electron");
const { openDatabase } = require("./db.cjs");

app.disableHardwareAcceleration();

if (protocol?.registerSchemesAsPrivileged) {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "houndfile",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true
      }
    }
  ]);
}

app.setName("Hound");

const isDev = !app.isPackaged;
const resolveRendererURL = () => process.env.VITE_DEV_SERVER_URL ?? "http://localhost:5173/";
const toIso = () => new Date().toISOString();
const ORBIT_THRESHOLD = 70;
const EARLY_SKIP_THRESHOLD = 0.2;
const QUALIFIED_THRESHOLD = 0.65;
const ORBIT_RECENT_DECAY_DAYS = 14;
const ORBIT_LONG_IGNORE_DAYS = 30;
const ORBIT_DECAY_START_DAYS = 7;
const ORBIT_DECAY_PER_DAY = 2;
const ORBIT_CONFIG = {
  qualifiedThreshold: QUALIFIED_THRESHOLD,
  earlySkipThreshold: EARLY_SKIP_THRESHOLD,
  promotionThreshold: ORBIT_THRESHOLD,
  demotionSkips: 2,
  recentWindow: 5,
  discoveryIgnoreDays: 30,
  recentDecayDays: ORBIT_RECENT_DECAY_DAYS
};

const allowedExtensions = new Set([
  ".mp3",
  ".wav",
  ".m4a",
  ".flac",
  ".aac",
  ".alac",
  ".ogg",
  ".opus"
]);

const normalizePaths = (paths = []) =>
  paths
    .filter((item) => typeof item === "string" && item.trim().length > 0)
    .map((item) => path.normalize(item))
    .filter((item) => allowedExtensions.has(path.extname(item).toLowerCase()));

let dbState = null;
let mainWindow = null;
let analysisQueue = [];
let analysisWorker = null;
let analysisBusy = false;
let analysisPaused = false;
let playbackActive = false;
let embeddingIndexCache = {
  version: null,
  builtAt: null,
  data: new Map(),
  dirty: true
};

const ensureAnalysisWorker = () => {
  if (analysisWorker) return analysisWorker;
  if (!dbState) return null;
  const workerPath = path.resolve(__dirname, "analysis-worker.cjs");
  const ffmpegPath = app.isPackaged
    ? path.join(process.resourcesPath, "ffmpeg", "ffmpeg.exe")
    : path.resolve(__dirname, "ffmpeg", "ffmpeg.exe");
  const ffprobePath = app.isPackaged
    ? path.join(process.resourcesPath, "ffmpeg", "ffprobe.exe")
    : path.resolve(__dirname, "ffmpeg", "ffprobe.exe");
  analysisWorker = new Worker(workerPath, {
    workerData: { ffmpegPath, ffprobePath }
  });
  analysisWorker.on("message", (message) => {
    if (!dbState) return;
    if (!message || typeof message !== "object") return;
    if (message.type === "progress") {
      const stmt = dbState.db.prepare(
        "UPDATE track_features SET analysisStatus = ?, analysisStage = ?, analysisProgress = ?, updatedAt = ? WHERE trackId = ?"
      );
      stmt.run(
        "in_progress",
        message.stage || "working",
        JSON.stringify({ progress: message.progress ?? 0 }),
        toIso(),
        message.trackId
      );
      mainWindow?.webContents?.send("analysis:progress", {
        trackId: message.trackId,
        stage: message.stage,
        progress: message.progress
      });
    }
    if (message.type === "complete") {
      const now = toIso();
      const result = message.result || {};
      const embeddingBuffer = result.embedding
        ? Buffer.from(Float32Array.from(result.embedding).buffer)
        : null;
      if (result.durationSec) {
        dbState.db
          .prepare("UPDATE tracks SET durationSec = ? WHERE trackId = ?")
          .run(result.durationSec, message.trackId);
      }
      dbState.db
        .prepare(
          `UPDATE track_features
           SET durationSec = ?,
               loudnessLUFS = ?,
               bpm = ?,
               bpmConfidence = ?,
               key = ?,
               mode = ?,
               keyConfidence = ?,
               timbreStats = ?,
               energyCurveSummary = ?,
               embedding = ?,
               embeddingVersion = ?,
               featuresVersion = ?,
               analysisStatus = ?,
               analysisStage = ?,
               analysisProgress = ?,
               analyzedAt = ?,
               updatedAt = ?
           WHERE trackId = ?`
        )
        .run(
          result.durationSec ?? null,
          result.loudnessLUFS ?? null,
          result.bpm ?? null,
          result.bpmConfidence ?? null,
          result.key ?? null,
          result.mode ?? null,
          result.keyConfidence ?? null,
          JSON.stringify(result.timbreStats ?? null),
          JSON.stringify(result.energyCurveSummary ?? null),
          embeddingBuffer,
          dbState.embeddingVersion,
          dbState.featuresVersion,
          "complete",
          "complete",
          JSON.stringify({ progress: 1 }),
          now,
          now,
          message.trackId
        );
      embeddingIndexCache.dirty = true;
      mainWindow?.webContents?.send("analysis:completed", {
        trackId: message.trackId,
        loudnessLUFS: result.loudnessLUFS ?? null
      });
      analysisBusy = false;
      processAnalysisQueue();
    }
    if (message.type === "error") {
      dbState.db
        .prepare(
          "UPDATE track_features SET analysisStatus = ?, analysisStage = ?, analysisProgress = ?, updatedAt = ? WHERE trackId = ?"
        )
        .run(
          "error",
          "error",
          JSON.stringify({ error: message.error || "Analysis failed" }),
          toIso(),
          message.trackId
        );
      analysisBusy = false;
      processAnalysisQueue();
    }
  });
  analysisWorker.on("exit", () => {
    analysisWorker = null;
  });
  return analysisWorker;
};

const hashFile = async (filePath) =>
  new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    const hash = crypto.createHash("sha256");
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });

const upsertTrack = (track) => {
  const now = toIso();
  dbState.db
    .prepare(
      `INSERT INTO tracks (trackId, contentHash, sourcePath, title, artist, album, durationSec, addedAt, lastSeenAt, fileSize, mtimeMs)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(trackId) DO UPDATE SET
         contentHash = excluded.contentHash,
         sourcePath = excluded.sourcePath,
         title = COALESCE(excluded.title, tracks.title),
         artist = COALESCE(excluded.artist, tracks.artist),
         album = COALESCE(excluded.album, tracks.album),
         durationSec = COALESCE(excluded.durationSec, tracks.durationSec),
         lastSeenAt = excluded.lastSeenAt,
         fileSize = excluded.fileSize,
         mtimeMs = excluded.mtimeMs`
    )
    .run(
      track.trackId,
      track.contentHash ?? track.trackId,
      track.sourcePath,
      track.title ?? null,
      track.artist ?? null,
      track.album ?? null,
      track.durationSec ?? null,
      track.addedAt ?? now,
      now,
      track.fileSize ?? null,
      track.mtimeMs ?? null
    );
};

const ensureFeatureRow = (track) => {
  const now = toIso();
  dbState.db
    .prepare(
      `INSERT INTO track_features (trackId, sourcePath, analysisStatus, analysisStage, analysisProgress, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(trackId) DO UPDATE SET
         sourcePath = excluded.sourcePath,
         updatedAt = excluded.updatedAt`
    )
    .run(
      track.trackId,
      track.sourcePath,
      "queued",
      "queued",
      JSON.stringify({ progress: 0 }),
      now,
      now
    );
};

const ensureOrbitRow = (trackId) => {
  const now = toIso();
  dbState.db
    .prepare(
      `INSERT INTO track_orbit (trackId, orbit, orbitUpdatedAt, evidenceScore)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(trackId) DO NOTHING`
    )
    .run(trackId, "discovery", now, 0);
};

const updateOrbitFromEvent = (trackId, event) => {
  if (!dbState) return null;
  const now = toIso();
  const prefs = dbState.db
    .prepare("SELECT forceOn, forceOff FROM track_prefs WHERE trackId = ?")
    .get(trackId);
  if (prefs?.forceOff) {
    dbState.db
      .prepare(
        "INSERT INTO track_orbit (trackId, orbit, orbitUpdatedAt, evidenceScore, lastNegativeAt) VALUES (?, ?, ?, ?, ?) ON CONFLICT(trackId) DO UPDATE SET orbit = excluded.orbit, orbitUpdatedAt = excluded.orbitUpdatedAt, lastNegativeAt = excluded.lastNegativeAt"
      )
      .run(trackId, "discovery", now, 0, now);
    return { trackId, orbit: "discovery", evidenceScore: 0, lastNegativeAt: now };
  }

  const completionPct = Number(event.completionPct) || 0;
  const listenedSec = Number(event.listenedSec) || 0;
  const qualified = completionPct >= ORBIT_CONFIG.qualifiedThreshold && event.endReason !== "skipped";
  const earlySkip = completionPct < ORBIT_CONFIG.earlySkipThreshold || listenedSec < 15;

  const history = dbState.db
    .prepare(
      "SELECT completionPct, listenedSec, endReason FROM playback_events WHERE trackId = ? ORDER BY startedAt DESC LIMIT 5"
    )
    .all(trackId);
  let qualifiedCount = 0;
  let earlySkips = 0;
  history.forEach((item) => {
    const pct = Number(item.completionPct) || 0;
    const sec = Number(item.listenedSec) || 0;
    const isQualified = pct >= ORBIT_CONFIG.qualifiedThreshold && item.endReason !== "skipped";
    const isEarly = pct < ORBIT_CONFIG.earlySkipThreshold || sec < 15;
    if (isQualified) qualifiedCount += 1;
    if (isEarly) earlySkips += 1;
  });

  const orbitRow = dbState.db
    .prepare(
      "SELECT orbit, evidenceScore, lastPositiveListenAt, lastNegativeAt FROM track_orbit WHERE trackId = ?"
    )
    .get(trackId);
  let evidenceScore = Number(orbitRow?.evidenceScore) || 0;
  if (qualified) evidenceScore += 12;
  if (earlySkip) evidenceScore -= 18;
  evidenceScore = Math.max(0, Math.min(100, evidenceScore));

  let orbit = orbitRow?.orbit || "discovery";
  if (prefs?.forceOn) {
    orbit = "rotation";
  } else if (earlySkips >= ORBIT_CONFIG.demotionSkips) {
    orbit = "discovery";
  } else if (evidenceScore >= ORBIT_CONFIG.promotionThreshold || qualifiedCount >= 2) {
    orbit = "rotation";
  } else if (qualified) {
    orbit = "recent";
  }

  const lastPositiveListenAt = qualified ? now : orbitRow?.lastPositiveListenAt ?? null;
  const lastNegativeAt = earlySkip ? now : orbitRow?.lastNegativeAt ?? null;

  dbState.db
    .prepare(
      `INSERT INTO track_orbit (trackId, orbit, orbitUpdatedAt, evidenceScore, lastPositiveListenAt, lastNegativeAt)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(trackId) DO UPDATE SET
         orbit = excluded.orbit,
         orbitUpdatedAt = excluded.orbitUpdatedAt,
         evidenceScore = excluded.evidenceScore,
         lastPositiveListenAt = excluded.lastPositiveListenAt,
         lastNegativeAt = excluded.lastNegativeAt`
    )
    .run(trackId, orbit, now, evidenceScore, lastPositiveListenAt, lastNegativeAt);

  return { trackId, orbit, evidenceScore, lastPositiveListenAt, lastNegativeAt };
};

const decayOrbits = () => {
  if (!dbState) return;
  const now = toIso();
  const nowMs = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const missing = dbState.db
    .prepare(
      "SELECT t.trackId FROM tracks t LEFT JOIN track_orbit o ON t.trackId = o.trackId WHERE o.trackId IS NULL"
    )
    .all();
  missing.forEach((row) => ensureOrbitRow(row.trackId));
  const cutoff = new Date(Date.now() - ORBIT_CONFIG.recentDecayDays * 24 * 60 * 60 * 1000).toISOString();
  dbState.db
    .prepare(
      "UPDATE track_orbit SET orbit = ?, orbitUpdatedAt = ? WHERE orbit = ? AND lastPositiveListenAt IS NOT NULL AND lastPositiveListenAt <= ?"
    )
    .run("discovery", now, "recent", cutoff);

  // Long-term decay: drop evidence score and orbit for tracks ignored for a long time.
  const orbitRows = dbState.db
    .prepare(
      "SELECT trackId, orbit, orbitUpdatedAt, lastPositiveListenAt, lastNegativeAt, evidenceScore FROM track_orbit"
    )
    .all();
  const longIgnoreMs = ORBIT_LONG_IGNORE_DAYS * dayMs;
  orbitRows.forEach((row) => {
    const lastTouchIso = row.lastPositiveListenAt || row.lastNegativeAt || row.orbitUpdatedAt;
    const lastTouchMs = lastTouchIso ? Date.parse(lastTouchIso) : null;
    if (!Number.isFinite(lastTouchMs)) return;
    const idleMs = nowMs - lastTouchMs;
    if (idleMs <= 0) return;
    const idleDays = idleMs / dayMs;
    let nextEvidence = Number.isFinite(row.evidenceScore) ? row.evidenceScore : 0;
    let nextOrbit = row.orbit || "discovery";
    let touched = false;

    if (idleMs >= longIgnoreMs && row.orbit !== "discovery") {
      nextOrbit = "discovery";
      nextEvidence = 0;
      touched = true;
    } else if (idleDays >= ORBIT_DECAY_START_DAYS && row.orbit === "rotation") {
      const decayDays = Math.floor(idleDays - ORBIT_DECAY_START_DAYS + 1);
      const decayed = Math.max(0, nextEvidence - decayDays * ORBIT_DECAY_PER_DAY);
      if (decayed !== nextEvidence) {
        nextEvidence = decayed;
        touched = true;
      }
    }

    if (touched) {
      dbState.db
        .prepare(
          "UPDATE track_orbit SET orbit = ?, orbitUpdatedAt = ?, evidenceScore = ? WHERE trackId = ?"
        )
        .run(nextOrbit, now, nextEvidence, row.trackId);
    }
  });
};

const needsAnalysis = (trackId) => {
  const row = dbState.db
    .prepare("SELECT embeddingVersion, featuresVersion, analysisStatus FROM track_features WHERE trackId = ?")
    .get(trackId);
  if (!row) return true;
  if (row.analysisStatus !== "complete") return true;
  if (row.embeddingVersion !== dbState.embeddingVersion) return true;
  if (row.featuresVersion !== dbState.featuresVersion) return true;
  return false;
};

const analyzeLoudness = (filePath) =>
  new Promise((resolve) => {
    if (typeof filePath !== "string" || filePath.trim().length === 0) {
      resolve(null);
      return;
    }
    const normalizedPath = path.normalize(filePath);
    if (!allowedExtensions.has(path.extname(normalizedPath).toLowerCase())) {
      resolve(null);
      return;
    }
    const ffmpegPath = app.isPackaged
      ? path.join(process.resourcesPath, "ffmpeg", "ffmpeg.exe")
      : path.resolve(__dirname, "ffmpeg", "ffmpeg.exe");
    const args = [
      "-i",
      normalizedPath,
      "-af",
      "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json",
      "-f",
      "null",
      "-"
    ];
    execFile(ffmpegPath, args, { windowsHide: true }, (_err, _stdout, stderr) => {
      if (typeof stderr !== "string") {
        resolve(null);
        return;
      }
      const match = stderr.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
      if (!match) {
        resolve(null);
        return;
      }
      try {
        const data = JSON.parse(match[0]);
        const inputLufs = Number(data.input_i);
        const inputTruePeak = Number(data.input_tp);
        if (!Number.isFinite(inputLufs)) {
          resolve(null);
          return;
        }
        const target = -14;
        const peakLimit = -1.5;
        const gainFromLufs = target - inputLufs;
        const gainFromPeak = Number.isFinite(inputTruePeak)
          ? peakLimit - inputTruePeak
          : gainFromLufs;
        const gainDbRaw = Math.min(gainFromLufs, gainFromPeak);
        const gainDb = Math.max(-12, Math.min(12, gainDbRaw));
        resolve({ gainDb, loudnessLUFS: inputLufs });
      } catch {
        resolve(null);
      }
    });
  });

const queueAnalysis = async (track) => {
  if (!dbState) return;
  upsertTrack(track);
  ensureFeatureRow(track);
  ensureOrbitRow(track.trackId);
  if (!needsAnalysis(track.trackId)) return;
  analysisQueue.push(track);
  processAnalysisQueue();
};

const processAnalysisQueue = async () => {
  if (!dbState || analysisBusy || analysisPaused) return;
  if (playbackActive && analysisQueue.length > 0) return;
  const next = analysisQueue.shift();
  if (!next) return;
  const worker = ensureAnalysisWorker();
  if (!worker) return;
  analysisBusy = true;
  const now = toIso();
  dbState.db
    .prepare(
      "UPDATE track_features SET analysisStatus = ?, analysisStage = ?, analysisProgress = ?, updatedAt = ? WHERE trackId = ?"
    )
    .run("in_progress", "loudness", JSON.stringify({ progress: 0.05 }), now, next.trackId);
  const loudness = await analyzeLoudness(next.sourcePath);
  worker.postMessage({
    type: "analyze",
    payload: {
      trackId: next.trackId,
      filePath: next.sourcePath,
      loudnessLUFS: loudness?.loudnessLUFS ?? null
    }
  });
};

const rebuildEmbeddingIndex = () => {
  if (!dbState) return;
  const rows = dbState.db
    .prepare(
      "SELECT trackId, embedding, bpm, key, mode FROM track_features WHERE analysisStatus = ? AND embeddingVersion = ?"
    )
    .all("complete", dbState.embeddingVersion);
  const data = new Map();
  rows.forEach((row) => {
    if (!row.embedding) return;
    const buffer = row.embedding;
    const vector = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
    data.set(row.trackId, {
      embedding: vector,
      bpm: row.bpm,
      key: row.key,
      mode: row.mode
    });
  });
  embeddingIndexCache = {
    version: dbState.embeddingVersion,
    builtAt: toIso(),
    data,
    dirty: false
  };
};

const getNearestNeighbors = (trackId, k = 200) => {
  if (!dbState) return [];
  if (embeddingIndexCache.dirty || embeddingIndexCache.version !== dbState.embeddingVersion) {
    rebuildEmbeddingIndex();
  }
  const source = embeddingIndexCache.data.get(trackId);
  if (!source) return [];
  const feedback = dbState.db
    .prepare(
      "SELECT posCentroid, negCentroid FROM embedding_feedback WHERE embeddingVersion = ?"
    )
    .get(dbState.embeddingVersion);
  const posCentroid = feedback?.posCentroid
    ? new Float32Array(
        feedback.posCentroid.buffer,
        feedback.posCentroid.byteOffset,
        feedback.posCentroid.byteLength / 4
      )
    : null;
  const negCentroid = feedback?.negCentroid
    ? new Float32Array(
        feedback.negCentroid.buffer,
        feedback.negCentroid.byteOffset,
        feedback.negCentroid.byteLength / 4
      )
    : null;
  const results = [];
  for (const [id, entry] of embeddingIndexCache.data.entries()) {
    if (id === trackId) continue;
    let dot = 0;
    const a = source.embedding;
    const b = entry.embedding;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i += 1) {
      dot += a[i] * b[i];
    }
    let bias = 0;
    if (posCentroid && posCentroid.length === b.length) {
      let posDot = 0;
      for (let i = 0; i < len; i += 1) {
        posDot += b[i] * posCentroid[i];
      }
      bias += posDot;
    }
    if (negCentroid && negCentroid.length === b.length) {
      let negDot = 0;
      for (let i = 0; i < len; i += 1) {
        negDot += b[i] * negCentroid[i];
      }
      bias -= negDot;
    }
    const score = dot + bias * 0.1;
    results.push({
      trackId: id,
      score,
      bpm: entry.bpm,
      key: entry.key,
      mode: entry.mode
    });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, k);
};

const registerIpc = () => {
  ipcMain.handle("dialog:open-audio-files", async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: "Import audio files",
        buttonLabel: "Import",
        properties: ["openFile", "multiSelections"],
        filters: [
          {
            name: "Audio Files",
        extensions: ["mp3", "wav", "m4a", "flac", "aac", "alac", "ogg", "opus"]
          }
        ]
      });
      if (result.canceled || !Array.isArray(result.filePaths)) {
        return [];
      }
      const normalized = normalizePaths(result.filePaths);
      const detailed = [];
      for (const filePath of normalized) {
        const stats = fs.statSync(filePath);
        const contentHash = await hashFile(filePath);
        detailed.push({
          path: filePath,
          trackId: contentHash,
          contentHash,
          fileSize: stats.size,
          mtimeMs: stats.mtimeMs
        });
      }
      return detailed;
    } catch {
      return [];
    }
  });

  ipcMain.handle("audio:analyze-loudness", async (_event, filePath) => {
    const loudness = await analyzeLoudness(filePath);
    return loudness ? { gainDb: loudness.gainDb, loudnessLUFS: loudness.loudnessLUFS } : null;
  });

  ipcMain.handle("library:get-tracks", () => {
    if (!dbState) return [];
    return dbState.db
      .prepare(
        `SELECT t.trackId, t.sourcePath, t.title, t.artist, t.album, t.durationSec,
                p.forceOn, p.forceOff, p.saved,
                o.orbit, o.evidenceScore, o.lastPositiveListenAt, o.lastNegativeAt
         FROM tracks t
         LEFT JOIN track_prefs p ON t.trackId = p.trackId
         LEFT JOIN track_orbit o ON t.trackId = o.trackId
         ORDER BY t.addedAt DESC`
      )
      .all()
      .map((row) => ({
        id: row.trackId,
        path: row.sourcePath,
        title: row.title,
        artist: row.artist,
        album: row.album,
        durationSec: row.durationSec,
        forceOn: !!row.forceOn,
        forceOff: !!row.forceOff,
        saved: !!row.saved,
        orbit: row.orbit,
        evidenceScore: row.evidenceScore,
        lastPositiveListenAt: row.lastPositiveListenAt,
        lastNegativeAt: row.lastNegativeAt
      }));
  });

  ipcMain.handle("library:upsert-tracks", (_event, tracks) => {
    if (!dbState || !Array.isArray(tracks)) return false;
    tracks.forEach((track) => {
      if (!track || !track.id || !track.path) return;
      upsertTrack({
        trackId: track.id,
        contentHash: track.contentHash ?? track.id,
        sourcePath: track.path,
        title: track.title,
        artist: track.artist,
        album: track.album,
        durationSec: track.durationSec
      });
      ensureOrbitRow(track.id);
    });
    return true;
  });

  ipcMain.handle("library:update-prefs", (_event, payload) => {
    if (!dbState || !payload?.trackId) return false;
    const now = toIso();
    const forceOn = payload.forceOn ? 1 : 0;
    const forceOff = payload.forceOff ? 1 : 0;
    const saved = payload.saved ? 1 : 0;
    dbState.db
      .prepare(
        `INSERT INTO track_prefs (trackId, forceOn, forceOff, saved, updatedAt)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(trackId) DO UPDATE SET
           forceOn = excluded.forceOn,
           forceOff = excluded.forceOff,
           saved = excluded.saved,
           updatedAt = excluded.updatedAt`
      )
      .run(payload.trackId, forceOn, forceOff, saved, now);
    if (forceOff) {
      dbState.db
        .prepare(
          "INSERT INTO track_orbit (trackId, orbit, orbitUpdatedAt, evidenceScore) VALUES (?, ?, ?, ?) ON CONFLICT(trackId) DO UPDATE SET orbit = excluded.orbit, orbitUpdatedAt = excluded.orbitUpdatedAt"
        )
        .run(payload.trackId, "discovery", now, 0);
    }
    if (forceOn) {
      dbState.db
        .prepare(
          "INSERT INTO track_orbit (trackId, orbit, orbitUpdatedAt, evidenceScore) VALUES (?, ?, ?, ?) ON CONFLICT(trackId) DO UPDATE SET orbit = excluded.orbit, orbitUpdatedAt = excluded.orbitUpdatedAt"
        )
        .run(payload.trackId, "rotation", now, ORBIT_THRESHOLD);
    }
    return true;
  });

  ipcMain.handle("library:remove-tracks", (_event, trackIds) => {
    if (!dbState || !Array.isArray(trackIds)) return false;
    const stmt = dbState.db.prepare("DELETE FROM tracks WHERE trackId = ?");
    const featureStmt = dbState.db.prepare("DELETE FROM track_features WHERE trackId = ?");
    const prefStmt = dbState.db.prepare("DELETE FROM track_prefs WHERE trackId = ?");
    const orbitStmt = dbState.db.prepare("DELETE FROM track_orbit WHERE trackId = ?");
    const eventStmt = dbState.db.prepare("DELETE FROM playback_events WHERE trackId = ?");
    trackIds.forEach((id) => {
      stmt.run(id);
      featureStmt.run(id);
      prefStmt.run(id);
      orbitStmt.run(id);
      eventStmt.run(id);
    });
    return true;
  });

  ipcMain.handle("library:clear", () => {
    if (!dbState) return false;
    dbState.db.prepare("DELETE FROM tracks").run();
    dbState.db.prepare("DELETE FROM track_features").run();
    dbState.db.prepare("DELETE FROM track_prefs").run();
    dbState.db.prepare("DELETE FROM track_orbit").run();
    dbState.db.prepare("DELETE FROM playback_events").run();
    embeddingIndexCache.dirty = true;
    return true;
  });

  ipcMain.handle("analysis:queue", (_event, tracks) => {
    if (!dbState || !Array.isArray(tracks)) return false;
    tracks.forEach((track) => {
      if (!track || !track.id || !track.path) return;
      queueAnalysis({
        trackId: track.id,
        contentHash: track.contentHash ?? track.id,
        sourcePath: track.path,
        title: track.title,
        artist: track.artist,
        fileSize: track.fileSize,
        mtimeMs: track.mtimeMs
      });
    });
    return true;
  });

  ipcMain.handle("analysis:get-features", (_event, trackId) => {
    if (!dbState || !trackId) return null;
    const row = dbState.db
      .prepare(
        "SELECT trackId, durationSec, loudnessLUFS, bpm, bpmConfidence, key, mode, keyConfidence, timbreStats, energyCurveSummary, embeddingVersion, featuresVersion, analysisStatus FROM track_features WHERE trackId = ?"
      )
      .get(trackId);
    if (!row) return null;
    return {
      trackId: row.trackId,
      durationSec: row.durationSec,
      loudnessLUFS: row.loudnessLUFS,
      bpm: row.bpm,
      bpmConfidence: row.bpmConfidence,
      key: row.key,
      mode: row.mode,
      keyConfidence: row.keyConfidence,
      timbreStats: row.timbreStats ? JSON.parse(row.timbreStats) : null,
      energyCurveSummary: row.energyCurveSummary ? JSON.parse(row.energyCurveSummary) : null,
      embeddingVersion: row.embeddingVersion,
      featuresVersion: row.featuresVersion,
      analysisStatus: row.analysisStatus
    };
  });

  ipcMain.handle("orbit:get", (_event, trackId) => {
    if (!dbState || !trackId) return null;
    const row = dbState.db
      .prepare(
        "SELECT trackId, orbit, orbitUpdatedAt, evidenceScore, lastPositiveListenAt, lastNegativeAt FROM track_orbit WHERE trackId = ?"
      )
      .get(trackId);
    return row || null;
  });

  ipcMain.handle("playback:log-event", (_event, payload) => {
    if (!dbState || !payload?.trackId) return null;
    const eventId = crypto.randomUUID();
    dbState.db
      .prepare(
        `INSERT INTO playback_events (eventId, trackId, startedAt, endedAt, listenedSec, completionPct, endReason, context)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        eventId,
        payload.trackId,
        payload.startedAt,
        payload.endedAt,
        payload.listenedSec,
        payload.completionPct,
        payload.endReason,
        payload.context
      );
    const orbit = updateOrbitFromEvent(payload.trackId, payload);
    return { eventId, orbit };
  });

  ipcMain.handle("analysis:pause", (_event, paused) => {
    analysisPaused = !!paused;
    if (!analysisPaused) {
      processAnalysisQueue();
    }
    return true;
  });

  ipcMain.handle("analysis:set-playback-active", (_event, active) => {
    playbackActive = !!active;
    if (!playbackActive) {
      processAnalysisQueue();
    }
    return true;
  });

  ipcMain.handle("recommendations:get-neighbors", (_event, trackId, k) => {
    return getNearestNeighbors(trackId, k);
  });

  ipcMain.handle("recommendations:metrics", () => {
    if (!dbState) return null;
    const row = dbState.db.prepare("SELECT * FROM metrics_summary WHERE id = 1").get();
    return row || null;
  });

  ipcMain.handle("selection:log-trace", (_event, payload) => {
    if (!dbState || !payload) return false;
    const selectionId = payload.selectionId || crypto.randomUUID();
    dbState.db
      .prepare(
        `INSERT INTO selection_trace (selectionId, timestamp, currentTrackId, pickedTrackId, reason, rolledOrbit, weights, poolSizes, filtersApplied)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        selectionId,
        payload.timestamp || toIso(),
        payload.currentTrackId ?? null,
        payload.pickedTrackId ?? null,
        payload.reason ?? null,
        payload.rolledOrbit ?? null,
        payload.weights ? JSON.stringify(payload.weights) : null,
        payload.poolSizes ? JSON.stringify(payload.poolSizes) : null,
        payload.filtersApplied ? JSON.stringify(payload.filtersApplied) : null
      );
    return true;
  });

  ipcMain.handle("recommendations:report", (_event, payload) => {
    if (!dbState || !payload || !payload.trackId) return false;
    const now = toIso();
    const embeddingRow = dbState.db
      .prepare("SELECT embedding FROM track_features WHERE trackId = ? AND embeddingVersion = ?")
      .get(payload.trackId, dbState.embeddingVersion);
    if (embeddingRow?.embedding) {
      const vector = new Float32Array(
        embeddingRow.embedding.buffer,
        embeddingRow.embedding.byteOffset,
        embeddingRow.embedding.byteLength / 4
      );
      const table = dbState.db.prepare(
        "SELECT embeddingVersion, posCount, negCount, posCentroid, negCentroid FROM embedding_feedback WHERE embeddingVersion = ?"
      );
      const row = table.get(dbState.embeddingVersion);
      let posCount = row?.posCount ?? 0;
      let negCount = row?.negCount ?? 0;
      let posCentroid = row?.posCentroid
        ? new Float32Array(row.posCentroid.buffer, row.posCentroid.byteOffset, row.posCentroid.byteLength / 4)
        : new Float32Array(vector.length);
      let negCentroid = row?.negCentroid
        ? new Float32Array(row.negCentroid.buffer, row.negCentroid.byteOffset, row.negCentroid.byteLength / 4)
        : new Float32Array(vector.length);
      if (payload.signal === "positive") {
        posCount += 1;
        for (let i = 0; i < vector.length; i += 1) {
          posCentroid[i] = posCentroid[i] + (vector[i] - posCentroid[i]) / posCount;
        }
      }
      if (payload.signal === "negative") {
        negCount += 1;
        for (let i = 0; i < vector.length; i += 1) {
          negCentroid[i] = negCentroid[i] + (vector[i] - negCentroid[i]) / negCount;
        }
      }
      dbState.db
        .prepare(
          `INSERT INTO embedding_feedback (embeddingVersion, posCount, negCount, posCentroid, negCentroid, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(embeddingVersion) DO UPDATE SET
             posCount = excluded.posCount,
             negCount = excluded.negCount,
             posCentroid = excluded.posCentroid,
             negCentroid = excluded.negCentroid,
             updatedAt = excluded.updatedAt`
        )
        .run(
          dbState.embeddingVersion,
          posCount,
          negCount,
          Buffer.from(posCentroid.buffer),
          Buffer.from(negCentroid.buffer),
          now
        );
    }
    if (payload.source === "recommendation") {
      const metrics = dbState.db.prepare("SELECT * FROM metrics_summary WHERE id = 1").get();
      const next = {
        totalPlays: (metrics?.totalPlays ?? 0) + 1,
        earlySkips: (metrics?.earlySkips ?? 0) + (payload.earlySkip ? 1 : 0),
        completions: (metrics?.completions ?? 0) + (payload.completed ? 1 : 0),
        replays: (metrics?.replays ?? 0) + (payload.replayed ? 1 : 0),
        regrets: (metrics?.regrets ?? 0) + (payload.regret ? 1 : 0)
      };
      dbState.db
        .prepare(
          "UPDATE metrics_summary SET totalPlays = ?, earlySkips = ?, completions = ?, replays = ?, regrets = ?, updatedAt = ? WHERE id = 1"
        )
        .run(
          next.totalPlays,
          next.earlySkips,
          next.completions,
          next.replays,
          next.regrets,
          now
        );
    }
    return true;
  });
};

const createWindow = () => {
  const preloadPath = path.resolve(__dirname, "preload.cjs");
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Hound",
    backgroundColor: "#0a0f1a",
    webPreferences: {
      // Preload bridge attached here (window.Hound).
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  if (isDev) {
    mainWindow.loadURL(resolveRendererURL());
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    const indexPath = path.resolve(__dirname, "../dist/index.html");
    mainWindow.loadFile(indexPath);
  }
  return mainWindow;
};

app.whenReady().then(() => {
  dbState = openDatabase(app);
  decayOrbits();
  protocol.registerFileProtocol("houndfile", (request, callback) => {
    try {
      const url = new URL(request.url);
      let filePath = decodeURIComponent(url.pathname);
      if (url.hostname && url.hostname.length === 1) {
        filePath = `${url.hostname}:${filePath}`;
      }
      if (process.platform === "win32" && filePath.startsWith("/")) {
        filePath = filePath.slice(1);
      }
      callback({ path: filePath });
    } catch {
      callback({ error: -6 });
    }
  });
  registerIpc();
  mainWindow = createWindow();
  const pending = dbState.db
    .prepare("SELECT trackId, sourcePath FROM track_features WHERE analysisStatus != ?")
    .all("complete");
  pending.forEach((row) => {
    queueAnalysis({ trackId: row.trackId, sourcePath: row.sourcePath });
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});


