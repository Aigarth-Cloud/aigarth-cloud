#!/usr/bin/env node
/**
 * `pnpm stack:dev` — bring up the local Docker infrastructure, wait for
 * it to be healthy, then start `pnpm dev`. One command, full stack.
 *
 * Cross-platform (Windows + macOS + Linux). Pure Node, no extra deps.
 *
 * Steps:
 *   1. Verify `docker` is on PATH and the daemon is responsive.
 *   2. Run `docker compose -f infrastructure/docker-compose.yml up -d`.
 *   3. Poll Postgres (5432) and MinIO (9000) until both answer.
 *   4. Spawn `pnpm dev` in the foreground, pipe stdio.
 *   5. On Ctrl+C / SIGINT, kill the pnpm subprocess gracefully.
 *
 * If the user wants to bypass Docker and just run the apps (knowing
 * the DB-touching services will 500), they can use `pnpm dev` directly.
 *
 * Run: pnpm stack:dev
 */

import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const COMPOSE_FILE = path.join(ROOT, "infrastructure", "docker-compose.yml");

const PG_PORT = 5432;
const MINIO_PORT = 9000;
const READY_TIMEOUT_MS = 120_000; // 2 minutes
const POLL_INTERVAL_MS = 1500;

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};
const c = (color, s) => `${ANSI[color]}${s}${ANSI.reset}`;

// ---------- helpers ----------

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: opts.stdio ?? "inherit",
      cwd: opts.cwd ?? ROOT,
      shell: process.platform === "win32", // so .cmd wrappers resolve
      env: opts.env ?? process.env,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(0);
      else reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

function checkPort(port, host = "127.0.0.1", timeoutMs = 1000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

async function waitForPort(port, name, timeoutMs) {
  const start = Date.now();
  let attempt = 0;
  while (Date.now() - start < timeoutMs) {
    attempt++;
    const ok = await checkPort(port);
    if (ok) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(c("green", `  ✓ ${name} ready on :${port} (${elapsed}s, ${attempt} attempt${attempt === 1 ? "" : "s"})`));
      return;
    }
    process.stdout.write(c("dim", `  · waiting for ${name} on :${port}…\r`));
    await wait(POLL_INTERVAL_MS);
  }
  throw new Error(`${name} did not become ready on :${port} within ${timeoutMs / 1000}s`);
}

// ---------- main ----------

async function main() {
  console.log(c("bold", c("cyan", "\nAigarth Cloud — full stack launcher\n")));

  // Step 1: sanity-check docker
  console.log(c("bold", "[1/4] Checking Docker…"));
  try {
    await run("docker", ["info"], { stdio: "pipe" });
  } catch (e) {
    console.error(c("red", "\n  ✗ Docker is not running or not installed."));
    console.error(c("yellow", "    Start Docker Desktop and try again."));
    console.error(c("dim", `    (inner: ${e.message})`));
    process.exit(1);
  }
  console.log(c("green", "  ✓ Docker daemon responsive\n"));

  // Step 2: compose up
  console.log(c("bold", "[2/4] Bringing up infrastructure (Postgres, Redis, NATS, MinIO, MailHog)…"));
  try {
    await run("docker", ["compose", "-f", COMPOSE_FILE, "up", "-d"], { stdio: "inherit" });
  } catch (e) {
    console.error(c("red", `\n  ✗ docker compose up failed: ${e.message}`));
    process.exit(1);
  }
  console.log("");

  // Step 3: wait for the two services the apps actually need
  console.log(c("bold", "[3/4] Waiting for infra to be healthy…"));
  try {
    await Promise.all([
      waitForPort(PG_PORT, "Postgres", READY_TIMEOUT_MS),
      waitForPort(MINIO_PORT, "MinIO", READY_TIMEOUT_MS),
    ]);
  } catch (e) {
    console.error(c("red", `\n  ✗ ${e.message}`));
    console.error(c("yellow", "    Check `docker compose -f infrastructure/docker-compose.yml logs`"));
    process.exit(1);
  }
  console.log("");

  // Step 4: pnpm dev
  console.log(c("bold", "[4/4] Starting pnpm dev (apps + services)…"));
  console.log(c("dim", "  Press Ctrl+C to stop everything.\n"));
  const dev = spawn("pnpm", ["dev"], {
    stdio: "inherit",
    cwd: ROOT,
    shell: process.platform === "win32",
    env: process.env,
  });

  // Forward signals
  const onSignal = (sig) => {
    if (process.platform === "win32") {
      // Best-effort on Windows: tree-kill the pnpm process
      try {
        spawn("taskkill", ["/pid", String(dev.pid), "/T", "/F"], { stdio: "ignore" });
      } catch { /* ignore */ }
    } else {
      try { dev.kill(sig); } catch { /* ignore */ }
    }
  };
  process.on("SIGINT", () => onSignal("SIGINT"));
  process.on("SIGTERM", () => onSignal("SIGTERM"));

  dev.on("exit", (code, sig) => {
    if (sig) {
      console.log(c("dim", `\n  pnpm dev stopped (${sig})`));
      process.exit(0);
    }
    process.exit(code ?? 0);
  });
}

main().catch((e) => {
  console.error(c("red", `\n  ✗ stack:dev failed: ${e.message}`));
  process.exit(1);
});
