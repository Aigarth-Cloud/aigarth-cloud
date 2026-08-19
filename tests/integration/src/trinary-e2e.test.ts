/**
 * End-to-end integration test for the Trinary Intelligence Layer.
 *
 *   Exercises the full stack:
 *     1. Stack health check (skip if any service is down)
 *     2. Sign up a fresh user
 *     3. Login to get a JWT
 *     4. Create 3 ANNs (sales / risk / finance) with trinary protocol
 *     5. Add a published version to each
 *     6. Create a tissue with the 3 members (veto_aware policy)
 *     7. Call /decide on the tissue
 *     8. Verify the signed envelope + contributors
 *     9. Verify the billing usage event was recorded
 *    10. Verify the decision log was persisted
 *    11. Cleanup (delete the test ANNs and tissue)
 *
 *   The test uses unique slugs per run (`itest-<timestamp>-...`) so
 *   it can be re-run without conflict. If anything throws mid-flow,
 *   the leftover rows are still cleaned up via a best-effort teardown.
 *
 *   Pre-conditions:
 *     - All 8 services listening on their dev ports (7001-7008)
 *     - Postgres reachable at DATABASE_URL
 *     - The 18A-18F migrations applied to every service
 *     - The demo tissue may or may not exist; the test creates its
 *       own data and doesn't depend on the seed
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { isStackUp, jsonRequest, type StackHealth } from "./http.js";
import { DATABASE_URL, STACK } from "./stack.js";

/* -------------------------------------------------------------------------- */
/*  Test fixtures                                                              */
/* -------------------------------------------------------------------------- */

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const TEST_PREFIX = `itest-${RUN_ID}`;
const TEST_EMAIL = `${TEST_PREFIX}@aigarth.cloud`;
const TEST_PASSWORD = "Integration-Test-Password-1234!";

// Slugify mirrors the ANN service's slugify (lowercase, non-alnum
// -> "-", trim leading/trailing "-"). The ANN service auto-derives
// the slug from the name, so we compute it the same way here.
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// Three ANNs, named to match the canonical trinary demo. Names are
// picked so their slugified form is predictable and unique-per-run.
const ANN_NAMES = {
  sales:   `${TEST_PREFIX} Ann Sales V1`,
  risk:    `${TEST_PREFIX} Ann Risk V1`,
  finance: `${TEST_PREFIX} Ann Finance V1`,
} as const;
const ANN_SLUGS = {
  sales:   slugify(ANN_NAMES.sales),
  risk:    slugify(ANN_NAMES.risk),
  finance: slugify(ANN_NAMES.finance),
} as const;
const TISSUE_NAME = `${TEST_PREFIX} Executive Tissue`;
const TISSUE_SLUG = slugify(TISSUE_NAME);

interface AnnVersionResponse {
  id: string;
  version: string;
  is_latest: boolean;
}
interface AnnResponse {
  id: string;
  slug: string;
  name: string;
  status: string;
  decision_protocol?: string;
  current_version_id?: string | null;
}
interface TissueResponse {
  id: string;
  slug: string;
  name: string;
  status: string;
  total_decisions: number;
}
interface TissueDecisionResponse {
  decision_id: string;
  envelope: {
    ann_id: string;
    ann_version: string;
    state: -1 | 0 | 1;
    confidence: number;
    authority: number;
    reasoning: string;
    recommended_action: string;
    reversibility: string;
    time_horizon: string;
    signature: string;
  };
  contributors: Array<{
    ann_slug: string;
    state: -1 | 0 | 1;
    confidence: number;
    authority: number;
    role: string;
  }>;
  ignored: Array<{ ann_slug: string; reason: string }>;
  tissue: { id: string; slug: string; name: string; version: string };
  total_latency_ms: number;
  policy: string;
}

/* -------------------------------------------------------------------------- */
/*  Stack probe (fails the suite loudly if any service is down)                */
/* -------------------------------------------------------------------------- */

let health: StackHealth | null = null;
let token: string | null = null;
let userId: string | null = null;
let annIds: Record<keyof typeof ANN_SLUGS, string> | null = null;
let tissueId: string | null = null;
let tissueSlug: string | null = null;
let decisionId: string | null = null;

beforeAll(async () => {
  health = await isStackUp();
  if (!health.allUp) {
    console.warn("[trinary-e2e] stack not fully up:", health);
  }
}, 60_000);

afterAll(async () => {
  // Best-effort cleanup. We use SQL because the API doesn't have a
  // "delete my test data" endpoint, and the services have foreign
  // keys that make raw DELETE order-sensitive.
  const client = new pg.Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    await client.query(
      "DELETE FROM billing_tissue_usage_events WHERE request_id LIKE $1",
      [`${TEST_PREFIX}-%`],
    );
    await client.query(
      "DELETE FROM tissue_decisions WHERE request_id LIKE $1",
      [`${TEST_PREFIX}-%`],
    );
    await client.query("DELETE FROM tissue_members WHERE tissue_id IN (SELECT id FROM tissues WHERE slug = $1)", [TISSUE_SLUG]);
    await client.query("DELETE FROM tissues WHERE slug = $1", [TISSUE_SLUG]);
    await client.query("DELETE FROM ann_decisions WHERE request_id LIKE $1", [`${TEST_PREFIX}-%`]);
    await client.query("DELETE FROM ann_versions WHERE ann_id IN (SELECT id FROM anns WHERE slug = ANY($1))", [Object.values(ANN_SLUGS)]);
    await client.query("DELETE FROM ann_licenses_granted WHERE ann_id IN (SELECT id FROM anns WHERE slug = ANY($1))", [Object.values(ANN_SLUGS)]);
    await client.query("DELETE FROM ann_ratings WHERE ann_id IN (SELECT id FROM anns WHERE slug = ANY($1))", [Object.values(ANN_SLUGS)]);
    await client.query("DELETE FROM anns WHERE slug = ANY($1)", [Object.values(ANN_SLUGS)]);
  } catch (err) {
    console.warn("[trinary-e2e] cleanup failed:", err instanceof Error ? err.message : err);
  } finally {
    await client.end();
  }
}, 30_000);

const requireStack = (): StackHealth => {
  if (!health) throw new Error("Stack health check did not run");
  if (!health.allUp) {
    throw new Error(
      `Stack not fully up: ${Object.entries(health).filter(([k, v]) => k !== "allUp" && !v).map(([k]) => k).join(", ")}. ` +
      `Run \`pnpm dev\` (or \`pnpm stack:up\`) before \`pnpm test:integration\`.`,
    );
  }
  return health;
};

/* -------------------------------------------------------------------------- */
/*  Test suite                                                                */
/* -------------------------------------------------------------------------- */

describe("trinary intelligence — end-to-end", () => {
  it("has all 8 services healthy", () => {
    const h = requireStack();
    expect(h.allUp).toBe(true);
    expect(h.identity).toBe(true);
    expect(h.tissue).toBe(true);
    expect(h.ann).toBe(true);
  });

  it("signs up a fresh user", async () => {
    const r = await jsonRequest<{ id: string }>("/v1/auth/signup", {
      service: "identity",
      method: "POST",
      body: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        name: `Integration Test ${RUN_ID}`,
      },
    });
    expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
    userId = r.id;
  });

  it("logs in and receives a JWT", async () => {
    const r = await jsonRequest<{ access_token: string; user: { id: string } }>(
      "/v1/auth/login",
      { service: "identity", method: "POST", body: { email: TEST_EMAIL, password: TEST_PASSWORD } },
    );
    expect(r.access_token.length).toBeGreaterThan(20);
    expect(r.user.id).toBe(userId);
    token = r.access_token;
  });

  it("creates 3 ANNs (sales, risk, finance) with trinary protocol", async () => {
    expect(token).toBeTruthy();
    const ids = {} as Record<keyof typeof ANN_SLUGS, string>;
    for (const [key, name] of Object.entries(ANN_NAMES) as Array<[keyof typeof ANN_NAMES, string]>) {
      const r = await jsonRequest<AnnResponse>("/v1/anns", {
        service: "ann",
        method: "POST",
        token: token!,
        body: {
          name,
          tagline: `Trinary integration test ANN (${key})`,
          description: `Auto-created by the trinary-e2e integration test (run ${RUN_ID}).`,
          category: "language",
          tags: ["trinary", "integration-test"],
          license: "open",
          visibility: "public",
          // Phase 18B fields, sent via the API (no SQL workaround needed).
          decisionProtocol: "trinary",
          trinaryPromptTemplate: `You are ${key} advisor. Reply with a single trinary envelope.`,
          authorityWeight: 0.5,
        },
      });
      expect(r.slug).toBe(ANN_SLUGS[key]);
      expect(r.status).toBe("draft");
      expect(r.decision_protocol).toBe("trinary");
      ids[key] = r.id;
    }
    annIds = ids;
  });

  it("adds a published version to each ANN", async () => {
    expect(annIds).toBeTruthy();
    expect(token).toBeTruthy();
    for (const [key, id] of Object.entries(annIds!)) {
      const r = await jsonRequest<AnnVersionResponse>(`/v1/anns/${id}/versions`, {
        service: "ann",
        method: "POST",
        token: token!,
        body: {
          version: "1.0.0",
          changelog: `Integration test version for ${key} (run ${RUN_ID}).`,
          artifactHash: "0".repeat(64),
          hyperparameters: {},
          metrics: {},
          setAsLatest: true,
        },
      });
      expect(r.version).toBe("1.0.0");
      expect(r.is_latest).toBe(true);
    }
  });

  it("publishes each ANN", async () => {
    expect(annIds).toBeTruthy();
    expect(token).toBeTruthy();
    for (const [key, id] of Object.entries(annIds!)) {
      const r = await jsonRequest<AnnResponse>(`/v1/anns/${id}/publish`, {
        service: "ann",
        method: "POST",
        token: token!,
        body: {},
      });
      expect(r.status).toBe("published");
    }
  });

  it("creates a veto_aware tissue with 3 members", async () => {
    expect(annIds).toBeTruthy();
    expect(token).toBeTruthy();
    const r = await jsonRequest<TissueResponse>("/v1/tissues", {
      service: "tissue",
      method: "POST",
      token: token!,
      body: {
        name: TISSUE_NAME,
        tagline: "Integration test veto_aware tissue",
        description: `Auto-created by trinary-e2e (run ${RUN_ID}).`,
        visibility: "private",
        access: "open",
        policy: { kind: "veto_aware", threshold: 0.4 },
      },
    });
    expect(r.slug).toBe(TISSUE_SLUG);
    expect(r.status).toBe("draft");
    tissueId = r.id;
    tissueSlug = r.slug;

    // Add members with roles + authority weights
    const memberConfigs: Array<{ key: keyof typeof ANN_SLUGS; role: "voting" | "veto"; weight: number }> = [
      { key: "sales",   role: "voting", weight: 0.4 },
      { key: "risk",    role: "veto",   weight: 0.3 },
      { key: "finance", role: "voting", weight: 0.3 },
    ];
    for (const m of memberConfigs) {
      const annSlug = ANN_SLUGS[m.key];
      const annId = annIds![m.key];
      const member = await jsonRequest<{ id: string; ann_slug: string; role: string }>(
        `/v1/tissues/${tissueId}/members`,
        {
          service: "tissue",
          method: "POST",
          token: token!,
          body: { ann_slug: annSlug, ann_id: annId, role: m.role, authority_weight: m.weight },
        },
      );
      expect(member.ann_slug).toBe(annSlug);
      expect(member.role).toBe(m.role);
    }

    // Publish
    const pub = await jsonRequest<TissueResponse>(`/v1/tissues/${tissueId}/publish`, {
      service: "tissue",
      method: "POST",
      token: token!,
      body: {},
    });
    expect(pub.status).toBe("active");
  });

  it("calls /decide and returns a signed trinary envelope", async () => {
    expect(tissueSlug).toBeTruthy();
    expect(token).toBeTruthy();
    const requestId = `${TEST_PREFIX}-decide-1`;
    const r = await jsonRequest<TissueDecisionResponse>(
      `/v1/tissues/${tissueSlug}/decide`,
      {
        service: "tissue",
        method: "POST",
        token: token!,
        body: {
          request_id: requestId,
          input: {
            deal_size_qubic: 5_000_000,
            counterparty: "acme",
            region: "tt",
            run_id: RUN_ID,
          },
          reversibility: "soft",
          time_horizon: "session",
        },
      },
    );
    // Envelope
    expect(r.envelope.ann_id).toBe(tissueId);
    expect(r.envelope.ann_version).toBe("1.0.0");
    expect([-1, 0, 1]).toContain(r.envelope.state);
    expect(r.envelope.confidence).toBeGreaterThan(0);
    expect(r.envelope.confidence).toBeLessThanOrEqual(1);
    expect(r.envelope.authority).toBeGreaterThan(0);
    expect(r.envelope.signature).toMatch(/^[a-f0-9]{32,}$/);
    expect(r.envelope.recommended_action).toMatch(/^(proceed|block|continue_observing)$/);
    expect(r.envelope.reasoning).toContain("veto_aware");
    // Contributors
    expect(r.contributors.length).toBe(3);
    for (const c of r.contributors) {
      expect([-1, 0, 1]).toContain(c.state);
      expect(Object.values(ANN_SLUGS)).toContain(c.ann_slug);
    }
    // Ignored
    expect(r.ignored.length).toBe(0);
    // Tissue + policy
    expect(r.tissue.slug).toBe(TISSUE_SLUG);
    expect(r.policy).toBe("veto_aware");
    expect(r.total_latency_ms).toBeGreaterThan(0);
    decisionId = r.decision_id;
  });

  it("recorded a billing_tissue_usage_events row for the decision", async () => {
    expect(decisionId).toBeTruthy();
    // The billing hook is fire-and-forget on the tissue service side.
    // Poll the DB for up to 5s for the event row to land.
    const client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      let row: { tissue_slug: string; user_id: string; state: number; cost_qubic: string } | undefined;
      const deadline = Date.now() + 5_000;
      while (Date.now() < deadline) {
        const r = await client.query(
          "SELECT user_id, tissue_slug, state, cost_qubic, request_id FROM billing_tissue_usage_events WHERE request_id = $1",
          [`${TEST_PREFIX}-decide-1`],
        );
        if (r.rowCount && r.rowCount > 0) {
          row = r.rows[0];
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(row).toBeDefined();
      expect(row!.tissue_slug).toBe(TISSUE_SLUG);
      expect(row!.user_id).toBe(userId);
      expect([-1, 0, 1]).toContain(row!.state);
    } finally {
      await client.end();
    }
  });

  it("persisted the decision to tissue_decisions", async () => {
    expect(decisionId).toBeTruthy();
    const client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      const r = await client.query(
        "SELECT state, signature, request_id FROM tissue_decisions WHERE id = $1",
        [decisionId],
      );
      expect(r.rowCount).toBe(1);
      expect(r.rows[0].request_id).toBe(`${TEST_PREFIX}-decide-1`);
      expect(r.rows[0].signature).toMatch(/^[a-f0-9]{32,}$/);
    } finally {
      await client.end();
    }
  });

  it("bumped the tissue's total_decisions counter", async () => {
    expect(tissueId).toBeTruthy();
    const r = await jsonRequest<TissueResponse>(`/v1/tissues/${TISSUE_SLUG}`, {
      service: "tissue",
    });
    expect(Number(r.total_decisions)).toBeGreaterThanOrEqual(1);
  });
});
