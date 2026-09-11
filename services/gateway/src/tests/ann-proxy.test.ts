/**
 * Unit tests for the gateway → ANN service proxy.
 *
 * The proxy is the public entry point that lets a third party
 * create, register, version, publish, and call ANNs through
 * api.aigarth.cloud. Before this module existed, every
 * /v1/anns* route on the public gateway returned 404 and a
 * third party could sign up but not actually do anything.
 *
 * Focus areas:
 *   - shouldProxy() correctly classifies the allowlist
 *   - pickRequestHeaders() forwards what we want, drops what
 *     we don't (no host leak, no internal headers)
 *   - buildUpstreamBody() never emits a body for GET/HEAD,
 *     re-stringifies JSON bodies, and skips null bodies
 *   - buildUpstreamUrl() preserves the query string
 *
 * The end-to-end proxy itself (proxyOnce → fetch → reply.send)
 * is covered by the docker-based smoke tests in CI. Stubbing
 * `fetch` here would only test our own code against our own
 * stubs, which catches typos but not the actual behaviour.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  shouldProxy,
  pickRequestHeaders,
  buildUpstreamBody,
  buildUpstreamUrl,
} from "../routes/ann-proxy.js";

beforeAll(() => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "postgres://aigarth:aigarth_dev@localhost:5432/aigarth";
  process.env.JWT_SECRET = "test-secret-for-routes-only-do-not-use-elsewhere-please";
  // ANN_SERVICE_URL falls back to http://localhost:7006 if unset
  process.env.ANN_SERVICE_URL = "http://ann.test.local:7006";
});

describe("ann-proxy — shouldProxy", () => {
  it("forwards the canonical ANN paths", () => {
    for (const url of [
      "/v1/anns",
      "/v1/anns?limit=10&visibility=public",
      "/v1/anns/btc-direction-predictor",
      "/v1/anns/kismet/versions",
      "/v1/anns/kismet/publish",
      "/v1/anns/kismet/decide",
      "/v1/anns/kismet/execute",
      "/v1/anns/kismet/rate",
      "/v1/anns/kismet/benchmark",
      "/v1/anns/kismet/stats",
      "/v1/anns/kismet/retrain",
    ]) {
      expect(shouldProxy(url), url).toBe(true);
    }
  });

  it("forwards the supporting catalog + me + organism paths", () => {
    for (const url of [
      "/v1/categories",
      "/v1/licenses",
      "/v1/licenses/open",
      "/v1/me",
      "/v1/me/anns",
      "/v1/me/licenses",
      "/v1/me/deployments",
      "/v1/organisms",
      "/v1/organisms/kismet-001",
      "/v1/organisms/kismet-001/lineage",
      "/v1/organisms/kismet-001/fitness",
      "/v1/organisms/kismet-001/memory",
    ]) {
      expect(shouldProxy(url), url).toBe(true);
    }
  });

  it("does NOT forward gateway-owned paths", () => {
    for (const url of [
      "/v1/models",
      "/v1/keys",
      "/v1/chat/completions",
      "/v1/embeddings",
      "/v1/images/generations",
      "/v1/usage",
      "/v1/usage/recent",
      "/v1/internal/anns/retrain-scan", // internal-token surface — never proxied
      "/healthz",
      "/readyz",
    ]) {
      expect(shouldProxy(url), url).toBe(false);
    }
  });

  it("does NOT forward arbitrary /v1/* paths", () => {
    // A new /v1/foo that nobody told the proxy about must not
    // be silently proxied. This is the safe default.
    for (const url of [
      "/v1/foo",
      "/v1/anything",
      "/v1/admin/users",
    ]) {
      expect(shouldProxy(url), url).toBe(false);
    }
  });
});

describe("ann-proxy — pickRequestHeaders", () => {
  it("forwards authorization, cookie, content-type, idempotency-key", () => {
    const headers = pickRequestHeaders({
      headers: {
        authorization: "Bearer eyJ.fake.token",
        cookie: "aigarth_session=...; theme=dark",
        "content-type": "application/json",
        "idempotency-key": "idem-2026-09-11-001",
        "user-agent": "mavis/1.0",
        accept: "application/json",
      },
    } as unknown as Parameters<typeof pickRequestHeaders>[0]);
    const lower: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
    expect(lower.authorization).toBe("Bearer eyJ.fake.token");
    expect(lower.cookie).toBe("aigarth_session=...; theme=dark");
    expect(lower["content-type"]).toBe("application/json");
    expect(lower["idempotency-key"]).toBe("idem-2026-09-11-001");
    expect(lower["user-agent"]).toBe("mavis/1.0");
    expect(lower.accept).toBe("application/json");
  });

  it("drops hop-by-hop and host headers", () => {
    const headers = pickRequestHeaders({
      headers: {
        // forwarded
        authorization: "Bearer x",
        "content-type": "application/json",
        // NOT forwarded
        host: "api.aigarth.cloud",
        connection: "keep-alive",
        "keep-alive": "timeout=5",
        "transfer-encoding": "chunked",
        "x-powered-by": "Aigarth/1.0",
        "x-internal-trace-id": "should-not-leak",
      },
    } as unknown as Parameters<typeof pickRequestHeaders>[0]);
    const lower: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
    expect(lower.authorization).toBe("Bearer x");
    expect(lower["content-type"]).toBe("application/json");
    expect(lower.host).toBeUndefined();
    expect(lower.connection).toBeUndefined();
    expect(lower["keep-alive"]).toBeUndefined();
    expect(lower["transfer-encoding"]).toBeUndefined();
    expect(lower["x-powered-by"]).toBeUndefined();
    expect(lower["x-internal-trace-id"]).toBeUndefined();
  });
});

describe("ann-proxy — buildUpstreamBody", () => {
  function req(method: string, body: unknown) {
    return { method, body } as unknown as Parameters<typeof buildUpstreamBody>[0];
  }

  it("emits no body for GET/HEAD", () => {
    expect(buildUpstreamBody(req("GET", { whatever: 1 })).hasBody).toBe(false);
    expect(buildUpstreamBody(req("HEAD", { whatever: 1 })).hasBody).toBe(false);
  });

  it("emits no body for a missing/null body", () => {
    expect(buildUpstreamBody(req("POST", undefined)).hasBody).toBe(false);
    expect(buildUpstreamBody(req("POST", null)).hasBody).toBe(false);
  });

  it("re-stringifies a JSON object body", () => {
    const out = buildUpstreamBody(
      req("POST", { name: "kismet", tagline: "Cross-domain correspondence finder" }),
    );
    expect(out.hasBody).toBe(true);
    expect(typeof out.body).toBe("string");
    expect(JSON.parse(out.body as string).name).toBe("kismet");
  });

  it("passes a pre-stringified body through", () => {
    const raw = '{"name":"kismet"}';
    const out = buildUpstreamBody(req("POST", raw));
    expect(out.body).toBe(raw);
  });

  it("emits a body for PUT/PATCH/DELETE", () => {
    for (const m of ["PUT", "PATCH", "DELETE"]) {
      expect(buildUpstreamBody(req(m, { a: 1 })).hasBody, m).toBe(true);
    }
  });
});

describe("ann-proxy — buildUpstreamUrl", () => {
  it("preserves the path and query string", () => {
    const url = buildUpstreamUrl({
      url: "/v1/anns?limit=10&visibility=public&status=published",
    } as unknown as Parameters<typeof buildUpstreamUrl>[0]);
    expect(url).toBe(
      "http://ann.test.local:7006/v1/anns?limit=10&visibility=public&status=published",
    );
  });

  it("preserves deep paths", () => {
    const url = buildUpstreamUrl({
      url: "/v1/anns/kismet/decisions/dec_abc/outcome",
    } as unknown as Parameters<typeof buildUpstreamUrl>[0]);
    expect(url).toBe(
      "http://ann.test.local:7006/v1/anns/kismet/decisions/dec_abc/outcome",
    );
  });
});
