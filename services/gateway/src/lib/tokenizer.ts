/**
 * Token estimation helpers (stub mode).
 *
 * Real impl would use a proper BPE tokenizer (tiktoken, etc.). For the
 * stub, we estimate: 1 token ≈ 4 characters of English text, with a
 * per-message overhead for role + formatting.
 *
 * This is good enough for billing and rate limiting; the actual LLM
 * provider will return its own `usage` for real accounting.
 */

import { loadConfig } from "../config/index.js";

export function estimateTokens(text: string): number {
  if (!text) return 0;
  const cfg = loadConfig();
  // 1 token per ~4 chars, minimum 1
  return Math.max(1, Math.ceil(text.length / cfg.GATEWAY_AVG_CHARS_PER_TOKEN));
}

export function estimateMessagesTokens(
  messages: Array<{ role: string; content: string | unknown }>,
): number {
  let total = 0;
  for (const m of messages) {
    // 4 tokens per message for role + formatting overhead
    total += 4;
    if (typeof m.content === "string") {
      total += estimateTokens(m.content);
    } else {
      // For non-string content, estimate JSON size
      total += estimateTokens(JSON.stringify(m.content));
    }
  }
  // 2 tokens for the assistant priming
  return total + 2;
}
