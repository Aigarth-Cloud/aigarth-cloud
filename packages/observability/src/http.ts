/**
 * Fastify HTTP request hooks — Phase 13.1.
 *
 * `registerHttpMetrics(app, serviceName)` wires:
 *   - A `service_info{service="..."}` gauge (constant 1 — for joins
 *     in PromQL).
 *   - An `onRequest` hook that stamps every request with a
 *     correlation ID (X-Request-Id header from the caller if
 *     present, else a generated one). The ID is forwarded on the
 *     reply.
 *   - An `onResponse` hook that records:
 *       - http_requests_total{service, method, route, status}  — counter
 *       - http_request_duration_seconds{service, method, route} — histogram
 *   - A `GET /metrics` endpoint that returns the registry in
 *     Prometheus text format.
 *
 * The "route" label uses Fastify's URL pattern (e.g. "/v1/anns/:id")
 * rather than the raw path, so cardinality stays bounded.
 */

import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { Counter, Histogram, Registry } from "./metrics.js";

export const CORRELATION_HEADER = "x-request-id";

export interface HttpMetricsOptions {
  /** Service name surfaced in the `service` label. */
  serviceName: string;
  /** Histogram buckets in seconds. Defaults are tuned for typical API workloads. */
  buckets?: number[];
  /** Skip recording the /metrics scrape itself (avoids a self-feedback loop). */
  skipRoute?: (path: string) => boolean;
}

const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

export interface HttpMetricsHandle {
  registry: Registry;
  requestCounter: Counter;
  durationHistogram: Histogram;
}

export function registerHttpMetrics(
  app: FastifyInstance,
  opts: HttpMetricsOptions,
): HttpMetricsHandle {
  const buckets = opts.buckets ?? DEFAULT_BUCKETS;
  const skipRoute = opts.skipRoute ?? (() => false);

  const registry = new Registry();
  registry.registerGauge({
    name: "service_info",
    help: "Constant 1 per service. Join with other metrics via the `service` label.",
    labelNames: ["service"],
  }).set({ service: opts.serviceName }, 1);

  const requestCounter = registry.registerCounter({
    name: "http_requests_total",
    help: "Total HTTP requests handled, labelled by service, method, route, and response status code.",
    labelNames: ["service", "method", "route", "status"],
  });

  const durationHistogram = registry.registerHistogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration in seconds, labelled by service, method, and route.",
    labelNames: ["service", "method", "route"],
    buckets,
  });

  // Correlation ID — read from inbound header or mint one.
  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    const incoming = req.headers[CORRELATION_HEADER];
    const id = typeof incoming === "string" && incoming.length > 0
      ? incoming
      : randomUUID();
    (req as unknown as { correlationId: string }).correlationId = id;
    reply.header(CORRELATION_HEADER, id);
  });

  // Count + time the request.
  app.addHook("onResponse", async (req: FastifyRequest, reply: FastifyReply) => {
    const url = req.routeOptions?.url ?? req.url;
    if (skipRoute(url)) return;
    const method = req.method;
    const status = String(reply.statusCode);
    const labels = { service: opts.serviceName, method, route: url, status };
    requestCounter.inc(labels);
    const durationSeconds = (reply.elapsedTime ?? 0) / 1000;
    durationHistogram.observe({ service: opts.serviceName, method, route: url }, durationSeconds);
    // Enrich the access log with the correlation ID + route + duration.
    const correlationId = (req as unknown as { correlationId?: string }).correlationId;
    req.log.info(
      {
        service: opts.serviceName,
        method,
        route: url,
        status: reply.statusCode,
        duration_ms: Math.round(durationSeconds * 1000),
        correlationId,
      },
      "http_request",
    );
  });

  // Expose /metrics. Public read (same posture as /healthz).
  app.get("/metrics", async (_req: FastifyRequest, reply: FastifyReply) => {
    const body = registry.render();
    reply.header("content-type", "text/plain; version=0.0.4; charset=utf-8");
    return reply.send(body);
  });

  return { registry, requestCounter, durationHistogram };
}
