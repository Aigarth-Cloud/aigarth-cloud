/**
 * Tests for the observability package.
 *
 * Strategy: each test gets a fresh registry. Covers the Prometheus
 * text format, the cardinality of labels, and the Fastify HTTP hook
 * (with a fastify instance built per test).
 */

import { describe, it, expect, beforeEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  registerHttpMetrics,
  type HttpMetricsHandle,
} from "../src/index.js";

describe("Counter", () => {
  it("renders as a Prometheus counter with a zero line when untouched", () => {
    const r = new Registry({ includeProcessMetrics: false });
    const c = r.registerCounter({ name: "test_total", help: "A test counter." });
    const out = c.render();
    expect(out).toContain("# HELP test_total A test counter.");
    expect(out).toContain("# TYPE test_total counter");
    expect(out).toContain("test_total 0");
  });

  it("inc() accumulates values per label set", () => {
    const r = new Registry({ includeProcessMetrics: false });
    const c = r.registerCounter({ name: "test_total", help: ".", labelNames: ["kind"] });
    c.inc({ kind: "a" });
    c.inc({ kind: "a" });
    c.inc({ kind: "b" });
    expect(c.get({ kind: "a" })).toBe(2n);
    expect(c.get({ kind: "b" })).toBe(1n);
    expect(c.get({ kind: "c" })).toBe(0n);
  });

  it("inc() without labels when labelNames is declared goes to the empty-label series", () => {
    const r = new Registry({ includeProcessMetrics: false });
    const c = r.registerCounter({ name: "test_total", help: ".", labelNames: ["kind"] });
    c.inc();
    c.inc();
    c.inc({ kind: "a" });
    expect(c.get()).toBe(2n);
    expect(c.get({ kind: "a" })).toBe(1n);
  });

  it("rendered output sorts label tuples for stable diffs", () => {
    const r = new Registry({ includeProcessMetrics: false });
    const c = r.registerCounter({ name: "hits_total", help: ".", labelNames: ["route"] });
    c.inc({ route: "/a" });
    c.inc({ route: "/b" });
    const lines = c.render().split("\n");
    expect(lines.indexOf("hits_total{route=\"/a\"} 1")).toBeLessThan(
      lines.indexOf("hits_total{route=\"/b\"} 1"),
    );
  });
});

describe("Gauge", () => {
  it("set/inc/dec work for a single series", () => {
    const g = new Gauge({ name: "g", help: "." });
    g.set(5);
    g.inc();      // +1 → 6
    g.inc({}, 4); // +4 → 10
    g.dec({}, 2); // -2 → 8
    expect(g.get()).toBe(8);
  });

  it("renders zero for an empty registry", () => {
    const g = new Gauge({ name: "queue_depth", help: "Backlog." });
    expect(g.render()).toContain("queue_depth 0");
  });
});

describe("Histogram", () => {
  it("buckets observations + sum + count", () => {
    const h = new Histogram({ name: "lat_seconds", help: ".", buckets: [0.1, 0.5, 1] });
    h.observe({}, 0.05);
    h.observe({}, 0.2);
    h.observe({}, 0.6);
    h.observe({}, 2.0);
    const out = h.render();
    expect(out).toContain("lat_seconds_bucket{le=\"0.1\"} 1");
    expect(out).toContain("lat_seconds_bucket{le=\"0.5\"} 2");
    expect(out).toContain("lat_seconds_bucket{le=\"1\"} 3");
    expect(out).toContain("lat_seconds_bucket{le=\"+Inf\"} 4");
    expect(out).toContain("lat_seconds_count 4");
    expect(out).toMatch(/lat_seconds_sum 2\.8\d*/);
  });

  it("renders zeros for an empty histogram", () => {
    const h = new Histogram({ name: "h", help: ".", buckets: [0.1, 1] });
    const out = h.render();
    expect(out).toContain("h_bucket{le=\"0.1\"} 0");
    expect(out).toContain("h_bucket{le=\"+Inf\"} 0");
    expect(out).toContain("h_count 0");
  });

  it("rejects non-finite observations", () => {
    const h = new Histogram({ name: "h2", help: ".", buckets: [1] });
    expect(() => h.observe({}, Number.NaN)).toThrow();
  });
});

describe("Registry", () => {
  it("renders all metrics in registration order", () => {
    const r = new Registry({ includeProcessMetrics: false });
    const c = r.registerCounter({ name: "a_total", help: "." });
    const g = r.registerGauge({ name: "b", help: "." });
    c.inc();
    g.set(42);
    const out = r.render();
    expect(out.indexOf("a_total")).toBeLessThan(out.indexOf("b"));
  });

  it("rejects duplicate metric names", () => {
    const r = new Registry({ includeProcessMetrics: false });
    r.registerCounter({ name: "dup_total", help: "." });
    expect(() => r.registerGauge({ name: "dup", help: "." })).not.toThrow();
    expect(() => r.registerCounter({ name: "dup_total", help: "." })).toThrow();
  });
});

describe("registerHttpMetrics (Fastify hook)", () => {
  let app: FastifyInstance;
  let handle: HttpMetricsHandle;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    handle = registerHttpMetrics(app, { serviceName: "test-svc" });
    app.get("/ping", async () => ({ ok: true }));
    app.get("/users/:id", async () => ({ id: 1 }));
    await app.ready();
  });

  it("emits a /metrics endpoint with the expected metrics", async () => {
    // Hit a couple of routes to populate the metrics.
    await app.inject({ method: "GET", url: "/ping" });
    await app.inject({ method: "GET", url: "/users/42" });
    await app.inject({ method: "GET", url: "/users/99" });
    const res = await app.inject({ method: "GET", url: "/metrics" });
    expect(res.statusCode).toBe(200);
    const body = res.body;
    expect(body).toContain("service_info{service=\"test-svc\"} 1");
    expect(body).toContain("http_requests_total{");
    expect(body).toContain('route="/ping"');
    expect(body).toContain('route="/users/:id"');
    // The route label is the pattern, not the raw path.
    expect(body).not.toContain('route="/users/42"');
    expect(body).toContain("http_request_duration_seconds_bucket{");
  });

  it("respects an inbound X-Request-Id header", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/ping",
      headers: { "x-request-id": "abc-123" },
    });
    expect(res.headers["x-request-id"]).toBe("abc-123");
  });

  it("mints a correlation ID when the inbound header is absent", async () => {
    const res = await app.inject({ method: "GET", url: "/ping" });
    expect(typeof res.headers["x-request-id"]).toBe("string");
    expect((res.headers["x-request-id"] as string).length).toBeGreaterThan(0);
  });

  it("counts requests across multiple calls", async () => {
    await app.inject({ method: "GET", url: "/ping" });
    await app.inject({ method: "GET", url: "/ping" });
    await app.inject({ method: "GET", url: "/ping" });
    const res = await app.inject({ method: "GET", url: "/metrics" });
    expect(res.body).toMatch(/http_requests_total\{[^}]*route="\/ping"[^}]*status="200"\} 3/);
  });
});
