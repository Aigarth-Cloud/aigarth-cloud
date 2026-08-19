/**
 * Phase 8 E2E — multi-service SDK smoke test.
 *
 * Verifies the SDK can talk to all 7 services using per-service URLs
 * and that the new resources (identity, qubic, compute, billing, ann,
 * marketplace, keys) all work end-to-end.
 *
 * Usage:
 *   pnpm build                       (in packages/sdk)
 *   pnpm tsx scripts/e2e.ts          (in packages/sdk)
 */

import { Aigarth, AuthenticationError } from "../dist/index.js";

const PASSWORD = "Correct-Horse-Battery-Staple-42";
const services = {
  identity: process.env["AIGARTH_IDENTITY_URL"] ?? "http://localhost:7001",
  qubic: process.env["AIGARTH_QUBIC_URL"] ?? "http://localhost:7002",
  compute: process.env["AIGARTH_COMPUTE_URL"] ?? "http://localhost:7003",
  gateway: process.env["AIGARTH_GATEWAY_URL"] ?? "http://localhost:7004",
  billing: process.env["AIGARTH_BILLING_URL"] ?? "http://localhost:7005",
  ann: process.env["AIGARTH_ANN_URL"] ?? "http://localhost:7006",
  marketplace: process.env["AIGARTH_MARKETPLACE_URL"] ?? "http://localhost:7007",
};

let assertions = 0;
function ts() { return new Date().toISOString().slice(11, 23); }
function log(m: string) { console.log(`[${ts()}] ${m}`); }
function ok(m: string) { log(`  ✓ ${m}`); }
function fail(m: string): never { log(`  ✗ ${m}`); process.exit(1); }
function assert(cond: unknown, m: string) {
  assertions++;
  if (!cond) fail(m);
}

async function main() {
  log("=== Phase 8 — SDK multi-service E2E ===");
  log("");

  // -------------------------------------------------------------------------
  // Section 1: Client instantiation with per-service URLs
  // -------------------------------------------------------------------------
  log("1. SDK client boots with per-service URLs");
  const email = `sdk-test-${Date.now()}@example.com`;
  const bootstrap = new Aigarth({ apiKey: "bootstrap-not-used", services });
  assert(typeof bootstrap.chat === "object", "client.chat exists");
  assert(typeof bootstrap.identity === "object", "client.identity exists");
  assert(typeof bootstrap.qubic === "object", "client.qubic exists");
  assert(typeof bootstrap.compute === "object", "client.compute exists");
  assert(typeof bootstrap.billing === "object", "client.billing exists");
  assert(typeof bootstrap.anns === "object", "client.anns exists");
  assert(typeof bootstrap.marketplace === "object", "client.marketplace exists");
  assert(typeof bootstrap.keys === "object", "client.keys exists");
  ok(`Aigarth client instantiated, 8 resources attached`);

  // -------------------------------------------------------------------------
  // Section 2: Identity — signup + login + whoami
  // -------------------------------------------------------------------------
  log("");
  log("2. Identity service — signup, login, whoami");

  const signupRes = await fetch(`${services.identity}/v1/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD, name: "SDK Test" }),
  });
  assert(signupRes.status === 201, `signup: ${signupRes.status}`);
  const signupBody = (await signupRes.json()) as { id: string };
  ok(`User created: ${signupBody.id}`);

  const loginRes = await fetch(`${services.identity}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  assert(loginRes.status === 200, `login: ${loginRes.status}`);
  const loginBody = (await loginRes.json()) as { access_token: string; user: { id: string; email: string } };
  const jwt = loginBody.access_token;
  ok(`Logged in: ${loginBody.user.email}`);

  // Now use the SDK with the JWT
  const client = new Aigarth({ apiKey: jwt, services });
  const me = await client.identity.whoami();
  assert(me.email === email, `whoami email mismatch: ${me.email} vs ${email}`);
  assert(me.id === signupBody.id, "whoami id mismatch");
  ok(`whoami: ${me.name} <${me.email}>`);

  // -------------------------------------------------------------------------
  // Section 3: Billing — public plans, free subscription
  // -------------------------------------------------------------------------
  log("");
  log("3. Billing service — public plans + free subscription");

  const plans = await client.billing.plans.list();
  assert(plans.data.length >= 1, "expected at least 1 plan");
  assert(plans.data.some((p) => p.tier === "free"), "expected a free plan");
  ok(`Listed ${plans.data.length} plans: ${plans.data.map((p) => p.tier).join(", ")}`);

  const freePlan = plans.data.find((p) => p.tier === "free")!;
  const sub = await client.billing.subscriptions.create({
    planId: freePlan.id,
    paymentMethod: "qubic",
    trial: true,
  });
  assert(sub.plan_id === freePlan.id, "subscription plan mismatch");
  assert(sub.status === "active" || sub.status === "trialing", `subscription status: ${sub.status}`);
  ok(`Subscribed to free: ${sub.id} (${sub.status})`);

  const invoices = await client.billing.invoices.list();
  assert(Array.isArray(invoices.data), "invoices should be array");
  ok(`Invoices: ${invoices.data.length}`);

  // -------------------------------------------------------------------------
  // Section 4: ANN service — public list + retrieve
  // -------------------------------------------------------------------------
  log("");
  log("4. ANN service — public list + retrieve");

  const anns = await client.anns.list({ limit: 5 });
  assert(Array.isArray(anns.data), "anns.data should be array");
  ok(`Listed ${anns.data.length} ANNs (public)`);

  if (anns.data.length > 0) {
    const a = await client.anns.retrieve(anns.data[0]!.id);
    assert(a.id === anns.data[0]!.id, "retrieve id mismatch");
    assert(typeof a.name === "string" && a.name.length > 0, "ann name");
    ok(`Retrieved: ${a.name} (${a.status})`);
  }

  // -------------------------------------------------------------------------
  // Section 5: Marketplace — public listings + auctions
  // -------------------------------------------------------------------------
  log("");
  log("5. Marketplace — public listings + auctions");

  const listings = await client.marketplace.listings.list({ limit: 5 });
  assert(Array.isArray(listings.data), "listings.data should be array");
  assert(typeof listings.total === "number", "listings.total");
  ok(`Listed ${listings.data.length} listings (total: ${listings.total})`);

  const auctions = await client.marketplace.auctions.list({ limit: 5 });
  assert(Array.isArray(auctions.data), "auctions.data should be array");
  ok(`Listed ${auctions.data.length} auctions`);

  // -------------------------------------------------------------------------
  // Section 6: Compute — regions, credit, stats
  // -------------------------------------------------------------------------
  log("");
  log("6. Compute service — regions, credit, stats");

  const regions = await client.compute.regions.list();
  assert(regions.data.length >= 1, "expected at least 1 region");
  ok(`Regions: ${regions.data.length} (${regions.data.map((r) => r.slug).join(", ")})`);

  const credit = await client.compute.credit();
  assert(credit.user_id === me.id, "credit user_id mismatch");
  ok(`Credit: ${credit.remaining_qubic} Qu remaining of ${credit.total_credit_qubic}`);

  const stats = await client.compute.stats();
  assert(typeof stats.total_jobs === "number", "stats.total_jobs");
  ok(`Stats: ${stats.total_jobs} total jobs, ${stats.completed_jobs} completed`);

  // -------------------------------------------------------------------------
  // Section 7: Qubic — wallets list, network status
  // -------------------------------------------------------------------------
  log("");
  log("7. Qubic service — wallets list, network status");

  const wallets = await client.qubic.wallets.list();
  assert(Array.isArray(wallets.data), "wallets.data should be array");
  ok(`Wallets: ${wallets.data.length} linked`);

  const networkStatus = await client.qubic.network.status();
  assert(typeof networkStatus.tickNumber === "number", "tickNumber");
  ok(`Network: tick ${networkStatus.tickNumber}, epoch ${networkStatus.epoch}`);

  // -------------------------------------------------------------------------
  // Section 8: Gateway — issue, list, revoke API keys
  // -------------------------------------------------------------------------
  log("");
  log("8. Gateway — issue, list, revoke API keys");

  const created = await client.keys.create({
    name: "sdk-e2e",
    scopes: ["chat:read", "chat:write"],
  });
  assert(created.full_key.startsWith("ak_live_"), `key format: ${created.full_key.slice(0, 20)}`);
  assert(created.id.length > 0, "key id");
  assert(created.prefix.length > 0, "key prefix");
  ok(`Key issued: ${created.prefix}…${created.secret_last4}`);

  const listed = await client.keys.list();
  assert(listed.data.some((k) => k.id === created.id), "key not in list");
  ok(`Listed ${listed.data.length} keys`);

  // Use the new key to call models
  const newClient = new Aigarth({ apiKey: created.full_key, services });
  const models = await newClient.models.list();
  assert(Array.isArray(models.data), "models.data array");
  ok(`Models accessible with new key: ${models.data.length} models`);

  // The DELETE /v1/keys/:id endpoint requires JWT (not API key), so
  // use the original client (with JWT) to revoke.
  await client.keys.revoke(created.id);
  const afterRevoke = await client.keys.list();
  const revoked = afterRevoke.data.find((k) => k.id === created.id);
  assert(revoked?.status === "revoked", `key should be revoked, got ${revoked?.status}`);
  ok(`Key revoked: ${created.id}`);

  // -------------------------------------------------------------------------
  // Section 9: Error mapping
  // -------------------------------------------------------------------------
  log("");
  log("9. Error mapping");

  try {
    const badClient = new Aigarth({ apiKey: "invalid-key", services });
    await badClient.identity.whoami();
    fail("expected an error for invalid key");
  } catch (err) {
    assert(err instanceof AuthenticationError, `expected AuthenticationError, got ${(err as Error)?.constructor?.name}`);
    assert((err as { status: number }).status === 401, `expected status 401, got ${(err as { status: number }).status}`);
    ok(`Auth error: ${(err as Error).constructor.name} (status=${(err as { status: number }).status})`);
  }

  // -------------------------------------------------------------------------
  // Done
  // -------------------------------------------------------------------------
  log("");
  log("=== ALL SDK E2E TESTS PASSED ===");
  log(`Summary: 9 sections, ${assertions} assertions, all green.`);
}

main().catch((err) => {
  console.error("E2E failed:", err);
  process.exit(1);
});
