import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import os from "node:os";
import path from "node:path";

const defaultEnvDir = path.join(os.homedir(), ".hound-secrets", "hound-studio");
const envDir = process.env.HOUND_STUDIO_ENV_DIR || defaultEnvDir;

export default defineConfig({
  envDir,
  plugins: [react()],
  server: {
    port: 5174
  }
});
