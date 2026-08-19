/**
 * Organization service — create, list, members, teams.
 *
 * Org creation is open to any authenticated user. Membership management
 * is restricted to org owners/admins (enforced at the route level).
 */

import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import {
  organizations,
  memberships,
  teams,
  teamMembers,
  users,
  type Organization,
  type Membership,
  type MembershipRole,
} from "../db/schema.js";
import { uid } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";
import { slugify } from "@aigarth/utils/strings";

// ---------- Schemas ----------

export const CreateOrgSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and dashes only")
    .optional(),
  name: z.string().trim().min(1).max(120),
  billingEmail: z.string().email().max(320).optional(),
});

export const UpdateOrgSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  billingEmail: z.string().email().max(320).nullable().optional(),
  avatarUrl: z.string().url().max(2048).nullable().optional(),
});

export const AddMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "member", "viewer"]).default("member"),
  scopes: z.array(z.string().min(1).max(120)).max(64).optional(),
});

export const UpdateMemberSchema = z.object({
  role: z.enum(["owner", "admin", "member", "viewer"]).optional(),
  scopes: z.array(z.string().min(1).max(120)).max(64).optional(),
});

export const CreateTeamSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and dashes only"),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).optional(),
});

// ---------- Create org ----------

export async function createOrg(
  input: z.infer<typeof CreateOrgSchema>,
  ownerUserId: string,
): Promise<{ org: Organization; membership: Membership }> {
  const db = getDb();
  const slug = input.slug ?? makeUniqueSlug(input.name);

  // Check slug uniqueness (case-insensitive)
  const existing = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(sql`lower(${organizations.slug}) = ${slug.toLowerCase()}`)
    .limit(1);
  if (existing[0]) throw new Error("An organization with this slug already exists.");

  const orgId = uid();
  const inserted = await db
    .insert(organizations)
    .values({
      id: orgId,
      slug,
      name: input.name,
      isPersonal: false,
      billingEmail: input.billingEmail,
    })
    .returning();
  const org = inserted[0]!;

  const membershipId = uid();
  const ms = await db
    .insert(memberships)
    .values({
      id: membershipId,
      userId: ownerUserId,
      orgId,
      role: "owner",
      invitedBy: ownerUserId,
    })
    .returning();
  const membership = ms[0]!;

  logActivity(db, {
    action: "org.created",
    actorUserId: ownerUserId,
    orgId,
    targetType: "org",
    targetId: orgId,
    metadata: { slug, name: input.name },
  });
  logActivity(db, {
    action: "org.member_added",
    actorUserId: ownerUserId,
    orgId,
    targetType: "user",
    targetId: ownerUserId,
    metadata: { role: "owner", selfAdded: true },
  });

  return { org, membership };
}

// ---------- List user orgs ----------

export async function listUserOrgs(userId: string): Promise<Array<Organization & { role: MembershipRole; scopes: string[] }>> {
  const db = getDb();
  const rows = await db
    .select({
      org: organizations,
      role: memberships.role,
      scopes: memberships.scopes,
    })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.orgId, organizations.id))
    .where(eq(memberships.userId, userId));

  return rows
    .filter((r) => r.org.deletedAt === null)
    .map((r) => ({
      ...r.org,
      role: r.role,
      scopes: r.scopes ?? [],
    }));
}

export async function getOrg(orgId: string): Promise<Organization | null> {
  const db = getDb();
  const rows = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  const org = rows[0];
  if (!org || org.deletedAt) return null;
  return org;
}

export async function updateOrg(
  orgId: string,
  input: z.infer<typeof UpdateOrgSchema>,
  actorUserId: string,
): Promise<Organization> {
  const db = getDb();
  const existing = await getOrg(orgId);
  if (!existing) throw new Error("Organization not found.");

  const updates: Partial<Organization> = { updatedAt: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.billingEmail !== undefined) updates.billingEmail = input.billingEmail;
  if (input.avatarUrl !== undefined) updates.avatarUrl = input.avatarUrl;

  await db.update(organizations).set(updates).where(eq(organizations.id, orgId));
  logActivity(db, {
    action: "org.created", // reuse enum (we don't have a separate "updated" action)
    actorUserId,
    orgId,
    targetType: "org",
    targetId: orgId,
    metadata: { kind: "updated", fields: Object.keys(updates).filter((k) => k !== "updatedAt") },
  });
  return (await getOrg(orgId))!;
}

export async function deleteOrg(orgId: string, actorUserId: string): Promise<void> {
  const db = getDb();
  const existing = await getOrg(orgId);
  if (!existing) throw new Error("Organization not found.");
  if (existing.isPersonal) throw new Error("Cannot delete a personal organization.");
  await db
    .update(organizations)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(organizations.id, orgId));
  logActivity(db, {
    action: "org.created",
    actorUserId,
    orgId,
    targetType: "org",
    targetId: orgId,
    metadata: { kind: "deleted" },
  });
}

// ---------- Members ----------

export async function listMembers(orgId: string): Promise<
  Array<{
    id: string;
    userId: string;
    email: string;
    name: string;
    role: MembershipRole;
    scopes: string[];
    joinedAt: Date;
    invitedBy: string | null;
  }>
> {
  const db = getDb();
  const rows = await db
    .select({
      membership: memberships,
      user: users,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.orgId, orgId));
  return rows
    .filter((r) => r.membership.removedAt === null)
    .map((r) => ({
      id: r.membership.id,
      userId: r.user.id,
      email: r.user.email,
      name: r.user.name,
      role: r.membership.role,
      scopes: r.membership.scopes ?? [],
      joinedAt: r.membership.joinedAt,
      invitedBy: r.membership.invitedBy,
    }));
}

export async function addMember(
  orgId: string,
  input: z.infer<typeof AddMemberSchema>,
  actorUserId: string,
): Promise<Membership> {
  const db = getDb();
  // Verify target user exists
  const userRows = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  const user = userRows[0];
  if (!user || user.status === "deleted") throw new Error("User not found.");

  // Already a member?
  const existing = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, input.userId)))
    .limit(1);
  const ex = existing[0];
  if (ex && ex.removedAt === null) {
    throw new Error("User is already a member of this organization.");
  }

  const id = uid();
  const inserted = await db
    .insert(memberships)
    .values({
      id,
      userId: input.userId,
      orgId,
      role: input.role,
      scopes: input.scopes ?? [],
      invitedBy: actorUserId,
    })
    .onConflictDoUpdate({
      target: [memberships.userId, memberships.orgId],
      set: {
        role: input.role,
        scopes: input.scopes ?? [],
        invitedBy: actorUserId,
        removedAt: null,
        joinedAt: new Date(),
      },
    })
    .returning();
  const membership = inserted[0]!;

  logActivity(db, {
    action: "org.member_added",
    actorUserId,
    orgId,
    targetType: "user",
    targetId: input.userId,
    metadata: { role: input.role },
  });
  return membership;
}

export async function updateMember(
  orgId: string,
  membershipId: string,
  input: z.infer<typeof UpdateMemberSchema>,
  actorUserId: string,
): Promise<Membership> {
  const db = getDb();
  const rows = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.id, membershipId), eq(memberships.orgId, orgId)))
    .limit(1);
  const existing = rows[0];
  if (!existing || existing.removedAt) throw new Error("Member not found.");

  // Guardrail: don't allow demoting the last owner
  if (existing.role === "owner" && input.role && input.role !== "owner") {
    const owners = await db
      .select()
      .from(memberships)
      .where(eq(memberships.orgId, orgId));
    const remainingOwners = owners.filter((m) => m.removedAt === null && m.role === "owner" && m.id !== existing.id);
    if (remainingOwners.length === 0) {
      throw new Error("Cannot demote the last owner. Promote another member to owner first.");
    }
  }

  const updates: Partial<Membership> = {};
  if (input.role !== undefined) updates.role = input.role;
  if (input.scopes !== undefined) updates.scopes = input.scopes;
  await db.update(memberships).set(updates).where(eq(memberships.id, membershipId));

  logActivity(db, {
    action: "org.role_changed",
    actorUserId,
    orgId,
    targetType: "user",
    targetId: existing.userId,
    metadata: { from: existing.role, to: input.role ?? existing.role },
  });
  const updated = await db.select().from(memberships).where(eq(memberships.id, membershipId)).limit(1);
  return updated[0]!;
}

export async function removeMember(
  orgId: string,
  membershipId: string,
  actorUserId: string,
): Promise<void> {
  const db = getDb();
  const rows = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.id, membershipId), eq(memberships.orgId, orgId)))
    .limit(1);
  const existing = rows[0];
  if (!existing || existing.removedAt) throw new Error("Member not found.");
  if (existing.role === "owner") {
    const owners = await db
      .select()
      .from(memberships)
      .where(eq(memberships.orgId, orgId));
    const remainingOwners = owners.filter((m) => m.removedAt === null && m.role === "owner" && m.id !== existing.id);
    if (remainingOwners.length === 0) {
      throw new Error("Cannot remove the last owner.");
    }
  }
  await db
    .update(memberships)
    .set({ removedAt: new Date() })
    .where(eq(memberships.id, membershipId));
  // Revoke all API keys for this user in this org
  // (caller's responsibility; we expose this so the route can do it in a transaction)
  logActivity(db, {
    action: "org.member_removed",
    actorUserId,
    orgId,
    targetType: "user",
    targetId: existing.userId,
    metadata: { role: existing.role },
  });
}

// ---------- Teams ----------

export async function listTeams(orgId: string) {
  const db = getDb();
  return db.select().from(teams).where(eq(teams.orgId, orgId));
}

export async function createTeam(
  orgId: string,
  input: z.infer<typeof CreateTeamSchema>,
  actorUserId: string,
) {
  const db = getDb();
  // slug unique within org
  const existing = await db
    .select()
    .from(teams)
    .where(and(eq(teams.orgId, orgId), eq(teams.slug, input.slug)))
    .limit(1);
  if (existing[0]) throw new Error("A team with this slug already exists in this org.");
  const id = uid();
  const inserted = await db
    .insert(teams)
    .values({ id, orgId, slug: input.slug, name: input.name, description: input.description })
    .returning();
  logActivity(db, {
    action: "org.created",
    actorUserId,
    orgId,
    targetType: "team",
    targetId: id,
    metadata: { kind: "team_created", slug: input.slug, name: input.name },
  });
  return inserted[0]!;
}

export async function addTeamMember(
  orgId: string,
  teamId: string,
  membershipId: string,
  actorUserId: string,
) {
  const db = getDb();
  // Verify the membership is in this org
  const mem = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.id, membershipId), eq(memberships.orgId, orgId)))
    .limit(1);
  if (!mem[0]) throw new Error("Member not found in this org.");
  const team = await db
    .select()
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.orgId, orgId)))
    .limit(1);
  if (!team[0]) throw new Error("Team not found in this org.");
  await db
    .insert(teamMembers)
    .values({ teamId, membershipId })
    .onConflictDoNothing();
  logActivity(db, {
    action: "org.created",
    actorUserId,
    orgId,
    targetType: "team",
    targetId: teamId,
    metadata: { kind: "team_member_added", membershipId },
  });
}

// ---------- Helpers ----------

function makeUniqueSlug(name: string): string {
  return slugify(name).slice(0, 32) || "workspace";
}
