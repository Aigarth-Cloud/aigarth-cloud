/**
 * Decisions — Phase 18D.
 *
 * The runtime that combines multiple ANN envelopes into a single
 * tissue-level decision. This is the file that turns the
 * `@aigarth/trinary` consensus algebra into a working runtime.
 *
 * Flow:
 *   1. Load the tissue + its active members
 *   2. Validate the tissue is active and has at least one member
 *   3. (Phase 18E) check access — owner always, "open" always,
 *      "licensed" requires an explicit grant
 *   4. Call each member's ANN service /decide endpoint IN PARALLEL,
 *      with a per-call timeout (TISSUE_DECISION_TIMEOUT_MS)
 *   5. For each successful response, build a ScoredEnvelope
 *   6. Run `combine(policy, scoredEnvelopes)` from @aigarth/trinary
 *   7. Build a tissue-level IntentEnvelope (ann_id = tissue.id,
 *      signed with TISSUE_SIGNING_KEY)
 *   8. Persist to tissue_decisions (append-only)
 *   9. Bump the tissue's total_decisions counter
 *  10. (Phase 18E) Fire billing + marketplace hooks (best-effort)
 *  11. Audit-log the call
 *  12. Return the envelope + contributors + ignored
 *
 * Degradation: a member that fails (ANN not found, not in
 * trinary mode, timed out, network error) is recorded in
 * `ignored` and excluded from the consensus computation. If
 * ALL members fail, the decision throws AllMembersFailedError
 * and the caller returns 502.
 */

import { eq, and, desc, lt } from "drizzle-orm";
import { z } from "zod";
import {
  blankEnvelope,
  signEnvelope,
  combine,
  ConsensusPolicySchema,
  IntentEnvelopeSchema,
  type IntentEnvelope,
  type ConsensusPolicy,
  type Reversibility,
  type TimeHorizon,
  type ScoredEnvelope,
  type TissueRole,
  type SignalRef,
} from "@aigarth/trinary";
import { getDb } from "../db/index.js";
import {
  tissues,
  tissueMembers,
  tissueDecisions,
  type TissueMember,
} from "../db/schema.js";
import { uid } from "../lib/ids.js";
import { logActivity, auditAction } from "../lib/audit.js";
import { loadConfig } from "../config/index.js";
import {
  callAnnDecide,
  buildAnnInput,
  type AnnCallResult,
} from "./annClient.js";
import {
  getTissue,
  getActiveMembers,
  TissueNotFoundError,
  TissueNotActiveError,
  TissueNoMembersError,
} from "./tissues.js";
import { checkAccess } from "./licenses.js";
import { reportTissueUsage, reportMarketplaceDecision } from "./billingHook.js";

// ---------- Schemas ----------

export const DecideRequestSchema = z.object({
  request_id: z.string().min(1).max(120).optional(),
  /**
   * Phase 18E — optional. The marketplace listing id (uuid)
   * that this call is being made through. If provided, the
   * call is attributed to that listing for revenue and
   * counter purposes.
   */
  tissue_listing_id: z.string().uuid().optional(),
  /**
   * Phase 18E — optional. The per-decision cost in QUBIC.
   * Defaults to 0 for open / unlisted calls; marketplaces set
   * their own price.
   */
  cost_qubic: z.string().regex(/^\d+$/).default("0"),
  input: z.record(z.unknown()).default({}),
  reversibility: z.enum(["irreversible", "soft", "advisory"]).optional(),
  time_horizon: z.enum(["immediate", "session", "persistent"]).optional(),
});
export type DecideRequest = z.infer<typeof DecideRequestSchema>;

export const ListDecisionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  before: z.string().datetime({ offset: true }).optional(),
  state: z.union([z.literal(-1), z.literal(0), z.literal(1)]).optional(),
});

// ---------- Errors ----------

export class AllMembersFailedError extends Error {
  constructor(public readonly ignored: Array<{ ann_slug: string; reason: string }>) {
    super(`All ${ignored.length} tissue member(s) failed. No consensus could be reached.`);
    this.name = "AllMembersFailedError";
  }
}

export class TissueAccessDeniedError extends Error {
  constructor(
    public readonly reason: "tissue_inactive" | "needs_license",
    public readonly tissueSlug: string,
  ) {
    super(
      reason === "tissue_inactive"
        ? `Tissue ${tissueSlug} is not active.`
        : `Tissue ${tissueSlug} is licensed and you do not have a valid grant.`,
    );
    this.name = "TissueAccessDeniedError";
  }
}

// ---------- Contributor / ignored shapes ----------

export interface ContributorRecord {
  ann_slug: string;
  ann_id: string;
  ann_version: string;
  state: -1 | 0 | 1;
  confidence: number;
  authority: number;
  signature: string;
  decision_id: string;
  latency_ms: number;
  role: TissueRole;
}

export interface IgnoredRecord {
  ann_slug: string;
  reason: string;
  latency_ms?: number;
}

// ---------- The /decide flow ----------

export interface DecideResult {
  decision_id: string;
  envelope: IntentEnvelope;
  contributors: ContributorRecord[];
  ignored: IgnoredRecord[];
  tissue: { id: string; slug: string; name: string; version: string };
  total_latency_ms: number;
  policy: ConsensusPolicy["kind"];
}

export async function decideTissue(
  idOrSlug: string,
  callerUserId: string | null,
  callerOrgId: string | null,
  userBearerToken: string,
  request: DecideRequest,
): Promise<DecideResult> {
  const t0 = Date.now();

  const tissue = await getTissue(idOrSlug);
  if (!tissue) throw new TissueNotFoundError(idOrSlug);
  if (tissue.status !== "active") {
    throw new TissueNotActiveError(tissue.id, tissue.status);
  }

  // Phase 18E — access control (owner, open, or licensed)
  if (callerUserId) {
    const access = await checkAccess(
      {
        id: tissue.id,
        ownerUserId: tissue.ownerUserId,
        access: tissue.access,
        status: tissue.status,
      },
      callerUserId,
    );
    if (!access.allowed) {
      // access.reason is only "needs_license" or "tissue_inactive" here
      // (owner / open / license → allowed=true; we already returned).
      const deniedReason: "needs_license" | "tissue_inactive" =
        access.reason === "tissue_inactive" ? "tissue_inactive" : "needs_license";
      throw new TissueAccessDeniedError(deniedReason, tissue.slug);
    }
  }

  const members = await getActiveMembers(tissue.id);
  if (members.length === 0) throw new TissueNoMembersError(tissue.id);

  // Fan out — every member called in parallel with the same input
  // context. The userBearerToken is forwarded so the ANN service
  // can attribute the decision.
  const annBody = buildAnnInput(request.input, {
    request_id: request.request_id,
    reversibility: request.reversibility,
    time_horizon: request.time_horizon,
  });

  const fanout = await Promise.all(
    members.map(async (m): Promise<{ member: TissueMember; result: AnnCallResult }> => {
      const result = await callAnnDecide(m.annSlug, userBearerToken, annBody);
      return { member: m, result };
    }),
  );

  // Split the fanout into contributors and ignored
  const contributors: Array<{ member: TissueMember; envelope: IntentEnvelope; latencyMs: number; decisionId: string }> = [];
  const ignored: IgnoredRecord[] = [];

  for (const { member, result } of fanout) {
    if (result.ok) {
      // Re-validate the envelope through the schema as a sanity check
      const parsed = IntentEnvelopeSchema.safeParse(result.response.envelope);
      if (parsed.success) {
        contributors.push({
          member,
          envelope: parsed.data,
          latencyMs: result.latencyMs,
          decisionId: result.response.decision_id,
        });
        continue;
      }
      ignored.push({
        ann_slug: member.annSlug,
        reason: `envelope failed schema validation: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
        latency_ms: result.latencyMs,
      });
    } else {
      ignored.push({
        ann_slug: member.annSlug,
        reason: result.reason,
        latency_ms: result.latencyMs,
      });
    }
  }

  if (contributors.length === 0) {
    throw new AllMembersFailedError(ignored);
  }

  // Build the scored envelopes for combine()
  const scoredEnvelopes: ScoredEnvelope[] = contributors.map(({ member, envelope }) => ({
    envelope,
    member: {
      ann_id: member.annSlug,
      authority: parseFloat(member.authorityWeight),
      role: member.role as TissueRole,
    },
  }));

  // Parse + run the consensus policy
  const policy = ConsensusPolicySchema.parse(tissue.policy as ConsensusPolicy);
  const combined = combine(policy, scoredEnvelopes);

  // Build the tissue-level envelope. The ann_id and ann_version
  // fields reuse the tissue's identity so a tissue's output is
  // indistinguishable from an ANN's output to downstream consumers.
  const contributorRecords: ContributorRecord[] = contributors.map(
    ({ member, envelope, latencyMs, decisionId }) => ({
      ann_slug: member.annSlug,
      ann_id: envelope.ann_id,
      ann_version: envelope.ann_version,
      state: envelope.state,
      confidence: envelope.confidence,
      authority: envelope.authority,
      signature: envelope.signature,
      decision_id: decisionId,
      latency_ms: latencyMs,
      role: member.role as TissueRole,
    }),
  );

  // Derive the most conservative reversibility + time_horizon
  // across the contributors. "Most conservative" means most
  // sticky / most non-undoable / most long-lived.
  const reversibility = maxReversibility(contributors.map((c) => c.envelope.reversibility));
  const timeHorizon = maxTimeHorizon(contributors.map((c) => c.envelope.time_horizon));

  // Flatten supporting signals from all contributors, deduped
  // by (source, id) and capped at 64.
  const signalMap = new Map<string, SignalRef>();
  for (const c of contributors) {
    for (const s of c.envelope.supporting_signals) {
      const key = `${s.source}::${s.id}`;
      if (!signalMap.has(key)) signalMap.set(key, s);
      if (signalMap.size >= 64) break;
    }
    if (signalMap.size >= 64) break;
  }

  // Latest expires_at among contributors, if any
  const expiresAt = contributors
    .map((c) => c.envelope.expires_at)
    .filter((e): e is string => typeof e === "string")
    .sort()
    .pop();

  // Use blankEnvelope as a typed factory, then sign
  // The tissue's authority is derived from the contributors: we
  // take the max (the most conservative / least surprising
  // number). The tissue-level operator can also override this
  // via the tissue's authority_weight field, but for v1 we use
  // max-of-contributors to keep the protocol symmetric.
  const tissueAuthority = contributors.reduce(
    (acc, c) => Math.max(acc, c.envelope.authority),
    0,
  );

  const unsigned = blankEnvelope({
    ann_id: tissue.id,
    ann_version: tissue.version,
    state: combined.state,
    confidence: combined.confidence,
    authority: tissueAuthority,
    reasoning: `Tissue ${tissue.name} (${tissue.slug}@${tissue.version}, ${policy.kind}): ${combined.reasoning}`,
    recommended_action: recommendedActionFor(combined.state),
    supporting_signals: Array.from(signalMap.values()),
    required_future_signals: [],
    reversibility,
    time_horizon: timeHorizon,
  });

  const cfg = loadConfig();
  const signed: IntentEnvelope = {
    ...unsigned,
    signature: signEnvelope(unsigned, cfg.TISSUE_SIGNING_KEY),
    ...(expiresAt ? { expires_at: expiresAt } : {}),
  };

  // Persist (append-only)
  const decisionId = uid();
  const db = getDb();
  await db.insert(tissueDecisions).values({
    id: decisionId,
    tissueId: tissue.id,
    tissueVersion: tissue.version,
    requestId: request.request_id ?? "",
    callerUserId,
    callerOrgId,
    state: signed.state,
    confidence: signed.confidence.toString(),
    authority: signed.authority.toString(),
    reasoning: signed.reasoning,
    reversibility: signed.reversibility,
    timeHorizon: signed.time_horizon,
    contributors: contributorRecords as unknown as Array<Record<string, unknown>>,
    ignored: ignored as unknown as Array<Record<string, unknown>>,
    envelope: signed as unknown as Record<string, unknown>,
    signature: signed.signature,
    issuedAt: new Date(signed.issued_at),
    expiresAt: signed.expires_at ? new Date(signed.expires_at) : null,
    latencyMs: Date.now() - t0,
  });

  // Bump the tissue's denormalized call counter
  await db
    .update(tissues)
    .set({
      totalDecisions: (tissue.totalDecisions + 1n) as unknown as bigint,
      updatedAt: new Date(),
    })
    .where(eq(tissues.id, tissue.id));

  await logActivity(db, {
    action: auditAction.decisionEmitted,
    actorUserId: callerUserId,
    orgId: callerOrgId,
    targetType: "tissue_decision",
    targetId: decisionId,
    metadata: {
      tissueId: tissue.id,
      state: signed.state,
      confidence: signed.confidence,
      contributors_count: contributors.length,
      ignored_count: ignored.length,
      policy: policy.kind,
      access: tissue.access,
      tissue_listing_id: request.tissue_listing_id ?? null,
      cost_qubic: request.cost_qubic,
    },
  });

  // Phase 18E — fire billing + marketplace hooks (best-effort,
  // non-blocking). Failures are logged in the hook itself.
  const costQubic = request.cost_qubic;
  if (callerUserId) {
    void reportTissueUsage({
      userId: callerUserId,
      orgId: callerOrgId ?? undefined,
      tissueSlug: tissue.slug,
      tissueVersion: tissue.version,
      tissueListingId: request.tissue_listing_id,
      state: signed.state,
      costQubic,
      requestId: request.request_id ?? decisionId,
    });
  }
  if (request.tissue_listing_id) {
    void reportMarketplaceDecision({
      listingId: request.tissue_listing_id,
      revenueQubic: costQubic,
    });
  }

  return {
    decision_id: decisionId,
    envelope: signed,
    contributors: contributorRecords,
    ignored,
    tissue: {
      id: tissue.id,
      slug: tissue.slug,
      name: tissue.name,
      version: tissue.version,
    },
    total_latency_ms: Date.now() - t0,
    policy: policy.kind,
  };
}

// ---------- The /decisions list flow ----------

export interface DecisionListRow {
  id: string;
  tissue_id: string;
  tissue_version: string;
  request_id: string;
  state: -1 | 0 | 1;
  confidence: string;
  authority: string;
  reasoning: string;
  reversibility: Reversibility;
  time_horizon: TimeHorizon;
  signature: string;
  issued_at: string;
  expires_at: string | null;
  latency_ms: number;
  created_at: string;
}

export async function listDecisions(
  idOrSlug: string,
  query: z.infer<typeof ListDecisionsQuerySchema>,
): Promise<{ data: DecisionListRow[]; next_cursor: string | null; has_more: boolean }> {
  const tissue = await getTissue(idOrSlug);
  if (!tissue) throw new TissueNotFoundError(idOrSlug);

  const conditions = [eq(tissueDecisions.tissueId, tissue.id)];
  if (query.before) conditions.push(lt(tissueDecisions.createdAt, new Date(query.before)));
  if (query.state !== undefined) conditions.push(eq(tissueDecisions.state, query.state));

  const db = getDb();
  const rows = await db
    .select()
    .from(tissueDecisions)
    .where(and(...conditions))
    .orderBy(desc(tissueDecisions.createdAt))
    .limit(query.limit + 1);

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1]!.createdAt.toISOString() : null;

  const data: DecisionListRow[] = page.map((r) => ({
    id: r.id,
    tissue_id: r.tissueId,
    tissue_version: r.tissueVersion,
    request_id: r.requestId,
    state: r.state as -1 | 0 | 1,
    confidence: r.confidence,
    authority: r.authority,
    reasoning: r.reasoning,
    reversibility: r.reversibility as Reversibility,
    time_horizon: r.timeHorizon as TimeHorizon,
    signature: r.signature,
    issued_at: r.issuedAt.toISOString(),
    expires_at: r.expiresAt?.toISOString() ?? null,
    latency_ms: r.latencyMs,
    created_at: r.createdAt.toISOString(),
  }));

  return { data, next_cursor: nextCursor, has_more: hasMore };
}

// ---------- Helpers ----------

/** "Most conservative" reversibility. irreversible > soft > advisory. */
export function maxReversibility(values: Reversibility[]): Reversibility {
  const rank: Record<Reversibility, number> = { advisory: 0, soft: 1, irreversible: 2 };
  let best: Reversibility = "advisory";
  for (const v of values) {
    if (rank[v] > rank[best]) best = v;
  }
  return best;
}

/** "Most conservative" time horizon. persistent > session > immediate. */
export function maxTimeHorizon(values: TimeHorizon[]): TimeHorizon {
  const rank: Record<TimeHorizon, number> = { immediate: 0, session: 1, persistent: 2 };
  let best: TimeHorizon = "immediate";
  for (const v of values) {
    if (rank[v] > rank[best]) best = v;
  }
  return best;
}

/** Map a trinary state to a recommended-action verb. */
export function recommendedActionFor(state: -1 | 0 | 1): string {
  return state === 1 ? "proceed" : state === -1 ? "block" : "continue_observing";
}

// Re-export for callers that need the schema
export { ConsensusPolicySchema, IntentEnvelopeSchema } from "@aigarth/trinary";
