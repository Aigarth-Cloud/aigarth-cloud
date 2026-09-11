/**
 * /v1/anns*, /v1/categories, /v1/licenses, /v1/me/*, /v1/organisms/*
 *
 * Transparent reverse proxy from the public gateway to the ANN
 * service (Phase 28+ third-party enablement). Before this module
 * existed, third-party callers could sign up via the public site
 * and obtain a real JWT, but every ANN route on `api.aigarth.cloud`
 * returned 404 because the gateway only registered its own
 * OpenAI-compatible surface (`/v1/models`, `/v1/keys`,
 * `/v1/chat/completions`, `/v1/embeddings`, `/v1/images`,
 * `/v1/usage`).
 *
 * Why this is safe:
 *   - The ANN service validates JWTs with the same JWT_SECRET as
 *     the gateway (Phase 18B/18C). We forward the caller's
 *     `Authorization: Bearer …` header verbatim. The ANN service
 *     rejects unauthenticated writes with 401 and enforces
 *     owner-only mutations inside its service layer.
 *   - Public read endpoints (`GET /v1/anns`, `GET
 *     /v1/categories`, `GET /v1/licenses`) are unauthenticated at
 *     the ANN service and are also unauthenticated at the
 *     gateway — the gateway adds no extra gate.
 *   - The proxy buffers the body and uses Node's built-in `fetch`,
 *     so no streaming edge cases. The gateway's 2 MB body limit
 *     applies to both directions (matched to the ANN service's
 *     own `bodyLimit: 2 * 1024 * 1024`).
 *
 * What is NOT proxied (must use the gateway's own surface):
 *   - /v1/chat/completions with `intent: "trinary"` — handled in
 *     `chat.ts`, frames the envelope as an OpenAI completion.
 *   - /v1/models, /v1/keys, /v1/usage — gateway-owned state.
 *   - /v1/embeddings, /v1/images/* — gateway-owned stubs.
 *
 * The list of proxied prefixes is intentionally narrow. Adding
 * `/v1/internal/*` here would leak the internal-token surface;
 * we don't want that.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { loadConfig } from "../config/index.js";

/**
 * Path prefixes that this proxy will forward to the ANN service.
 * Order matters only for human reading — the matching is
 * prefix-based and exact-match for the bare paths.
 */
const PROXIED_PREFIXES = [
  "/v1/anns",
  "/v1/categories",
  "/v1/licenses",
  "/v1/me",
  "/v1/organisms",
] as const;

/**
 * HTTP request headers we forward to the ANN service.
 *
 * Hop-by-hop headers (RFC 7230 §6.1) are stripped. `host` is
 * stripped because `fetch` will set the right one. Everything
 * else that the third party sent (authorization, cookie, content
 * type, idempotency-key, accept-*, user-agent, x-forwarded-*)
 * is forwarded verbatim.
 */
const FORWARDED_REQUEST_HEADER_ALLOWLIST = new Set(
  [
    "authorization",
    "cookie",
    "content-type",
    "accept",
    "accept-language",
    "accept-encoding",
    "user-agent",
    "idempotency-key",
    "x-request-id",
    "x-forwarded-for",
    "x-forwarded-host",
    "x-forwarded-proto",
    "x-real-ip",
    "x-correlation-id",
  ].map((s) => s.toLowerCase()),
);

/**
 * HTTP response headers we copy from the upstream back to the
 * caller. Stays tight on purpose — most of the proxy's value is
 * in the status code and the JSON body, and silently forwarding
 * arbitrary upstream headers can leak internal details
 * (`X-Powered-By`, `Server`, etc.).
 */
const FORWARDED_RESPONSE_HEADER_ALLOWLIST = new Set(
  [
    "content-type",
    "cache-control",
    "etag",
    "location",
    "retry-after",
    "x-ratelimit-limit",
    "x-ratelimit-remaining",
    "x-ratelimit-reset",
    "idempotent-replay",
    "vary",
  ].map((s) => s.toLowerCase()),
);

export function shouldProxy(url: string): boolean {
  // Strip the query string before matching. Fastify preserves
  // the query in `req.url`, so `/v1/anns?limit=10` would
  // otherwise miss the bare-path branch of the prefix check.
  const path = url.split("?", 1)[0] ?? url;
  return PROXIED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

export function pickRequestHeaders(req: FastifyRequest): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v !== "string") continue;
    if (FORWARDED_REQUEST_HEADER_ALLOWLIST.has(k.toLowerCase())) {
      out[k] = v;
    }
  }
  return out;
}

function pickResponseHeaders(upstream: Response, reply: FastifyReply): void {
  upstream.headers.forEach((value, key) => {
    if (FORWARDED_RESPONSE_HEADER_ALLOWLIST.has(key.toLowerCase())) {
      reply.header(key, value);
    }
  });
}

/**
 * Build the upstream URL. `req.url` already includes the path
 * and the query string (Fastify preserves both), so we can
 * concatenate without rewriting. The trailing slash on
 * `ANN_SERVICE_URL` is irrelevant — we just join.
 */
export function buildUpstreamUrl(req: FastifyRequest): string {
  const cfg = loadConfig();
  return `${cfg.ANN_SERVICE_URL}${req.url}`;
}

/**
 * Serialize the request body. Fastify has already parsed JSON
 * bodies into `req.body`. The ANN service expects the raw JSON
 * shape back, so we re-stringify. We never forward a `null`
 * body — the ANN service treats that as "no body" and Zod will
 * reject the request, which is the right behaviour for the
 * /v1/anns routes that take a body.
 */
export function buildUpstreamBody(req: FastifyRequest): { body: string | undefined; hasBody: boolean } {
  const method = req.method.toUpperCase();
  const takesBody = method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
  if (!takesBody) return { body: undefined, hasBody: false };
  if (req.body == null) return { body: undefined, hasBody: false };
  if (typeof req.body === "string") return { body: req.body, hasBody: true };
  // Fastify parsed JSON — re-stringify. The ANN service's
  // content-type parser will reject anything that's not JSON
  // here, so this is safe.
  return { body: JSON.stringify(req.body), hasBody: true };
}

async function proxyOnce(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!shouldProxy(req.url)) {
    return reply.code(404).send({
      error: { message: `Route ${req.method}:${req.url} not found` },
    });
  }

  const target = buildUpstreamUrl(req);
  const headers = pickRequestHeaders(req);
  const { body, hasBody } = buildUpstreamBody(req);

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? body : undefined,
    });
  } catch (err) {
    req.log.error(
      { err: err instanceof Error ? err.message : String(err), target, method: req.method },
      "ann proxy: upstream fetch failed",
    );
    return reply.code(502).send({
      error: {
        message: "ANN service unreachable",
        target,
        detail: err instanceof Error ? err.message : "unknown",
      },
    });
  }

  reply.code(upstream.status);
  pickResponseHeaders(upstream, reply);

  // Buffer the body. The ANN service caps at 2 MB; the gateway
  // does the same. Anything larger would have been rejected by
  // the gateway already.
  const text = await upstream.text();
  return reply.send(text);
}

export async function annProxyRoutes(app: FastifyInstance): Promise<void> {
  // Single catch-all route. Fastify's router matches the more
  // specific routes registered first (e.g. /v1/models,
  // /v1/chat/completions) before this wildcard, so this proxy
  // only sees the ANN paths the allowlist approves.
  app.route({
    method: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    url: "/v1/*",
    handler: proxyOnce,
  });
}
