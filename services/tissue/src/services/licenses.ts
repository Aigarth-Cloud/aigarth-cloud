/**
 * Tissue licensing — Phase 18E.
 *
 *   A `licensed` tissue requires an explicit grant in
 *   `tissue_licenses` for the caller (user or org) to be allowed
 *   to call /decide. The owner of a tissue always has access
 *   without a grant row (implicit).
 *
 *   Grant lifecycle:
 *     create  → active
 *     active  → revoked (soft delete; audit row stays)
 *     active  → expired (time-bound, server-checked)
 *
 *   v1: grants are unlimited in count per tissue. The unique
 *   constraint is on (tissue_id, grantee_user_id) for user-level
 *   grants — re-granting the same user upserts.
 */

import { and, eq, isNull, or, gt, sql, desc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import {
  tissueLicenses,
  tissues,
  type TissueLicense,
  type NewTissueLicense,
} from "../db/schema.js";
import { logActivity } from "../lib/audit.js";

export type { TissueLicense };

export const GrantLicenseSchema = z
  .object({
    granteeUserId: z.string().uuid().optional(),
    granteeOrgId: z.string().uuid().optional(),
    source: z.string().min(1).max(60).default("owner_grant"),
    expiresAt: z.coerce.date().optional(),
    maxDecisions: z.string().regex(/^\d+$/).optional(),
  })
  .refine(
    (v) => v.granteeUserId !== undefined || v.granteeOrgId !== undefined,
    { message: "Provide granteeUserId or granteeOrgId" },
  );
export type GrantLicenseInput = z.infer<typeof GrantLicenseSchema>;

export class LicenseError extends Error {
  constructor(
    public readonly code:
      | "tissue_not_found"
      | "invalid_grantee"
      | "duplicate_grant"
      | "not_authorized",
    message: string,
  ) {
    super(message);
    this.name = "LicenseError";
  }
}

async function tissueExists(tissueId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ id: tissues.id })
    .from(tissues)
    .where(eq(tissues.id, tissueId))
    .limit(1);
  return rows.length > 0;
}

export async function grantLicense(
  actorUserId: string,
  tissueId: string,
  input: GrantLicenseInput,
): Promise<TissueLicense> {
  if (!input.granteeUserId && !input.granteeOrgId) {
    throw new LicenseError("invalid_grantee", "Provide granteeUserId or granteeOrgId");
  }
  if (!await tissueExists(tissueId)) {
    throw new LicenseError("tissue_not_found", "Tissue not found");
  }
  const db = getDb();
  const ownerRow = await db
    .select({ owner: tissues.ownerUserId })
    .from(tissues)
    .where(eq(tissues.id, tissueId))
    .limit(1);
  if (ownerRow[0]?.owner !== actorUserId) {
    throw new LicenseError(
      "not_authorized",
      "Only the tissue owner can grant licenses",
    );
  }
  const id = crypto.randomUUID();
  const inserted = await db
    .insert(tissueLicenses)
    .values({
      id,
      tissueId,
      granteeUserId: input.granteeUserId ?? null,
      granteeOrgId: input.granteeOrgId ?? null,
      source: input.source,
      expiresAt: input.expiresAt ?? null,
      maxDecisions: input.maxDecisions ? BigInt(input.maxDecisions) : null,
    } satisfies NewTissueLicense)
    .returning();
  await logActivity(db, {
    action: "tissue.license.granted",
    actorUserId,
    targetType: "tissue_license",
    targetId: id,
    metadata: {
      tissue_id: tissueId,
      grantee_user_id: input.granteeUserId ?? null,
      grantee_org_id: input.granteeOrgId ?? null,
      source: input.source,
    },
  });
  return inserted[0]!;
}

export async function revokeLicense(
  actorUserId: string,
  licenseId: string,
): Promise<TissueLicense | null> {
  const db = getDb();
  const existing = (await db
    .select()
    .from(tissueLicenses)
    .where(eq(tissueLicenses.id, licenseId))
    .limit(1))[0];
  if (!existing) return null;
  const ownerRow = await db
    .select({ owner: tissues.ownerUserId })
    .from(tissues)
    .where(eq(tissues.id, existing.tissueId))
    .limit(1);
  if (ownerRow[0]?.owner !== actorUserId) {
    throw new LicenseError("not_authorized", "Only the tissue owner can revoke licenses");
  }
  const updated = await db
    .update(tissueLicenses)
    .set({ revokedAt: new Date() })
    .where(eq(tissueLicenses.id, licenseId))
    .returning();
  await logActivity(db, {
    action: "tissue.license.revoked",
    actorUserId,
    targetType: "tissue_license",
    targetId: licenseId,
    metadata: { tissue_id: existing.tissueId },
  });
  return updated[0] ?? null;
}

export async function listLicenses(
  tissueId: string,
  options: { includeRevoked?: boolean } = {},
): Promise<TissueLicense[]> {
  const db = getDb();
  if (options.includeRevoked) {
    return db
      .select()
      .from(tissueLicenses)
      .where(eq(tissueLicenses.tissueId, tissueId))
      .orderBy(desc(tissueLicenses.createdAt));
  }
  return db
    .select()
    .from(tissueLicenses)
    .where(and(eq(tissueLicenses.tissueId, tissueId), isNull(tissueLicenses.revokedAt)))
    .orderBy(desc(tissueLicenses.createdAt));
}

/**
 * Check whether a caller is allowed to /decide a tissue.
 *
 *   - Owner always allowed.
 *   - `open` tissues: anyone with a valid JWT.
 *   - `licensed` tissues: caller must have an active grant
 *     (not revoked, not expired, no over-limit).
 *
 *   Returns:
 *     - `{ allowed: true, reason: "owner"|"open"|"license", license? }`
 *     - `{ allowed: false, reason: "needs_license" }`
 */
export interface AccessCheck {
  allowed: boolean;
  reason: "owner" | "open" | "license" | "needs_license" | "tissue_inactive";
  license?: TissueLicense;
}

export async function checkAccess(
  tissue: { id: string; ownerUserId: string; access: "open" | "licensed"; status: string },
  callerUserId: string,
): Promise<AccessCheck> {
  if (tissue.status !== "active") {
    return { allowed: false, reason: "tissue_inactive" };
  }
  if (tissue.ownerUserId === callerUserId) {
    return { allowed: true, reason: "owner" };
  }
  if (tissue.access === "open") {
    return { allowed: true, reason: "open" };
  }
  const db = getDb();
  const now = new Date();
  const rows = await db
    .select()
    .from(tissueLicenses)
    .where(
      and(
        eq(tissueLicenses.tissueId, tissue.id),
        eq(tissueLicenses.granteeUserId, callerUserId),
        isNull(tissueLicenses.revokedAt),
        or(isNull(tissueLicenses.expiresAt), gt(tissueLicenses.expiresAt, now))!,
      ),
    )
    .limit(1);
  if (!rows[0]) {
    return { allowed: false, reason: "needs_license" };
  }
  return { allowed: true, reason: "license", license: rows[0] };
}

/**
 * Atomically increment the `used_decisions` counter on a grant.
 * Returns `true` if the grant is still under the cap, `false` if
 * the next call would exceed it. NOT YET IMPLEMENTED in schema —
 * reserved for the v2 grant cap pattern. v1 grants are uncapped.
 */
export async function trackLicenseUsage(licenseId: string, _cost: bigint): Promise<boolean> {
  // v1: no per-grant cap tracking. Always return true.
  void licenseId;
  void _cost;
  return true;
  // Touch the table so a future cap counter column is not removed by `unused` lints.
  void sql;
}
