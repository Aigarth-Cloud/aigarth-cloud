/**
 * Version router — Phase 19D.3.
 *
 * Picks which deployment of an ANN serves a given call, and which
 * (optional) shadow deployment runs alongside. The /decide flow
 * consults this router BEFORE invoking the trinary backend.
 *
 * Deployment modes (per `ann_deployments.deploy_mode`):
 *
 *   - `active`     — serves traffic, weighted by `traffic_weight`
 *   - `canary`     — serves a small slice of traffic (low weight)
 *   - `shadow`     — runs alongside, results logged but NOT served
 *   - `deprecated` — never selected; historical decision log preserved
 *
 * Algorithm:
 *
 *   1. Load all `running` deployments for the ann.
 *   2. Serving: weighted random pick from `active` + `canary`,
 *      where weight = `traffic_weight`. Weights must sum > 0; if they
 *      sum to 0, we treat the first `active` as 100% (defensive).
 *   3. Shadow: random pick from `shadow` (any weight, single pick).
 *      Shadow runs the model but does NOT affect the served result.
 *   4. Returns null for serving if no `active`/`canary` exist.
 *      The caller falls back to the ANN's `currentVersionId` (legacy
 *      behavior) so an ANN with no formal deployment still works.
 *
 * Determinism:
 *   The pick is seeded by the caller (test suite passes a seeded
 *   `rand`). Production callers can use `Math.random` for natural
 *   distribution; the trinary backend itself is deterministic given
 *   a request, so the same input always produces the same envelope.
 */

import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/index.js";
import {
  annDeployments,
  annVersions,
  type AnnDeployment,
  type AnnVersion,
} from "../db/schema.js";

export interface PickedDeployment {
  deployment: AnnDeployment;
  version: AnnVersion;
}

export class NoServingDeploymentError extends Error {
  constructor(annId: string) {
    super(
      `ANN '${annId}' has no active or canary deployments with weight > 0. ` +
        `Add a deployment (or wait for the current one to reach 'running').`,
    );
    this.name = "NoServingDeploymentError";
  }
}

/**
 * Deterministically pick one item weighted by `trafficWeight`. Returns
 * the first item if total weight is 0 (defensive — degenerate config).
 */
export function pickByWeight<T extends { trafficWeight: number }>(
  items: T[],
  rand: () => number = Math.random,
): T | null {
  if (items.length === 0) return null;
  const total = items.reduce((s, x) => s + Math.max(0, x.trafficWeight), 0);
  if (total <= 0) return items[0]!;
  const r = rand() * total;
  let acc = 0;
  for (const item of items) {
    acc += Math.max(0, item.trafficWeight);
    if (r < acc) return item;
  }
  return items[items.length - 1]!;
}

/**
 * Load a deployment's underlying version row by deployment.versionId.
 * Helper used by pickServingDeployment / pickShadowDeployment.
 */
async function loadVersion(versionId: string): Promise<AnnVersion | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(annVersions)
    .where(eq(annVersions.id, versionId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Pick the serving deployment for an ANN. Returns null if no
 * `active`/`canary` deployment exists (caller should fall back to
 * the ANN's currentVersionId).
 */
export async function pickServingDeployment(
  annId: string,
  rand: () => number = Math.random,
): Promise<PickedDeployment | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(annDeployments)
    .where(
      and(
        eq(annDeployments.annId, annId),
        eq(annDeployments.status, "running"),
        inArray(annDeployments.deployMode, ["active", "canary"]),
      ),
    );
  if (rows.length === 0) return null;
  const picked = pickByWeight(rows, rand);
  if (!picked) return null;
  const version = await loadVersion(picked.versionId);
  if (!version) return null;
  return { deployment: picked, version };
}

/**
 * Pick an optional shadow deployment. Returns null if no shadow exists
 * or if a deterministic seed picks "no shadow" (50/50 split to keep
 * the shadow traffic from being too noisy).
 */
export async function pickShadowDeployment(
  annId: string,
  rand: () => number = Math.random,
): Promise<PickedDeployment | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(annDeployments)
    .where(
      and(
        eq(annDeployments.annId, annId),
        eq(annDeployments.status, "running"),
        eq(annDeployments.deployMode, "shadow"),
      ),
    );
  if (rows.length === 0) return null;
  // 50/50 — don't shadow every call. With many shadows the noise gets
  // expensive; with too few the eval is statistically thin.
  if (rand() < 0.5) return null;
  const picked = pickByWeight(rows, rand);
  if (!picked) return null;
  const version = await loadVersion(picked.versionId);
  if (!version) return null;
  return { deployment: picked, version };
}
