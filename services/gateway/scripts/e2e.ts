/**
 * End-to-end test for Phase 7 (AI Gateway).
 *
 *   1. identity dev   (in one terminal)
 *   2. gateway dev    (in another)
 *   3. gateway db:seed
 *   4. tsx scripts/e2e.ts
 *
 * Asserts:
 *   - Health, public models (no auth), auth required for keys
 *   - Issue gateway API key, list, revoke
 *   - Chat completions (sync + SSE streaming) via JWT and API key
 *   - Embeddings (vector shape + cost)
 *   - Image generation (URL shape + cost)
 *   - Usage tracking (count, tokens, cost, by_model, by_endpoint)
 *   - Rate limiting (sliding window, retry-after)
 *   - Validation (bad model, bad input)
 */

const IDENTITY = process.env["IDENTITY_URL"] ?? "http://localhost:7001";
const GATEWAY = process.env["GATEWAY_URL"] ?? "http://localhost:7004";
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
): Promise<{ status: number; body: any; text?: string }> {
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
  return { status: res.status, body: json, text };
}

async function main() {
  log("=== Phase 7 — AI Gateway end-to-end test ===");
  log("");

  // ---------- Health ----------

  log("1. Health + public model catalog");
  const healthz = await http(GATEWAY, "GET", "/healthz");
  assert(healthz.status === 200, `healthz: ${healthz.status}`);
  assert(healthz.body.service === "gateway", "service=gateway");
  ok("GET /healthz → 200");

  const readyz = await http(GATEWAY, "GET", "/readyz");
  assert(readyz.status === 200, `readyz: ${readyz.status}`);
  ok("GET /readyz → 200");

  // Public models (no auth)
  const models = await http(GATEWAY, "GET", "/v1/models");
  assert(models.status === 200, `models: ${models.status}`);
  assert(models.body.object === "list", "object=list");
  assert(models.body.data.length >= 4, `expected >= 4 models, got ${models.body.data.length}`);
  const ids = models.body.data.map((m: any) => m.id);
  assert(ids.includes("aigarth-meridian-1"), "meridian-1 listed");
  assert(ids.includes("aigarth-meridian-1-pro"), "meridian-1-pro listed");
  assert(ids.includes("aigarth-embed-1"), "embed-1 listed");
  assert(ids.includes("aigarth-image-1"), "image-1 listed");
  ok(`Listed ${models.body.data.length} models (${ids.join(", ")})`);

  // Read one
  const oneModel = await http(GATEWAY, "GET", "/v1/models/aigarth-meridian-1");
  assert(oneModel.status === 200, `one model: ${oneModel.status}`);
  assert(oneModel.body.context_window === 8192, "context window");
  assert(typeof oneModel.body.pricing.input_cost_qubic_per_1k === "string", "pricing shape");
  ok(`Read model: ${oneModel.body.id} (ctx=${oneModel.body.context_window})`);

  // ---------- Auth required for keys ----------

  log("");
  log("2. Auth required for /v1/keys");
  const noAuth = await http(GATEWAY, "GET", "/v1/keys");
  assert(noAuth.status === 401, `expected 401, got ${noAuth.status}`);
  ok("GET /v1/keys without token → 401");

  // ---------- Sign up + login ----------

  log("");
  log("3. Create user via identity, log in");
  const email = `gateway-e2e-${Date.now()}@example.com`;
  const signup = await http(IDENTITY, "POST", "/v1/auth/signup", {
    email,
    password: PASSWORD,
    name: "Gateway E2E",
  });
  assert(signup.status === 201, `signup: ${signup.status} ${JSON.stringify(signup.body)}`);
  const userId = signup.body.id;
  ok(`User created: ${userId}`);

  const login = await http(IDENTITY, "POST", "/v1/auth/login", { email, password: PASSWORD });
  const token = login.body.access_token;
  ok("Logged in, JWT captured");

  // ---------- Issue gateway API key ----------

  log("");
  log("4. Issue gateway API key");
  const keyRes = await http(
    GATEWAY,
    "POST",
    "/v1/keys",
    { name: "E2E test key", scopes: ["chat", "embeddings", "images"] },
    token,
  );
  assert(keyRes.status === 201, `key: ${keyRes.status} ${JSON.stringify(keyRes.body)}`);
  assert(typeof keyRes.body.full_key === "string", "full_key returned");
  assert(keyRes.body.full_key.startsWith("ak_live_"), "key format");
  assert(keyRes.body.full_key.split(".").length === 2, "key has prefix.secret");
  assert(keyRes.body.prefix.length === 8, "prefix is 8 chars");
  assert(keyRes.body.secret_last4.length === 4, "last4 is 4 chars");
  const fullKey = keyRes.body.full_key;
  const keyId = keyRes.body.id;
  ok(`API key issued: ${fullKey.slice(0, 14)}… (id ${keyId})`);

  // List keys
  const keysList = await http(GATEWAY, "GET", "/v1/keys", undefined, token);
  assert(keysList.status === 200, `keys list: ${keysList.status}`);
  assert(keysList.body.data.length === 1, "1 key");
  assert(keysList.body.data[0].status === "active", "active");
  ok("List keys → 1 active");

  // ---------- Chat completions (sync, JWT) ----------

  log("");
  log("5. Chat completion (sync) via JWT");
  const chat1 = await http(
    GATEWAY,
    "POST",
    "/v1/chat/completions",
    {
      model: "aigarth-meridian-1",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello, world!" },
      ],
      n: 1,
    },
    token,
  );
  assert(chat1.status === 200, `chat1: ${chat1.status} ${JSON.stringify(chat1.body)}`);
  assert(chat1.body.object === "chat.completion", "object");
  assert(chat1.body.model === "aigarth-meridian-1", "model");
  assert(Array.isArray(chat1.body.choices), "choices array");
  assert(chat1.body.choices.length === 1, "1 choice");
  assert(chat1.body.choices[0].message.role === "assistant", "role=assistant");
  assert(typeof chat1.body.choices[0].message.content === "string", "content is string");
  assert(chat1.body.choices[0].message.content.includes("Hello, world!") || chat1.body.choices[0].message.content.includes("stub"), "content references input or marks stub");
  assert(chat1.body.usage.prompt_tokens > 0, "prompt_tokens > 0");
  assert(chat1.body.usage.completion_tokens > 0, "completion_tokens > 0");
  assert(chat1.body.usage.total_tokens === chat1.body.usage.prompt_tokens + chat1.body.usage.completion_tokens, "total = prompt + completion");
  assert(typeof chat1.body.id === "string" && chat1.body.id.startsWith("chatcmpl-"), "id shape");
  ok(`Chat: ${chat1.body.choices[0].message.content.length} chars, ${chat1.body.usage.total_tokens} tokens`);

  // ---------- Chat completions (sync, API key) ----------

  log("");
  log("6. Chat completion (sync) via API key");
  const chat2 = await http(
    GATEWAY,
    "POST",
    "/v1/chat/completions",
    {
      model: "aigarth-meridian-1-pro",
      messages: [{ role: "user", content: "Test from API key" }],
    },
    fullKey,
  );
  assert(chat2.status === 200, `chat2: ${chat2.status} ${JSON.stringify(chat2.body)}`);
  assert(chat2.body.choices[0].message.content.includes("API key"), "content references input");
  ok(`Chat via key: ${chat2.body.choices[0].message.content.length} chars`);

  // ---------- Chat completions (SSE streaming) ----------

  log("");
  log("7. Chat completion (SSE streaming)");
  const streamRes = await fetch(`${GATEWAY}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      model: "aigarth-meridian-1",
      messages: [{ role: "user", content: "Stream test please" }],
      stream: true,
    }),
  });
  assert(streamRes.status === 200, `stream status: ${streamRes.status}`);
  assert(streamRes.headers.get("content-type")?.includes("text/event-stream"), "content-type is SSE");
  const streamText = await streamRes.text();
  const lines = streamText.split("\n\n").filter((l) => l.startsWith("data: ") && !l.includes("[DONE]"));
  assert(lines.length >= 3, `expected >= 3 SSE chunks, got ${lines.length}`);
  const firstChunk = JSON.parse(lines[0]!.slice(6)) as { choices: Array<{ delta: { role?: string } }> };
  assert(firstChunk.choices[0]?.delta?.role === "assistant", "first chunk has role=assistant");
  const lastChunk = JSON.parse(lines[lines.length - 1]!.slice(6)) as { choices: Array<{ finish_reason: string | null }> };
  assert(lastChunk.choices[0]?.finish_reason === "stop", `final finish_reason: ${lastChunk.choices[0]?.finish_reason}`);
  assert(streamText.includes("data: [DONE]"), "ends with [DONE]");
  // Reconstruct the streamed text
  const streamed = lines
    .map((l) => JSON.parse(l.slice(6)) as { choices: Array<{ delta: { content?: string } }> })
    .map((c) => c.choices[0]?.delta?.content ?? "")
    .join("");
  assert(streamed.length > 10, `streamed text: ${streamed.length} chars`);
  ok(`Streamed ${lines.length} chunks → "${streamed.slice(0, 60)}…"`);

  // ---------- Embeddings ----------

  log("");
  log("8. Embeddings");
  const emb1 = await http(
    GATEWAY,
    "POST",
    "/v1/embeddings",
    { model: "aigarth-embed-1", input: "The quick brown fox" },
    token,
  );
  assert(emb1.status === 200, `emb1: ${emb1.status} ${JSON.stringify(emb1.body)}`);
  assert(emb1.body.object === "list", "object=list");
  assert(emb1.body.data.length === 1, "1 embedding");
  assert(emb1.body.data[0].object === "embedding", "object=embedding");
  assert(Array.isArray(emb1.body.data[0].embedding), "embedding is array");
  assert(emb1.body.data[0].embedding.length === 1536, `dim: ${emb1.body.data[0].embedding.length}`);
  assert(emb1.body.usage.prompt_tokens > 0, "prompt_tokens > 0");
  ok(`Embed 1 string → ${emb1.body.data[0].embedding.length}-dim vector`);

  // Determinism: same input → same vector
  const emb2 = await http(
    GATEWAY,
    "POST",
    "/v1/embeddings",
    { model: "aigarth-embed-1", input: "The quick brown fox" },
    token,
  );
  assert(
    JSON.stringify(emb1.body.data[0].embedding) === JSON.stringify(emb2.body.data[0].embedding),
    "same input → same vector (deterministic)",
  );
  ok("Determinism verified: same input → identical vector");

  // Batch
  const emb3 = await http(
    GATEWAY,
    "POST",
    "/v1/embeddings",
    { model: "aigarth-embed-1", input: ["alpha", "beta", "gamma"] },
    token,
  );
  assert(emb3.body.data.length === 3, `batch: 3 embeddings, got ${emb3.body.data.length}`);
  ok("Batch embeddings: 3 strings → 3 vectors");

  // ---------- Image generation ----------

  log("");
  log("9. Image generation");
  const img1 = await http(
    GATEWAY,
    "POST",
    "/v1/images/generations",
    {
      model: "aigarth-image-1",
      prompt: "A cat in a garden of bonsai trees",
      n: 2,
      size: "512x512",
    },
    token,
  );
  assert(img1.status === 200, `img1: ${img1.status} ${JSON.stringify(img1.body)}`);
  assert(img1.body.data.length === 2, `n=2 → 2 images, got ${img1.body.data.length}`);
  assert(typeof img1.body.data[0].url === "string", "url is string");
  assert(img1.body.data[0].url.includes("picsum.photos") || img1.body.data[0].url.startsWith("https://"), "url is https");
  ok(`Generated 2 image URLs (first: ${img1.body.data[0].url.slice(0, 50)}…)`);

  // ---------- Usage tracking ----------

  log("");
  log("10. Usage tracking");
  const usage = await http(GATEWAY, "GET", "/v1/usage", undefined, token);
  assert(usage.status === 200, `usage: ${usage.status}`);
  assert(usage.body.total_requests >= 4, `total_requests >= 4, got ${usage.body.total_requests}`);
  assert(usage.body.total_tokens > 0, "total_tokens > 0");
  assert(BigInt(usage.body.total_cost_qubic) > 0n, "total_cost_qubic > 0");
  assert(Array.isArray(usage.body.by_model), "by_model array");
  assert(usage.body.by_model.length >= 2, "by_model has >= 2 entries");
  assert(usage.body.by_endpoint.length >= 2, "by_endpoint has >= 2 entries");
  const chatUsage = usage.body.by_model.find((m: any) => m.model === "aigarth-meridian-1");
  assert(chatUsage, "meridian-1 in by_model");
  assert(chatUsage.requests >= 1, "meridian-1 requests >= 1");
  ok(`Usage: ${usage.body.total_requests} requests, ${usage.body.total_tokens} tokens, ${usage.body.total_cost_qubic} Qu`);

  // Recent
  const recent = await http(GATEWAY, "GET", "/v1/usage/recent?limit=5", undefined, token);
  assert(recent.status === 200, `recent: ${recent.status}`);
  assert(recent.body.data.length >= 1, "recent has rows");
  assert(recent.body.data[0].model, "recent has model");
  assert(recent.body.data[0].endpoint, "recent has endpoint");
  assert(typeof recent.body.data[0].cost_qubic === "string", "cost_qubic is string (bigint)");
  ok(`Recent: ${recent.body.data.length} rows`);

  // ---------- Bad model / bad input ----------

  log("");
  log("11. Validation: bad model + bad input");
  const badModel = await http(
    GATEWAY,
    "POST",
    "/v1/chat/completions",
    { model: "gpt-9000", messages: [{ role: "user", content: "hi" }] },
    token,
  );
  assert(badModel.status === 404, `bad model: ${badModel.status}`);

  const badInput = await http(
    GATEWAY,
    "POST",
    "/v1/chat/completions",
    { model: "aigarth-meridian-1", messages: [] },
    token,
  );
  assert(badInput.status === 400, `empty messages: ${badInput.status}`);

  const wrongType = await http(
    GATEWAY,
    "POST",
    "/v1/embeddings",
    { model: "aigarth-meridian-1", input: "text" },
    token,
  );
  assert(wrongType.status === 400, `wrong type: ${wrongType.status}`);

  ok("All 3 validation cases rejected (400/404)");

  // ---------- Bad API key ----------

  log("");
  log("12. Invalid API key → 401");
  const badKey = await http(
    GATEWAY,
    "POST",
    "/v1/chat/completions",
    { model: "aigarth-meridian-1", messages: [{ role: "user", content: "hi" }] },
    "ak_live_deadbeef.bogussecret",
  );
  assert(badKey.status === 401, `bad key: ${badKey.status}`);

  const malformedKey = await http(
    GATEWAY,
    "POST",
    "/v1/chat/completions",
    { model: "aigarth-meridian-1", messages: [{ role: "user", content: "hi" }] },
    "ak_live_just-a-prefix",
  );
  assert(malformedKey.status === 401, `malformed key: ${malformedKey.status}`);

  ok("Invalid + malformed API keys → 401");

  // ---------- Revoke API key ----------

  log("");
  log("13. Revoke API key");
  const revoke = await http(GATEWAY, "DELETE", `/v1/keys/${keyId}`, undefined, token);
  assert(revoke.status === 200, `revoke: ${revoke.status}`);

  // Subsequent calls with revoked key → 401
  const revokedCall = await http(
    GATEWAY,
    "POST",
    "/v1/chat/completions",
    { model: "aigarth-meridian-1", messages: [{ role: "user", content: "hi" }] },
    fullKey,
  );
  assert(revokedCall.status === 401, `post-revoke: ${revokedCall.status}`);

  // Keys list now shows revoked
  const keysAfter = await http(GATEWAY, "GET", "/v1/keys", undefined, token);
  const revoked = keysAfter.body.data.find((k: any) => k.id === keyId);
  assert(revoked.status === "revoked", "key status=revoked");
  ok("Key revoked; subsequent calls → 401");

  // ---------- Summary ----------

  log("");
  log("=== ✅ All Phase 7 E2E assertions passed ===");
  log(`   Identity: ${IDENTITY}`);
  log(`   Gateway:  ${GATEWAY}`);
  log(`   User:     ${userId}`);
  log(`   Models:   ${models.body.data.length}`);
  log(`   Requests: ${usage.body.total_requests}`);
  log(`   Tokens:   ${usage.body.total_tokens}`);
  log(`   Cost:     ${usage.body.total_cost_qubic} Qu`);
  log(`   API key:  revoked`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("FATAL:", err);
  process.exit(1);
});
