/**
 * Dataset service (Phase 19B.1 + 19B.2).
 *
 * CRUD for the `datasets` table. Version management lives in
 * `versions.ts`. Access grants live in `access.ts`.
 *
 * Slug generation: `slugify(name)` first; on collision, retry up
 * to 3 times with a short random suffix. After 3 collisions we
 * fail with `DatasetSlugCollisionError` so the caller knows to
 * pick a different name.
 */

import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { createHash } from "node:crypto";
import { getDb } from "../db/index.js";
import {
  datasets,
  datasetVersions,
  type Dataset,
  type NewDataset,
  type DatasetVersion,
} from "../db/schema.js";
import { uid, slugify, slugWithSuffix } from "../lib/ids.js";
import { logActivity, auditAction } from "../lib/audit.js";
import { bigintToNumber } from "../lib/db-types.js";

// ---------- Schemas ----------

export const DatasetKindSchema = z.enum([
  "tabular",
  "text",
  "image",
  "audio",
  "time_series",
  "multimodal",
  "other",
]);

export const DatasetLicenseSchema = z.enum([
  "open",
  "cc_by",
  "cc_by_sa",
  "commercial",
  "custom",
]);

export const DatasetStatusSchema = z.enum(["draft", "private", "public", "deprecated"]);

export const CreateDatasetSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(80).optional(),
  description: z.string().max(8000).optional(),
  kind: DatasetKindSchema,
  license: DatasetLicenseSchema.default("open"),
  source: z.string().max(500).optional(),
  status: DatasetStatusSchema.default("private"),
  owner_org_id: z.string().uuid().optional(),
});
export type CreateDatasetInput = z.infer<typeof CreateDatasetSchema>;

export const UpdateDatasetSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(8000).optional(),
  license: DatasetLicenseSchema.optional(),
  source: z.string().max(500).optional(),
});
export type UpdateDatasetInput = z.infer<typeof UpdateDatasetSchema>;

export const ListDatasetsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  kind: DatasetKindSchema.optional(),
  license: DatasetLicenseSchema.optional(),
  status: DatasetStatusSchema.optional(),
  owner: z.string().uuid().optional(),
  search: z.string().min(1).max(120).optional(),
  sort: z.enum(["newest", "oldest", "name"]).default("newest"),
});
export type ListDatasetsQuery = z.infer<typeof ListDatasetsQuerySchema>;

// ---------- Errors ----------

export class DatasetNotFoundError extends Error {
  constructor(idOrSlug: string) {
    super(`Dataset '${idOrSlug}' not found.`);
    this.name = "DatasetNotFoundError";
  }
}

export class DatasetSlugCollisionError extends Error {
  constructor(name: string) {
    super(`Could not find a unique slug for dataset '${name}' after 3 retries. Pick a different name.`);
    this.name = "DatasetSlugCollisionError";
  }
}

export class DatasetForbiddenError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "DatasetForbiddenError";
  }
}

// ---------- Helpers ----------

async function pickUniqueSlug(name: string, requestedSlug?: string): Promise<string> {
  const db = getDb();
  const base = requestedSlug ? slugify(requestedSlug) : slugify(name);
  if (!base) {
    // Empty slug — fall back to a random one
    return slugWithSuffix(name || "dataset");
  }
  // Try the base first
  const existing = await db
    .select({ id: datasets.id })
    .from(datasets)
    .where(eq(datasets.slug, base))
    .limit(1);
  if (existing.length === 0) return base;
  // Up to 3 retries with a random suffix
  for (let i = 0; i < 3; i++) {
    const candidate = `${base}-${slugify(name).slice(0, 0)}${randomSuffix(4)}`;
    const conflict = await db
      .select({ id: datasets.id })
      .from(datasets)
      .where(eq(datasets.slug, candidate))
      .limit(1);
    if (conflict.length === 0) return candidate;
  }
  throw new DatasetSlugCollisionError(name);
}

function randomSuffix(len: number): string {
  return createHash("sha256")
    .update(`${Date.now()}-${Math.random()}`)
    .digest("hex")
    .slice(0, len)
    .toLowerCase();
}

// ---------- Mutations ----------

export async function createDataset(
  callerUserId: string,
  input: CreateDatasetInput,
): Promise<Dataset> {
  const db = getDb();
  const slug = await pickUniqueSlug(input.name, input.slug);
  const id = uid();
  const now = new Date();

  const row: NewDataset = {
    id,
    slug,
    name: input.name,
    description: input.description ?? null,
    ownerUserId: callerUserId,
    ownerOrgId: input.owner_org_id ?? null,
    kind: input.kind,
    license: input.license,
    source: input.source ?? null,
    status: input.status,
    datasetRevenueBps: 0,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(datasets).values(row);

  await logActivity(db, {
    action: auditAction.datasetCreated,
    actorUserId: callerUserId,
    orgId: input.owner_org_id ?? null,
    targetType: "dataset",
    targetId: id,
    metadata: { slug, kind: input.kind, license: input.license, status: input.status },
  });

  const [created] = await db.select().from(datasets).where(eq(datasets.id, id)).limit(1);
  if (!created) throw new Error("Dataset creation succeeded but row not found");
  return created;
}

export async function updateDataset(
  callerUserId: string,
  idOrSlug: string,
  input: UpdateDatasetInput,
): Promise<Dataset> {
  const db = getDb();
  const existing = await getDataset(idOrSlug);
  if (!existing) throw new DatasetNotFoundError(idOrSlug);
  if (existing.ownerUserId !== callerUserId) {
    throw new DatasetForbiddenError("Only the dataset owner can update it.");
  }
  const updates: Partial<NewDataset> = { updatedAt: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.license !== undefined) updates.license = input.license;
  if (input.source !== undefined) updates.source = input.source;

  await db.update(datasets).set(updates).where(eq(datasets.id, existing.id));
  await logActivity(db, {
    action: auditAction.datasetUpdated,
    actorUserId: callerUserId,
    targetType: "dataset",
    targetId: existing.id,
    metadata: { fields: Object.keys(input) },
  });

  const [updated] = await db.select().from(datasets).where(eq(datasets.id, existing.id)).limit(1);
  if (!updated) throw new DatasetNotFoundError(idOrSlug);
  return updated;
}

export async function changeDatasetStatus(
  callerUserId: string,
  idOrSlug: string,
  newStatus: z.infer<typeof DatasetStatusSchema>,
): Promise<Dataset> {
  const db = getDb();
  const existing = await getDataset(idOrSlug);
  if (!existing) throw new DatasetNotFoundError(idOrSlug);
  if (existing.ownerUserId !== callerUserId) {
    throw new DatasetForbiddenError("Only the dataset owner can change status.");
  }
  await db
    .update(datasets)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(datasets.id, existing.id));
  await logActivity(db, {
    action: auditAction.datasetStatusChanged,
    actorUserId: callerUserId,
    targetType: "dataset",
    targetId: existing.id,
    metadata: { from: existing.status, to: newStatus },
  });
  const [updated] = await db.select().from(datasets).where(eq(datasets.id, existing.id)).limit(1);
  if (!updated) throw new DatasetNotFoundError(idOrSlug);
  return updated;
}

// ---------- Reads ----------

export async function getDataset(idOrSlug: string): Promise<Dataset | null> {
  const db = getDb();
  // Try UUID first, then slug
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
  if (isUuid) {
    const [row] = await db.select().from(datasets).where(eq(datasets.id, idOrSlug)).limit(1);
    return row ?? null;
  }
  const [row] = await db.select().from(datasets).where(eq(datasets.slug, idOrSlug)).limit(1);
  return row ?? null;
}

export async function listDatasets(query: ListDatasetsQuery): Promise<{
  data: Dataset[];
  total: number;
  limit: number;
  offset: number;
}> {
  const db = getDb();
  const conditions = [];
  if (query.kind) conditions.push(eq(datasets.kind, query.kind));
  if (query.license) conditions.push(eq(datasets.license, query.license));
  if (query.status) conditions.push(eq(datasets.status, query.status));
  if (query.owner) conditions.push(eq(datasets.ownerUserId, query.owner));
  if (query.search) conditions.push(ilike(datasets.name, `%${query.search}%`));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const orderBy =
    query.sort === "name"
      ? datasets.name
      : query.sort === "oldest"
        ? datasets.createdAt
        : desc(datasets.createdAt);

  const rows = await db
    .select()
    .from(datasets)
    .where(where)
    .orderBy(orderBy)
    .limit(query.limit)
    .offset(query.offset);

  const totalRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(datasets)
    .where(where);
  const total = bigintToNumber(totalRow[0]?.count, 0);

  return { data: rows, total, limit: query.limit, offset: query.offset };
}

/**
 * Public catalog: only `status = 'public'` datasets, sorted by newest.
 * Used by the catalog browse page (19B.4) and the marketing /datasets
 * route.
 */
export async function listPublicCatalog(query: {
  limit?: number;
  offset?: number;
  kind?: z.infer<typeof DatasetKindSchema>;
  license?: z.infer<typeof DatasetLicenseSchema>;
  search?: string;
}): Promise<{ data: Dataset[]; total: number; limit: number; offset: number }> {
  return listDatasets({
    limit: query.limit ?? 20,
    offset: query.offset ?? 0,
    kind: query.kind,
    license: query.license,
    status: "public",
    search: query.search,
    sort: "newest",
  });
}

/** Latest published version of a dataset, or null. Used by training jobs. */
export async function getLatestVersion(datasetId: string): Promise<DatasetVersion | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(datasetVersions)
    .where(eq(datasetVersions.datasetId, datasetId))
    .orderBy(desc(datasetVersions.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export { datasetVersions };
