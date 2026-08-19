/**
 * Smoke test: @aigarth/sdk → gateway round-trip.
 *
 * Uses the SDK to list models, send a chat completion, and stream
 * a chat completion. Verifies the SDK works against the real gateway.
 */

import { Aigarth } from "@aigarth/sdk";

async function main() {
  const GATEWAY = process.env["GATEWAY_URL"] ?? "http://localhost:7004";
  // We need a JWT or API key. The simplest path: get a user from the
  // identity service, log in, get the JWT, then call.
  const IDENTITY = process.env["IDENTITY_URL"] ?? "http://localhost:7001";

  const email = `sdk-smoke-${Date.now()}@example.com`;
  const password = "Correct-Horse-Battery-Staple-42";
  await fetch(`${IDENTITY}/v1/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name: "SDK Smoke" }),
  });
  const loginRes = await fetch(`${IDENTITY}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const { access_token } = (await loginRes.json()) as { access_token: string };

  const client = new Aigarth({ apiKey: access_token, baseURL: `${GATEWAY}/v1` });

  // 1. List models
  const models = await client.models.list();
  console.log(`SDK listed ${models.data.length} models via gateway`);

  // 2. Chat completion (sync)
  const completion = await client.chat.create({
    model: "aigarth-meridian-1",
    messages: [{ role: "user", content: "Hi from the SDK" }],
  });
  console.log(
    `SDK chat: ${completion.choices[0]?.message?.content?.slice(0, 60)}… (${completion.usage?.total_tokens} tokens)`,
  );

  // 3. Chat completion (stream)
  const stream = await client.chat.create({
    model: "aigarth-meridian-1",
    messages: [{ role: "user", content: "Stream test from SDK" }],
    stream: true,
  });
  let streamed = "";
  for await (const chunk of stream) {
    streamed += chunk.choices[0]?.delta?.content ?? "";
  }
  console.log(`SDK stream: ${streamed.slice(0, 60)}…`);

  // 4. Embeddings
  const embed = await client.embeddings.create({
    model: "aigarth-embed-1",
    input: "test from SDK",
  });
  console.log(`SDK embed: ${embed.data[0]?.embedding?.length}-dim vector`);

  console.log("✅ SDK → gateway round-trip works");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
