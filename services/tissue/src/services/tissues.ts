/**
 * Tissues — CRUD on the tissue + members.
 *
 * Phase 18D. The bounded context:
 *   - `Tissue` is a named composition of ANNs with a consensus policy
 *   - `TissueMember` is an ANN that participates, with role + authority
 *   - Membership is by ANN slug (cross-service), not by uuid FK
 *   - The policy is a JSONB blob that must round-trip through
 *     `ConsensusPolicySchema` from `@aigarth/trinary`
 */

import { eq, and, desc, asc, ilike, or, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  ConsensusPolicySchema,
  TRINARY_STATES,
  type ConsensusPolicy,
} from "@aigarth/trinary";
import { getDb } from "../db/index.js";
import {
  tissues,
  tissueMembers,
  auditLogs,
  type Tissue,
  type NewTissue,
  type TissueMember,
  type NewTissueMember,
  type TissueMemberRole,
} from "../db/schema.js";
import { uid, slugify, slugSuffix } from "../lib/ids.js";
import { logActivity, auditAction } from "../lib/audit.js";
import { loadConfig } from "../config/index.js";

// ---------- Schemas ----------

/** The four policy shapes the v1 platform supports. Re-exported from the trinary package. */
export const CreateTissueSchema = z.object({
  name: z.string().min(1).max(120),
  tagline: z.string().max(200).optional(),
  description: z.string().max(20_000).optional(),
  visibility: z.enum(["public", "unlisted", "private"]).default("public"),
  orgId: z.string().uuid().optional(),
  policy: ConsensusPolicySchema,
  metadata: z.record(z.unknown()).default({}),
});

export const UpdateTissueSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  tagline: z.string().max(200).nullable().optional(),
  description: z.string().max(20_000).nullable().optional(),
  visibility: z.enum(["public", "unlisted", "private"]).optional(),
  policy: ConsensusPolicySchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const AddMemberSchema = z.object({
  ann_slug: z.string().min(1).max(120),
  ann_id: z.string().uuid().optional(),
  role: z.enum(["voting", "veto", "advisory"]).default("voting"),
  authority_weight: z.number().min(0).max(1).default(0.5),
  position: z.number().int().min(0).default(0),
});

export const ListQuerySchema = z.object({
  q: z.string().max(200).optional(),
  status: z.enum(["draft", "active", "paused", "deprecated"]).default("active"),
  visibility: z.enum(["public", "unlisted", "private"]).optional(),
  owner: z.string().uuid().optional(),
  policy_kind: z.enum(["weighted_majority", "veto_aware", "unanimous", "short_circuit"]).optional(),
  sort: z.enum(["newest", "oldest", "name", "decisions"]).default("newest"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const ListMembersQuerySchema = z.object({
  role: z.enum(["voting", "veto", "advisory"]).optional(),
  sort: z.enum(["position", "slug", "authority"]).default("position"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export interface ListResult {
  data: Tissue[];
  total: number;
  limit: number;
  offset: number;
}

// ---------- Errors ----------

export class TissueNotFoundError extends Error {
  constructor(idOrSlug: string) {
    super(`Tissue '${idOrSlug}' not found.`);
    this.name = "TissueNotFoundError";
  }
}

export class TissueNotActiveError extends Error {
  constructor(tissueId: string, status: string) {
    super(`Tissue '${tissueId}' is in status '${status}', not 'active'.`);
    this.name = "TissueNotActiveError";
  }
}

export class TissueNoMembersError extends Error {
  constructor(tissueId: string) {
    super(`Tissue '${tissueId}' has no members.`);
    this.name = "TissueNoMembersError";
  }
}

export class TissueMemberLimitError extends Error {
  constructor(tissueId: string, limit: number) {
    super(`Tissue '${tissueId}' is at the member limit of ${limit}.`);
    this.name = "TissueMemberLimitError";
  }
}

export class TissueDuplicateMemberError extends Error {
  constructor(tissueId: string, annSlug: string) {
    super(`Tissue '${tissueId}' already has member '${annSlug}'.`);
    this.name = "TissueDuplicateMemberError";
  }
}

// ---------- Slug ----------

async function generateUniqueSlug(db: ReturnType<typeof getDb>, name: string): Promise<string> {
  const base = slugify(name) || "tissue";
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${slugSuffix(4)}`;
    const existing = await db
      .select({ id: tissues.id })
      .from(tissues)
      .where(eq(tissues.slug, candidate))
      .limit(1);
    if (!existing[0]) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

// ---------- CRUD ----------

export async function createTissue(
  userId: string,
  input: z.infer<typeof CreateTissueSchema>,
): Promise<Tissue> {
  const db = getDb();
  const slug = await generateUniqueSlug(db, input.name);

  const id = uid();
  const inserted = await db
    .insert(tissues)
    .values({
      id,
      slug,
      name: input.name,
      tagline: input.tagline ?? null,
      description: input.description ?? null,
      ownerUserId: userId,
      ownerOrgId: input.orgId ?? null,
      visibility: input.visibility,
      status: "draft",
      version: "1.0.0",
      policy: input.policy as unknown as Record<string, unknown>,
      policyKind: input.policy.kind,
      metadata: input.metadata,
      totalDecisions: 0n,
    } satisfies NewTissue)
    .returning();

  await logActivity(db, {
    action: auditAction.tissueCreated,
    actorUserId: userId,
    orgId: input.orgId ?? null,
    targetType: "tissue",
    targetId: id,
    metadata: { slug, name: input.name, policy_kind: input.policy.kind },
  });

  return inserted[0]!;
}

export async function updateTissue(
  userId: string,
  tissueId: string,
  input: z.infer<typeof UpdateTissueSchema>,
): Promise<Tissue | null> {
  const db = getDb();
  const t = (await db.select().from(tissues).where(eq(tissues.id, tissueId)).limit(1))[0];
  if (!t) return null;
  if (t.ownerUserId !== userId) {
    throw new Error("Only the owner can update this tissue.");
  }

  const updates: Partial<NewTissue> = { updatedAt: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.tagline !== undefined) updates.tagline = input.tagline;
  if (input.description !== undefined) updates.description = input.description;
  if (input.visibility !== undefined) updates.visibility = input.visibility;
  if (input.metadata !== undefined) updates.metadata = input.metadata;
  if (input.policy !== undefined) {
    updates.policy = input.policy as unknown as Record<string, unknown>;
    updates.policyKind = input.policy.kind;
    // Bump version on policy change
    const [major, minor, patch] = t.version.split(".").map((n) => parseInt(n, 10));
    updates.version = `${major}.${(minor ?? 0) + 1}.${patch ?? 0}`;
  }

  const updated = await db.update(tissues).set(updates).where(eq(tissues.id, tissueId)).returning();
  await logActivity(db, {
    action: auditAction.tissueUpdated,
    actorUserId: userId,
    targetType: "tissue",
    targetId: tissueId,
    metadata: { fields: Object.keys(input) },
  });
  return updated[0] ?? null;
}

export async function publishTissue(userId: string, tissueId: string): Promise<Tissue | null> {
  const db = getDb();
  const t = (await db.select().from(tissues).where(eq(tissues.id, tissueId)).limit(1))[0];
  if (!t) return null;
  if (t.ownerUserId !== userId) {
    throw new Error("Only the owner can publish this tissue.");
  }
  if (t.status === "active") return t;
  if (t.status === "deprecated") {
    throw new Error(`Cannot publish a deprecated tissue.`);
  }

  // Must have at least one member
  const memberCount = (
    await db.select({ id: tissueMembers.id }).from(tissueMembers).where(eq(tissueMembers.tissueId, tissueId)).limit(1)
  ).length;
  if (memberCount === 0) {
    throw new Error("Cannot publish a tissue without at least one member.");
  }

  const updated = await db
    .update(tissues)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(tissues.id, tissueId))
    .returning();
  await logActivity(db, {
    action: auditAction.tissuePublished,
    actorUserId: userId,
    targetType: "tissue",
    targetId: tissueId,
  });
  return updated[0] ?? null;
}

export async function pauseTissue(userId: string, tissueId: string): Promise<Tissue | null> {
  const db = getDb();
  const t = (await db.select().from(tissues).where(eq(tissues.id, tissueId)).limit(1))[0];
  if (!t) return null;
  if (t.ownerUserId !== userId) throw new Error("Only the owner can pause this tissue.");
  const updated = await db
    .update(tissues)
    .set({ status: "paused", updatedAt: new Date() })
    .where(eq(tissues.id, tissueId))
    .returning();
  await logActivity(db, {
    action: auditAction.tissuePaused,
    actorUserId: userId,
    targetType: "tissue",
    targetId: tissueId,
  });
  return updated[0] ?? null;
}

// ---------- Read ----------

export async function getTissueById(id: string): Promise<Tissue | null> {
  const db = getDb();
  const rows = await db.select().from(tissues).where(eq(tissues.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getTissueBySlug(slug: string): Promise<Tissue | null> {
  const db = getDb();
  const rows = await db.select().from(tissues).where(eq(tissues.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getTissue(idOrSlug: string): Promise<Tissue | null> {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug)) {
    return getTissueById(idOrSlug);
  }
  return getTissueBySlug(idOrSlug);
}

export async function listTissues(query: z.infer<typeof ListQuerySchema>): Promise<ListResult> {
  const db = getDb();
  const filters: ReturnType<typeof eq>[] = [];

  if (query.status) {
    filters.push(eq(tissues.status, query.status));
  } else {
    filters.push(eq(tissues.status, "active"));
  }
  if (query.visibility) {
    filters.push(eq(tissues.visibility, query.visibility));
  } else {
    filters.push(eq(tissues.visibility, "public"));
  }
  if (query.owner) {
    filters.push(eq(tissues.ownerUserId, query.owner));
  }
  if (query.policy_kind) {
    filters.push(eq(tissues.policyKind, query.policy_kind));
  }
  if (query.q) {
    const needle = `%${query.q.toLowerCase()}%`;
    const orCond = or(
      ilike(tissues.name, needle),
      ilike(tissues.tagline, needle),
      ilike(tissues.description, needle),
    );
    if (orCond) filters.push(orCond);
  }

  const where = filters.length === 1 ? filters[0] : and(...filters);

  let orderBy;
  switch (query.sort) {
    case "oldest":
      orderBy = asc(tissues.createdAt);
      break;
    case "name":
      orderBy = asc(tissues.name);
      break;
    case "decisions":
      orderBy = desc(tissues.totalDecisions);
      break;
    case "newest":
    default:
      orderBy = desc(tissues.createdAt);
  }

  const data = await db
    .select()
    .from(tissues)
    .where(where)
    .orderBy(orderBy)
    .limit(query.limit)
    .offset(query.offset);

  const totalRows = await db.select({ id: tissues.id }).from(tissues).where(where);
  return {
    data,
    total: totalRows.length,
    limit: query.limit,
    offset: query.offset,
  };
}

// ---------- Members ----------

export async function addMember(
  userId: string,
  tissueId: string,
  input: z.infer<typeof AddMemberSchema>,
): Promise<TissueMember> {
  const db = getDb();
  const t = (await db.select().from(tissues).where(eq(tissues.id, tissueId)).limit(1))[0];
  if (!t) throw new TissueNotFoundError(tissueId);
  if (t.ownerUserId !== userId) throw new Error("Only the owner can add members.");
  if (t.status === "deprecated") throw new Error("Cannot add members to a deprecated tissue.");

  // Enforce the member limit
  const cfg = loadConfig();
  const existing = await db
    .select({ id: tissueMembers.id })
    .from(tissueMembers)
    .where(eq(tissueMembers.tissueId, tissueId));
  if (existing.length >= cfg.TISSUE_MAX_MEMBERS) {
    throw new TissueMemberLimitError(tissueId, cfg.TISSUE_MAX_MEMBERS);
  }

  // Reject duplicates
  const dup = (
    await db
      .select({ id: tissueMembers.id })
      .from(tissueMembers)
      .where(and(eq(tissueMembers.tissueId, tissueId), eq(tissueMembers.annSlug, input.ann_slug)))
      .limit(1)
  )[0];
  if (dup) throw new TissueDuplicateMemberError(tissueId, input.ann_slug);

  const id = uid();
  const inserted = await db
    .insert(tissueMembers)
    .values({
      id,
      tissueId,
      annSlug: input.ann_slug,
      annId: input.ann_id ?? null,
      role: input.role,
      authorityWeight: input.authority_weight.toString(),
      position: input.position,
    } satisfies NewTissueMember)
    .returning();

  await logActivity(db, {
    action: auditAction.memberAdded,
    actorUserId: userId,
    targetType: "tissue_member",
    targetId: id,
    metadata: { tissueId, ann_slug: input.ann_slug, role: input.role },
  });

  return inserted[0]!;
}

export async function removeMember(
  userId: string,
  tissueId: string,
  memberId: string,
): Promise<boolean> {
  const db = getDb();
  const t = (await db.select().from(tissues).where(eq(tissues.id, tissueId)).limit(1))[0];
  if (!t) throw new TissueNotFoundError(tissueId);
  if (t.ownerUserId !== userId) throw new Error("Only the owner can remove members.");

  const result = await db
    .delete(tissueMembers)
    .where(and(eq(tissueMembers.id, memberId), eq(tissueMembers.tissueId, tissueId)))
    .returning();
  if (!result[0]) return false;

  await logActivity(db, {
    action: auditAction.memberRemoved,
    actorUserId: userId,
    targetType: "tissue_member",
    targetId: memberId,
    metadata: { tissueId, ann_slug: result[0].annSlug },
  });
  return true;
}

export async function listMembers(
  tissueId: string,
  query: z.infer<typeof ListMembersQuerySchema>,
): Promise<{ data: TissueMember[]; total: number; limit: number; offset: number }> {
  const db = getDb();
  const filters: ReturnType<typeof eq>[] = [eq(tissueMembers.tissueId, tissueId)];
  if (query.role) filters.push(eq(tissueMembers.role, query.role));

  const where = filters.length === 1 ? filters[0] : and(...filters);

  let orderBy;
  switch (query.sort) {
    case "slug":
      orderBy = asc(tissueMembers.annSlug);
      break;
    case "authority":
      orderBy = desc(tissueMembers.authorityWeight);
      break;
    case "position":
    default:
      orderBy = asc(tissueMembers.position);
  }

  const data = await db
    .select()
    .from(tissueMembers)
    .where(where)
    .orderBy(orderBy)
    .limit(query.limit)
    .offset(query.offset);

  const totalRows = await db.select({ id: tissueMembers.id }).from(tissueMembers).where(where);
  return { data, total: totalRows.length, limit: query.limit, offset: query.offset };
}

export async function getActiveMembers(tissueId: string): Promise<TissueMember[]> {
  const db = getDb();
  return db
    .select()
    .from(tissueMembers)
    .where(eq(tissueMembers.tissueId, tissueId))
    .orderBy(asc(tissueMembers.position));
}

/** Re-export for callers that need the trinary tuple or the policy type. */
export { TRINARY_STATES };
export type { ConsensusPolicy };
