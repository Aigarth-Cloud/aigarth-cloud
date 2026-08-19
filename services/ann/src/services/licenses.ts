/**
 * Licenses — read-only lookup. Seed-only at the data level.
 * (License creation/editing is an admin operation; deferred.)
 */

import { eq, asc } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { licenses, type License } from "../db/schema.js";

export type { License };

export async function listLicenses(): Promise<License[]> {
  const db = getDb();
  return db.select().from(licenses).orderBy(asc(licenses.name));
}

export async function getLicenseBySlug(slug: string): Promise<License | null> {
  const db = getDb();
  const rows = await db.select().from(licenses).where(eq(licenses.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getLicenseById(id: string): Promise<License | null> {
  const db = getDb();
  const rows = await db.select().from(licenses).where(eq(licenses.id, id)).limit(1);
  return rows[0] ?? null;
}
