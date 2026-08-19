/**
 * ANN deployments — links an ANN + version to a real cluster placement.
 *
 *   - The deploy call forwards to services/compute to create a real job.
 *   - We capture the returned job_id and store it on the deployment row.
 *   - Status flips: pending → deploying → running → stopped | failed
 *   - Cost per call is set from the version + license, in QUBIC.
 *
 *   If services/compute is not configured, the deploy is recorded with
 *   a synthetic compute_job_id and status=running (stub mode).
 */

import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import {
  anns,
  annVersions,
  annDeployments,
  licenses,
  type AnnDeployment,
  type NewAnnDeployment,
} from "../db/schema.js";
import { uid } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";
import { loadConfig } from "../config/index.js";
import { createHash, randomUUID } from "node:crypto";

export type { AnnDeployment };

export const DeployAnnSchema = z.object({
  versionId: z.string().uuid().optional(),
  regionId: z.string().uuid().optional(),
  clusterId: z.string().uuid().optional(),
  replicas: z.number().int().min(1).max(100).default(1),
  orgId: z.string().uuid().optional(),
});

export async function deployAnn(
  userId: string,
  annId: string,
  input: z.infer<typeof DeployAnnSchema> & { userJwt?: string },
): Promise<AnnDeployment> {
  const db = getDb();
  const ann = (await db.select().from(anns).where(eq(anns.id, annId)).limit(1))[0];
  if (!ann) throw new Error("ANN not found.");
  if (ann.status !== "published") {
    throw new Error("Can only deploy a published ANN.");
  }

  // Pick the version: explicit, current, or latest
  let version;
  if (input.versionId) {
    version = (await db.select().from(annVersions).where(eq(annVersions.id, input.versionId)).limit(1))[0];
    if (!version) throw new Error(`Version ${input.versionId} not found.`);
    if (version.annId !== annId) throw new Error("Version does not belong to this ANN.");
  } else {
    version = (await db.select().from(annVersions).where(and(eq(annVersions.annId, annId), eq(annVersions.isLatest, true))).limit(1))[0]
      ?? (await db.select().from(annVersions).where(eq(annVersions.annId, annId)).orderBy(desc(annVersions.createdAt)).limit(1))[0];
    if (!version) throw new Error("No version available to deploy.");
  }

  // Compute cost per call from the ANN's license
  let costPerCallQubic = 0n;
  if (ann.licenseId) {
    const lic = (await db.select().from(licenses).where(eq(licenses.id, ann.licenseId)).limit(1))[0];
    if (lic) costPerCallQubic = lic.pricePerCallQubic;
  }

  // Forward to services/compute to create a real placement.
  // If compute is not configured, generate a synthetic job id (stub mode).
  const cfg = loadConfig();
  let computeJobId: string | null = null;
  let status: "pending" | "deploying" | "running" | "failed" = "pending";
  let endpointUrl: string | null = null;

  if (cfg.COMPUTE_SERVICE_URL) {
    // Real path: must succeed. No silent fallback.
    let res: Response;
    try {
      res = await fetch(`${cfg.COMPUTE_SERVICE_URL}/v1/compute/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
          // Forward the user's JWT so the compute service can identify the caller
          "Authorization": `Bearer ${input.userJwt ?? ""}`,
        },
        body: JSON.stringify({
          clusterId: input.clusterId,
          regionId: input.regionId,
          kind: "ann_inference",
          payload: { annId, versionId: version.id, replicas: input.replicas },
          priority: 5,
        }),
      });
    } catch (err) {
      // Network error / services/compute down — fail closed.
      throw new Error(
        `services/compute unreachable: ${err instanceof Error ? err.message : "unknown"}. Deploy aborted.`,
      );
    }
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`services/compute rejected deploy: ${res.status} ${errText}`);
    }
    let data: { id: string; status?: string };
    try {
      data = (await res.json()) as { id: string; status?: string };
    } catch (err) {
      throw new Error(
        `services/compute returned invalid JSON: ${err instanceof Error ? err.message : "unknown"}`,
      );
    }
    if (!data.id) {
      throw new Error("services/compute response missing `id` field");
    }
    computeJobId = data.id;
    // services/compute returns the job with a status; treat "running" as placed.
    // For more realistic flows, we'd stay in "deploying" until services/compute
    // signals placement via a callback or poll. For the stub compute, "running"
    // is the natural end state.
    status = data.status === "running" ? "running" : "deploying";
  } else {
    // Stub mode (dev): no real compute configured. Use a synthetic job id.
    // Status flips to running immediately; endpointUrl is a placeholder.
    computeJobId = `stub-${randomUUID()}`;
    status = "running";
    endpointUrl = `https://aigarth.cloud/v1/anns/${ann.slug}/versions/${version.version}/invoke`;
  }

  const id = uid();
  const inserted = await db
    .insert(annDeployments)
    .values({
      id,
      annId,
      versionId: version.id,
      regionId: input.regionId ?? null,
      clusterId: input.clusterId ?? null,
      computeJobId,
      status,
      endpointUrl,
      replicas: input.replicas,
      ownerUserId: userId,
      ownerOrgId: input.orgId ?? null,
      costPerCallQubic,
      deployedAt: status === "running" ? new Date() : null,
    } satisfies NewAnnDeployment)
    .returning();

  await logActivity(db, {
    action: "ann.deployment_started",
    actorUserId: userId,
    orgId: input.orgId ?? null,
    targetType: "ann_deployment",
    targetId: id,
    metadata: { annId, versionId: version.id, computeJobId, status },
  });

  return inserted[0]!;
}

export async function stopDeployment(
  userId: string,
  annId: string,
  deploymentId: string,
): Promise<AnnDeployment | null> {
  const db = getDb();
  const dep = (await db.select().from(annDeployments).where(eq(annDeployments.id, deploymentId)).limit(1))[0];
  if (!dep) return null;
  if (dep.annId !== annId) throw new Error("Deployment does not belong to this ANN.");
  if (dep.ownerUserId !== userId) {
    throw new Error("Only the deployment owner can stop it.");
  }
  if (dep.status === "stopped") return dep;

  const cfg = loadConfig();
  if (cfg.COMPUTE_SERVICE_URL && dep.computeJobId && !dep.computeJobId.startsWith("stub-")) {
    try {
      await fetch(`${cfg.COMPUTE_SERVICE_URL}/v1/jobs/${dep.computeJobId}/cancel`, {
        method: "POST",
        headers: { "x-user-id": userId },
      });
    } catch {
      // best-effort; we still flip status locally
    }
  }

  const updated = await db
    .update(annDeployments)
    .set({ status: "stopped", stoppedAt: new Date(), updatedAt: new Date() })
    .where(eq(annDeployments.id, deploymentId))
    .returning();

  await logActivity(db, {
    action: "ann.deployment_stopped",
    actorUserId: userId,
    targetType: "ann_deployment",
    targetId: deploymentId,
  });

  return updated[0] ?? null;
}

export async function listDeployments(annId: string, limit = 50): Promise<AnnDeployment[]> {
  const db = getDb();
  return db
    .select()
    .from(annDeployments)
    .where(eq(annDeployments.annId, annId))
    .orderBy(desc(annDeployments.createdAt))
    .limit(limit);
}

export async function listMyDeployments(userId: string, limit = 50): Promise<AnnDeployment[]> {
  const db = getDb();
  return db
    .select()
    .from(annDeployments)
    .where(eq(annDeployments.ownerUserId, userId))
    .orderBy(desc(annDeployments.createdAt))
    .limit(limit);
}
