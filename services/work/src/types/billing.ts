/**
 * WorkUsageEvent — the single bridge from services/work to
 * services/billing.
 *
 * Mirrors TissueUsageEvent at
 * services/billing/src/services/tissueUsage.ts:24-35.
 *
 * Per ADR 006 §7. The accountant emits this event EXACTLY ONCE
 * per work item on `status = "verified"`. Disputed and failed
 * items do NOT bill.
 */

import { z } from "zod";

export const WorkUsageEventSchema = z.object({
  userId: z.string().min(1),
  orgId: z.string().min(1).optional(),
  workId: z.string().regex(/^wki_[0-9A-HJKMNP-TV-Z]{26}$/),
  workType: z.enum([
    "materials_simulation",
    "video_evaluation",
    "trinary_decision",
    "dft_relaxation",
    "awork_1",
  ]),
  algorithmVersion: z.string().regex(/^v\d+\.\d+\.\d+$/),
  costQubic: z.string().regex(/^\d+$/),
  replicas: z.coerce.number().int().min(1).max(5),
  verificationMethod: z.enum(["replication", "challenge", "deterministic"]),
  replicasAgreed: z.string().regex(/^\d+\/\d+$/),
  workerId: z.string().regex(/^wrk_[0-9A-HJKMNP-TV-Z]{26}$/),
  requestId: z.string().min(1).max(120),
  occurredAt: z.coerce.date().optional(),
});

export type WorkUsageEvent = z.infer<typeof WorkUsageEventSchema>;

/**
 * Compute the v1 cost for a work item.
 *
 *   base_cost + replicas * replica_cost
 *
 * Defaults: base 100 Qu-bit (0.0001 QUBIC), replica 50 Qu-bit.
 * Override via env in v2.
 */
export function estimateWorkCost(
  replicas: number,
  opts: { baseCostQubit?: number; replicaCostQubit?: number } = {},
): bigint {
  const base = BigInt(opts.baseCostQubit ?? 100);
  const replica = BigInt(opts.replicaCostQubit ?? 50);
  return base + replica * BigInt(replicas);
}
