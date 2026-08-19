/**
 * Work item envelope — Zod schemas.
 *
 * Per ADR 006 §3 and PEP v0.2 §11
 * (aigarth-cloud-evolution-pep-v0.2.md:345-380).
 *
 * The envelope is the single first-class work-item contract for
 * v1. Same shape for neural, materials, and video workloads;
 * only the algorithm and verification method differ.
 */

import { z } from "zod";

// ---------- ID / version shapes ----------

export const WorkIdSchema = z.string().regex(/^wki_[0-9A-HJKMNP-TV-Z]{26}$/);
export const WorkerIdSchema = z.string().regex(/^wrk_[0-9A-HJKMNP-TV-Z]{26}$/);
export const SemverSchema = z.string().regex(/^v\d+\.\d+\.\d+$/);

// ---------- Envelope sub-shapes ----------

export const InputSchema = z.object({
  payload_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  payload_uri: z.string().min(1).max(2048),
  payload_size_bytes: z.coerce.number().int().positive(),
});

export const AlgorithmSchema = z.object({
  name: z.string().min(1).max(120),
  version: SemverSchema,
  container: z.string().min(1).max(512),
  deterministic: z.boolean(),
});

export const RequirementsSchema = z.object({
  cpu_cores: z.coerce.number().int().min(1).max(256),
  memory_gb: z.coerce.number().int().min(1).max(1024),
  gpu: z.enum(["none", "optional", "required"]),
  gpu_kind: z.enum(["any", "rtx_4090", "h100"]).default("any"),
  estimated_runtime_s: z.coerce.number().int().min(1).max(86400),
});

export const VerificationSpecSchema = z
  .object({
    method: z.enum(["replication", "challenge", "deterministic", "tee", "zk"]),
    replicas: z.coerce.number().int().min(1).max(5).default(3),
    challenge_work_id: z.string().nullable().optional(),
  })
  .superRefine((v, ctx) => {
    // ADR 006 §3 invariant 2: replication requires replicas >= 2.
    if (v.method === "replication" && v.replicas < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "replication requires replicas >= 2",
        path: ["replicas"],
      });
    }
  });

export const RewardSchema = z.object({
  currency: z.enum(["QUBIC"]).default("QUBIC"),
  /** 1M Qu-bit = 0.001 QUBIC. */
  amount: z.coerce.bigint().min(BigInt(0)),
  payer: z.string().min(1).max(120),
});

// ---------- Submit input (user-facing) ----------

export const SubmitWorkItemSchema = z
  .object({
    type: z.string().min(1).max(120),
    spec_version: z.coerce.number().int().min(1).default(1),
    input: InputSchema,
    algorithm: AlgorithmSchema,
    requirements: RequirementsSchema.default({
      cpu_cores: 1,
      memory_gb: 1,
      gpu: "none",
      gpu_kind: "any",
      estimated_runtime_s: 60,
    }),
    verification: VerificationSpecSchema,
    reward: RewardSchema,
  })
  .strict()
  .superRefine((v, ctx) => {
    // ADR 006 §3 invariant 1: deterministic method requires
    // deterministic algorithm.
    if (v.verification.method === "deterministic" && !v.algorithm.deterministic) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "verification.method = 'deterministic' requires algorithm.deterministic = true",
        path: ["verification", "method"],
      });
    }
    // ADR 006 §10 negative consequence 2: reservationId is not a
    // valid field for work items.
    if ("reservationId" in (v as Record<string, unknown>)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "reservationId is not a valid field for work items; use reward.payer",
        path: [],
      });
    }
  });

export type SubmitWorkItemInput = z.infer<typeof SubmitWorkItemSchema>;

// ---------- Result submission (worker-facing) ----------

export const SubmitWorkResultSchema = z.object({
  payload_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  signature: z.string().min(1).max(2048),
});

export type SubmitWorkResultInput = z.infer<typeof SubmitWorkResultSchema>;

// ---------- List / filter ----------

export const ListWorkItemsQuerySchema = z.object({
  status: z.enum(["queued", "running", "verified", "failed", "disputed"]).optional(),
  type: z.string().max(120).optional(),
  payer: z.string().max(120).optional(),
  since: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListWorkItemsQuery = z.infer<typeof ListWorkItemsQuerySchema>;

// ---------- Dispute ----------

export const DisputeWorkItemSchema = z.object({
  reason: z.string().min(1).max(2_000),
});

export type DisputeWorkItemInput = z.infer<typeof DisputeWorkItemSchema>;
