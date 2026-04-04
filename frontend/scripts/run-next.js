const path = require("path");
const { spawn } = require("child_process");
const dotenv = require("dotenv");

const frontendRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(frontendRoot, "..");

dotenv.config({
  path: path.resolve(repoRoot, ".env"),
});

dotenv.config({
  path: path.resolve(frontendRoot, ".env.local"),
  override: true,
});

const mode = process.argv[2] === "start" ? "start" : "dev";
const port = process.env.FRONTEND_PORT || process.env.PORT || "4100";

const nextBin = path.resolve(
  frontendRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "next.cmd" : "next",
);

const child = spawn(nextBin, [mode, "-p", String(port)], {
  cwd: frontendRoot,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
