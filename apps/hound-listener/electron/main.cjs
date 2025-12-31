const path = require("node:path");
const { execFile } = require("node:child_process");
const { app, BrowserWindow, ipcMain, dialog, protocol } = require("electron");

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
      return normalizePaths(result.filePaths);
    } catch {
      return [];
    }
  });

  ipcMain.handle("audio:analyze-loudness", async (_event, filePath) => {
    if (typeof filePath !== "string" || filePath.trim().length === 0) {
      return null;
    }
    const normalizedPath = path.normalize(filePath);
    if (!allowedExtensions.has(path.extname(normalizedPath).toLowerCase())) {
      return null;
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
    return new Promise((resolve) => {
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
          resolve({ gainDb });
        } catch {
          resolve(null);
        }
      });
    });
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
};

app.whenReady().then(() => {
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
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});


