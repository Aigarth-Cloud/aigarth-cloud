/**
 * Worker manifest — Zod schemas.
 *
 * Per ADR 006 §4 and PEP v0.2 §12
 * (aigarth-cloud-evolution-pep-v0.2.md:395-413).
 */

import { z } from "zod";
import { WorkerIdSchema } from "./work-item.js";

// Re-export so other modules can import the id regex from the
// single source of truth (../types/work-item.ts).
export { WorkerIdSchema } from "./work-item.js";

export const RegisterWorkerSchema = z
  .object({
    kind: z.enum(["local", "remote", "oc-processor", "neuraxon", "human-via-oracle"]),
    capabilities: z.object({
      cpu_cores: z.coerce.number().int().min(1).max(1024),
      memory_gb: z.coerce.number().int().min(1).max(1024),
      gpu: z.enum(["none", "rtx_4090", "h100", "any"]).default("none"),
      algorithms: z.array(z.string().min(1).max(120)).min(1).max(64),
      runtime: z.enum(["docker", "wasm", "native"]).default("docker"),
      location: z.string().min(1).max(120).default("local"),
      reputation: z.number().min(0).max(1).default(0.5),
      disputes: z.coerce.number().int().min(0).default(0),
    }),
  })
  .superRefine((v, ctx) => {
    // ADR 006 §4 invariant 2: only `local` is allowed in v1.
    if (v.kind !== "local") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `worker kind '${v.kind}' is not yet available in v1 (only 'local')`,
        path: ["kind"],
      });
    }
  });

export type RegisterWorkerInput = z.infer<typeof RegisterWorkerSchema>;

export const HeartbeatSchema = z.object({
  worker_id: WorkerIdSchema,
});

export type HeartbeatInput = z.infer<typeof HeartbeatSchema>;

export const ListWorkersQuerySchema = z.object({
  status: z.enum(["active", "suspended", "offline"]).optional(),
  kind: z.enum(["local", "remote", "oc-processor", "neuraxon", "human-via-oracle"]).optional(),
  location: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListWorkersQuery = z.infer<typeof ListWorkersQuerySchema>;

export const WorkerIdParamSchema = z.object({
  worker_id: WorkerIdSchema,
});

export const BatchSubmitResultSchema = z.object({
  results: z
    .array(
      z.object({
        work_id: z.string().regex(/^wki_[0-9A-HJKMNP-TV-Z]{26}$/),
        payload_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
        signature: z.string().min(1).max(2048),
      }),
    )
    .min(1)
    .max(50),
});

export type BatchSubmitResultInput = z.infer<typeof BatchSubmitResultSchema>;
