const { spawn } = require("node:child_process");
const path = require("node:path");

const electronPath = require("electron");
const entry = path.resolve(__dirname, "main.cjs");
const env = { ...process.env };

if (env.ELECTRON_RUN_AS_NODE) {
  delete env.ELECTRON_RUN_AS_NODE;
}

const child = spawn(electronPath, [entry], {
  stdio: "inherit",
  env
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
