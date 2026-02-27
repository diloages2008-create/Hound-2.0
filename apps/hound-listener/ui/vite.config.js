import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import os from "node:os";
import path from "node:path";

const defaultEnvDir = path.join(os.homedir(), ".hound-secrets", "hound-listener");
const envDir = process.env.HOUND_LISTENER_ENV_DIR || defaultEnvDir;

export default defineConfig({
  base: './',
  root: path.resolve(__dirname),
  envDir,
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
