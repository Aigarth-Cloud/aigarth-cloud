/**
 * Stub backends for the gateway.
 *
 * Deterministic, in-memory. The wire shape is OpenAI-compatible so
 * the @aigarth/sdk can consume it without changes.
 *
 * In production, replace with calls to real model providers (OpenAI,
 * Anthropic, local LLMs, etc.) — only this module needs to change.
 */

import { createHash } from "node:crypto";

/**
 * Deterministic chat completion.
 *
 * Generates a fixed-length response based on the input hash. The
 * response always includes a clear "stub" marker so callers can
 * tell in tests/dev.
 */
export function stubChatCompletion(input: {
  messages: Array<{ role: string; content: string }>;
  model: string;
  n?: number;
  maxTokens?: number;
}): {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: "assistant"; content: string };
    finish_reason: "stop";
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
} {
  const lastUser = [...input.messages].reverse().find((m) => m.role === "user");
  const userText = typeof lastUser?.content === "string" ? lastUser.content : "(no user message)";
  const seed = createHash("sha256")
    .update(`${input.model}:${userText}`)
    .digest("hex");
  // Deterministic "response" — short, with a hash signature
  const stubText = `This is a stub response from ${input.model}. You said: "${truncate(userText, 120)}". [stub:${seed.slice(0, 8)}]`;

  const completionTokens = Math.max(1, Math.ceil(stubText.length / 4));
  const promptTokens = input.messages.reduce(
    (sum, m) => sum + Math.max(1, Math.ceil((typeof m.content === "string" ? m.content.length : 0) / 4)) + 4,
    2,
  );

  const n = input.n ?? 1;
  const choices = Array.from({ length: n }, (_, i) => ({
    index: i,
    message: { role: "assistant" as const, content: i === 0 ? stubText : `${stubText} (choice ${i})` },
    finish_reason: "stop" as const,
  }));

  return {
    id: `chatcmpl-${seed.slice(0, 24)}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: input.model,
    choices,
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens * n,
      total_tokens: promptTokens + completionTokens * n,
    },
  };
}

/**
 * Stream a chat completion chunk by chunk. Yields each chunk.
 */
export async function* stubChatStream(input: {
  messages: Array<{ role: string; content: string }>;
  model: string;
}): AsyncGenerator<{
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: { role?: "assistant"; content?: string };
    finish_reason: string | null;
  }>;
}> {
  const lastUser = [...input.messages].reverse().find((m) => m.role === "user");
  const userText = typeof lastUser?.content === "string" ? lastUser.content : "(no user message)";
  const seed = createHash("sha256")
    .update(`${input.model}:${userText}`)
    .digest("hex");
  const id = `chatcmpl-${seed.slice(0, 24)}`;
  const created = Math.floor(Date.now() / 1000);

  const fullText = `This is a stub response from ${input.model}. You said: "${truncate(userText, 120)}". [stub:${seed.slice(0, 8)}]`;

  // First chunk: role
  yield {
    id,
    object: "chat.completion.chunk",
    created,
    model: input.model,
    choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
  };

  // Stream word by word
  const words = fullText.split(/(\s+)/); // keep whitespace
  for (const word of words) {
    if (!word) continue;
    await sleep(5); // tiny delay to feel like streaming
    yield {
      id,
      object: "chat.completion.chunk",
      created,
      model: input.model,
      choices: [{ index: 0, delta: { content: word }, finish_reason: null }],
    };
  }

  // Final chunk: finish reason
  yield {
    id,
    object: "chat.completion.chunk",
    created,
    model: input.model,
    choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
  };
}

/**
 * Deterministic embedding.
 *
 * Returns a 1536-dim vector derived from the input hash. Same input
 * always produces the same vector (reproducible).
 */
export function stubEmbedding(input: {
  input: string | string[];
  model: string;
  dimensions?: number;
}): {
  object: "list";
  data: Array<{ index: number; object: "embedding"; embedding: number[] }>;
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
} {
  const inputs = Array.isArray(input.input) ? input.input : [input.input];
  const data = inputs.map((text, index) => {
    const dim = input.dimensions ?? 1536;
    const vec = deterministicVector(text + ":" + input.model, dim);
    return { index, object: "embedding" as const, embedding: vec };
  });
  const promptTokens = inputs.reduce(
    (sum, t) => sum + Math.max(1, Math.ceil(t.length / 4)),
    0,
  );
  return {
    object: "list",
    data,
    model: input.model,
    usage: { prompt_tokens: promptTokens, total_tokens: promptTokens },
  };
}

/**
 * Deterministic image generation.
 *
 * Returns a placeholder URL. Real impl would call an image model
 * (DALL-E, Stable Diffusion, etc.) and either return the URL or
 * store the image in object storage and return a presigned URL.
 */
export function stubImageGeneration(input: {
  prompt: string;
  model: string;
  n?: number;
  size?: string;
}): {
  created: number;
  data: Array<{ url: string; revised_prompt?: string }>;
} {
  const n = input.n ?? 1;
  const size = input.size ?? "1024x1024";
  const seed = createHash("sha256").update(input.prompt + ":" + input.model).digest("hex");
  return {
    created: Math.floor(Date.now() / 1000),
    data: Array.from({ length: n }, (_, i) => ({
      url: `https://picsum.photos/seed/${seed.slice(0, 16)}${i}/${size.replace("x", "/")}`,
      revised_prompt: `Stub revised prompt: ${truncate(input.prompt, 200)}`,
    })),
  };
}

// ---------- Helpers ----------

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Build a deterministic unit vector of given dimension from a string. */
function deterministicVector(seed: string, dim: number): number[] {
  const vec: number[] = [];
  let h = seed;
  while (vec.length < dim) {
    h = createHash("sha256").update(h).digest("hex");
    // Each hex char pair = one byte; use 4 hex chars = one float in [0, 1)
    for (let i = 0; i < h.length && vec.length < dim; i += 4) {
      const n = parseInt(h.slice(i, i + 4), 16) / 0xffff; // [0, 1)
      vec.push(n * 2 - 1); // [-1, 1)
    }
  }
  // Normalize to unit length
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
  return vec.map((x) => x / norm);
}
