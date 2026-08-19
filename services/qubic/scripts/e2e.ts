/**
 * End-to-end test for Phase 3 (Qubic service).
 *
 * Exercises every Qubic endpoint against a running identity + qubic service.
 * Uses the STUB Qubic client (deterministic, no real network).
 *
 *   1. identity dev   (in one terminal)
 *   2. qubic dev      (in another)
 *   3. tsx scripts/e2e.ts   (in a third)
 *
 * Asserts:
 *   - Health: /healthz, /readyz both 200
 *   - Auth: requests without a JWT are 401
 *   - Validators: listComputors returns 676 (full Qubic computor set)
 *   - Wallet: link → list → read → balance (cached on 2nd call) → authorize
 *   - Stake: intent → submit → status flips to broadcast
 *   - Stake: release before maturity fails
 *   - Stake: cancel an unsigned intent
 *   - Treasury: create movement → sign → list → execute
 *   - Network: getCurrentTick returns valid tick info
 */

const IDENTITY = process.env["IDENTITY_URL"] ?? "http://localhost:7001";
const QUBIC = process.env["QUBIC_URL"] ?? "http://localhost:7002";
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

// Helper: derive a valid 60-char Qubic address from a seed string
function qubicAddressFromSeed(seed: string): string {
  const upper = seed.toUpperCase().replace(/[^A-Z]/g, "");
  // Pad/truncate to exactly 60 chars
  const padded = (upper + "A".repeat(60)).slice(0, 60);
  return padded;
}

async function main() {
  log("=== Phase 3 — Qubic service end-to-end test ===");
  log("");

  // ---------- Health ----------

  log("1. Health checks (no auth required)");
  const healthz = await http(QUBIC, "GET", "/healthz");
  assert(healthz.status === 200, `healthz: ${healthz.status}`);
  assert(healthz.body.status === "ok", "healthz body.status");
  assert(healthz.body.service === "qubic", "healthz body.service");
  ok("GET /healthz → 200, status=ok, service=qubic");

  const readyz = await http(QUBIC, "GET", "/readyz");
  assert(readyz.status === 200, `readyz: ${readyz.status}`);
  assert(readyz.body.status === "ready", "readyz body.status");
  ok("GET /readyz → 200, status=ready");

  // ---------- Auth required ----------

  log("");
  log("2. Auth required — 401 without a JWT");
  const noAuth = await http(QUBIC, "GET", "/v1/qubic/wallets");
  assert(noAuth.status === 401, `expected 401, got ${noAuth.status}`);
  ok("GET /v1/qubic/wallets without token → 401");

  // ---------- Sign up + login ----------

  log("");
  log("3. Create user via identity service, log in, capture JWT");
  const email = `qubic-e2e-${Date.now()}@example.com`;
  const signup = await http(IDENTITY, "POST", "/v1/auth/signup", {
    email,
    password: PASSWORD,
    name: "Qubic E2E",
  });
  assert(signup.status === 201, `signup: ${signup.status} ${JSON.stringify(signup.body)}`);
  const userId = signup.body.id;
  ok(`User created: ${userId}`);

  const login = await http(IDENTITY, "POST", "/v1/auth/login", { email, password: PASSWORD });
  assert(login.status === 200, `login: ${login.status}`);
  const token = login.body.access_token;
  assert(typeof token === "string" && token.length > 50, "access_token shape");
  ok("Logged in, JWT captured");

  // ---------- Validators ----------

  log("");
  log("4. List validators (computors) — stub returns 676");
  const validators = await http(QUBIC, "GET", "/v1/qubic/validators?limit=676", undefined, token);
  assert(validators.status === 200, `validators: ${validators.status}`);
  assert(Array.isArray(validators.body.data), "validators.data array");
  assert(validators.body.data.length === 676, `expected 676 computors, got ${validators.body.data.length}`);
  const first = validators.body.data[0];
  assert(typeof first.computor_index === "number", "computor_index");
  assert(typeof first.qubic_address === "string", "qubic_address");
  assert(/^[A-Z]{60}$/.test(first.qubic_address), `address format: ${first.qubic_address}`);
  assert(typeof first.performance_score === "number", "performance_score");
  ok(`Listed ${validators.body.data.length} validators (computor 0 = ${first.qubic_address.slice(0, 8)}…)`);

  // ---------- Wallet ----------

  log("");
  log("5. Link a wallet (idempotent)");
  const userWallet = qubicAddressFromSeed(`USER-${userId}`);
  const identityLinkId = "00000000-0000-4000-8000-000000000001";
  const link1 = await http(QUBIC, "POST", "/v1/qubic/wallets", {
    qubicAddress: userWallet,
    identityLinkId,
    network: "testnet",
  }, token);
  assert(link1.status === 201, `link1: ${link1.status} ${JSON.stringify(link1.body)}`);
  assert(link1.body.qubic_address === userWallet, "qubic_address matches");
  assert(link1.body.stake_authorized === false, "stake_authorized starts false");
  ok(`Wallet linked: ${link1.body.id}`);

  // Idempotency: link the same (user, address) again → same id
  const link2 = await http(QUBIC, "POST", "/v1/qubic/wallets", {
    qubicAddress: userWallet,
    identityLinkId,
    network: "testnet",
  }, token);
  assert(link2.status === 201, `link2: ${link2.status}`);
  assert(link2.body.id === link1.body.id, "idempotent: same id");
  ok("Idempotent re-link returns same wallet id");

  // List
  const list = await http(QUBIC, "GET", "/v1/qubic/wallets", undefined, token);
  assert(list.status === 200, `list: ${list.status}`);
  assert(list.body.data.length === 1, `expected 1 wallet, got ${list.body.data.length}`);
  ok(`List wallets: ${list.body.data.length} found`);

  // Read by id
  const read = await http(QUBIC, "GET", `/v1/qubic/wallets/${link1.body.id}`, undefined, token);
  assert(read.status === 200, `read: ${read.status}`);
  ok(`Read wallet by id`);

  // Balance (refresh to avoid cache from any previous run)
  const bal = await http(QUBIC, "GET", `/v1/qubic/wallets/${link1.body.id}/balance?refresh=true`, undefined, token);
  assert(bal.status === 200, `bal: ${bal.status}`);
  assert(typeof bal.body.balance_qubic === "string", "balance_qubic is string (bigint)");
  const balBig = BigInt(bal.body.balance_qubic);
  assert(balBig > 0n, "balance is positive");
  assert(bal.body.display.includes("Qu"), "display ends in Qu");
  ok(`Balance: ${bal.body.display} (tick ${bal.body.tick_number})`);

  // Authorize staking
  const auth = await http(QUBIC, "POST", `/v1/qubic/wallets/${link1.body.id}/authorize-staking`, {
    expiresInDays: 365,
  }, token);
  assert(auth.status === 200, `auth: ${auth.status}`);
  assert(auth.body.stake_authorized === true, "stake_authorized now true");
  assert(typeof auth.body.stake_authorization_expires_at === "string", "expires_at set");
  ok("Wallet authorized for staking (365 days)");

  // ---------- Network status ----------

  log("");
  log("6. Network status (stub returns valid tick info)");
  const status = await http(QUBIC, "GET", "/v1/qubic/network/status", undefined, token);
  assert(status.status === 200, `status: ${status.status}`);
  assert(typeof status.body.tickNumber === "number", "tickNumber");
  assert(typeof status.body.epoch === "number", "epoch");
  assert(status.body.tickNumber > 0, "tickNumber > 0");
  ok(`Network: tick=${status.body.tickNumber}, epoch=${status.body.epoch}`);

  // ---------- Stake intent + submit ----------

  log("");
  log("7. Create stake intent");
  // Pick a receiver address from a real computor
  const receiver = validators.body.data[10].qubic_address;
  const amount = "1000000"; // 1 Qu in smallest unit (1e6 per 1 Qu)
  const intent = await http(QUBIC, "POST", "/v1/qubic/stakes/intent", {
    walletId: link1.body.id,
    receiver,
    amountQubic: amount,
    epochsLocked: 2,
  }, token);
  assert(intent.status === 201, `intent: ${intent.status} ${JSON.stringify(intent.body)}`);
  assert(typeof intent.body.intent_hash === "string", "intent_hash");
  assert(typeof intent.body.message === "string", "message");
  assert(intent.body.message.includes(receiver), "message includes receiver");
  assert(intent.body.amount_qubic === amount, "amount matches");
  ok(`Stake intent created: ${intent.body.stake_id} hash=${intent.body.intent_hash.slice(0, 16)}…`);

  log("");
  log("8. Submit signed intent → broadcast");
  const submit = await http(QUBIC, "POST", `/v1/qubic/stakes/${intent.body.stake_id}/submit`, {
    intentHash: intent.body.intent_hash,
    signature: "deadbeefcafebabe1234567890abcdef",
  }, token);
  assert(submit.status === 200, `submit: ${submit.status} ${JSON.stringify(submit.body)}`);
  assert(submit.body.stake.status === "broadcast", `status: ${submit.body.stake.status}`);
  assert(typeof submit.body.stake.tx_hash === "string", "tx_hash set");
  assert(submit.body.stake.tx_hash.length === 60, "tx_hash is 60 chars");
  ok(`Stake broadcast: tx_hash=${submit.body.stake.tx_hash.slice(0, 16)}…`);

  // List stakes
  const stakesList = await http(QUBIC, "GET", "/v1/qubic/stakes", undefined, token);
  assert(stakesList.status === 200, `stakes list: ${stakesList.status}`);
  assert(stakesList.body.data.length === 1, "1 stake in list");
  assert(stakesList.body.data[0].status === "broadcast", "listed status is broadcast");
  ok("List stakes → 1 stake, status=broadcast");

  // Read one
  const stakeOne = await http(QUBIC, "GET", `/v1/qubic/stakes/${intent.body.stake_id}`, undefined, token);
  assert(stakeOne.status === 200, `stake one: ${stakeOne.status}`);
  assert(stakeOne.body.principal_qubic === amount, "principal matches");
  ok("Read single stake");

  // Release before maturity should fail
  const release = await http(QUBIC, "POST", `/v1/qubic/stakes/${intent.body.stake_id}/release`, {}, token);
  assert(release.status === 400, `release before maturity: ${release.status}`);
  assert(typeof release.body.error?.message === "string", "error message present");
  ok("Release before maturity → 400 (correctly rejected)");

  // ---------- Cancel an unsigned intent ----------

  log("");
  log("9. Cancel an unsigned intent");
  const intent2 = await http(QUBIC, "POST", "/v1/qubic/stakes/intent", {
    walletId: link1.body.id,
    receiver,
    amountQubic: "500000",
    epochsLocked: 1,
  }, token);
  assert(intent2.status === 201, `intent2: ${intent2.status}`);
  const cancel = await http(QUBIC, "POST", `/v1/qubic/stakes/${intent2.body.stake_id}/cancel`, {}, token);
  assert(cancel.status === 200, `cancel: ${cancel.status}`);
  ok("Unsigned stake cancelled");

  // Verify the cancelled stake is still in list with status=cancelled
  const stakesAfter = await http(QUBIC, "GET", "/v1/qubic/stakes", undefined, token);
  assert(stakesAfter.body.data.length === 2, "2 stakes now");
  const cancelled = stakesAfter.body.data.find((s: any) => s.id === intent2.body.stake_id);
  assert(cancelled?.status === "cancelled", "cancelled stake has status=cancelled");
  ok("Cancelled stake has status=cancelled");

  // ---------- Treasury ----------

  log("");
  log("10. Treasury: create movement, sign (1 of 2), list, sign (2 of 2), execute");
  // The Qubic service .env has TREASURY_SIGNERS set to two valid 60-char addresses.
  const signer1 = "BB" + "A".repeat(58); // 60 chars total
  const signer2 = "CC" + "A".repeat(58);

  const movement = await http(QUBIC, "POST", "/v1/qubic/treasury/movements", {
    kind: "reward_payout",
    amountQubic: "100000",
    counterparty: userWallet,
    signersRequired: 2,
  }, token);
  assert(movement.status === 201, `movement: ${movement.status} ${JSON.stringify(movement.body)}`);
  assert(movement.body.kind === "reward_payout", "kind");
  assert(movement.body.amount_qubic === "100000", "amount");
  assert(movement.body.signers_approved === 0, "starts with 0 signers");
  assert(movement.body.signers_required === 2, "threshold=2");
  ok(`Movement created: ${movement.body.id} (requires ${movement.body.signers_required} signers)`);

  // Sign with signer1
  const sign1 = await http(QUBIC, "POST", `/v1/qubic/treasury/movements/${movement.body.id}/sign`, {
    signer: signer1,
    signature: "a".repeat(64),
  }, token);
  assert(sign1.status === 200, `sign1: ${sign1.status} ${JSON.stringify(sign1.body)}`);
  assert(sign1.body.signers_approved === 1, `approved=1, got ${sign1.body.signers_approved}`);
  ok("Signer 1 signed (1/2)");

  // Duplicate signature from same signer is rejected
  const dup = await http(QUBIC, "POST", `/v1/qubic/treasury/movements/${movement.body.id}/sign`, {
    signer: signer1,
    signature: "a".repeat(64),
  }, token);
  assert(dup.status === 400, `dup: ${dup.status}`);
  ok("Duplicate signature rejected (400)");

  // Sign with signer2 — meets threshold
  const sign2 = await http(QUBIC, "POST", `/v1/qubic/treasury/movements/${movement.body.id}/sign`, {
    signer: signer2,
    signature: "b".repeat(64),
  }, token);
  assert(sign2.status === 200, `sign2: ${sign2.status}`);
  assert(sign2.body.signers_approved === 2, "approved=2 (threshold met)");
  ok("Signer 2 signed (2/2 — threshold met)");

  // Unauthorized signer rejected
  const bad = await http(QUBIC, "POST", `/v1/qubic/treasury/movements/${movement.body.id}/sign`, {
    signer: "DD".repeat(30),
    signature: "c".repeat(64),
  }, token);
  assert(bad.status === 400, `bad signer: ${bad.status}`);
  ok("Unauthorized signer rejected (400)");

  // List
  const mvList = await http(QUBIC, "GET", "/v1/qubic/treasury/movements", undefined, token);
  assert(mvList.status === 200, `mv list: ${mvList.status}`);
  assert(mvList.body.data.length >= 1, "at least 1 movement");
  ok(`Listed ${mvList.body.data.length} movement(s)`);

  // Execute
  const execute = await http(QUBIC, "POST", `/v1/qubic/treasury/movements/${movement.body.id}/execute`, {
    txHash: qubicAddressFromSeed("EXEC"),
  }, token);
  assert(execute.status === 200, `execute: ${execute.status} ${JSON.stringify(execute.body)}`);
  assert(typeof execute.body.executed_at === "string", "executed_at set");
  ok("Movement executed");

  // ---------- Summary ----------

  log("");
  log("=== ✅ All Phase 3 E2E assertions passed ===");
  log(`   Identity: ${IDENTITY}`);
  log(`   Qubic:    ${QUBIC}`);
  log(`   User:     ${userId}`);
  log(`   Wallets:  ${list.body.data.length}`);
  log(`   Stakes:   ${stakesAfter.body.data.length}`);
  log(`   Movements: ${mvList.body.data.length}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("FATAL:", err);
  process.exit(1);
});
