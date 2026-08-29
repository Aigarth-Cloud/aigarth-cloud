/**
 * ANN manifest — the standard published identity for an ANN.
 *
 * Per the Phase 29 superprompt (§4 — ANN Artifact Standard) and the
 * aigarth-cloud-evolution-pep-v0.2 §17 (BPP-9000 packaging discipline,
 * aigarth-cloud-evolution-pep-v0.2.md:545-560). Every publishable ANN
 * is identified by the canonical hash of its manifest; two ANNs are the
 * "same version" iff they have the same `manifestHash`.
 *
 * The manifest is content-addressed, not location-addressed. The
 * `repository` and `commit` fields are *provenance* — the canonical
 * source — not the only place the ANN can be loaded from. Aigarth
 * stores the manifest hash and can re-fetch the artifact from any
 * source that publishes the same content.
 *
 * Conformance to v0.2 §17:
 *   - version is `v<semver>` (the 'v' prefix is mandatory)
 *   - modelHash is `sha256:<hex>` (lowercase, 64 hex chars)
 *   - input/output schemas are JSON-Schema-shaped objects (the
 *     `inputSchema` and `outputSchema` are free-form; the executor
 *     enforces them at run time)
 *
 * This is the **declarative** layer. The *inference function* lives
 * in the runtime adapter (see `services/ann/src/services/execution/
 * adapters/`). The manifest names the artifact; the adapter runs it.
 */

import { z } from "zod";
import { createHash } from "node:crypto";

/** A JSON-Schema-shaped input/output spec. v1 keeps the body opaque. */
export const SchemaShapeSchema = z
  .object({
    /** The JSON-Schema-style "type" hint: "object", "array", ... */
    type: z.string().min(1).max(40).optional(),
    /** Human-readable description. */
    description: z.string().max(2000).optional(),
    /** JSON-Schema "required" list. */
    required: z.array(z.string()).optional(),
    /** JSON-Schema "properties" object. */
    properties: z.record(z.unknown()).optional(),
  })
  .strict();

export const BenchmarkSpecSchema = z
  .object({
    /** e.g. "MMLU", "HumanEval", "Internal-Q-A". */
    name: z.string().min(1).max(120),
    /** Score in 0-100. */
    score: z.number().min(0).max(100),
    /** Hash of the dataset used, for reproducibility. */
    datasetHash: z.string().optional(),
    /** Optional metadata. */
    metadata: z.record(z.unknown()).optional(),
  })
  .strict();

export const AnnManifestSchema = z
  .object({
    /** The ANN id. Matches the registry slug. */
    id: z.string().min(1).max(120),
    /** Human-readable name. */
    name: z.string().min(1).max(200),
    /** Semver with mandatory 'v' prefix, e.g. "v1.0.0". */
    version: z.string().regex(/^v\d+\.\d+\.\d+$/, "version must match /^v\\d+\\.\\d+\\.\\d+$/"),
    /** Display name of the creator (denormalised for marketplace listings). */
    creator: z.string().min(1).max(200),
    /** Architecture tag, e.g. "mlp-3", "transformer-decoder", "deterministic-stub". */
    architecture: z.string().min(1).max(120),
    /** SHA-256 of the model weights / artifact. */
    modelHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    /** JSON-Schema-shaped input spec. */
    inputSchema: SchemaShapeSchema.default({ type: "object" }),
    /** JSON-Schema-shaped output spec. */
    outputSchema: SchemaShapeSchema.default({ type: "object" }),
    /** Optional benchmark result. */
    benchmark: BenchmarkSpecSchema.optional(),
    /** Optional GitHub (or any) repository URL. */
    repository: z.string().url().optional(),
    /** Optional 40-char git commit SHA. */
    commit: z
      .string()
      .regex(/^[a-f0-9]{40}$/, "commit must be a 40-char lowercase hex SHA")
      .optional(),
    /** SPDX license id. */
    license: z.string().max(80).optional(),
    /** Optional description (shown in marketplace listings). */
    description: z.string().max(2000).optional(),
  })
  .strict();

export type AnnManifest = z.infer<typeof AnnManifestSchema>;
export type SchemaShape = z.infer<typeof SchemaShapeSchema>;
export type BenchmarkSpec = z.infer<typeof BenchmarkSpecSchema>;

/**
 * Canonical JSON form: stable key order, no whitespace, sorted object
 * keys recursively. Two manifests with the same logical content
 * produce the same string regardless of how they were written.
 */
export function canonicalizeManifest(m: AnnManifest): string {
  return JSON.stringify(m, (_k, v) => {
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

/** SHA-256 of the canonicalised manifest. The version identity. */
export function manifestHash(m: AnnManifest): string {
  return `sha256:${createHash("sha256").update(canonicalizeManifest(m)).digest("hex")}`;
}

/** Build a complete version-identity record from a manifest. */
export function versionIdentity(m: AnnManifest): {
  annId: string;
  version: string;
  manifestHash: string;
} {
  return {
    annId: m.id,
    version: m.version,
    manifestHash: manifestHash(m),
  };
}

/**
 * Parse and validate a manifest. Throws on any Zod issue. The error
 * is structured so the caller can surface it to the API layer.
 */
export function parseAnnManifest(input: unknown): AnnManifest {
  const result = AnnManifestSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("; ");
    throw new ManifestValidationError(issues);
  }
  return result.data;
}

/** Thrown when a manifest fails Zod validation. */
export class ManifestValidationError extends Error {
  public override readonly name = "ManifestValidationError";
  constructor(message: string) {
    super(`Invalid ANN manifest: ${message}`);
  }
}

/** Build a default manifest, with overrides applied. */
export function buildManifest(overrides: Partial<AnnManifest> & Pick<AnnManifest, "id" | "name" | "version" | "creator">): AnnManifest {
  return AnnManifestSchema.parse({
    architecture: "deterministic-stub",
    modelHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    ...overrides,
  });
}
