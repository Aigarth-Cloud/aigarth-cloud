// Dev bootstrap — ensures `.env` exists, then runs the service.
//
// Why: `--env-file=.env` in tsx fails hard if `.env` is missing.
// Other services in the monorepo have `.env` checked in from
// earlier phases; a brand-new service (like 19B's dataset) only
// ships `.env.example` until the first dev run. This wrapper makes
// the first run Just Work without a manual `cp` step.
//
// On subsequent runs the file is already present and the script
// passes through.

import { existsSync, copyFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const envFile = resolve(root, ".env");
const exampleFile = resolve(root, ".env.example");

if (!existsSync(envFile)) {
  if (!existsSync(exampleFile)) {
    console.error(
      "[dev] .env and .env.example are both missing. Something is very wrong.",
    );
    process.exit(1);
  }
  console.log("[dev] .env not found — copying from .env.example");
  copyFileSync(exampleFile, envFile);
}

// Find the local tsx binary. We resolve it via pnpm exec, which
// understands the workspace's node_modules layout. On Windows, we
// need the .cmd wrapper.
const tsxBin =
  process.platform === "win32"
    ? resolve(root, "node_modules", ".bin", "tsx.cmd")
    : resolve(root, "node_modules", ".bin", "tsx");

if (!existsSync(tsxBin)) {
  console.error(
    `[dev] tsx binary not found at ${tsxBin}. Did you run "pnpm install"?`,
  );
  process.exit(1);
}

// Spawn `tsx watch --env-file=.env src/index.ts` and proxy exit code.
const child = spawn(tsxBin, ["watch", "--env-file=.env", "src/index.ts"], {
  stdio: "inherit",
  cwd: root,
  shell: process.platform === "win32",
});
child.on("exit", (code) => process.exit(code ?? 0));
