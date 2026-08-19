# Phase 13 — Observability v1 — Delivery

**Phase:** 13
**Status:** done (100%)
**Story points:** 3 / 3 (v1 scope)
**Active build time:** ~2h
**Velocity:** 1.5 SP/h

## TL;DR

You can't operate what you can't see. v1 ships the wire format,
the most useful counters, the HTTP request hooks, the correlation
IDs, the AigarthPool + Qearn business metrics, and a starter
Grafana dashboard. Distributed tracing (OpenTelemetry) and alert
routing (PagerDuty / Opsgenie) are deferred to v2 — the ROADMAP
says "build alongside, mature over time."

## What's shipped

### Shared package — `packages/observability`

A tiny hand-rolled Prometheus text-format renderer + a
`registerHttpMetrics(app, serviceName)` Fastify hook helper.
**No `prom-client` dep** — keeps the bundle small (< 3 KB per
service) and the surface minimal. Source ~300 LOC, MIT-licensed
internally.

Exports:

```ts
import { registerHttpMetrics, Counter, Gauge, Histogram, Registry } from "@aigarth/observability";
```

Public surface:

- `registerHttpMetrics(app, opts)` — wires:
  - `service_info{service="..."}` gauge (constant 1, for joins)
  - `onRequest` hook — stamps every request with a correlation
    ID (X-Request-Id header from the caller if present, else a
    generated UUID), echoed on the reply
  - `onResponse` hook — `http_requests_total{service, method,
    route, status}` counter + `http_request_duration_seconds{
    service, method, route}` histogram (default buckets
    `[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]`)
  - `GET /metrics` endpoint returning text/plain Prometheus format
  - Access log enriched with `{service, route, status,
    duration_ms, correlationId}`
- `Counter`, `Gauge`, `Histogram`, `Registry` primitives for
  callers that need their own business metrics on the same
  registry

### Wired into all 10 services

`/metrics` is now live on every service, no auth (same posture as
`/healthz`):

| Service | Port | Path | Hooks |
|---|---|---|---|
| identity | 7001 | `/metrics` | `http_requests_total`, `http_request_duration_seconds`, `service_info` |
| ann | 7006 | `/metrics` | + AigarthPool business metrics |
| qubic | 7002 | `/metrics` | + Qearn business metrics |
| economy | 7010 | `/metrics` | `http_requests_total`, etc. |
| billing | 7005 | `/metrics` | same |
| marketplace | 7007 | `/metrics` | same |
| tissue | 7008 | `/metrics` | same |
| dataset | 7009 | `/metrics` | same |
| compute | 7003 | `/metrics` | same |
| gateway | 7004 | `/metrics` | same |

Each service registers `registerHttpMetrics(app, { serviceName:
"<name>" })` immediately after JWT setup, before any routes, so
the hooks fire on every request.

### AigarthPool business metrics — services/ann

`services/ann/src/lib/aigarthpool_metrics.ts` registers a handful
of gauges + counters on the ann service's `/metrics` endpoint.
Subscribes to the AigarthPool's event feed at server startup;
updates on every event.

- `aigarthpool_total_staked_qubic` (gauge) — sum of active
  position principals, in Qu-bit
- `aigarthpool_total_positions` (gauge) — count of active
  positions
- `aigarthpool_paused` (gauge, 0 or 1) — M4 circuit breaker state
- `aigarthpool_yield_paid_total_qubic` (counter) — cumulative
  Qearn yield distributed
- `aigarthpool_events_total{kind}` (counter) — count of pool
  events by kind (PositionOpened / PositionClosed / RewardsClaimed
  / SplitsChanged / PoolPaused / PoolUnpaused / GovernanceInitialized
  / TreasuryTransfer* / SignerChange*)

Initial values are sourced from `pool.getTotals()` + `pool.isPaused()`
on startup, then kept in sync via the subscribe hook.

**Precision note:** the Prometheus exporter stores values as JS
`number`. Qu-bit amounts up to ~9e15 (Number.MAX_SAFE_INTEGER)
are represented exactly. The AigarthPool's per-tx cap is 1M QUBIC
(1e12 Qu-bit) and the per-user-per-epoch cap is 5M QUBIC (5e12
Qu-bit), so totals stay well within the safe range for any
realistic pool size. The help text documents the limit.

### Qearn business metrics — services/qubic

`services/qubic/src/lib/qearn_metrics.ts` registers:

- `qubic_qearn_events_observed_total{kind}` (gauge) — count of
  Qearn events observed by the watcher, grouped by kind (`lock`
  / `unlock` / `yield` / `other`)

The Qearn watcher is a separate process (a dedicated
`pnpm --filter @aigarth/qubic worker:qearn-watcher` script that
runs `services/qubic/src/workers/qearn-watcher.ts`). For v1 the
qubic service reads the `qubic_qearn_events` mirror table on each
`/metrics` scrape to keep its gauge fresh. The hook chain is
`/metrics` → `onRequest` → `qearnHandle.refresh()` → SELECT
COUNT(*) GROUP BY kind → gauge.set. Failures are silent
(`log.debug` only) so the metrics path never breaks the request
path.

A future v2 can use NATS to push live updates; v1 stays
consistent because the watcher commits every event to the DB
before the next /metrics scrape.

### Grafana dashboard JSON

`infra/observability/aigarth-cloud-overview.json` — a starter
Grafana dashboard for the platform:

- 12×8 grid
- Dark theme
- 10s refresh
- 6 panels:
  1. **Request rate** — `rate(http_requests_total[1m])` per service
  2. **p95 latency** — `histogram_quantile(0.95, ...)` per service
  3. **Error rate** — `rate(http_requests_total{status=~"5.."}[1m])`
  4. **Process memory (RSS)** — per service
  5. **AigarthPool totalStaked** — `aigarthpool_total_staked_qubic`
  6. **Qearn events observed** — `qubic_qearn_events_observed_total`

### Tests

`packages/observability/tests/metrics.test.ts` — **15/15 vitest
cases** cover Counter / Gauge / Histogram / Registry / render /
text format / skipRoute / duplicate name / HttpMetrics across 3
routes / correlation-ID propagation.

## What v1 does NOT ship (deferred to v2)

The ROADMAP says "build alongside, mature over time" — v1 is
intentionally narrow. v2 is the operational half:

- **Distributed tracing** — OpenTelemetry SDK + exporter to
  Jaeger or Tempo. Span the inbound HTTP request → service-to-
  service call → DB query. Useful for the slower paths
  (e.g. training job scheduling, AigarthPool cross-service
  settlement flow).
- **Alert routing** — PagerDuty / Opsgenie integration. Severity
  tiers (P1 / P2 / P3). Alert rules live in the Grafana
  dashboard or in a sibling `infra/alerts/*.yaml`.
- **Public status page** — the page exists at `/status`; the
  data pipeline (synthetic checks + per-service health) is v2.
- **Incident management** — postmortem template + timeline
  tooling.

## Files

### Created
- `packages/observability/package.json`
- `packages/observability/tsconfig.json`
- `packages/observability/src/metrics.ts`
- `packages/observability/src/http.ts`
- `packages/observability/src/index.ts`
- `packages/observability/tests/metrics.test.ts`
- `services/ann/src/lib/aigarthpool_metrics.ts`
- `services/qubic/src/lib/qearn_metrics.ts`
- `infra/observability/aigarth-cloud-overview.json`
- `apps/dashboard/scripts/register-phase-13.ts`
- `apps/dashboard/scripts/closeout-13.ts`
- `docs/deliveries/phase-13-delivery.md` (this file)

### Modified
- `services/identity/package.json` — added `@aigarth/observability`
- `services/ann/package.json` — added `@aigarth/observability`
- `services/qubic/package.json` — added `@aigarth/observability`
- `services/economy/package.json` — added `@aigarth/observability`
- `services/billing/package.json` — added `@aigarth/observability`
- `services/marketplace/package.json` — added `@aigarth/observability`
- `services/tissue/package.json` — added `@aigarth/observability`
- `services/dataset/package.json` — added `@aigarth/observability`
- `services/compute/package.json` — added `@aigarth/observability`
- `services/gateway/package.json` — added `@aigarth/observability`
- `services/identity/src/server.ts` — registerHttpMetrics
- `services/ann/src/server.ts` — registerHttpMetrics + registerAigarthPoolMetrics
- `services/qubic/src/server.ts` — registerHttpMetrics + registerQearnMetrics + onRequest hook to refresh Qearn gauge on each /metrics scrape
- `services/economy/src/server.ts` — registerHttpMetrics
- `services/billing/src/server.ts` — registerHttpMetrics
- `services/marketplace/src/server.ts` — registerHttpMetrics
- `services/tissue/src/server.ts` — registerHttpMetrics
- `services/dataset/src/server.ts` — registerHttpMetrics
- `services/compute/src/server.ts` — registerHttpMetrics
- `services/gateway/src/server.ts` — registerHttpMetrics

## Test counts at closeout
- **15/15** observability package
- **22/22** monorepo typecheck
