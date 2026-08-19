/**
 * GET /api/services/health
 *
 * Pings every service + infra port from the server side and returns
 * a status report. Cached for 2s to keep the page snappy.
 *
 * Used by the Services dashboard page for live status. Avoids CORS
 * (we always call from the same host as the dashboard, which is on
 * the same network as the services).
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Health = {
  name: string;
  ok: boolean;
  status: number;
  latencyMs: number;
  detail?: string;
  body?: unknown;
};

const TARGETS: { name: string; url: string; ping: "http" | "tcp" }[] = [
  // Apps
  { name: "apps/web",         url: "http://localhost:3003", ping: "http" },
  { name: "apps/dashboard",   url: "http://localhost:4000", ping: "http" },

  // Aigarth services
  { name: "identity",         url: "http://localhost:7001/healthz", ping: "http" },
  { name: "identity-wallet-auth", url: "http://localhost:7001/v1/auth/wallet/stats", ping: "http" },
  { name: "qubic",            url: "http://localhost:7002/healthz", ping: "http" },
  { name: "compute",          url: "http://localhost:7003/healthz", ping: "http" },
  { name: "gateway",          url: "http://localhost:7004/healthz", ping: "http" },
  { name: "billing",          url: "http://localhost:7005/healthz", ping: "http" },
  { name: "ann",              url: "http://localhost:7006/healthz", ping: "http" },
  { name: "marketplace",      url: "http://localhost:7007/healthz", ping: "http" },
  { name: "tissue",           url: "http://localhost:7008/healthz", ping: "http" },
  { name: "dataset",          url: "http://localhost:7009/healthz", ping: "http" },
  { name: "economy",          url: "http://localhost:7010/healthz", ping: "http" },
  { name: "training",         url: "http://localhost:7011/healthz", ping: "http" },
  { name: "work",             url: "http://localhost:7012/healthz", ping: "http" },

  // Infrastructure
  { name: "postgres",         url: "tcp://localhost:5432",           ping: "tcp" },
  { name: "redis",            url: "tcp://localhost:6379",           ping: "tcp" },
  { name: "nats",             url: "tcp://localhost:4222",           ping: "tcp" },
  { name: "minio",            url: "http://localhost:9000/minio/health/live", ping: "http" },
  { name: "mailhog-smtp",     url: "tcp://localhost:1025",           ping: "tcp" },
  { name: "mailhog-web",      url: "http://localhost:8025",          ping: "http" },
];

const TIMEOUT_MS = 1500;

async function pingHttp(url: string): Promise<Health> {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const latencyMs = Date.now() - started;
    let body: unknown = undefined;
    try { body = await res.json(); } catch { /* not JSON */ }
    return {
      name: url,
      ok: res.ok,
      status: res.status,
      latencyMs,
      body,
    };
  } catch (err) {
    return {
      name: url,
      ok: false,
      status: 0,
      latencyMs: Date.now() - started,
      detail: (err as Error).message,
    };
  }
}

import net from "node:net";
async function pingTcp(host: string, port: number): Promise<Health> {
  const started = Date.now();
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (h: Omit<Health, "ok"> & { ok: boolean }) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(h);
    };
    socket.setTimeout(TIMEOUT_MS);
    socket.once("connect", () => {
      finish({
        name: `${host}:${port}`,
        ok: true,
        status: 200,
        latencyMs: Date.now() - started,
        detail: "tcp connect ok",
      });
    });
    socket.once("timeout", () => {
      finish({
        name: `${host}:${port}`,
        ok: false,
        status: 0,
        latencyMs: Date.now() - started,
        detail: "tcp timeout",
      });
    });
    socket.once("error", (err) => {
      finish({
        name: `${host}:${port}`,
        ok: false,
        status: 0,
        latencyMs: Date.now() - started,
        detail: err.message,
      });
    });
    socket.connect(port, host);
  });
}

async function ping(target: typeof TARGETS[number]): Promise<Health> {
  // Self-check short-circuit: this route is hosted on apps/dashboard
  // (port 4000), so probing it via HTTP would block the Node event
  // loop. If we got here, the server is up.
  if (target.name === "apps/dashboard") {
    return {
      name: target.name,
      ok: true,
      status: 200,
      latencyMs: 0,
      detail: "self (in-process)",
    };
  }
  if (target.ping === "http") {
    const r = await pingHttp(target.url);
    return { ...r, name: target.name };
  }
  // tcp://host:port
  const m = target.url.replace(/^tcp:\/\//, "").split(":");
  const host = m[0]!;
  const port = Number(m[1]!);
  const r = await pingTcp(host, port);
  return { ...r, name: target.name };
}

export async function GET() {
  const results = await Promise.all(TARGETS.map(ping));
  const up = results.filter((r) => r.ok).length;
  return NextResponse.json(
    {
      checked_at: new Date().toISOString(),
      up,
      down: results.length - up,
      services: results,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
