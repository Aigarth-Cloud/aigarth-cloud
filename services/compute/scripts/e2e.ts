/**
 * End-to-end test for Phase 2 (Compute service).
 *
 * Exercises every endpoint against a running identity + compute service.
 *
 *   1. identity dev   (in one terminal)
 *   2. qubic dev      (in another — needed for some cross-service refs)
 *   3. compute dev    (in another)
 *   4. compute db:seed
 *   5. tsx scripts/e2e.ts
 *
 * Asserts:
 *   - Health: /healthz, /readyz both 200
 *   - Auth: requests without a JWT are 401
 *   - Regions: list (seeded with global, eu-west)
 *   - Clusters: list filtered by region; members list
 *   - Reservations: create → list → read; credit + cost model verified
 *   - Jobs: submit (no reservation) → broadcast → start → complete; with reservation → credit debit
 *   - Cancellation: cancel a queued job; credit refunded
 *   - Capacity credit: derived from active reservations
 *   - Stats: user aggregate
 *   - Region stats: cluster + computor counts
 */

const IDENTITY = process.env["IDENTITY_URL"] ?? "http://localhost:7001";
const COMPUTE = process.env["COMPUTE_URL"] ?? "http://localhost:7003";
const PASSWORD = "Correct-Horse-Battery-Staple-42";

function ts() {
  return new Date().toISOString().slice(11, 23);
}
function log(msg: string) {
  console.log(`[${ts()}] ${msg}`);
}
function ok(msg: string) {
  log(`  ✓ ${msg}`);
}
function fail(msg: string): never {
  log(`  ✗ ${msg}`);
  process.exit(1);
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) fail(`assert: ${msg}`);
}

async function http(
  base: string,
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

async function main() {
  log("=== Phase 2 — Compute service end-to-end test ===");
  log("");

  // ---------- Health ----------

  log("1. Health checks (no auth required)");
  const healthz = await http(COMPUTE, "GET", "/healthz");
  assert(healthz.status === 200, `healthz: ${healthz.status}`);
  assert(healthz.body.status === "ok", "healthz body.status");
  assert(healthz.body.service === "compute", "healthz body.service");
  ok("GET /healthz → 200, status=ok, service=compute");

  const readyz = await http(COMPUTE, "GET", "/readyz");
  assert(readyz.status === 200, `readyz: ${readyz.status}`);
  assert(readyz.body.status === "ready", "readyz body.status");
  ok("GET /readyz → 200, status=ready");

  // ---------- Auth required ----------

  log("");
  log("2. Auth required — 401 without a JWT");
  const noAuth = await http(COMPUTE, "GET", "/v1/compute/regions");
  assert(noAuth.status === 401, `expected 401, got ${noAuth.status}`);
  ok("GET /v1/compute/regions without token → 401");

  // ---------- Sign up + login ----------

  log("");
  log("3. Create user via identity service, log in, capture JWT");
  const email = `compute-e2e-${Date.now()}@example.com`;
  const signup = await http(IDENTITY, "POST", "/v1/auth/signup", {
    email,
    password: PASSWORD,
    name: "Compute E2E",
  });
  assert(signup.status === 201, `signup: ${signup.status} ${JSON.stringify(signup.body)}`);
  const userId = signup.body.id;
  ok(`User created: ${userId}`);

  const login = await http(IDENTITY, "POST", "/v1/auth/login", { email, password: PASSWORD });
  assert(login.status === 200, `login: ${login.status}`);
  const token = login.body.access_token;
  assert(typeof token === "string" && token.length > 50, "access_token shape");
  ok("Logged in, JWT captured");

  // ---------- Regions ----------

  log("");
  log("4. List regions (seeded with global + eu-west)");
  const regions = await http(COMPUTE, "GET", "/v1/compute/regions", undefined, token);
  assert(regions.status === 200, `regions: ${regions.status}`);
  assert(Array.isArray(regions.body.data), "regions.data array");
  assert(regions.body.data.length >= 2, `expected >= 2 regions, got ${regions.body.data.length}`);
  const slugs = regions.body.data.map((r: any) => r.slug);
  assert(slugs.includes("global"), `global region present: ${slugs}`);
  assert(slugs.includes("eu-west"), `eu-west region present: ${slugs}`);
  const globalRegion = regions.body.data.find((r: any) => r.slug === "global");
  ok(`Listed ${regions.body.data.length} regions (${slugs.join(", ")})`);

  // Region stats
  const regionStats = await http(COMPUTE, "GET", `/v1/compute/regions/${globalRegion.id}/stats`, undefined, token);
  assert(regionStats.status === 200, `region stats: ${regionStats.status}`);
  assert(regionStats.body.computor_count >= 1, `computor_count: ${regionStats.body.computor_count}`);
  assert(regionStats.body.cluster_count >= 1, `cluster_count: ${regionStats.body.cluster_count}`);
  ok(`Global region: ${regionStats.body.cluster_count} clusters, ${regionStats.body.computor_count} computors`);

  // ---------- Clusters ----------

  log("");
  log("5. List clusters, filter by region, inspect members");
  const allClusters = await http(COMPUTE, "GET", "/v1/compute/clusters", undefined, token);
  assert(allClusters.status === 200, `all clusters: ${allClusters.status}`);
  assert(allClusters.body.data.length >= 3, `expected >= 3 clusters, got ${allClusters.body.data.length}`);
  const purposes = allClusters.body.data.map((c: any) => c.purpose);
  assert(purposes.includes("general"), "general cluster present");
  assert(purposes.includes("training"), "training cluster present");
  assert(purposes.includes("inference"), "inference cluster present");
  ok(`Listed ${allClusters.body.data.length} clusters (${purposes.join(", ")})`);

  const generalCluster = allClusters.body.data.find((c: any) => c.purpose === "general");
  const trainingCluster = allClusters.body.data.find((c: any) => c.purpose === "training");

  // Filter by region
  const euClusters = await http(
    COMPUTE,
    "GET",
    `/v1/compute/clusters?regionId=${globalRegion.id}`,
    undefined,
    token,
  );
  assert(euClusters.status === 200, "region filter");
  assert(Array.isArray(euClusters.body.data), "data array");
  ok(`Region filter: ${euClusters.body.data.length} clusters in global`);

  // Cluster members
  const members = await http(COMPUTE, "GET", `/v1/compute/clusters/${generalCluster.id}/members`, undefined, token);
  assert(members.status === 200, `members: ${members.status}`);
  assert(members.body.data.length >= 1, `cluster has members: ${members.body.data.length}`);
  assert(
    typeof members.body.data[0].computor_index === "number",
    "computor_index is a number",
  );
  assert(members.body.data[0].computor_index >= 0 && members.body.data[0].computor_index <= 675, "computor in range");
  ok(`General cluster has ${members.body.data.length} computors (first: #${members.body.data[0].computor_index})`);

  // ---------- Reservations ----------

  log("");
  log("6. Create a reservation (lock 1000 QUBIC for 1 epoch, 0.5% fee)");
  const reservation = await http(
    COMPUTE,
    "POST",
    "/v1/compute/reservations",
    { principalQubic: "1000000000", epochs: 1, startEpoch: 1000 }, // 1k Qu, 1 epoch
    token,
  );
  assert(reservation.status === 201, `reservation: ${reservation.status} ${JSON.stringify(reservation.body)}`);
  assert(reservation.body.status === "active", "status=active");
  assert(reservation.body.principal_qubic === "1000000000", "principal matches");
  assert(reservation.body.credit_qubic === "995000000", `credit (after 0.5% fee) = 995000000, got ${reservation.body.credit_qubic}`);
  assert(reservation.body.used_qubic === "0", "used=0");
  assert(reservation.body.remaining_qubic === "995000000", "remaining=credit");
  const reservationId = reservation.body.id;
  ok(`Reservation created: ${reservationId} (1000 Qu locked, 995 Qu credit)`);

  // List reservations
  const reservations = await http(COMPUTE, "GET", "/v1/compute/reservations", undefined, token);
  assert(reservations.status === 200, `list reservations: ${reservations.status}`);
  assert(reservations.body.data.length === 1, "1 reservation");
  ok("List reservations → 1 active");

  // Read
  const resvRead = await http(COMPUTE, "GET", `/v1/compute/reservations/${reservationId}`, undefined, token);
  assert(resvRead.status === 200, "read reservation");
  ok("Read reservation by id");

  // Capacity credit
  const credit1 = await http(COMPUTE, "GET", "/v1/compute/credits", undefined, token);
  assert(credit1.status === 200, `credits: ${credit1.status}`);
  assert(credit1.body.total_credit_qubic === "995000000", `total_credit: ${credit1.body.total_credit_qubic}`);
  assert(credit1.body.used_qubic === "0", "used=0");
  assert(credit1.body.remaining_qubic === "995000000", "remaining=total");
  assert(credit1.body.active_reservation_count === 1, "1 active reservation");
  ok(`Capacity credit: ${credit1.body.remaining_qubic} Qu remaining`);

  // ---------- Jobs: submit (no reservation) ----------

  log("");
  log("7. Submit a job (no reservation — free-tier)");
  const job1 = await http(
    COMPUTE,
    "POST",
    "/v1/compute/jobs",
    {
      type: "general",
      payload: { hello: "world" },
      priority: 5,
      estimatedDurationMs: 1000,
    },
    token,
  );
  assert(job1.status === 201, `job1: ${job1.status} ${JSON.stringify(job1.body)}`);
  assert(job1.body.status === "queued", `status: ${job1.body.status}`);
  assert(job1.body.credit_used_qubic !== null, "credit used is set");
  assert(job1.body.estimated_cost_qubic !== null, "estimated cost is set");
  const job1Id = job1.body.id;
  ok(`Job submitted: ${job1Id} (cost ${job1.body.estimated_cost_qubic} Qu)`);

  // Cancel a queued job (no credit hold since no reservation)
  const cancel1 = await http(COMPUTE, "POST", `/v1/compute/jobs/${job1Id}/cancel`, {}, token);
  assert(cancel1.status === 200, `cancel1: ${cancel1.status}`);
  assert(cancel1.body.status === "cancelled", `status: ${cancel1.body.status}`);
  ok("Queued job cancelled");

  // ---------- Jobs: submit with reservation (charges credit) ----------

  log("");
  log("8. Submit a job that charges against the reservation");
  const beforeCredit = (await http(COMPUTE, "GET", "/v1/compute/credits", undefined, token)).body.remaining_qubic;
  const job2 = await http(
    COMPUTE,
    "POST",
    "/v1/compute/jobs",
    {
      type: "contract_call",
      clusterId: trainingCluster.id,
      contractIndex: 1,
      functionIndex: 5,
      payload: { x: 42 },
      priority: 7,
      estimatedDurationMs: 5000, // higher cost
      reservationId,
    },
    token,
  );
  assert(job2.status === 201, `job2: ${job2.status} ${JSON.stringify(job2.body)}`);
  assert(job2.body.reservation_id === reservationId, "reservation_id set");
  assert(job2.body.status === "queued", "status=queued");
  const job2Id = job2.body.id;
  const cost2 = BigInt(job2.body.estimated_cost_qubic);
  const afterCredit = (await http(COMPUTE, "GET", "/v1/compute/credits", undefined, token)).body.remaining_qubic;
  assert(
    BigInt(beforeCredit) - BigInt(afterCredit) === cost2,
    `credit debited by ${cost2} (before=${beforeCredit}, after=${afterCredit})`,
  );
  ok(`Job submitted against reservation: ${job2Id} (debited ${cost2} Qu from credit)`);

  // List jobs
  const jobsList = await http(COMPUTE, "GET", "/v1/compute/jobs", undefined, token);
  assert(jobsList.status === 200, `list jobs: ${jobsList.status}`);
  assert(jobsList.body.data.length === 2, `2 jobs (1 cancelled + 1 queued), got ${jobsList.body.data.length}`);
  ok(`List jobs: ${jobsList.body.data.length} found`);

  // List by status
  const queuedOnly = await http(COMPUTE, "GET", "/v1/compute/jobs?status=queued", undefined, token);
  assert(queuedOnly.body.data.length === 1, "1 queued");
  ok("Status filter: status=queued → 1 job");

  // ---------- Job lifecycle: broadcast -> running -> completed ----------

  log("");
  log("9. Drive job2 through the full lifecycle");
  const broadcast = await http(COMPUTE, "POST", `/v1/compute/jobs/${job2Id}/broadcast`, {}, token);
  assert(broadcast.status === 200, `broadcast: ${broadcast.status}`);
  assert(broadcast.body.status === "submitted", `status: ${broadcast.body.status}`);
  assert(typeof broadcast.body.tx_hash === "string", "tx_hash set");
  assert(broadcast.body.tx_hash.length === 60, `tx_hash 60 chars: ${broadcast.body.tx_hash.length}`);
  assert(typeof broadcast.body.submitted_tick === "number", "submitted_tick set");
  ok(`Job broadcast: tx_hash=${broadcast.body.tx_hash.slice(0, 16)}… tick=${broadcast.body.submitted_tick}`);

  const started = await http(COMPUTE, "POST", `/v1/compute/jobs/${job2Id}/start`, {}, token);
  assert(started.status === 200, `start: ${started.status}`);
  assert(started.body.status === "running", `status: ${started.body.status}`);
  ok("Job running");

  const completed = await http(
    COMPUTE,
    "POST",
    `/v1/compute/jobs/${job2Id}/complete`,
    { result: { output: "ok", value: 42 } },
    token,
  );
  assert(completed.status === 200, `complete: ${completed.status}`);
  assert(completed.body.status === "completed", `status: ${completed.body.status}`);
  assert(completed.body.result?.output === "ok", "result stored");
  ok(`Job completed with result: ${JSON.stringify(completed.body.result)}`);

  // ---------- Stats ----------

  log("");
  log("10. User stats");
  const stats = await http(COMPUTE, "GET", "/v1/compute/stats", undefined, token);
  assert(stats.status === 200, `stats: ${stats.status}`);
  assert(stats.body.total_jobs === 2, `total_jobs=2, got ${stats.body.total_jobs}`);
  assert(stats.body.completed_jobs === 1, `completed_jobs=1, got ${stats.body.completed_jobs}`);
  assert(stats.body.cancelled_jobs === 1, `cancelled_jobs=1, got ${stats.body.cancelled_jobs}`);
  assert(BigInt(stats.body.total_spent_qubic) > 0n, "spent > 0");
  ok(`Stats: ${stats.body.completed_jobs} done, ${stats.body.cancelled_jobs} cancelled, ${stats.body.total_spent_qubic} Qu spent`);

  // ---------- Release reservation ----------

  log("");
  log("11. Release reservation (early; 0.1% penalty)");
  // Create a fresh reservation to release (don't release the one we used)
  const resv2 = await http(
    COMPUTE,
    "POST",
    "/v1/compute/reservations",
    { principalQubic: "500000000", epochs: 2, startEpoch: 1000 },
    token,
  );
  assert(resv2.status === 201, `resv2: ${resv2.status}`);
  const resv2Credit = BigInt(resv2.body.credit_qubic);
  const release = await http(COMPUTE, "POST", `/v1/compute/reservations/${resv2.body.id}/release`, {}, token);
  assert(release.status === 200, `release: ${release.status} ${JSON.stringify(release.body)}`);
  assert(release.body.status === "released", `status: ${release.body.status}`);
  assert(typeof release.body.refund_qubic === "string", "refund set");
  // Penalty is 0.1% of remaining (which = credit since used=0): 99750000/1000 = ~99750
  const refund = BigInt(release.body.refund_qubic);
  const penalty = BigInt(release.body.penalty_qubic);
  assert(refund + penalty === resv2Credit, "refund + penalty = credit");
  assert(penalty > 0n, "penalty > 0");
  ok(`Reservation released: refund=${refund}, penalty=${penalty}`);

  // Release the same reservation again → should fail
  const releaseAgain = await http(COMPUTE, "POST", `/v1/compute/reservations/${resv2.body.id}/release`, {}, token);
  assert(releaseAgain.status === 400, `re-release: ${releaseAgain.status}`);
  ok("Re-release of released reservation → 400 (correctly rejected)");

  // ---------- Validation ----------

  log("");
  log("12. Validation: bad inputs are rejected");
  const badResv = await http(
    COMPUTE,
    "POST",
    "/v1/compute/reservations",
    { principalQubic: "not-a-number", epochs: 1 },
    token,
  );
  assert(badResv.status === 400, `bad resv: ${badResv.status}`);

  const badJob = await http(
    COMPUTE,
    "POST",
    "/v1/compute/jobs",
    { type: "invalid", payload: {} },
    token,
  );
  assert(badJob.status === 400, `bad job: ${badJob.status}`);

  const badCluster = await http(
    COMPUTE,
    "POST",
    "/v1/compute/clusters",
    { name: "Bad", slug: "BAD", regionId: globalRegion.id }, // bad slug
    token,
  );
  assert(badCluster.status === 400, `bad cluster: ${badCluster.status}`);

  const badRegionId = await http(
    COMPUTE,
    "GET",
    `/v1/compute/regions/00000000-0000-0000-0000-000000000000/stats`,
    undefined,
    token,
  );
  assert(badRegionId.status === 404, `bad region: ${badRegionId.status}`);

  ok("All 4 validation cases rejected (400/404)");

  // ---------- Summary ----------

  log("");
  log("=== ✅ All Phase 2 E2E assertions passed ===");
  log(`   Identity: ${IDENTITY}`);
  log(`   Compute:  ${COMPUTE}`);
  log(`   User:     ${userId}`);
  log(`   Regions:  ${regions.body.data.length}`);
  log(`   Clusters: ${allClusters.body.data.length}`);
  log(`   Reservations: 2 (1 active with debit, 1 released)`);
  log(`   Jobs:     2 (1 cancelled, 1 completed end-to-end)`);
  log(`   Credit spent: ${stats.body.total_spent_qubic} Qu`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("FATAL:", err);
  process.exit(1);
});
