/**
 * ANN license grants — when a user licenses an ANN for use.
 *
 *   - Required for commercial / restricted ANNs before deployment.
 *   - Optional for open ANNs (anyone can deploy).
 *   - A user can hold at most one active grant per (ann, license) pair.
 *   - Revocation sets status=revoked, recorded_at=now, reason optional.
 *   - Expiration sets status=expired when the date passes.
 *
 *   Payment gating:
 *   - Open licenses (price_per_call_qubic = 0) → granted immediately, status=active.
 *   - Priced licenses (commercial, restricted, custom) → caller must pass a
 *     `paidInvoiceId` from services/billing. The invoice is verified to be
 *     paid, for the same user, with the same license in metadata. Then granted.
 *   - If `BILLING_SERVICE_URL` is not configured, priced licenses still work
 *     but with a warning (dev mode). Open is always free.
 */

import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import {
  anns,
  licenses,
  annLicensesGranted,
  type AnnLicenseGrant,
  type NewAnnLicenseGrant,
} from "../db/schema.js";
import { uid } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";
import { loadConfig } from "../config/index.js";
import { extractJwt } from "../lib/auth.js";
import type { FastifyRequest } from "fastify";

export type { AnnLicenseGrant };

export const GrantLicenseSchema = z.object({
  licenseSlug: z.string().min(1).max(60),
  expiresAt: z.coerce.date().optional(),
  orgId: z.string().uuid().optional(),
  /** Required for priced licenses. The paid invoice from services/billing. */
  paidInvoiceId: z.string().uuid().optional(),
});

/**
 * Verify a paid invoice from services/billing.
 * Returns true if the invoice exists, is paid, and is for the same user + license.
 */
async function verifyPaidInvoice(
  userId: string,
  invoiceId: string,
  expectedLicenseSlug: string,
  jwt: string,
): Promise<{ ok: boolean; reason?: string }> {
  const cfg = loadConfig();
  if (!cfg.BILLING_SERVICE_URL) {
    return { ok: true, reason: "billing not configured (dev mode)" };
  }
  try {
    const res = await fetch(`${cfg.BILLING_SERVICE_URL}/v1/invoices/${invoiceId}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) {
      return { ok: false, reason: `invoice fetch failed: ${res.status}` };
    }
    const data = (await res.json()) as {
      id: string;
      user_id: string;
      status: string;
      total_qubic: string;
      metadata?: { license_slug?: string; ann_id?: string };
    };
    if (data.user_id !== userId) {
      return { ok: false, reason: "invoice is for a different user" };
    }
    if (data.status !== "paid") {
      return { ok: false, reason: `invoice is not paid (status=${data.status})` };
    }
    if (data.metadata?.license_slug && data.metadata.license_slug !== expectedLicenseSlug) {
      return { ok: false, reason: `invoice is for license '${data.metadata.license_slug}', not '${expectedLicenseSlug}'` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `invoice fetch error: ${err instanceof Error ? err.message : "unknown"}` };
  }
}

export async function grantLicense(
  userId: string,
  annId: string,
  input: z.infer<typeof GrantLicenseSchema>,
  req?: FastifyRequest,
): Promise<AnnLicenseGrant> {
  const db = getDb();
  const ann = (await db.select({ id: anns.id, status: anns.status }).from(anns).where(eq(anns.id, annId)).limit(1))[0];
  if (!ann) throw new Error("ANN not found.");
  if (ann.status !== "published") {
    throw new Error("Can only license a published ANN.");
  }
  const lic = (await db.select().from(licenses).where(eq(licenses.slug, input.licenseSlug)).limit(1))[0];
  if (!lic) throw new Error(`License '${input.licenseSlug}' not found.`);
  if (!lic.isActive) throw new Error(`License '${input.licenseSlug}' is not active.`);

  // Payment gating for priced licenses
  if (lic.pricePerCallQubic > 0n) {
    if (!input.paidInvoiceId) {
      throw new Error(
        `License '${input.licenseSlug}' requires payment. Pass 'paidInvoiceId' from services/billing. ` +
          `License price: ${lic.pricePerCallQubic.toString()} QUBIC per call.`,
      );
    }
    const jwt = req ? extractJwt(req) : "";
    const verification = await verifyPaidInvoice(userId, input.paidInvoiceId, input.licenseSlug, jwt);
    if (!verification.ok) {
      throw new Error(`Payment verification failed: ${verification.reason}`);
    }
  }

  // Upsert: re-grant if a prior grant exists in any non-active state
  const existing = (await db
    .select()
    .from(annLicensesGranted)
    .where(and(eq(annLicensesGranted.annId, annId), eq(annLicensesGranted.userId, userId), eq(annLicensesGranted.licenseId, lic.id)))
    .limit(1))[0];

  const id = existing?.id ?? uid();

  if (existing) {
    const updated = await db
      .update(annLicensesGranted)
      .set({
        status: "active",
        expiresAt: input.expiresAt ?? null,
        grantedAt: new Date(),
        revokedAt: null,
        revokedReason: null,
        updatedAt: new Date(),
      })
      .where(eq(annLicensesGranted.id, id))
      .returning();
    await logActivity(db, {
      action: "ann.license_granted",
      actorUserId: userId,
      targetType: "ann_license_grant",
      targetId: id,
      metadata: { annId, licenseSlug: input.licenseSlug, reGranted: true },
    });
    return updated[0]!;
  }

  const inserted = await db
    .insert(annLicensesGranted)
    .values({
      id,
      annId,
      licenseId: lic.id,
      userId,
      orgId: input.orgId ?? null,
      status: "active",
      expiresAt: input.expiresAt ?? null,
      callCount: 0n,
    } satisfies NewAnnLicenseGrant)
    .returning();

  await logActivity(db, {
    action: "ann.license_granted",
    actorUserId: userId,
    targetType: "ann_license_grant",
    targetId: id,
    metadata: { annId, licenseSlug: input.licenseSlug },
  });

  return inserted[0]!;
}

export async function revokeLicense(
  userId: string,
  annId: string,
  reason?: string,
): Promise<AnnLicenseGrant | null> {
  const db = getDb();
  const existing = (await db
    .select()
    .from(annLicensesGranted)
    .where(and(eq(annLicensesGranted.annId, annId), eq(annLicensesGranted.userId, userId), eq(annLicensesGranted.status, "active")))
    .limit(1))[0];
  if (!existing) return null;

  const updated = await db
    .update(annLicensesGranted)
    .set({
      status: "revoked",
      revokedAt: new Date(),
      revokedReason: reason ?? null,
      updatedAt: new Date(),
    })
    .where(eq(annLicensesGranted.id, existing.id))
    .returning();

  return updated[0] ?? null;
}

export async function listMyLicenses(userId: string, limit = 50): Promise<AnnLicenseGrant[]> {
  const db = getDb();
  return db
    .select()
    .from(annLicensesGranted)
    .where(eq(annLicensesGranted.userId, userId))
    .orderBy(desc(annLicensesGranted.grantedAt))
    .limit(limit);
}

export async function hasActiveLicense(userId: string, annId: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({ id: annLicensesGranted.id })
    .from(annLicensesGranted)
    .where(and(eq(annLicensesGranted.annId, annId), eq(annLicensesGranted.userId, userId), eq(annLicensesGranted.status, "active")))
    .limit(1);
  return rows.length > 0;
}
