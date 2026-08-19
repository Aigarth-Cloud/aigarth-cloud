/**
 * Trinary decisions — Phase 18B + Phase 19C.3.
 *
 * The `decideAnn` flow is the bridge between the existing ANN registry
 * and the new `@aigarth/trinary` protocol. Given an ANN and a request
 * context, it:
 *
 *  1. Loads the ANN + its latest version
 *  2. Refuses the call if the ANN is not in `trinary` or `hybrid` mode
 *  3. Invokes the configured `TrinaryBackend` to produce a real
 *     state / confidence / reasoning triple (or the deterministic
 *     hash stub if `ANN_LLM_BACKEND=stub`). Backend failures fall
 *     back to a neutral `state=0` envelope — we never block the
 *     caller on a model outage.
 *  4. Builds an IntentEnvelope with the backend output
 *  5. Signs the envelope with the service's signing key
 *  6. Persists the decision to `ann_decisions` (append-only)
 *  7. Returns the signed envelope to the caller
 *
 * `listDecisions` paginates the decision log for an ANN, with an
 * optional flag to re-verify signatures against the stored envelope.
 *
 * See ADR 003 — Trinary Protocol v1 — for the full protocol.
 */

import { createHash, randomBytes } from "node:crypto";
import { desc, eq, lt, and, sql } from "drizzle-orm";
import { z } from "zod";
import {
  blankEnvelope,
  signEnvelope,
  verifyEnvelope,
  TRINARY_STATES,
  type TrinaryState,
  type IntentEnvelope,
  type Reversibility,
  type TimeHorizon,
  type SignalRef,
} from "@aigarth/trinary";
import { getDb } from "../db/index.js";
import { anns, annDecisions, annVersions, type Ann, type AnnDecision, type AnnDecisionProtocol } from "../db/schema.js";
import { uid } from "../lib/ids.js";
import { logActivity, auditAction } from "../lib/audit.js";
import { loadConfig } from "../config/index.js";
import { getAnn } from "./anns.js";
import { pickServingDeployment, pickShadowDeployment } from "./versionRouter.js";
import { getTrinaryBackend } from "../backends/index.js";
import type { TrinaryBackend, TrinaryOutput } from "../backends/index.js";
import { TrinaryBackendError } from "../backends/index.js";

// ---------- Public schemas ----------

/** Input for the /decide endpoint. The `input` field is the caller's
 *  observation context (free-form, opaque to us). It will be hashed
 *  to produce a deterministic state in v1. */
export const DecideRequestSchema = z.object({
  /** Caller-supplied request id, for cross-service tracing. */
  request_id: z.string().min(1).max(120).optional(),
  /** The observation context. Free-form. */
  input: z.record(z.unknown()).default({}),
  /** Optional override of the ANN's default reversibility. */
  reversibility: z.enum(["irreversible", "soft", "advisory"]).optional(),
  /** Optional override of the ANN's default time horizon. */
  time_horizon: z.enum(["immediate", "session", "persistent"]).optional(),
  /** Optional pre-computed signals. The stub ignores them in v1. */
  supporting_signals: z
    .array(
      z.object({
        source: z.enum([
          "ann_decision",
          "event",
          "feature",
          "market",
          "user",
          "system",
          "external",
        ]),
        id: z.string().min(1).max(256),
        content_hash: z
          .string()
          .regex(/^[a-f0-9]{64}$/i)
          .optional(),
        label: z.string().min(1).max(120).optional(),
      }),
    )
    .max(64)
    .optional(),
});
export type DecideRequest = z.infer<typeof DecideRequestSchema>;

export const ListDecisionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  /** Cursor: pass the `created_at` of the last row from the previous page. */
  before: z.string().datetime({ offset: true }).optional(),
  /** Optional: only return decisions with this state. */
  state: z.union([z.literal(-1), z.literal(0), z.literal(1)]).optional(),
  /** When true, re-verify each envelope's signature against the
   *  configured signing key. Adds a `signature_valid` field to each
   *  row. Use sparingly — touches every row. */
  verify_signatures: z
    .union([z.boolean(), z.string(), z.number()])
    .transform((v) => v === true || v === "true" || v === 1 || v === "1")
    .default(false),
});
export type ListDecisionsQuery = z.infer<typeof ListDecisionsQuerySchema>;

/** Result type for the /decide endpoint. */
export interface DecideResult {
  decision_id: string;
  envelope: IntentEnvelope;
  persisted: true;
}

/** Result type for the /decisions list endpoint. */
export interface DecisionListRow {
  id: string;
  ann_id: string;
  ann_version: string;
  request_id: string;
  state: TrinaryState;
  confidence: string;
  authority: string;
  reasoning: string;
  recommended_action: string | null;
  reversibility: Reversibility;
  time_horizon: TimeHorizon;
  signature: string;
  issued_at: string;
  expires_at: string | null;
  created_at: string;
  /** Present only when `verify_signatures=true` was passed. */
  signature_valid?: boolean;
}

// ---------- Errors ----------

export class AnnNotFoundError extends Error {
  constructor(idOrSlug: string) {
    super(`ANN '${idOrSlug}' not found.`);
    this.name = "AnnNotFoundError";
  }
}

export class AnnNotTrinaryError extends Error {
  constructor(annId: string, protocol: AnnDecisionProtocol) {
    super(
      `ANN '${annId}' has decision_protocol='${protocol}', which does not emit trinary envelopes. ` +
        `Set decision_protocol to 'trinary' or 'hybrid' before calling /decide.`,
    );
    this.name = "AnnNotTrinaryError";
  }
}

export class AnnNoPublishedVersionError extends Error {
  constructor(annId: string) {
    super(
      `ANN '${annId}' has no published version. Publish a version before calling /decide.`,
    );
    this.name = "AnnNoPublishedVersionError";
  }
}

// ---------- The /decide flow ----------

/**
 * Build a signed IntentEnvelope for an ANN and persist it.
 *
 * Throws AnnNotFoundError / AnnNotTrinaryError / AnnNoPublishedVersionError
 * for predictable failure modes; the route layer maps these to 404 / 400.
 */
export async function decideAnn(
  idOrSlug: string,
  callerUserId: string | null,
  callerOrgId: string | null,
  request: DecideRequest,
): Promise<DecideResult> {
  const ann = await getAnn(idOrSlug);
  if (!ann) throw new AnnNotFoundError(idOrSlug);
  if (ann.decisionProtocol === "openai_chat") {
    throw new AnnNotTrinaryError(ann.id, ann.decisionProtocol);
  }

  const version = await getLatestPublishedVersion(ann.id);
  if (!version) throw new AnnNoPublishedVersionError(ann.id);

  const cfg = loadConfig();
  const requestId = request.request_id ?? newRequestId();
  const issuedAt = new Date();

  // Phase 19D.3 — if the ANN has `active`/`canary` deployments,
  // use the router to pick one by weight. Falls back to the ANN's
  // `currentVersionId` (legacy behavior) so an ANN with no formal
  // deployment still works.
  const serving = await pickServingDeployment(ann.id);
  const servedVersion = serving?.version ?? version;

  // Invoke the configured trinary backend. On any failure (timeout,
  // network error, parse error, missing template) we fall back to a
  // neutral envelope — the caller is never blocked on a model outage.
  const backendOutput = await invokeTrinaryBackendSafe({
    backend: getTrinaryBackend(),
    ann,
    annVersion: servedVersion.version,
    request,
  });

  // Build the unsigned envelope via the protocol's factory, then sign.
  const unsigned = blankEnvelope({
    ann_id: ann.id,
    ann_version: servedVersion.version,
    state: backendOutput.state,
    confidence: backendOutput.confidence,
    authority: numericOr(ann.authorityWeight, 0.5),
    reasoning: backendOutput.reasoning,
    recommended_action:
      backendOutput.recommended_action ?? defaultVerbForState(backendOutput.state),
    supporting_signals: request.supporting_signals ?? [],
    required_future_signals: [],
    reversibility: request.reversibility ?? defaultReversibility(ann.id),
    time_horizon: request.time_horizon ?? "session",
    issued_at: issuedAt.toISOString(),
  });

  // Sign with the service's signing key. v1 = single env-var key for all
  // ANNs. v2 introduces per-ANN keys (KMS / secrets manager).
  const signingKey = resolveSigningKey(cfg, ann.id);
  const signed: IntentEnvelope = {
    ...unsigned,
    signature: signEnvelope(unsigned, signingKey),
  };

  // Persist (append-only). We do NOT re-validate with the schema here —
  // `blankEnvelope` already returns a parsed IntentEnvelope.
  const decisionId = uid();
  const db = getDb();

  // Phase 19D.3 — optionally pick a shadow deployment. We run the
  // model against it (50/50 to keep noise down) and store the
  // shadow envelope alongside the served one.
  let shadowVersion: string | null = null;
  let shadowEnvelope: Record<string, unknown> | null = null;
  const shadow = await pickShadowDeployment(ann.id);
  if (shadow && shadow.version.id !== servedVersion.id) {
    const shadowOutput = await invokeTrinaryBackendSafe({
      backend: getTrinaryBackend(),
      ann,
      annVersion: shadow.version.version,
      request,
    });
    const shadowUnsigned = blankEnvelope({
      ann_id: ann.id,
      ann_version: shadow.version.version,
      state: shadowOutput.state,
      confidence: shadowOutput.confidence,
      authority: numericOr(ann.authorityWeight, 0.5),
      reasoning: shadowOutput.reasoning,
      recommended_action:
        shadowOutput.recommended_action ?? defaultVerbForState(shadowOutput.state),
      supporting_signals: request.supporting_signals ?? [],
      required_future_signals: [],
      reversibility: request.reversibility ?? defaultReversibility(ann.id),
      time_horizon: request.time_horizon ?? "session",
      issued_at: issuedAt.toISOString(),
    });
    const shadowKey = resolveSigningKey(cfg, ann.id);
    const shadowSigned: IntentEnvelope = {
      ...shadowUnsigned,
      signature: signEnvelope(shadowUnsigned, shadowKey),
    };
    shadowVersion = shadow.version.version;
    shadowEnvelope = shadowSigned as unknown as Record<string, unknown>;
  }

  await db.insert(annDecisions).values({
    id: decisionId,
    annId: ann.id,
    annVersion: servedVersion.version,
    requestId,
    callerUserId,
    callerOrgId,
    state: signed.state,
    confidence: signed.confidence.toString(),
    authority: signed.authority.toString(),
    reasoning: signed.reasoning,
    recommendedAction: signed.recommended_action ?? null,
    reversibility: signed.reversibility,
    timeHorizon: signed.time_horizon,
    envelope: signed as unknown as Record<string, unknown>,
    signature: signed.signature,
    issuedAt,
    expiresAt: signed.expires_at ? new Date(signed.expires_at) : null,
    shadowVersion,
    shadowEnvelope,
  });

  await logActivity(db, {
    action: auditAction.decisionEmitted,
    actorUserId: callerUserId,
    orgId: callerOrgId,
    targetType: "ann_decision",
    targetId: decisionId,
    metadata: {
      annId: ann.id,
      annVersion: servedVersion.version,
      state: signed.state,
      confidence: signed.confidence,
      requestId,
      servedDeploymentId: serving?.deployment.id ?? null,
      shadowVersion,
    },
  });

  return { decision_id: decisionId, envelope: signed, persisted: true };
}

// ---------- The /decisions list flow ----------

/**
 * Page through the decision log for an ANN.
 *
 * Pagination is cursor-based on `created_at` (descending). Use the
 * `created_at` of the last row as the next `before` value.
 */
export async function listDecisions(
  annIdOrSlug: string,
  query: ListDecisionsQuery,
): Promise<{ data: DecisionListRow[]; next_cursor: string | null; has_more: boolean }> {
  const ann = await getAnn(annIdOrSlug);
  if (!ann) throw new AnnNotFoundError(annIdOrSlug);

  const cfg = loadConfig();
  const conditions = [eq(annDecisions.annId, ann.id)];
  if (query.before) {
    conditions.push(lt(annDecisions.createdAt, new Date(query.before)));
  }
  if (query.state !== undefined) {
    conditions.push(eq(annDecisions.state, query.state));
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(annDecisions)
    .where(and(...conditions))
    .orderBy(desc(annDecisions.createdAt))
    .limit(query.limit + 1);

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1]!.createdAt.toISOString() : null;

  const data = page.map((r) => toListRow(r, query.verify_signatures ? resolveSigningKey(cfg, ann.id) : null));
  return { data, next_cursor: nextCursor, has_more: hasMore };
}

// ---------- Helpers ----------

async function getLatestPublishedVersion(annId: string): Promise<{ id: string; version: string } | null> {
  const db = getDb();
  const rows = await db
    .select({ id: annVersions.id, version: annVersions.version })
    .from(annVersions)
    .where(and(eq(annVersions.annId, annId), eq(annVersions.isLatest, true)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Invoke the configured trinary backend, with a defensive neutral
 * fallback. Never throws — if the backend fails for any reason
 * (timeout, network, parse, missing template), we return a neutral
 * `state=0, confidence=0.5` envelope so the caller is never blocked
 * on a model outage.
 */
async function invokeTrinaryBackendSafe(args: {
  backend: TrinaryBackend;
  ann: Ann;
  annVersion: string;
  request: DecideRequest;
}): Promise<TrinaryOutput> {
  const { backend, ann, annVersion, request } = args;
  const info = backend.info();

  // An ANN without a trinaryPromptTemplate cannot drive a real LLM
  // call — fall back to a neutral envelope. The dashboard should warn
  // the operator to set this field.
  if (!ann.trinaryPromptTemplate || ann.trinaryPromptTemplate.trim() === "") {
    return {
      state: 0,
      confidence: 0.5,
      reasoning: `ANN ${ann.id} has no trinary_prompt_template; returning neutral state via ${info.id} backend.`,
      recommended_action: "continue_observing",
    };
  }

  try {
    return await backend.invokeTrinary({
      systemPrompt: ann.trinaryPromptTemplate,
      input: request.input,
      annId: ann.id,
      annVersion,
      reversibility: request.reversibility,
      timeHorizon: request.time_horizon,
    });
  } catch (e) {
    const reason =
      e instanceof TrinaryBackendError
        ? e.message
        : (e as Error)?.message ?? String(e);
    return {
      state: 0,
      confidence: 0.5,
      reasoning: `Trinary backend ${info.id} (model=${info.model}) failed: ${reason}. Returning neutral state.`,
      recommended_action: "continue_observing",
    };
  }
}

/** Default verb for a state, when the backend did not provide one. */
function defaultVerbForState(state: -1 | 0 | 1): string {
  return state === 1 ? "proceed" : state === -1 ? "block" : "continue_observing";
}

/**
 * The signing key for an ANN. v1: a single env-var key for all ANNs.
 * v2: per-ANN keys stored in a secrets manager.
 */
function resolveSigningKey(
  cfg: ReturnType<typeof loadConfig>,
  _annId: string,
): string {
  return cfg.ANN_TRINARY_SIGNING_KEY;
}

function toListRow(row: AnnDecision, signingKey: string | null): DecisionListRow {
  const out: DecisionListRow = {
    id: row.id,
    ann_id: row.annId,
    ann_version: row.annVersion,
    request_id: row.requestId,
    state: row.state as TrinaryState,
    confidence: row.confidence,
    authority: row.authority,
    reasoning: row.reasoning,
    recommended_action: row.recommendedAction,
    reversibility: row.reversibility as Reversibility,
    time_horizon: row.timeHorizon as TimeHorizon,
    signature: row.signature,
    issued_at: row.issuedAt.toISOString(),
    expires_at: row.expiresAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
  };
  if (signingKey !== null) {
    // Re-verify the stored envelope against the signing key. The
    // envelope is stored as JSONB; round-trip it through the
    // schema to get the typed shape, then verify.
    const parsed = row.envelope as unknown as IntentEnvelope;
    out.signature_valid = verifyEnvelope(parsed, signingKey);
  }
  return out;
}

/** Re-export for callers that need the trinary tuple. */
export { TRINARY_STATES };

/** Re-export the Ann type for tests. */
export type { Ann };

// ---------- Internal helpers (exported for unit tests) ----------

/**
 * Deterministic trinary state from a hash of (ann_id, ann_version,
 * request_id, input). The hash is sha-256; the first nibble of the
 * digest maps to a state:
 *   - 0x0..0x5  → +1
 *   - 0x6..0xa  →  0
 *   - 0xb..0xf  → -1
 */
export function stubTrinaryState(
  annId: string,
  annVersion: string,
  requestId: string,
  input: Record<string, unknown>,
): TrinaryState {
  const h = createHash("sha256")
    .update(`${annId}@${annVersion}:${requestId}:${stableStringify(input)}`)
    .digest();
  const nibble = h[0]! & 0x0f;
  if (nibble <= 0x05) return 1;
  if (nibble <= 0x0a) return 0;
  return -1;
}

/** Deterministic confidence in [0.6, 0.99]. Higher hash nibble → higher confidence. */
export function stubConfidence(
  annId: string,
  annVersion: string,
  requestId: string,
  input: Record<string, unknown>,
): number {
  const h = createHash("sha256")
    .update(`conf:${annId}@${annVersion}:${requestId}:${stableStringify(input)}`)
    .digest();
  const nibble = h[1]! & 0x0f;
  return 0.6 + (nibble / 0x0f) * 0.39;
}

/** Stable JSON stringify with sorted keys. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        sorted[k] = (v as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return v;
  });
}

/** Stub reasoning text. */
export function stubReasoning(annId: string, input: Record<string, unknown>): string {
  const keys = Object.keys(input);
  if (keys.length === 0) {
    return `ANN ${annId} (stub): empty input context, returning neutral state`;
  }
  return `ANN ${annId} (stub): observed ${keys.length} input field(s) — ${keys.slice(0, 5).join(", ")}`;
}

/** Per-ANN default reversibility. Stable. */
export function defaultReversibility(annId: string): Reversibility {
  const h = createHash("sha256").update(`rev:${annId}`).digest();
  return h[0]! % 2 === 0 ? "soft" : "advisory";
}

/** Coerce a string-or-number to a finite number, with a fallback. */
export function numericOr(n: string | number | null | undefined, fallback: number): number {
  if (n === null || n === undefined) return fallback;
  const parsed = typeof n === "string" ? parseFloat(n) : n;
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

/** Generate a new request id. */
export function newRequestId(): string {
  return `req_${randomBytes(8).toString("hex")}`;
}
