/**
 * HTTP helpers — typed fetch wrappers.
 *
 *   - jsonRequest: typed JSON request with auth header
 *   - assertOk: throws on non-2xx with a structured error
 *   - isStackUp: pings /healthz on every service in parallel
 */

import { STACK, type StackEndpoints } from "./stack.js";

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Bearer token. Omit for public endpoints. */
  token?: string;
  /** Override the per-service baseURL (defaults to the service in `service`). */
  service?: keyof StackEndpoints;
  /** Extra headers. */
  headers?: Record<string, string>;
  /** Per-request timeout in ms. Default 10s. */
  timeoutMs?: number;
  /** If true, don't throw on non-2xx. Default false. */
  allowNonOk?: boolean;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    public readonly url: string,
  ) {
    super(`HTTP ${status} on ${url}: ${typeof body === "string" ? body : JSON.stringify(body).slice(0, 200)}`);
    this.name = "HttpError";
  }
}

export async function jsonRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const service = options.service ?? "tissue";
  const baseURL = STACK[service];
  const url = `${baseURL}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json",
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    };
    const res = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let body: unknown;
    try {
      body = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!res.ok && !options.allowNonOk) {
      throw new HttpError(res.status, body, url);
    }
    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

export interface StackHealth {
  identity: boolean;
  qubic: boolean;
  compute: boolean;
  gateway: boolean;
  billing: boolean;
  ann: boolean;
  marketplace: boolean;
  tissue: boolean;
  allUp: boolean;
}

export async function isStackUp(): Promise<StackHealth> {
  const services: (keyof StackEndpoints)[] = [
    "identity", "qubic", "compute", "gateway", "billing", "ann", "marketplace", "tissue",
  ];
  const checks = await Promise.allSettled(
    services.map(async (svc) => {
      try {
        const res = await fetch(`${STACK[svc]}/healthz`, { signal: AbortSignal.timeout(2_000) });
        return [svc, res.ok] as const;
      } catch {
        return [svc, false] as const;
      }
    }),
  );
  const out: Record<string, boolean> = {};
  for (const c of checks) {
    if (c.status === "fulfilled") {
      const [svc, ok] = c.value;
      out[svc] = ok;
    }
  }
  const allUp = services.every((s) => out[s] === true);
  return {
    identity: out["identity"] ?? false,
    qubic: out["qubic"] ?? false,
    compute: out["compute"] ?? false,
    gateway: out["gateway"] ?? false,
    billing: out["billing"] ?? false,
    ann: out["ann"] ?? false,
    marketplace: out["marketplace"] ?? false,
    tissue: out["tissue"] ?? false,
    allUp,
  };
}
