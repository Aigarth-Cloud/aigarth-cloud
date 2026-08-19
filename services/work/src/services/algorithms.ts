/**
 * Algorithm registry (Task 10 — awork_1 + TireMind).
 *
 * Per ADR 006 §10 and PEP v0.2 §33 Task 10
 * (aigarth-cloud-evolution-pep-v0.2.md:1241-1252).
 *
 * The first registered algorithm is `awork_1` — a deterministic
 * numerical benchmark. TireMind is documented (companion doc
 * `docs/proposals/tiremind-001.md`) but the runtime registration
 * is for awork_1 only.
 */

import { eq, and } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { workAlgorithms, type WorkAlgorithm } from "../db/schema.js";
import { uid } from "../lib/ids.js";
import { logActivity, auditAction } from "../lib/audit.js";
import {
  RegisterAlgorithmSchema,
  signAlgorithm,
  type RegisterAlgorithmInput,
} from "../types/algorithm.js";
import { loadConfig } from "../config/index.js";

/**
 * The awork_1 algorithm record. Registered on first startup if
 * not present.
 */
export const AWORK_1_DEFINITION: RegisterAlgorithmInput = {
  name: "awork_1",
  version: "v0.1.0",
  container: "registry.aigarth.cloud/algorithms/awork_1:v0.1.0",
  deterministic: true,
  description:
    "Phase 27 first algorithm. A deterministic numerical benchmark: given an input seed, computes a SHA-256-derived fixed-point sequence. v1: container is a Python daemon that reads a JSON payload `{seed: int, iters: int}` and writes `{hash: sha256:...}`. Used as the proof that the Work Runtime can route, replicate, and verify.",
};

export class AlgorithmAlreadyRegisteredError extends Error {
  constructor(name: string, version: string) {
    super(`Algorithm '${name}' @ '${version}' is already registered.`);
    this.name = "AlgorithmAlreadyRegisteredError";
  }
}

export async function registerAlgorithm(
  input: RegisterAlgorithmInput,
): Promise<WorkAlgorithm> {
  const db = getDb();
  const cfg = loadConfig();
  const parsed = RegisterAlgorithmSchema.parse(input);

  // Idempotency: if (name, version) already exists, return the
  // existing row.
  const [existing] = await db
    .select()
    .from(workAlgorithms)
    .where(
      and(
        eq(workAlgorithms.name, parsed.name),
        eq(workAlgorithms.version, parsed.version),
      ),
    )
    .limit(1);
  if (existing) return existing;

  const signature = signAlgorithm(
    parsed.name,
    parsed.version,
    parsed.container,
    cfg.WORK_SIGNING_KEY,
  );

  const [row] = await db
    .insert(workAlgorithms)
    .values({
      id: uid(),
      name: parsed.name,
      version: parsed.version,
      container: parsed.container,
      deterministic: parsed.deterministic,
      signature,
      description: parsed.description ?? null,
    })
    .returning();

  await logActivity(db, {
    action: auditAction.algorithmRegistered,
    metadata: { name: parsed.name, version: parsed.version, container: parsed.container },
  });

  return row!;
}

export async function ensureAwork1Registered(): Promise<WorkAlgorithm> {
  return registerAlgorithm(AWORK_1_DEFINITION);
}

export async function listAlgorithms(): Promise<WorkAlgorithm[]> {
  const db = getDb();
  return db.select().from(workAlgorithms);
}

export async function getAlgorithmByName(name: string): Promise<WorkAlgorithm | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(workAlgorithms)
    .where(eq(workAlgorithms.name, name))
    .limit(1);
  return row ?? null;
}
