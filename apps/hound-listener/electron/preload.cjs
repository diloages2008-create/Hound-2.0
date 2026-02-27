const { contextBridge, ipcRenderer } = require("electron");

// Contract: window.Hound.openAudioFiles(): Promise<string[]>
// - Returns absolute paths
// - Cancel returns []
contextBridge.exposeInMainWorld("Hound", {
  openAudioFiles: () =>
    ipcRenderer.invoke("dialog:open-audio-files").catch(() => []),
  analyzeLoudness: (filePath) =>
    ipcRenderer.invoke("audio:analyze-loudness", filePath).catch(() => null),
  loadLibrary: () => ipcRenderer.invoke("library:get-tracks").catch(() => []),
  saveLibrary: (tracks) =>
    ipcRenderer.invoke("library:upsert-tracks", tracks).catch(() => false),
  updateTrackPrefs: (payload) =>
    ipcRenderer.invoke("library:update-prefs", payload).catch(() => false),
  removeLibraryTracks: (trackIds) =>
    ipcRenderer.invoke("library:remove-tracks", trackIds).catch(() => false),
  clearLibrary: () => ipcRenderer.invoke("library:clear").catch(() => false),
  queueAnalysis: (tracks) =>
    ipcRenderer.invoke("analysis:queue", tracks).catch(() => false),
  getTrackFeatures: (trackId) =>
    ipcRenderer.invoke("analysis:get-features", trackId).catch(() => null),
  getTrackOrbit: (trackId) =>
    ipcRenderer.invoke("orbit:get", trackId).catch(() => null),
  logPlaybackEvent: (payload) =>
    ipcRenderer.invoke("playback:log-event", payload).catch(() => false),
  pauseAnalysis: (paused) =>
    ipcRenderer.invoke("analysis:pause", paused).catch(() => false),
  setPlaybackActive: (active) =>
    ipcRenderer.invoke("analysis:set-playback-active", active).catch(() => false),
  getNeighbors: (trackId, k) =>
    ipcRenderer.invoke("recommendations:get-neighbors", trackId, k).catch(() => []),
  logSelectionTrace: (payload) =>
    ipcRenderer.invoke("selection:log-trace", payload).catch(() => false),
  reportRecommendationSignal: (payload) =>
    ipcRenderer.invoke("recommendations:report", payload).catch(() => false),
  getRecommendationMetrics: () =>
    ipcRenderer.invoke("recommendations:metrics").catch(() => null),
  onAnalysisProgress: (handler) => {
    ipcRenderer.on("analysis:progress", handler);
    return () => ipcRenderer.removeListener("analysis:progress", handler);
  },
  onAnalysisCompleted: (handler) => {
    ipcRenderer.on("analysis:completed", handler);
    return () => ipcRenderer.removeListener("analysis:completed", handler);
  }
});

