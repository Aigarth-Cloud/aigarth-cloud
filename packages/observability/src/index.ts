/**
 * @aigarth/observability — public entry point.
 *
 *   import { registerHttpMetrics, Counter, Gauge, Histogram, Registry } from "@aigarth/observability";
 *
 * Phase 13.1. v1 scope: Prometheus-format /metrics on every
 * service + Fastify HTTP request hooks + correlation IDs. Tracing
 * (OpenTelemetry) and alert routing ship in a follow-up.
 */

export {
  Counter,
  Gauge,
  Histogram,
  Registry,
  type LabelValues,
  type MetricOptions,
  type HistogramOpts,
} from "./metrics.js";

export {
  registerHttpMetrics,
  CORRELATION_HEADER,
  type HttpMetricsOptions,
  type HttpMetricsHandle,
} from "./http.js";
