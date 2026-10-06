/**
 * GET /api/services/health
 *
 * Pings every service + infra port from the server side and returns
 * a status report. Cached for 2s to keep the page snappy.
 *
 * Used by the Services dashboard page and the new /architecture
 * ReactFlow topology. Avoids CORS (we always call from the same
 * host as the dashboard, which is on the same network as the services).
 *
 * Resolution strategy: each target lists one or more hostnames +
 * ports. The router tries them in order and reports the first that
 * responds. On local dev `localhost:<port>` works (ports are bound
 * on the host); on production the dashboard container reaches other
 * containers by their Docker Compose service name (e.g. `identity`
 * for the identity service). `apps/dashboard` always succeeds
 * in-process — see the self-check below.
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
  resolvedHost?: string;
  body?: unknown;
};

/**
 * One entry per service. Each entry lists hostnames to try in order.
 * First response wins; if all fail, the last error is reported with
 * `resolvedHost` left blank so the UI can show the host it actually
 * tried (useful when debugging compose DNS vs host port mapping).
 */
const TARGETS: {
  name: string;
  /**
   * Endpoints to probe. Each is `{ host, port, path, kind }`.
   * `kind` is `http` (fetch) or `tcp` (raw socket).
   */
  probes: Array<{ host: string; port: number; path?: string; kind: "http" | "tcp" }>;
}[] = [
  // Apps — only the dashboard itself can self-check; the others are
  // either this same Next.js process (dashboard) or a sibling
  // container (web). On local dev `localhost` works because pnpm dev
  // listens on the host. On production both are sibling containers on
  // the `aigarth` Docker network.
  {
    name: "apps/web",
    probes: [
      { host: "web", port: 3003, kind: "http" },
      { host: "localhost", port: 3003, kind: "http" },
    ],
  },
  {
    name: "apps/dashboard",
    probes: [],
  },

  // Aigarth services. Service names match the compose service IDs on
  // production. `localhost` is the local-dev fallback (turbo runs each
  // service on its own port on the host).
  {
    name: "identity",
    probes: [
      { host: "identity", port: 7001, path: "/healthz", kind: "http" },
      { host: "localhost", port: 7001, path: "/healthz", kind: "http" },
    ],
  },
  {
    name: "identity-wallet-auth",
    probes: [
      { host: "identity", port: 7001, path: "/v1/auth/wallet/stats", kind: "http" },
      { host: "localhost", port: 7001, path: "/v1/auth/wallet/stats", kind: "http" },
    ],
  },
  {
    name: "qubic",
    probes: [
      { host: "qubic", port: 7002, path: "/healthz", kind: "http" },
      { host: "localhost", port: 7002, path: "/healthz", kind: "http" },
    ],
  },
  {
    name: "compute",
    probes: [
      { host: "compute", port: 7003, path: "/healthz", kind: "http" },
      { host: "localhost", port: 7003, path: "/healthz", kind: "http" },
    ],
  },
  {
    name: "gateway",
    probes: [
      { host: "gateway", port: 7004, path: "/healthz", kind: "http" },
      { host: "localhost", port: 7004, path: "/healthz", kind: "http" },
    ],
  },
  {
    name: "billing",
    probes: [
      { host: "billing", port: 7005, path: "/healthz", kind: "http" },
      { host: "localhost", port: 7005, path: "/healthz", kind: "http" },
    ],
  },
  {
    name: "ann",
    probes: [
      { host: "ann", port: 7006, path: "/healthz", kind: "http" },
      { host: "localhost", port: 7006, path: "/healthz", kind: "http" },
    ],
  },
  {
    name: "marketplace",
    probes: [
      { host: "marketplace", port: 7007, path: "/healthz", kind: "http" },
      { host: "localhost", port: 7007, path: "/healthz", kind: "http" },
    ],
  },
  {
    name: "tissue",
    probes: [
      { host: "tissue", port: 7008, path: "/healthz", kind: "http" },
      { host: "localhost", port: 7008, path: "/healthz", kind: "http" },
    ],
  },
  {
    name: "dataset",
    probes: [
      { host: "dataset", port: 7009, path: "/healthz", kind: "http" },
      { host: "localhost", port: 7009, path: "/healthz", kind: "http" },
    ],
  },
  {
    name: "economy",
    probes: [
      { host: "economy", port: 7010, path: "/healthz", kind: "http" },
      { host: "localhost", port: 7010, path: "/healthz", kind: "http" },
    ],
  },
  {
    name: "training",
    probes: [
      { host: "training", port: 7011, path: "/healthz", kind: "http" },
      { host: "localhost", port: 7011, path: "/healthz", kind: "http" },
    ],
  },
  {
    name: "work",
    probes: [
      { host: "work", port: 7012, path: "/healthz", kind: "http" },
      { host: "localhost", port: 7012, path: "/healthz", kind: "http" },
    ],
  },

  // Infrastructure. Postgres / Redis / NATS / MailHog are TCP-only.
  // MinIO exposes a real HTTP liveness probe.
  {
    name: "postgres",
    probes: [
      { host: "postgres", port: 5432, kind: "tcp" },
      { host: "localhost", port: 5432, kind: "tcp" },
    ],
  },
  {
    name: "redis",
    probes: [
      { host: "redis", port: 6379, kind: "tcp" },
      { host: "localhost", port: 6379, kind: "tcp" },
    ],
  },
  {
    name: "nats",
    probes: [
      { host: "nats", port: 4222, kind: "tcp" },
      { host: "localhost", port: 4222, kind: "tcp" },
    ],
  },
  {
    name: "minio",
    probes: [
      { host: "minio", port: 9000, path: "/minio/health/live", kind: "http" },
      { host: "localhost", port: 9000, path: "/minio/health/live", kind: "http" },
    ],
  },
  {
    name: "mailhog-smtp",
    probes: [
      { host: "mailhog", port: 1025, kind: "tcp" },
      { host: "localhost", port: 1025, kind: "tcp" },
    ],
  },
  {
    name: "mailhog-web",
    probes: [
      { host: "mailhog", port: 8025, kind: "http" },
      { host: "localhost", port: 8025, kind: "http" },
    ],
  },
];

const TIMEOUT_MS = 1500;

async function pingHttp(host: string, port: number, path: string): Promise<Health> {
  const url = `http://${host}:${port}${path}`;
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
      resolvedHost: host,
      body,
    };
  } catch (err) {
    return {
      name: url,
      ok: false,
      status: 0,
      latencyMs: Date.now() - started,
      detail: (err as Error).message,
      resolvedHost: host,
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
        resolvedHost: host,
        detail: "tcp connect ok",
      });
    });
    socket.once("timeout", () => {
      finish({
        name: `${host}:${port}`,
        ok: false,
        status: 0,
        latencyMs: Date.now() - started,
        resolvedHost: host,
        detail: "tcp timeout",
      });
    });
    socket.once("error", (err) => {
      finish({
        name: `${host}:${port}`,
        ok: false,
        status: 0,
        latencyMs: Date.now() - started,
        resolvedHost: host,
        detail: err.message,
      });
    });
    socket.connect(port, host);
  });
}

async function probe(p: { host: string; port: number; path?: string; kind: "http" | "tcp" }): Promise<Health> {
  if (p.kind === "http") return pingHttp(p.host, p.port, p.path ?? "/");
  return pingTcp(p.host, p.port);
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

  // Try each probe in order. First success wins. If all fail, return
  // the last failure (which is usually the most informative: it shows
  // the host we ultimately tried).
  let last: Health | null = null;
  for (const p of target.probes) {
    const r = await probe(p);
    if (r.ok) {
      return { ...r, name: target.name };
    }
    last = r;
  }
  return { ...(last as Health), name: target.name };
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