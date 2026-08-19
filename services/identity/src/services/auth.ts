/**
 * Auth service — signup, login, logout, password reset, email verification.
 *
 * Each function is a single-purpose business operation. They all
 * emit audit events.
 *
 * Drizzle 0.42 API: query builders are thenable. No more `.get()` / `.all()` / `.run()`.
 * - `await db.select()...` returns T[]
 * - `await db.insert(t).values(...)` returns T[] if you add `.returning()`
 * - `await db.update(t).set(...).where(...)` returns the update count by default
 */

import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import {
  users,
  userCredentials,
  emailVerifications,
  passwordResets,
  sessions,
  organizations,
  memberships,
  type User,
} from "../db/schema.js";
import { hashPassword, verifyPassword, validatePasswordStrength } from "../lib/password.js";
import { generateToken, hashToken, uid } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";
import { slugify } from "@aigarth/utils/strings";

// ---------- Schemas ----------

export const SignupSchema = z.object({
  email: z.string().email().max(320).transform((s) => s.toLowerCase()),
  password: z.string().min(1).max(256),
  name: z.string().trim().min(1).max(120),
  orgName: z.string().trim().min(1).max(120).optional(),
});

export const LoginSchema = z.object({
  email: z.string().email().max(320).transform((s) => s.toLowerCase()),
  password: z.string().min(1).max(256),
});

export const VerifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const PasswordResetRequestSchema = z.object({
  email: z.string().email().max(320).transform((s) => s.toLowerCase()),
});

export const PasswordResetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(1).max(256),
});

// ---------- Result types ----------

export interface SignupResult {
  user: User;
  /** Verification token — only emitted in dev for ease of testing. */
  verificationToken: string | null;
  personalOrgId: string;
}

export interface LoginResult {
  user: User;
  session: { id: string; jti: string; expiresAt: Date };
  accessToken: string;
  refreshToken: string;
}

// ---------- Signup ----------

export interface SignupOptions {
  signupIpHash?: string;
  userAgent?: string;
  emitVerificationToken?: boolean;
}

export async function signup(
  input: z.infer<typeof SignupSchema>,
  opts: SignupOptions = {},
): Promise<SignupResult> {
  const db = getDb();

  const pwError = validatePasswordStrength(input.password);
  if (pwError) throw new Error(pwError);

  const existingRows = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${input.email}`)
    .limit(1);
  const existing = existingRows[0];
  if (existing) {
    throw new Error("An account with this email already exists.");
  }

  const userId = uid();
  const now = new Date();
  const insertedRows = await db
    .insert(users)
    .values({
      id: userId,
      email: input.email,
      name: input.name,
      status: "pending_verification",
      signupIpHash: opts.signupIpHash,
    })
    .returning();
  const created = insertedRows[0]!;

  const passwordHash = await hashPassword(input.password);
  await db.insert(userCredentials).values({
    userId,
    passwordHash: passwordHash.hash,
    hashParams: passwordHash.params,
  });

  const orgId = uid();
  const orgSlug = makeUniqueSlug(input.orgName ?? `${input.name}'s Workspace`, orgId);
  await db.insert(organizations).values({
    id: orgId,
    slug: orgSlug,
    name: input.orgName ?? `${input.name}'s Workspace`,
    isPersonal: true,
    billingEmail: input.email,
  });

  await db.insert(memberships).values({
    id: uid(),
    userId,
    orgId,
    role: "owner",
  });

  const token = generateToken();
  const tokenHash = await hashToken(token);
  await db.insert(emailVerifications).values({
    id: uid(),
    userId,
    email: input.email,
    tokenHash,
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
  });

  logActivity(db, {
    action: "user.created",
    actorUserId: userId,
    targetType: "user",
    targetId: userId,
    metadata: { email: input.email, source: "signup" },
    ipHash: opts.signupIpHash,
    userAgent: opts.userAgent,
  });
  logActivity(db, {
    action: "org.created",
    actorUserId: userId,
    orgId,
    targetType: "org",
    targetId: orgId,
    metadata: { isPersonal: true },
  });

  return {
    user: created,
    verificationToken: opts.emitVerificationToken ? token : null,
    personalOrgId: orgId,
  };
}

// ---------- Email verification ----------

export async function verifyEmail(input: z.infer<typeof VerifyEmailSchema>): Promise<User> {
  const db = getDb();
  const tokenHash = await hashToken(input.token);

  const verificationRows = await db
    .select()
    .from(emailVerifications)
    .where(eq(emailVerifications.tokenHash, tokenHash))
    .limit(1);
  const verification = verificationRows[0];
  if (!verification) throw new Error("Invalid verification link.");
  if (verification.usedAt) throw new Error("This link has already been used.");
  if (verification.expiresAt < new Date()) throw new Error("This link has expired.");

  await db
    .update(emailVerifications)
    .set({ usedAt: new Date() })
    .where(eq(emailVerifications.id, verification.id));

  await db
    .update(users)
    .set({
      status: "active",
      emailVerifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, verification.userId));

  logActivity(db, {
    action: "user.email_verified",
    actorUserId: verification.userId,
    targetType: "user",
    targetId: verification.userId,
  });

  const userRows = await db.select().from(users).where(eq(users.id, verification.userId)).limit(1);
  const user = userRows[0];
  if (!user) throw new Error("user vanished");
  return user;
}

// ---------- Login ----------

export interface LoginOptions {
  ipHash?: string;
  userAgent?: string;
  issueTokens: (user: User, jti: string) => { accessToken: string; refreshToken: string };
}

export async function login(
  input: z.infer<typeof LoginSchema>,
  opts: LoginOptions,
): Promise<LoginResult> {
  const db = getDb();

  const userRows = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${input.email}`)
    .limit(1);
  const user = userRows[0];
  if (!user || user.status === "deleted") {
    logActivity(db, {
      action: "login.failed",
      metadata: { email: input.email, reason: "no_user" },
      ipHash: opts.ipHash,
      userAgent: opts.userAgent,
    });
    throw new Error("Invalid email or password.");
  }

  const credsRows = await db
    .select()
    .from(userCredentials)
    .where(eq(userCredentials.userId, user.id))
    .limit(1);
  const creds = credsRows[0];
  if (!creds) {
    logActivity(db, {
      action: "login.failed",
      actorUserId: user.id,
      metadata: { reason: "no_credentials" },
      ipHash: opts.ipHash,
      userAgent: opts.userAgent,
    });
    throw new Error("Invalid email or password.");
  }

  const ok = await verifyPassword(creds.passwordHash, input.password);
  if (!ok) {
    logActivity(db, {
      action: "login.failed",
      actorUserId: user.id,
      metadata: { reason: "bad_password" },
      ipHash: opts.ipHash,
      userAgent: opts.userAgent,
    });
    throw new Error("Invalid email or password.");
  }

  const jti = uid();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({
    id: uid(),
    userId: user.id,
    jti,
    ipHash: opts.ipHash,
    userAgent: opts.userAgent,
    expiresAt,
  });

  await db
    .update(users)
    .set({ lastSeenAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id));

  logActivity(db, {
    action: "login.succeeded",
    actorUserId: user.id,
    metadata: { jti },
    ipHash: opts.ipHash,
    userAgent: opts.userAgent,
  });
  logActivity(db, {
    action: "session.created",
    actorUserId: user.id,
    targetType: "session",
    targetId: jti,
  });

  const tokens = opts.issueTokens(user, jti);
  return {
    user,
    session: { id: jti, jti, expiresAt },
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

// ---------- Logout ----------

export async function logout(jti: string, reason = "user_logout"): Promise<void> {
  const db = getDb();
  const sessionRows = await db.select().from(sessions).where(eq(sessions.jti, jti)).limit(1);
  const session = sessionRows[0];
  if (!session) return;
  await db
    .update(sessions)
    .set({ revokedAt: new Date(), revokedReason: reason })
    .where(eq(sessions.jti, jti));
  logActivity(db, {
    action: "session.revoked",
    actorUserId: session.userId,
    targetType: "session",
    targetId: jti,
    metadata: { reason },
  });
}

// ---------- Password reset ----------

export async function requestPasswordReset(
  input: z.infer<typeof PasswordResetRequestSchema>,
  opts: { emitToken?: boolean } = {},
): Promise<{ token: string | null }> {
  const db = getDb();
  const userRows = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${input.email}`)
    .limit(1);
  const user = userRows[0];
  if (!user) return { token: null };
  const token = generateToken();
  const tokenHash = await hashToken(token);
  await db.insert(passwordResets).values({
    id: uid(),
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  return { token: opts.emitToken ? token : null };
}

export async function resetPassword(input: z.infer<typeof PasswordResetSchema>): Promise<void> {
  const db = getDb();
  const pwError = validatePasswordStrength(input.password);
  if (pwError) throw new Error(pwError);

  const tokenHash = await hashToken(input.token);
  const resetRows = await db
    .select()
    .from(passwordResets)
    .where(eq(passwordResets.tokenHash, tokenHash))
    .limit(1);
  const reset = resetRows[0];
  if (!reset) throw new Error("Invalid reset link.");
  if (reset.usedAt) throw new Error("This link has already been used.");
  if (reset.expiresAt < new Date()) throw new Error("This link has expired.");

  const newHash = await hashPassword(input.password);
  await db.transaction(async (tx) => {
    await tx.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, reset.id));
    await tx
      .update(userCredentials)
      .set({
        passwordHash: newHash.hash,
        hashParams: newHash.params,
        changedAt: new Date(),
        mustChange: false,
      })
      .where(eq(userCredentials.userId, reset.userId));
  });

  // Revoke all sessions for this user
  await db
    .update(sessions)
    .set({ revokedAt: new Date(), revokedReason: "password_reset" })
    .where(eq(sessions.userId, reset.userId));

  logActivity(db, {
    action: "user.password_changed",
    actorUserId: reset.userId,
    targetType: "user",
    targetId: reset.userId,
    metadata: { source: "reset" },
  });
}

// ---------- Helpers ----------

function makeUniqueSlug(name: string, idHint: string): string {
  const base = slugify(name).slice(0, 32) || "workspace";
  return `${base}-${idHint.slice(0, 8)}`;
}
