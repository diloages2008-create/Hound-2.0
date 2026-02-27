const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

const FEATURES_VERSION = "v1";
const EMBEDDING_VERSION = "v1-mfcc-59";

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const getDataRoot = (app) => {
  if (app.isPackaged) {
    return path.join(app.getPath("userData"), "data");
  }
  return path.resolve(__dirname, "..", "data");
};

const getDbPath = (app) => path.join(getDataRoot(app), "hound.db");

const openDatabase = (app) => {
  const dataRoot = getDataRoot(app);
  ensureDir(dataRoot);
  ensureDir(path.join(dataRoot, "analysis-cache"));
  ensureDir(path.join(dataRoot, "embeddings"));
  const dbPath = getDbPath(app);
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");

  const ensureColumn = (table, column, type) => {
    const existing = db
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .some((row) => row.name === column);
    if (!existing) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
  };

  db.exec(`
    CREATE TABLE IF NOT EXISTS tracks (
      trackId TEXT PRIMARY KEY,
      contentHash TEXT,
      sourcePath TEXT NOT NULL,
      title TEXT,
      artist TEXT,
      album TEXT,
      durationSec REAL,
      addedAt TEXT,
      lastSeenAt TEXT,
      fileSize INTEGER,
      mtimeMs INTEGER
    );

    CREATE TABLE IF NOT EXISTS track_features (
      trackId TEXT PRIMARY KEY,
      sourcePath TEXT NOT NULL,
      durationSec REAL,
      loudnessLUFS REAL,
      bpm REAL,
      bpmConfidence REAL,
      key TEXT,
      mode TEXT,
      keyConfidence REAL,
      timbreStats TEXT,
      energyCurveSummary TEXT,
      embedding BLOB,
      embeddingVersion TEXT,
      featuresVersion TEXT,
      analysisStatus TEXT,
      analysisStage TEXT,
      analysisProgress TEXT,
      analyzedAt TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS playback_events (
      eventId TEXT PRIMARY KEY,
      trackId TEXT NOT NULL,
      startedAt TEXT,
      endedAt TEXT,
      listenedSec REAL,
      completionPct REAL,
      endReason TEXT,
      context TEXT
    );

    CREATE TABLE IF NOT EXISTS track_prefs (
      trackId TEXT PRIMARY KEY,
      forceOn INTEGER,
      forceOff INTEGER,
      saved INTEGER,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS track_orbit (
      trackId TEXT PRIMARY KEY,
      orbit TEXT,
      orbitUpdatedAt TEXT,
      evidenceScore REAL,
      lastPositiveListenAt TEXT,
      lastNegativeAt TEXT
    );

    CREATE INDEX IF NOT EXISTS playback_events_trackId ON playback_events (trackId);
    CREATE INDEX IF NOT EXISTS playback_events_startedAt ON playback_events (startedAt);

    CREATE TABLE IF NOT EXISTS embedding_feedback (
      embeddingVersion TEXT PRIMARY KEY,
      posCount INTEGER,
      negCount INTEGER,
      posCentroid BLOB,
      negCentroid BLOB,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS metrics_summary (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      totalPlays INTEGER,
      earlySkips INTEGER,
      completions INTEGER,
      replays INTEGER,
      regrets INTEGER,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS selection_trace (
      selectionId TEXT PRIMARY KEY,
      timestamp TEXT,
      currentTrackId TEXT,
      pickedTrackId TEXT,
      reason TEXT,
      rolledOrbit TEXT,
      weights TEXT,
      poolSizes TEXT,
      filtersApplied TEXT
    );
  `);

  ensureColumn("tracks", "album", "TEXT");
  ensureColumn("tracks", "durationSec", "REAL");
  ensureColumn("tracks", "fileSize", "INTEGER");
  ensureColumn("tracks", "mtimeMs", "INTEGER");
  ensureColumn("track_features", "durationSec", "REAL");
  ensureColumn("track_features", "embeddingVersion", "TEXT");
  ensureColumn("track_features", "featuresVersion", "TEXT");
  ensureColumn("track_features", "analysisStatus", "TEXT");
  ensureColumn("track_features", "analysisStage", "TEXT");
  ensureColumn("track_features", "analysisProgress", "TEXT");

  const seed = db.prepare("SELECT id FROM metrics_summary WHERE id = 1").get();
  if (!seed) {
    db.prepare(
      "INSERT INTO metrics_summary (id, totalPlays, earlySkips, completions, replays, regrets, updatedAt) VALUES (1, 0, 0, 0, 0, 0, ?)"
    ).run(new Date().toISOString());
  }

  return {
    db,
    dataRoot,
    featuresVersion: FEATURES_VERSION,
    embeddingVersion: EMBEDDING_VERSION
  };
};

module.exports = {
  openDatabase,
  getDataRoot,
  FEATURES_VERSION,
  EMBEDDING_VERSION
};
