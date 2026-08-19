/**
 * Categories — taxonomy lookup.
 * Read-only at the API level; seed-only at the data level.
 */

import { eq, asc } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { categories, type Category } from "../db/schema.js";

export type { Category };

export async function listCategories(): Promise<Category[]> {
  const db = getDb();
  return db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const db = getDb();
  const rows = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const db = getDb();
  const rows = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return rows[0] ?? null;
}
