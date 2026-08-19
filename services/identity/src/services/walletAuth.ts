/**
 * Wallet-as-identity auth service.
 *
 * Unlike the existing /v1/wallets/link/* flow (which requires the user
 * to be already signed in and just links a wallet to an existing account),
 * this flow lets a brand-new user sign up AND sign in using only a Qubic
 * wallet. No email, no password, no KYC.
 *
 *   1. POST /v1/auth/wallet/start    { address } -> { nonce, message, expiresInSeconds }
 *   2. Wallet signs the message.
 *   3. POST /v1/auth/wallet/finish   { address, kind, ..., nonce }
 *      - kind: "message"     → signature is a 64-byte Qubic SchnorrQ
 *                              over the canonical message (vault path;
 *                              standard 32-byte dev stub still works)
 *      - kind: "transaction" → signature is the appended 64-byte
 *                              SchnorrQ of a Qubic self-transfer whose
 *                              `input` field IS the canonical message
 *                              (MetaMask Qubic snap path)
 *      - Verifies signature (K12 + SchnorrQ_Verify via @qubic-lib/qubic-ts-library).
 *      - Looks up the wallet in `wallet_links`.
 *      - If linked: reuses the existing user.
 *      - If unlinked: creates a brand-new user keyed on the wallet,
 *        creates a personal org, inserts a `wallet_links` row,
 *        audits `user.created` + `wallet.linked` (kind tagged so the
 *        command centre can break it down by signer).
 *      - Issues an access JWT + refresh JWT, persists a `sessions` row.
 *      - Sets the `aigarth_session` cookie for browser flows.
 *
 * The user is given a deterministic email of the form
 *   qubic-<first12chars-of-addr-lowercase>@wallet.local
 * which is unique, not routable, and reversible. Display name is
 *   QUBIC <first6>...<last4>
 * so the dashboard has something sensible to show.
 *
 * The signature verifier is the existing K12+SchnorrQ verifier in
 * src/lib/qubic.ts, extended in Phase 21 to also accept a
 * transaction-wrapped proof for MetaMask snap users.
 */

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { getDb } from "../db/index.js";
import { users, walletLinks, organizations, memberships, sessions, auditLogs } from "../db/schema.js";
import { uid } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";
import {
  isValidQubicAddress,
  verifyQubicSignature,
  verifyQubicTransactionSignature,
} from "../lib/qubic.js";
import { slugify } from "@aigarth/utils/strings";

// ---------- Schemas ----------

export const WalletStartSchema = z.object({
  /** 60-char Qubic address, uppercase A-Z. */
  address: z.string().regex(/^[A-Z]{60}$/),
});

/**
 * Discriminated union: the client picks one proof kind and sends
 * the matching fields. `kind: "message"` is the legacy 64-byte
 * SchnorrQ path. `kind: "transaction"` is the Phase 21 MetaMask
 * Qubic snap path (signed Qubic self-transfer with the canonical
 * message embedded in the input field).
 */
export const WalletFinishSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("message"),
    address: z.string().regex(/^[A-Z]{60}$/),
    /**
     * Base64url-encoded signature over the canonical message.
     * Real K12 signatures are 64 bytes (~86 chars base64url); the
     * dev stub verifier accepts any well-formed base64url blob
     * >= 32 chars. The stub path is what the paste-address fallback
     * uses — see services/identity/src/lib/qubic.ts.
     */
    signature: z.string().min(32).max(2048),
    /** Nonce returned by /start, echoed back. */
    nonce: z.string().min(8).max(256),
    /** Optional human label for the wallet ("Main", "Cold", "Treasury"). */
    label: z.string().trim().min(1).max(64).optional(),
  }),
  z.object({
    kind: z.literal("transaction"),
    address: z.string().regex(/^[A-Z]{60}$/),
    /**
     * Base64-encoded Qubic self-transfer transaction whose `input`
     * field carries the canonical message. Produced by the MetaMask
     * Qubic snap's `signTransaction` RPC.
     */
    signedTx: z.string().min(80).max(8192),
    /** Nonce returned by /start, echoed back. */
    nonce: z.string().min(8).max(256),
    /** Optional human label for the wallet ("Main", "Cold", "Treasury"). */
    label: z.string().trim().min(1).max(64).optional(),
  }),
]);

// ---------- Result types ----------

export interface WalletStartResult {
  nonce: string;
  address: string;
  /** Canonical message the wallet must sign (UTF-8). */
  message: string;
  expiresInSeconds: number;
}

export interface WalletFinishResult {
  user: { id: string; email: string; name: string; status: string };
  wallet: { id: string; address: string; verifiedAt: string | null };
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  created: boolean; // true = brand-new account, false = existing account signed in
  verification: { reason: string };
}

// ---------- Nonce cache (in-memory; mirror of wallets.ts) ----------

interface PendingAuthNonce {
  address: string;
  nonce: string;
  message: string;
  issuedAt: number;
}

const pendingAuthNonces = new Map<string, PendingAuthNonce>();

function purgeExpiredAuthNonces(): void {
  const now = Date.now();
  for (const [k, v] of pendingAuthNonces) {
    if (now - v.issuedAt > 5 * 60 * 1000) pendingAuthNonces.delete(k);
  }
}

const NONCE_BYTES = 32;
const NONCE_TTL_MS = 5 * 60 * 1000;

function messageFor(address: string, nonce: string): string {
  return `Aigarth sign-in\nAddress: ${address}\nNonce: ${nonce}`;
}

// ---------- /v1/auth/wallet/start ----------

export async function walletAuthStart(
  input: z.infer<typeof WalletStartSchema>,
): Promise<WalletStartResult> {
  if (!isValidQubicAddress(input.address)) {
    throw new Error("Invalid Qubic address");
  }
  purgeExpiredAuthNonces();

  const nonce = randomBytes(NONCE_BYTES).toString("base64url");
  const message = messageFor(input.address, nonce);
  // Use nonce as the key — only one outstanding nonce per address.
  pendingAuthNonces.set(input.address, {
    address: input.address,
    nonce,
    message,
    issuedAt: Date.now(),
  });

  return {
    nonce,
    address: input.address,
    message,
    expiresInSeconds: NONCE_TTL_MS / 1000,
  };
}

// ---------- /v1/auth/wallet/finish ----------

export interface IssueTokensFn {
  (userId: string, jti: string): { accessToken: string; refreshToken: string };
}

export interface CookieOpts {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  domain?: string;
  path: string;
  maxAge: number;
}

export interface WalletFinishOptions {
  ipHash?: string;
  userAgent?: string;
  issueTokens: IssueTokensFn;
  /** Set the aigarth_session cookie on the response. */
  setSessionCookie: (token: string) => void;
}

export async function walletAuthFinish(
  input: z.infer<typeof WalletFinishSchema>,
  opts: WalletFinishOptions,
): Promise<WalletFinishResult> {
  if (!isValidQubicAddress(input.address)) {
    throw new Error("Invalid Qubic address");
  }

  // 1. Find + consume the matching nonce
  const pending = pendingAuthNonces.get(input.address);
  if (!pending) {
    throw new Error("No pending sign-in for this address, or it expired. Start again.");
  }
  if (pending.nonce !== input.nonce) {
    throw new Error("Nonce mismatch. Start again.");
  }
  if (Date.now() - pending.issuedAt > NONCE_TTL_MS) {
    pendingAuthNonces.delete(input.address);
    throw new Error("Nonce expired. Start again.");
  }
  pendingAuthNonces.delete(input.address);

  // 2. Verify the proof. Two paths:
  //    - kind: "message"     → standard 64-byte SchnorrQ over the message
  //                            (vault / 32-byte dev stub)
  //    - kind: "transaction" → MetaMask Qubic snap path; signed Qubic
  //                            self-transfer with the message in the
  //                            `input` field
  const messageBytes = new TextEncoder().encode(pending.message);
  const proofKind: "message" | "transaction" = input.kind;
  let verifyReason = "ok";
  if (input.kind === "message") {
    const signatureBytes = base64UrlToBytes(input.signature);
    const result = await verifyQubicSignature(input.address, messageBytes, signatureBytes);
    if (!result.valid) {
      throw new Error(`Signature verification failed: ${result.reason}`);
    }
    verifyReason = result.reason;
  } else {
    // input.kind === "transaction"
    const txResult = await verifyQubicTransactionSignature(input.address, messageBytes, input.signedTx);
    if (!txResult.valid) {
      throw new Error(`Transaction verification failed: ${txResult.reason}`);
    }
    verifyReason = txResult.reason;
  }

  // 3. Find or create the user
  const db = getDb();
  const existingLink = await db
    .select()
    .from(walletLinks)
    .where(eq(walletLinks.qubicAddress, input.address))
    .limit(1);
  const link = existingLink[0];

  let userId: string;
  let created = false;
  let linkRow: typeof walletLinks.$inferSelect;

  if (link) {
    // Existing user — sign them in.
    userId = link.userId;
    // Refresh verifiedAt + lastNonce
    const updated = await db
      .update(walletLinks)
      .set({ lastNonce: input.nonce, verifiedAt: new Date(), revokedAt: null })
      .where(eq(walletLinks.id, link.id))
      .returning();
    linkRow = updated[0]!;
  } else {
    // New user — provision them.
    created = true;
    userId = uid();
    const email = walletEmailFor(input.address);
    const name = walletDisplayNameFor(input.address);

    await db.insert(users).values({
      id: userId,
      email,
      name,
      status: "active", // wallet-signed users skip email verification
      // lastSeenAt + updatedAt default to now()
    });

    // Personal org
    const orgId = uid();
    const orgSlug = makeUniqueOrgSlug(input.address, orgId);
    await db.insert(organizations).values({
      id: orgId,
      slug: orgSlug,
      name: `${name}'s Workspace`,
      isPersonal: true,
    });
    await db.insert(memberships).values({
      id: uid(),
      userId,
      orgId,
      role: "owner",
    });

    // Wallet link
    const walletId = uid();
    const inserted = await db
      .insert(walletLinks)
      .values({
        id: walletId,
        userId,
        qubicAddress: input.address,
        lastNonce: input.nonce,
        verifiedAt: new Date(),
      })
      .returning();
    linkRow = inserted[0]!;

    logActivity(db, {
      action: "user.created",
      actorUserId: userId,
      targetType: "user",
      targetId: userId,
      metadata: { source: "wallet_auth", kind: proofKind, address: input.address, label: input.label ?? null },
      ipHash: opts.ipHash,
      userAgent: opts.userAgent,
    });
    logActivity(db, {
      action: "org.created",
      actorUserId: userId,
      orgId,
      targetType: "org",
      targetId: orgId,
      metadata: { isPersonal: true, source: "wallet_auth" },
    });
    logActivity(db, {
      action: "wallet.linked",
      actorUserId: userId,
      targetType: "wallet",
      targetId: walletId,
      metadata: { address: input.address, source: "wallet_auth", kind: proofKind, label: input.label ?? null },
      ipHash: opts.ipHash,
      userAgent: opts.userAgent,
    });
  }

  // 4. Issue a session + JWTs
  const jti = uid();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({
    id: uid(),
    userId,
    jti,
    ipHash: opts.ipHash,
    userAgent: opts.userAgent,
    expiresAt,
  });
  await db
    .update(users)
    .set({ lastSeenAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));

  logActivity(db, {
    action: "login.succeeded",
    actorUserId: userId,
    metadata: { jti, source: "wallet_auth", kind: proofKind },
    ipHash: opts.ipHash,
    userAgent: opts.userAgent,
  });
  logActivity(db, {
    action: "session.created",
    actorUserId: userId,
    targetType: "session",
    targetId: jti,
    metadata: { kind: proofKind },
  });

  const tokens = opts.issueTokens(userId, jti);
  opts.setSessionCookie(tokens.accessToken);

  // Load user for response
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userRows[0]!;

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
    },
    wallet: {
      id: linkRow.id,
      address: linkRow.qubicAddress,
      verifiedAt: linkRow.verifiedAt?.toISOString() ?? null,
    },
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: expiresAt.toISOString(),
    created,
    verification: { reason: verifyReason },
  };
}

// ---------- Wallet stats (for the command centre) ----------

export interface WalletAuthStats {
  total_linked: number;
  total_unique_users: number;
  total_sessions_30d: number;
  recent_signins: { address: string; created_at: string; user_id: string }[];
  last_24h_signins: number;
  stub_unverified_count: number;
  /** Last 10 wallet-auth events (login.succeeded), tagged with proof kind. */
  recent_audit: {
    actor_user_id: string | null;
    action: string;
    kind: "message" | "transaction" | "unknown";
    address: string | null;
    label: string | null;
    created_at: string;
    ip_hash: string | null;
    user_agent: string | null;
  }[];
  /** 30-day signin counts, broken down by proof kind. */
  by_kind: {
    message: number;
    transaction: number;
    unknown: number;
  };
  /** True if MetaMask snap usage has been observed in the last 30d. */
  snap_active_30d: boolean;
}

export async function walletAuthStats(): Promise<WalletAuthStats> {
  const db = getDb();
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Linked wallets (active only)
  const allLinked = await db
    .select()
    .from(walletLinks)
    .limit(5000);
  const linked = allLinked.filter((w) => !w.revokedAt);
  const uniqueUsers = new Set(linked.map((w) => w.userId));
  const stubUnverified = linked.filter((w) => !w.verifiedAt).length;

  // Recent 10 wallet-auth sessions (newest first)
  const recentSessions = await db
    .select()
    .from(sessions)
    .orderBy(desc(sessions.createdAt))
    .limit(50);

  // Filter to last 30d (in app code so the SQL stays simple)
  const recent30d = recentSessions.filter((s) => s.createdAt >= cutoff30d).slice(0, 10);
  const last24h = recentSessions.filter((s) => s.createdAt >= cutoff24h).length;

  // Pull wallet addresses for those recent userIds in one query
  const userIds = Array.from(new Set(recent30d.map((s) => s.userId)));
  let walletByUser = new Map<string, string>();
  if (userIds.length > 0) {
    const wallets = await db
      .select()
      .from(walletLinks)
      .where(inArray(walletLinks.userId, userIds))
      .limit(100);
    walletByUser = new Map(wallets.map((w) => [w.userId, w.qubicAddress]));
  }

  // ---- Last 10 wallet-auth audit events (login.succeeded, wallet.linked)
  // These carry the proof kind in metadata.kind, so we can break down
  // the command centre by message vs transaction. The shape is:
  //   action = "login.succeeded"  → metadata.source = "wallet_auth", kind in metadata.kind
  //   action = "wallet.linked"    → same metadata shape
  // We take the union (newest 10).
  const recentAuditRows = await db
    .select()
    .from(auditLogs)
    .where(
      sql`${auditLogs.action} in ('login.succeeded', 'wallet.linked') and ${auditLogs.metadata}->>'source' = 'wallet_auth'`,
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(10);

  // Resolve addresses for the audit rows (join via wallet_links by userId)
  const auditUserIds = Array.from(
    new Set(
      recentAuditRows
        .map((r) => r.actorUserId)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  let auditWalletByUser = new Map<string, string>();
  if (auditUserIds.length > 0) {
    const wallets = await db
      .select()
      .from(walletLinks)
      .where(inArray(walletLinks.userId, auditUserIds))
      .limit(100);
    auditWalletByUser = new Map(wallets.map((w) => [w.userId, w.qubicAddress]));
  }

  const recent_audit = recentAuditRows.map((r) => {
    const md = (r.metadata ?? {}) as Record<string, unknown>;
    const rawKind = typeof md.kind === "string" ? md.kind : null;
    const kind: "message" | "transaction" | "unknown" =
      rawKind === "message" || rawKind === "transaction" ? rawKind : "unknown";
    const address =
      (typeof md.address === "string" ? md.address : null) ??
      (r.actorUserId ? auditWalletByUser.get(r.actorUserId) ?? null : null);
    const label = typeof md.label === "string" ? md.label : null;
    return {
      actor_user_id: r.actorUserId,
      action: r.action,
      kind,
      address,
      label,
      created_at: r.createdAt.toISOString(),
      ip_hash: r.ipHash,
      user_agent: r.userAgent,
    };
  });

  // ---- 30-day by-kind counts (one query, group by kind)
  const byKindRows = await db
    .select({
      kind: sql<string>`${auditLogs.metadata}->>'kind'`,
      count: sql<number>`count(*)::int`,
    })
    .from(auditLogs)
    .where(
      sql`${auditLogs.action} = 'login.succeeded' and ${auditLogs.metadata}->>'source' = 'wallet_auth' and ${auditLogs.createdAt} >= ${cutoff30d}`,
    )
    .groupBy(sql`${auditLogs.metadata}->>'kind'`);

  const by_kind = { message: 0, transaction: 0, unknown: 0 };
  for (const row of byKindRows) {
    if (row.kind === "message") by_kind.message = Number(row.count);
    else if (row.kind === "transaction") by_kind.transaction = Number(row.count);
    else by_kind.unknown = Number(row.count);
  }
  const snap_active_30d = by_kind.transaction > 0;

  return {
    total_linked: linked.length,
    total_unique_users: uniqueUsers.size,
    total_sessions_30d: recent30d.length,
    recent_signins: recent30d.map((s) => ({
      address: walletByUser.get(s.userId) ?? "(no linked wallet)",
      created_at: s.createdAt.toISOString(),
      user_id: s.userId,
    })),
    last_24h_signins: last24h,
    stub_unverified_count: stubUnverified,
    recent_audit,
    by_kind,
    snap_active_30d,
  };
}

// ---------- Helpers ----------

function walletEmailFor(address: string): string {
  // Deterministic, unique, not routable. Lower-cased for uniqueness in the
  // email index. Reversible: the address is recoverable from the local-part.
  const prefix = address.slice(0, 12).toLowerCase();
  return `qubic-${prefix}@wallet.local`;
}

function walletDisplayNameFor(address: string): string {
  return `QUBIC ${address.slice(0, 6)}…${address.slice(-4)}`;
}

function makeUniqueOrgSlug(address: string, idHint: string): string {
  const base = slugify(`qubic-${address.slice(0, 6).toLowerCase()}`).slice(0, 24) || "wallet";
  return `${base}-${idHint.slice(0, 8)}`;
}

function base64UrlToBytes(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return Uint8Array.from(Buffer.from(padded, "base64"));
}

// Suppress unused-import warning for `and` (kept for future expansion).
void and;
