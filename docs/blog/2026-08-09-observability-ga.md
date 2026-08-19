---
title: "Observability GA: every service, every request, one Grafana"
date: 2026-08-09
author: Aigarth Cloud team
tags: [observability, prometheus, grafana, ops, launch]
---

# Observability GA: every service, every request, one Grafana

We just shipped Phase 13 — Observability v1. Every service in
the platform now exposes a Prometheus-format `/metrics`
endpoint, with HTTP request count + duration histograms, AigarthPool
business metrics, and Qearn watcher metrics.

## What you can see now

Open the starter dashboard at `infra/observability/aigarth-cloud-overview.json`:

- **Request rate per service** — `rate(http_requests_total[1m])`
- **p95 latency per service** — `histogram_quantile(0.95, ...)`
- **Error rate** — `rate(http_requests_total{status=~"5.."}[1m])`
- **Process memory (RSS)** — per-service RSS in bytes
- **AigarthPool total staked** — `aigarthpool_total_staked_qubic`
- **Qearn events observed** — `qubic_qearn_events_observed_total{kind}`

## What we deliberately didn't ship

The ROADMAP says "build alongside, mature over time" — v1 is
intentionally narrow. v2 ships:

- Distributed tracing (OpenTelemetry → Jaeger/Tempo)
- Alert routing (PagerDuty/Opsgenie)
- Synthetic checks for the public status page

## How we built it

A shared package `@aigarth/observability` with a hand-rolled
Prometheus text-format renderer. No `prom-client` dep, < 3 KB
per service. Bundle size matters when every service is
carrying its own metrics.

Plus a small per-service business-metrics module for the
service-specific numbers (AigarthPool position counts, Qearn
event counts, etc.) that subscribe to the service's domain
event feed.

## What this unblocks

- SLO monitoring: error rate + latency p95 are now first-class
  metrics, so we can write real SLOs against them.
- Capacity planning: RSS + heap metrics are the inputs to
  right-sizing the compute tier.
- Incident response: when something is on fire, the Grafana
  dashboard is the first place you look — not a tail of
  unstructured logs.

## Try it

```bash
# All 10 services expose /metrics
curl -s http://localhost:7006/metrics | head -30
curl -s http://localhost:7002/metrics | head -30

# Or load the starter dashboard
open infra/observability/aigarth-cloud-overview.json
```

The dashboard imports cleanly into a fresh Grafana instance.
Dashboards for the AigarthPool state + Qearn event volume land
in Phase 14 + Phase 15 v1.
