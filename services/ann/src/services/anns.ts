/**
 * ANNs — the canonical registry.
 *
 *   Create draft → update metadata → publish (requires ≥1 version)
 *   Slug is auto-generated from name, with a 4-char suffix to disambiguate.
 *   The first version is NOT auto-created. The creator calls POST /v1/anns/:id/versions
 *   to add a version, then POST /v1/anns/:id/publish to flip the status to "published".
 *
 *   Search uses a simple case-insensitive LIKE on (name, tagline, description).
 *   For real ANN-scale search, we'd add pg_trgm + GIN index. Deferred.
 */

import { eq, and, or, ilike, desc, asc, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import {
  anns,
  annVersions,
  annRatings,
  annLicensesGranted,
  categories,
  licenses,
  type Ann,
  type NewAnn,
} from "../db/schema.js";
import { uid, slugify, slugSuffix } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";
import { defaultSplits, AigarthPoolError } from "@aigarth/aigarthpool";
import { getAigarthPool } from "./aigarthpool.js";

export type { Ann };

// ---------- Schemas ----------

export const CreateAnnSchema = z.object({
  name: z.string().min(1).max(120),
  tagline: z.string().max(200).optional(),
  description: z.string().max(20_000).optional(),
  icon: z.string().max(60).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  categorySlug: z.string().min(1).max(60).optional(),
  licenseSlug: z.string().min(1).max(60).optional(),
  visibility: z.enum(["public", "unlisted", "private"]).default("public"),
  orgId: z.string().uuid().optional(),
  creatorName: z.string().min(1).max(120).optional(),
  /** Phase 18B — defaults to `openai_chat` so existing ANNs are unaffected. */
  decisionProtocol: z.enum(["openai_chat", "trinary", "hybrid"]).default("openai_chat"),
  /** Phase 18B — system prompt the ANN uses to emit IntentEnvelopes. */
  trinaryPromptTemplate: z.string().max(20_000).optional(),
  /** Phase 18B — operator-trusted authority weight, [0, 1]. Default 0.5. */
  authorityWeight: z.number().min(0).max(1).optional(),
});

export const UpdateAnnSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  tagline: z.string().max(200).nullable().optional(),
  description: z.string().max(20_000).nullable().optional(),
  icon: z.string().max(60).nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  categorySlug: z.string().min(1).max(60).nullable().optional(),
  licenseSlug: z.string().min(1).max(60).nullable().optional(),
  visibility: z.enum(["public", "unlisted", "private"]).optional(),
  decisionProtocol: z.enum(["openai_chat", "trinary", "hybrid"]).optional(),
  trinaryPromptTemplate: z.string().max(20_000).nullable().optional(),
  authorityWeight: z.number().min(0).max(1).optional(),
});

export const ListQuerySchema = z.object({
  q: z.string().max(200).optional(),
  /** When true, use pg_trgm similarity (typo-tolerant). Slower but more forgiving. */
  fuzzy: z.coerce.boolean().default(false),
  category: z.string().max(60).optional(),
  license: z.string().max(60).optional(),
  status: z.enum(["draft", "published", "deprecated", "suspended"]).default("published"),
  visibility: z.enum(["public", "unlisted", "private"]).optional(),
  creator: z.string().uuid().optional(),
  sort: z.enum(["newest", "popular", "rating", "calls", "name", "relevance"]).default("newest"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const SignAnnSchema = z.object({
  walletAddress: z.string().regex(/^[A-Z]{60}$/, "wallet address must be 60 uppercase A-Z"),
  signature: z.string().min(1).max(4096),
});

export interface ListResult {
  data: Ann[];
  total: number;
  limit: number;
  offset: number;
}

// ---------- Slug ----------

async function generateUniqueSlug(db: ReturnType<typeof getDb>, name: string): Promise<string> {
  const base = slugify(name) || "ann";
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${slugSuffix(4)}`;
    const existing = await db.select({ id: anns.id }).from(anns).where(eq(anns.slug, candidate)).limit(1);
    if (!existing[0]) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

// ---------- CRUD ----------

export async function createAnn(
  userId: string,
  input: z.infer<typeof CreateAnnSchema>,
): Promise<Ann> {
  const db = getDb();
  const slug = await generateUniqueSlug(db, input.name);

  let categoryId: string | null = null;
  if (input.categorySlug) {
    const cat = (await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, input.categorySlug)).limit(1))[0];
    if (cat) categoryId = cat.id;
  }
  let licenseId: string | null = null;
  if (input.licenseSlug) {
    const lic = (await db.select({ id: licenses.id }).from(licenses).where(eq(licenses.slug, input.licenseSlug)).limit(1))[0];
    if (lic) licenseId = lic.id;
  }

  const id = uid();
  const inserted = await db
    .insert(anns)
    .values({
      id,
      slug,
      name: input.name,
      tagline: input.tagline ?? null,
      description: input.description ?? null,
      icon: input.icon ?? null,
      tags: input.tags,
      categoryId,
      licenseId,
      creatorUserId: userId,
      creatorOrgId: input.orgId ?? null,
      creatorName: input.creatorName ?? userId,
      visibility: input.visibility,
      status: "draft",
      totalCalls: 0n,
      totalRevenueQubic: 0n,
      monthlyCalls: 0n,
      downloads: 0n,
      ratingCount: 0,
      decisionProtocol: input.decisionProtocol,
      trinaryPromptTemplate: input.trinaryPromptTemplate ?? null,
      authorityWeight: (input.authorityWeight ?? 0.5).toString(),
    } satisfies NewAnn)
    .returning();

  await logActivity(db, {
    action: "ann.created",
    actorUserId: userId,
    orgId: input.orgId ?? null,
    targetType: "ann",
    targetId: id,
    metadata: { slug, name: input.name, visibility: input.visibility },
  });

  // Phase 20.4 — register the ANN with the AigarthPool so users
  // can stake for it. The default splits (30/60/10) seed the
  // contract; the creator's wallet is the creator split destination.
  // We use the creator wallet address stored on the row, or fall
  // back to a deterministic placeholder. Wrapped in try/catch so
  // ANN creation never fails because of a simulator hiccup — the
  // off-chain row is the source of truth for the catalog.
  try {
    const creatorWallet = inserted[0]!.creatorWalletAddress ?? `PLACEHOLDER${id.replace(/-/g, "").slice(0, 50).toUpperCase()}`;
    const pool = getAigarthPool();
    const splits = defaultSplits(creatorWallet);
    // First registration: caller is the creator (implicit creator status).
    await pool.setAnnSplits(creatorWallet, id, splits.creatorBps, splits.userBps, splits.treasuryBps, splits.creatorWallet);
  } catch (err) {
    // AigarthPool registration failed — log but don't fail the
    // ANN creation. The user can retry via a future
    // `POST /v1/anns/:id/register-pool` admin endpoint.
    const code = err instanceof AigarthPoolError ? err.code : "UNKNOWN";
    await logActivity(db, {
      action: "ann.pool_register_failed",
      actorUserId: userId,
      orgId: input.orgId ?? null,
      targetType: "ann",
      targetId: id,
      metadata: { code, message: (err as Error)?.message ?? String(err) },
    });
  }

  return inserted[0]!;
}

export async function updateAnn(
  userId: string,
  annId: string,
  input: z.infer<typeof UpdateAnnSchema>,
): Promise<Ann | null> {
  const db = getDb();
  const ann = (await db.select().from(anns).where(eq(anns.id, annId)).limit(1))[0];
  if (!ann) return null;
  if (ann.creatorUserId !== userId) {
    throw new Error("Only the creator can update this ANN.");
  }
  if (ann.status === "suspended") {
    throw new Error("Cannot update a suspended ANN.");
  }

  const updates: Partial<NewAnn> = { updatedAt: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.tagline !== undefined) updates.tagline = input.tagline;
  if (input.description !== undefined) updates.description = input.description;
  if (input.icon !== undefined) updates.icon = input.icon;
  if (input.tags !== undefined) updates.tags = input.tags;
  if (input.visibility !== undefined) updates.visibility = input.visibility;
  if (input.decisionProtocol !== undefined) updates.decisionProtocol = input.decisionProtocol;
  if (input.trinaryPromptTemplate !== undefined) updates.trinaryPromptTemplate = input.trinaryPromptTemplate;
  if (input.authorityWeight !== undefined) updates.authorityWeight = input.authorityWeight.toString();

  if (input.categorySlug !== undefined) {
    if (input.categorySlug === null) {
      updates.categoryId = null;
    } else {
      const cat = (await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, input.categorySlug)).limit(1))[0];
      if (!cat) throw new Error(`Category '${input.categorySlug}' not found.`);
      updates.categoryId = cat.id;
    }
  }
  if (input.licenseSlug !== undefined) {
    if (input.licenseSlug === null) {
      updates.licenseId = null;
    } else {
      const lic = (await db.select({ id: licenses.id }).from(licenses).where(eq(licenses.slug, input.licenseSlug)).limit(1))[0];
      if (!lic) throw new Error(`License '${input.licenseSlug}' not found.`);
      updates.licenseId = lic.id;
    }
  }

  const updated = await db.update(anns).set(updates).where(eq(anns.id, annId)).returning();
  await logActivity(db, {
    action: "ann.updated",
    actorUserId: userId,
    targetType: "ann",
    targetId: annId,
    metadata: { fields: Object.keys(input) },
  });
  return updated[0] ?? null;
}

export async function publishAnn(userId: string, annId: string): Promise<Ann | null> {
  const db = getDb();
  const ann = (await db.select().from(anns).where(eq(anns.id, annId)).limit(1))[0];
  if (!ann) return null;
  if (ann.creatorUserId !== userId) {
    throw new Error("Only the creator can publish this ANN.");
  }
  if (ann.status === "published") return ann;
  if (ann.status === "deprecated" || ann.status === "suspended") {
    throw new Error(`Cannot publish an ANN in status '${ann.status}'.`);
  }

  // Must have at least one version
  const versionCount = (await db.select({ id: annVersions.id }).from(annVersions).where(eq(annVersions.annId, annId)).limit(1)).length;
  if (versionCount === 0) {
    throw new Error("Cannot publish an ANN without at least one version. Add a version first.");
  }

  const updated = await db
    .update(anns)
    .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(anns.id, annId))
    .returning();
  await logActivity(db, {
    action: "ann.published",
    actorUserId: userId,
    targetType: "ann",
    targetId: annId,
  });
  return updated[0] ?? null;
}

export async function deprecateAnn(userId: string, annId: string, reason?: string): Promise<Ann | null> {
  const db = getDb();
  const ann = (await db.select().from(anns).where(eq(anns.id, annId)).limit(1))[0];
  if (!ann) return null;
  if (ann.creatorUserId !== userId) {
    throw new Error("Only the creator can deprecate this ANN.");
  }
  const updated = await db
    .update(anns)
    .set({ status: "deprecated", updatedAt: new Date() })
    .where(eq(anns.id, annId))
    .returning();
  await logActivity(db, {
    action: "ann.deprecated",
    actorUserId: userId,
    targetType: "ann",
    targetId: annId,
    metadata: { reason: reason ?? null },
  });
  return updated[0] ?? null;
}

// ---------- Admin operations ----------

/** Admin-only: suspend an ANN. The creator cannot bypass this. */
export async function suspendAnn(adminUserId: string, annId: string, reason?: string): Promise<Ann | null> {
  const db = getDb();
  const ann = (await db.select().from(anns).where(eq(anns.id, annId)).limit(1))[0];
  if (!ann) return null;
  const updated = await db
    .update(anns)
    .set({ status: "suspended", updatedAt: new Date() })
    .where(eq(anns.id, annId))
    .returning();
  await logActivity(db, {
    action: "ann.suspended",
    actorUserId: adminUserId,
    targetType: "ann",
    targetId: annId,
    metadata: { reason: reason ?? null, suspendedFrom: ann.status },
  });
  return updated[0] ?? null;
}

/** Admin-only: restore a suspended ANN to published. */
export async function restoreAnn(adminUserId: string, annId: string): Promise<Ann | null> {
  const db = getDb();
  const ann = (await db.select().from(anns).where(eq(anns.id, annId)).limit(1))[0];
  if (!ann) return null;
  if (ann.status !== "suspended") return ann;
  const updated = await db
    .update(anns)
    .set({ status: "published", updatedAt: new Date() })
    .where(eq(anns.id, annId))
    .returning();
  await logActivity(db, {
    action: "ann.restored",
    actorUserId: adminUserId,
    targetType: "ann",
    targetId: annId,
  });
  return updated[0] ?? null;
}

/** Admin-only: force-deprecate an ANN (e.g. for ToS violation). Skips creator check. */
export async function adminDeprecateAnn(adminUserId: string, annId: string, reason?: string): Promise<Ann | null> {
  const db = getDb();
  const ann = (await db.select().from(anns).where(eq(anns.id, annId)).limit(1))[0];
  if (!ann) return null;
  const updated = await db
    .update(anns)
    .set({ status: "deprecated", updatedAt: new Date() })
    .where(eq(anns.id, annId))
    .returning();
  await logActivity(db, {
    action: "ann.admin_deprecated",
    actorUserId: adminUserId,
    targetType: "ann",
    targetId: annId,
    metadata: { reason: reason ?? null, previousStatus: ann.status, creatorUserId: ann.creatorUserId },
  });
  return updated[0] ?? null;
}

export async function signAnn(
  userId: string,
  annId: string,
  input: z.infer<typeof SignAnnSchema>,
): Promise<Ann | null> {
  const db = getDb();
  const ann = (await db.select().from(anns).where(eq(anns.id, annId)).limit(1))[0];
  if (!ann) return null;
  if (ann.creatorUserId !== userId) {
    throw new Error("Only the creator can sign this ANN.");
  }
  // Note: real K12 signature verification is a TODO (see services/identity/src/lib/qubic.ts).
  // For now we do format-only validation and store the signature.
  const updated = await db
    .update(anns)
    .set({
      creatorWalletAddress: input.walletAddress,
      signature: input.signature,
      updatedAt: new Date(),
    })
    .where(eq(anns.id, annId))
    .returning();
  await logActivity(db, {
    action: "ann.signed",
    actorUserId: userId,
    targetType: "ann",
    targetId: annId,
    metadata: { walletAddress: input.walletAddress },
  });
  return updated[0] ?? null;
}

// ---------- Read ----------

export async function getAnnById(id: string): Promise<Ann | null> {
  const db = getDb();
  const rows = await db.select().from(anns).where(eq(anns.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getAnnBySlug(slug: string): Promise<Ann | null> {
  const db = getDb();
  const rows = await db.select().from(anns).where(eq(anns.slug, slug)).limit(1);
  return rows[0] ?? null;
}

/** Resolve "id-or-slug" — accepts both. */
export async function getAnn(idOrSlug: string): Promise<Ann | null> {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug)) {
    return getAnnById(idOrSlug);
  }
  return getAnnBySlug(idOrSlug);
}

export async function listAnns(query: z.infer<typeof ListQuerySchema>): Promise<ListResult> {
  const db = getDb();
  const filters: ReturnType<typeof eq>[] = [];

  if (query.status) {
    filters.push(eq(anns.status, query.status));
  } else {
    filters.push(eq(anns.status, "published"));
  }
  if (query.visibility) {
    filters.push(eq(anns.visibility, query.visibility));
  } else {
    filters.push(eq(anns.visibility, "public"));
  }
  if (query.creator) {
    filters.push(eq(anns.creatorUserId, query.creator));
  }
  if (query.q) {
    const needle = `%${query.q.toLowerCase()}%`;
    if (query.fuzzy) {
      // Trigram similarity on name (uses pg_trgm GIN index, GIN trigram ops).
      // Threshold 0.15 is a reasonable default; lower = more permissive.
      const fuzzyCond = sql`(
        similarity(${anns.name}, ${query.q}) > 0.15
        OR similarity(COALESCE(${anns.tagline}, ''), ${query.q}) > 0.15
        OR similarity(COALESCE(${anns.description}, ''), ${query.q}) > 0.15
      )`;
      filters.push(fuzzyCond);
    } else {
      const orCond = or(
        ilike(anns.name, needle),
        ilike(anns.tagline, needle),
        ilike(anns.description, needle),
        sql`(${anns.tags}::text) ILIKE ${needle}`,
      );
      if (orCond) filters.push(orCond);
    }
  }
  if (query.category) {
    const cat = (await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, query.category)).limit(1))[0];
    if (cat) filters.push(eq(anns.categoryId, cat.id));
    else return { data: [], total: 0, limit: query.limit, offset: query.offset };
  }
  if (query.license) {
    const lic = (await db.select({ id: licenses.id }).from(licenses).where(eq(licenses.slug, query.license)).limit(1))[0];
    if (lic) filters.push(eq(anns.licenseId, lic.id));
    else return { data: [], total: 0, limit: query.limit, offset: query.offset };
  }

  const where = filters.length === 1 ? filters[0] : and(...filters);

  // Sorting
  let orderBy;
  switch (query.sort) {
    case "popular":
      orderBy = desc(anns.monthlyCalls);
      break;
    case "rating":
      orderBy = desc(anns.ratingAverage);
      break;
    case "calls":
      orderBy = desc(anns.totalCalls);
      break;
    case "name":
      orderBy = asc(anns.name);
      break;
    case "relevance":
      // When there's a query, rank by best match. Without a query, fall back to newest.
      if (query.q) {
        orderBy = sql`GREATEST(
          similarity(${anns.name}, ${query.q}),
          similarity(COALESCE(${anns.tagline}, ''), ${query.q}),
          similarity(COALESCE(${anns.description}, ''), ${query.q})
        ) DESC`;
      } else {
        orderBy = desc(anns.publishedAt);
      }
      break;
    case "newest":
    default:
      orderBy = desc(anns.publishedAt);
  }

  const data = await db
    .select()
    .from(anns)
    .where(where)
    .orderBy(orderBy)
    .limit(query.limit)
    .offset(query.offset);

  // For total count, we approximate by running a parallel select with the same WHERE.
  // Simpler & correct: re-build the same WHERE via drizzle's where().
  // Since we already built `where`, we can use it directly.
  const totalRows = await db.select({ id: anns.id }).from(anns).where(where);
  return {
    data,
    total: totalRows.length,
    limit: query.limit,
    offset: query.offset,
  };
}

// ---------- Rating aggregation ----------

/** Recompute the denormalized rating_average and rating_count for an ANN. */
export async function recomputeRatingAggregates(annId: string): Promise<void> {
  const db = getDb();
  const result = await db
    .select({
      avg: sql<string | null>`AVG(${annRatings.rating})::numeric(3,2)::text`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(annRatings)
    .where(eq(annRatings.annId, annId));
  const r = result[0] ?? { avg: null, count: 0 };
  await db
    .update(anns)
    .set({
      ratingAverage: r.avg,
      ratingCount: r.count ?? 0,
      updatedAt: new Date(),
    })
    .where(eq(anns.id, annId));
}

/** Forcibly return popular ANNs (used by homepage). */
export async function listPopular(limit = 8): Promise<Ann[]> {
  const db = getDb();
  return db
    .select()
    .from(anns)
    .where(and(eq(anns.status, "published"), eq(anns.visibility, "public")))
    .orderBy(desc(anns.monthlyCalls))
    .limit(limit);
}

/** Get the licenses a user has been granted (active only). */
export async function getUserLicensedAnns(userId: string): Promise<Ann[]> {
  const db = getDb();
  const grants = await db
    .select({ annId: annLicensesGranted.annId })
    .from(annLicensesGranted)
    .where(and(eq(annLicensesGranted.userId, userId), eq(annLicensesGranted.status, "active")));
  if (grants.length === 0) return [];
  const ids = grants.map((g) => g.annId);
  return db.select().from(anns).where(inArray(anns.id, ids));
}
