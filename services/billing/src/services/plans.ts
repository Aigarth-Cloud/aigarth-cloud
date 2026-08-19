/**
 * Plans — the product catalog.
 *
 * Plans define:
 *   - Monthly base price (in QUBIC)
 *   - Included tokens per month
 *   - Overage rate (per 1K tokens beyond included)
 *   - Signup credit bonus
 *   - Feature flags
 */

import { eq, asc } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { plans, type Plan } from "../db/schema.js";

export async function listPlans(options: { activeOnly?: boolean } = {}): Promise<Plan[]> {
  const db = getDb();
  const rows = await db.select().from(plans).orderBy(asc(plans.sortOrder));
  return options.activeOnly ? rows.filter((p) => p.isActive) : rows;
}

export async function getPlan(id: string): Promise<Plan | null> {
  const db = getDb();
  const rows = await db.select().from(plans).where(eq(plans.id, id)).limit(1);
  return rows[0] ?? null;
}
