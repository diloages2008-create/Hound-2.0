const ENV = (typeof import.meta !== "undefined" && import.meta.env) ? import.meta.env : {};
const PROVIDER_MODE = (ENV.VITE_LIBRARY_PROVIDER || "mock").toLowerCase();
const MOCK_MANIFEST_URL = ENV.VITE_MOCK_LIBRARY_MANIFEST_URL || "/mock-library/manifest.json";

function toHoundFileUrl(path) {
  const normalized = String(path || "").replace(/\\/g, "/");
  const prefixed = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return `houndfile://${encodeURI(prefixed)}`;
}

function toViteFsUrl(path) {
  const normalized = String(path || "").replace(/\\/g, "/").replace(/^\/+/, "");
  return `/@fs/${encodeURI(normalized)}`;
}

function normalizeManifestTrack(item = {}) {
  return {
    id: item.trackId || item.id || "",
    title: item.title || "Unknown Title",
    artist: item.artist || "Unknown Artist",
    album: item.album || null,
    durationSec: Number.isFinite(item.durationSec) ? item.durationSec : Number(item.duration || 0) || null,
    streamUrl: item.streamUrl || item.url || null,
    path: item.filePath || item.path || "",
    artworkPath: item.artworkPath || item.artwork || null,
    world: item.world || "Normal",
    orbit: item.orbit || "discovery",
    worldOrbit: item.worldOrbit || (item.orbit === "rotation" ? "orbit_1" : item.orbit === "recent" ? "orbit_2" : "orbit_3"),
    globalOrbit: item.globalOrbit || null,
    saved: Boolean(item.saved),
    rotation: item.orbit === "rotation",
    rotationOverride: item.rotationOverride || "none",
    rotationScore: Number.isFinite(item.rotationScore) ? item.rotationScore : 0,
    playCountTotal: Number.isFinite(item.playCountTotal) ? item.playCountTotal : 0,
    playHistory: Array.isArray(item.playHistory) ? item.playHistory : [],
    gain: Number.isFinite(item.gain) ? item.gain : 1,
    loudnessReady: Boolean(item.loudnessReady),
    analysisStatus: item.analysisStatus || "pending",
    forceOn: Boolean(item.forceOn),
    forceOff: Boolean(item.forceOff),
    archivedAt: item.archivedAt || null,
    archiveRetestCount: Number.isFinite(item.archiveRetestCount) ? item.archiveRetestCount : 0
  };
}

function createMockProvider(fetchImpl) {
  return {
    mode: "mock",
    async listTracks() {
      const response = await fetchImpl(MOCK_MANIFEST_URL, { method: "GET" });
      if (!response.ok) throw new Error(`Mock manifest load failed: ${response.status}`);
      const payload = await response.json();
      const tracks = Array.isArray(payload?.tracks) ? payload.tracks : [];
      return tracks.map(normalizeManifestTrack).filter((track) => track.id);
    },
    async resolveStreamUrl(track) {
      if (track?.streamUrl) return track.streamUrl;
      if (track?.remoteUrl) return track.remoteUrl;
      if (track?.path) return toViteFsUrl(track.path);
      throw new Error(`No stream source for track ${track?.id || "unknown"}`);
    }
  };
}

function createApiProvider() {
  return {
    mode: "api",
    async listTracks() {
      return [];
    },
    async resolveStreamUrl(track) {
      if (track?.remoteUrl) return track.remoteUrl;
      if (track?.streamUrl) return track.streamUrl;
      throw new Error(`No API stream for track ${track?.id || "unknown"}`);
    }
  };
}

export function createLibraryProvider({ fetchImpl = fetch, mode = PROVIDER_MODE } = {}) {
  if (mode === "api") return createApiProvider(fetchImpl);
  return createMockProvider(fetchImpl);
}

export { PROVIDER_MODE, MOCK_MANIFEST_URL };
