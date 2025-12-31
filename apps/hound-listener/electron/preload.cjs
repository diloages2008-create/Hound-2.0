const { contextBridge, ipcRenderer } = require("electron");

// Contract: window.Hound.openAudioFiles(): Promise<string[]>
// - Returns absolute paths
// - Cancel returns []
contextBridge.exposeInMainWorld("Hound", {
  openAudioFiles: () =>
    ipcRenderer.invoke("dialog:open-audio-files").catch(() => []),
  analyzeLoudness: (filePath) =>
    ipcRenderer.invoke("audio:analyze-loudness", filePath).catch(() => null)
});

