/**
 * Trinary output parser (Phase 19C.3).
 *
 * The model is asked to return a single JSON object:
 *
 *   {
 *     "state": -1 | 0 | 1,
 *     "confidence": 0.0..1.0,
 *     "reasoning": "short string",
 *     "recommended_action": "optional short verb"
 *   }
 *
 * Real models don't always cooperate. This parser handles:
 *
 *   1. Pure JSON                          — {"state": 1, ...}
 *   2. JSON inside a ```json code fence   — ```json\n{...}\n```
 *   3. JSON embedded in free text         — "My answer: {...}"
 *   4. State as text ("+1", "no", "block") — best-effort fallback
 *
 * On any failure, `parseTrinaryOutput` throws `TrinaryParserError`.
 * Callers should catch and substitute a neutral envelope — never
 * let a model-output parsing failure block the caller.
 */

import type { TrinaryState } from "@aigarth/trinary";
import { TrinaryBackendError } from "./types.js";
import type { TrinaryOutput } from "./types.js";

export class TrinaryParserError extends TrinaryBackendError {
  constructor(message: string, cause?: unknown) {
    super(message, cause, "parser");
    this.name = "TrinaryParserError";
  }
}

/** Maximum allowed reasoning length — matches the envelope schema. */
const MAX_REASONING_LEN = 8000;
/** Maximum allowed recommended_action length. */
const MAX_VERB_LEN = 120;

/** Clamp a number into [min, max]. NaN / non-finite → fallback. */
function clampNumber(n: unknown, min: number, max: number, fallback: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/** Coerce a model-emitted state into a TrinaryState. */
function coerceState(v: unknown): TrinaryState | null {
  if (typeof v === "number") {
    if (v === 1 || v === 0 || v === -1) return v;
    // Sometimes models emit 0.7 intending +1, or -0.3 intending 0.
    if (v > 0.5) return 1;
    if (v < -0.5) return -1;
    return 0;
  }
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (t === "1" || t === "+1" || t === "true" || t === "yes" || t === "proceed" || t === "positive") return 1;
    if (t === "0" || t === "neutral" || t === "observe" || t === "continue") return 0;
    if (t === "-1" || t === "no" || t === "block" || t === "negative" || t === "false") return -1;
    // Sometimes models say "1.0" or "0.5"; treat like a number.
    const asNum = Number(t);
    if (Number.isFinite(asNum)) return coerceState(asNum);
  }
  return null;
}

/**
 * Try to extract a JSON object from a free-text model response.
 *
 * Order:
 *   1. The entire response parses as JSON
 *   2. A ```json ... ``` fenced block
 *   3. The first { ... } brace-balanced substring
 *   4. Fall through to a best-effort state-text match
 */
function extractJsonCandidate(raw: string): unknown {
  const text = raw.trim();
  if (!text) return null;

  // 1. Try the whole string
  try {
    return JSON.parse(text);
  } catch {
    // fall through
  }

  // 2. Try a ```json fence
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]!.trim());
    } catch {
      // fall through
    }
  }

  // 3. Find the first { and try to match a balanced substring
  const firstBrace = text.indexOf("{");
  if (firstBrace === -1) return null;
  let depth = 0;
  for (let i = firstBrace; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const candidate = text.slice(firstBrace, i + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Best-effort fallback when no JSON is found but the model emitted
 * a state word at the start of a sentence. Returns null if no
 * state-text can be identified.
 *
 * Heuristic: split the response into sentences and look for a
 * sentence whose first non-empty word is one of the state verbs.
 * This avoids false positives on normal English like "no signal".
 *
 * If no such leading state verb is found, we return null and the
 * caller throws — better to substitute a neutral envelope than to
 * guess wrong.
 */
function extractStateFromText(raw: string): TrinaryState | null {
  // Split on sentence boundaries (period, exclamation, question mark,
  // newline, or the word "then"). Each sentence is examined for its
  // first non-empty word.
  const sentences = raw
    .split(/(?<=[.!?\n])\s+|\s+then\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const sentence of sentences) {
    // First word, stripped of leading punctuation/quotes.
    const firstWordMatch = sentence.match(/^["'`(*\-\s]*([A-Za-z+\-0-9]+)/);
    if (!firstWordMatch) continue;
    const first = firstWordMatch[1]!.toLowerCase();

    if (first === "block" || first === "negative" || first === "refuse" || first === "reject" || first === "no") {
      return -1;
    }
    if (first === "proceed" || first === "positive" || first === "accept" || first === "approve" || first === "yes") {
      return 1;
    }
    if (first === "neutral" || first === "observe" || first === "continue" || first === "maybe" || first === "unclear") {
      return 0;
    }
    // "+1" or "-1" or "1" or "0" as the first token
    if (first === "+1" || first === "1") return 1;
    if (first === "-1") return -1;
    if (first === "0") return 0;
  }
  return null;
}

/**
 * Parse a raw model response into a `TrinaryOutput`.
 *
 * Throws `TrinaryParserError` on any failure. Callers should catch
 * and substitute a neutral envelope.
 */
export function parseTrinaryOutput(raw: string): TrinaryOutput {
  if (typeof raw !== "string") {
    throw new TrinaryParserError("parseTrinaryOutput: input is not a string", { raw });
  }

  let parsed: unknown = null;
  let parseError: unknown = null;
  try {
    parsed = extractJsonCandidate(raw);
  } catch (e) {
    parseError = e;
  }

  // If we got a non-object, fall through to text-extraction
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    const stateFromText = extractStateFromText(raw);
    if (stateFromText === null) {
      throw new TrinaryParserError("parseTrinaryOutput: no JSON object and no state text found", {
        raw: raw.slice(0, 200),
        parseError,
      });
    }
    return {
      state: stateFromText,
      confidence: 0.5,
      reasoning: truncate(raw, MAX_REASONING_LEN),
    };
  }

  const obj = parsed as Record<string, unknown>;

  const state = coerceState(obj.state);
  if (state === null) {
    throw new TrinaryParserError("parseTrinaryOutput: cannot coerce state", {
      state: obj.state,
      raw: raw.slice(0, 200),
    });
  }

  const confidence = clampNumber(obj.confidence, 0, 1, 0.5);

  const reasoning = truncate(
    typeof obj.reasoning === "string" ? obj.reasoning : "",
    MAX_REASONING_LEN,
  );

  const recommended_action =
    typeof obj.recommended_action === "string" && obj.recommended_action.length > 0
      ? truncate(obj.recommended_action, MAX_VERB_LEN)
      : undefined;

  return { state, confidence, reasoning, recommended_action };
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max);
}
