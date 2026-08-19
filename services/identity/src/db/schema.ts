/**
 * Identity service — Drizzle schema.
 *
 * All tables use UUID primary keys (gen_random_uuid()).
 * All timestamps are stored as `timestamp with time zone` (Postgres `timestamptz`).
 * Soft delete is via `deleted_at` on rows where we need to retain history.
 *
 * Tables:
 *   users              — one per person
 *   user_credentials   — Argon2id hash + rotation
 *   email_verifications — pending email changes
 *   password_resets    — password reset tokens
 *   sessions           — active JWT sessions (so we can revoke)
 *   organizations      — tenant (org, company, team, individual)
 *   memberships        — user ↔ org
 *   teams              — sub-grouping within an org
 *   team_members       — user ↔ team (via membership)
 *   roles              — named role per org
 *   api_keys           — long-lived programmatic keys
 *   wallet_links       — Qubic wallet signed-nonce links
 *   mfa_credentials    — TOTP / WebAuthn
 *   audit_logs         — every state-changing event
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ---------- Enums ----------

export const userStatus = pgEnum("user_status", [
  "active",
  "suspended",
  "pending_verification",
  "deleted",
]);

export const membershipRole = pgEnum("membership_role", [
  "owner",
  "admin",
  "member",
  "viewer",
]);

export const apiKeyStatus = pgEnum("api_key_status", [
  "active",
  "rotated",
  "revoked",
]);

export const mfaType = pgEnum("mfa_type", ["totp", "webauthn"]);

export const auditAction = pgEnum("audit_action", [
  "user.created",
  "user.email_verified",
  "user.password_changed",
  "user.suspended",
  "user.deleted",
  "session.created",
  "session.revoked",
  "org.created",
  "org.member_added",
  "org.member_removed",
  "org.role_changed",
  "api_key.created",
  "api_key.rotated",
  "api_key.revoked",
  "wallet.linked",
  "wallet.unlinked",
  "mfa.enrolled",
  "mfa.removed",
  "login.succeeded",
  "login.failed",
]);

// ---------- Users ----------

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    name: text("name").notNull(),
    avatarUrl: text("avatar_url"),
    status: userStatus("status").notNull().default("pending_verification"),
    locale: text("locale").notNull().default("en"),
    timezone: text("timezone").notNull().default("UTC"),
    /** Hashed IP for abuse detection. */
    signupIpHash: text("signup_ip_hash"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_lower_idx").on(sql`lower(${t.email})`),
    statusIdx: index("users_status_idx").on(t.status),
  }),
);

export const userCredentials = pgTable("user_credentials", {
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .primaryKey(),
  /** Argon2id hash. */
  passwordHash: text("password_hash").notNull(),
  /** Argon2 parameters used (so we can rotate cost). */
  hashParams: jsonb("hash_params")
    .$type<{ type: "argon2id"; memory: number; iterations: number; parallelism: number }>()
    .notNull(),
  /** When the password was last changed. */
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  /** Must-change flag — set on password reset until next login. */
  mustChange: boolean("must_change").notNull().default(false),
});

// ---------- Email verification & password reset ----------

export const emailVerifications = pgTable("email_verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  /** SHA-256 of the token (token itself only in email). */
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const passwordResets = pgTable("password_resets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Sessions ----------

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** JWT ID (jti) — unique. */
    jti: text("jti").notNull(),
    /** Optional: when the session was created via an API key. */
    apiKeyId: uuid("api_key_id"),
    /** User agent string (truncated). */
    userAgent: text("user_agent"),
    /** IP hash. */
    ipHash: text("ip_hash"),
    /** Last activity. */
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedReason: text("revoked_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    jtiIdx: uniqueIndex("sessions_jti_idx").on(t.jti),
    userIdx: index("sessions_user_idx").on(t.userId),
  }),
);

// ---------- Organizations ----------

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    /** Personal org (one per user) vs team org. */
    isPersonal: boolean("is_personal").notNull().default(false),
    avatarUrl: text("avatar_url"),
    billingEmail: text("billing_email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    slugIdx: uniqueIndex("organizations_slug_lower_idx").on(sql`lower(${t.slug})`),
  }),
);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: membershipRole("role").notNull().default("member"),
    /** Custom scopes (e.g. ["billing.write", "models.publish"]). */
    scopes: jsonb("scopes").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    invitedBy: uuid("invited_by").references(() => users.id),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
  },
  (t) => ({
    userOrgIdx: uniqueIndex("memberships_user_org_idx").on(t.userId, t.orgId),
    orgIdx: index("memberships_org_idx").on(t.orgId),
  }),
);

// ---------- Teams ----------

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgSlugIdx: uniqueIndex("teams_org_slug_idx").on(t.orgId, t.slug),
  }),
);

export const teamMembers = pgTable(
  "team_members",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.teamId, t.membershipId] }),
  }),
);

// ---------- API keys ----------

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    /** Public prefix (ak_live_xxx). */
    prefix: text("prefix").notNull(),
    /** SHA-256 of the secret. */
    secretHash: text("secret_hash").notNull(),
    name: text("name").notNull(),
    /** Scoped permissions. Empty array = full access within the org. */
    scopes: jsonb("scopes").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    status: apiKeyStatus("status").notNull().default("active"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    /** Hard expiry (null = never). */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    /** When this key was rotated, the new key's id. */
    rotatedToId: uuid("rotated_to_id"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedReason: text("revoked_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    prefixIdx: uniqueIndex("api_keys_prefix_idx").on(t.prefix),
    orgIdx: index("api_keys_org_idx").on(t.orgId),
  }),
);

// ---------- Qubic wallet linking ----------

export const walletLinks = pgTable(
  "wallet_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Qubic address (60-char base26 identity). */
    qubicAddress: text("qubic_address").notNull(),
    /** Last nonce we issued. The user must sign the next one. */
    lastNonce: text("last_nonce"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => ({
    userAddrIdx: uniqueIndex("wallet_links_user_addr_idx").on(t.userId, t.qubicAddress),
    addrIdx: index("wallet_links_addr_idx").on(t.qubicAddress),
  }),
);

// ---------- MFA ----------

export const mfaCredentials = pgTable(
  "mfa_credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: mfaType("type").notNull(),
    /** Human label ("iPhone 15", "YubiKey 5"). */
    label: text("label").notNull(),
    /** TOTP secret (encrypted at rest in production). */
    totpSecret: text("totp_secret"),
    /** WebAuthn credential. */
    webauthnCredentialId: text("webauthn_credential_id"),
    webauthnPublicKey: text("webauthn_public_key"),
    webauthnCounter: integer("webauthn_counter").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => ({
    userIdx: index("mfa_credentials_user_idx").on(t.userId),
  }),
);

// ---------- Audit log ----------

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Optional actor (user). Null for system events. */
    actorUserId: uuid("actor_user_id").references(() => users.id),
    /** Optional org context. */
    orgId: uuid("org_id").references(() => organizations.id),
    action: auditAction("action").notNull(),
    /** The affected resource (user/org/api_key/etc). */
    targetType: text("target_type"),
    targetId: text("target_id"),
    /** Free-form metadata. */
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    actorIdx: index("audit_logs_actor_idx").on(t.actorUserId),
    orgIdx: index("audit_logs_org_idx").on(t.orgId),
    actionIdx: index("audit_logs_action_idx").on(t.action),
    createdIdx: index("audit_logs_created_idx").on(t.createdAt),
  }),
);

// ---------- Relations ----------

export const usersRelations = relations(users, ({ one, many }) => ({
  credentials: one(userCredentials, {
    fields: [users.id],
    references: [userCredentials.userId],
  }),
  sessions: many(sessions),
  memberships: many(memberships),
  walletLinks: many(walletLinks),
  mfaCredentials: many(mfaCredentials),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
  teams: many(teams),
  apiKeys: many(apiKeys),
}));

export const membershipsRelations = relations(memberships, ({ one, many }) => ({
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
  org: one(organizations, {
    fields: [memberships.orgId],
    references: [organizations.id],
  }),
  teamMembers: many(teamMembers),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  org: one(organizations, { fields: [teams.orgId], references: [organizations.id] }),
  members: many(teamMembers),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  membership: one(memberships, {
    fields: [teamMembers.membershipId],
    references: [memberships.id],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  org: one(organizations, { fields: [apiKeys.orgId], references: [organizations.id] }),
  createdBy: one(users, {
    fields: [apiKeys.createdByUserId],
    references: [users.id],
  }),
}));

export const walletLinksRelations = relations(walletLinks, ({ one }) => ({
  user: one(users, { fields: [walletLinks.userId], references: [users.id] }),
}));

export const mfaCredentialsRelations = relations(mfaCredentials, ({ one }) => ({
  user: one(users, { fields: [mfaCredentials.userId], references: [users.id] }),
}));

// ---------- Type exports ----------

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserCredential = typeof userCredentials.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Membership = typeof memberships.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type WalletLink = typeof walletLinks.$inferSelect;
export type MfaCredential = typeof mfaCredentials.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type AuditAction = (typeof auditAction.enumValues)[number];
export type MembershipRole = (typeof membershipRole.enumValues)[number];
