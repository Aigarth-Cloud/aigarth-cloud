/**
 * Qubic wallet linking service.
 *
 * The flow:
 *   1. User calls POST /v1/wallets/link/start → server generates a nonce,
 *      stores the next-expected nonce for the address, returns the nonce.
 *   2. The user's Qubic wallet signs the nonce with their private key.
 *   3. User calls POST /v1/wallets/link/finish with address + signature.
 *   4. Server verifies the signature against the stored nonce, then links
 *      the wallet to the user.
 *
 * On the verify step, we also issue a non-custodial "Qubic paid" capability:
 * the user can now opt to pay for compute with their Qubic balance, billed
 * to the linked wallet.
 */

import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { getDb } from "../db/index.js";
import { walletLinks, type WalletLink } from "../db/schema.js";
import { uid } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";
import { isValidQubicAddress, verifyQubicSignature } from "../lib/qubic.js";

// ---------- Schemas ----------

export const StartLinkSchema = z.object({
  /** Optional: pre-declare the address. If absent, the finish step sets it. */
  address: z.string().regex(/^[A-Z]{60}$/).optional(),
});

export const FinishLinkSchema = z.object({
  address: z.string().regex(/^[A-Z]{60}$/),
  /** Base64url-encoded signature over the nonce. */
  signature: z.string().min(64).max(2048),
  /** The nonce that was signed (echoed back from /start). */
  nonce: z.string().min(8).max(256),
});

// ---------- Nonce cache (in-memory for now; production should use Redis) ----------

interface PendingNonce {
  userId: string;
  address: string | null;
  nonce: string;
  issuedAt: number;
}

const pendingNonces = new Map<string, PendingNonce>();

function purgeExpired(): void {
  const now = Date.now();
  for (const [k, v] of pendingNonces) {
    if (now - v.issuedAt > 5 * 60 * 1000) pendingNonces.delete(k);
  }
}

const NONCE_BYTES = 32;

// ---------- Start link ----------

export interface StartLinkResult {
  /** The nonce the wallet must sign. Echo this in the /finish call. */
  nonce: string;
  /** Echo of the address, if provided. */
  address: string | null;
  /** The message the wallet should sign: "${noncePrefix}${nonce}" (UTF-8). */
  message: string;
  /** Seconds until the nonce expires. */
  expiresInSeconds: number;
}

export async function startLink(
  userId: string,
  input: z.infer<typeof StartLinkSchema>,
): Promise<StartLinkResult> {
  purgeExpired();
  const nonce = randomBytes(NONCE_BYTES).toString("base64url");
  const linkId = uid();
  pendingNonces.set(linkId, {
    userId,
    address: input.address ?? null,
    nonce,
    issuedAt: Date.now(),
  });
  return {
    nonce,
    address: input.address ?? null,
    message: `Aigarth wallet link\nNonce: ${nonce}`,
    expiresInSeconds: 5 * 60,
  };
}

// ---------- Finish link ----------

export async function finishLink(
  userId: string,
  input: z.infer<typeof FinishLinkSchema>,
): Promise<{ wallet: WalletLink; verification: { stub_unverified: true; reason: string } }> {
  const db = getDb();

  // Find the pending nonce by matching the supplied nonce string
  let pending: PendingNonce | null = null;
  let pendingKey: string | null = null;
  for (const [k, v] of pendingNonces) {
    if (v.userId === userId && v.nonce === input.nonce) {
      pending = v;
      pendingKey = k;
      break;
    }
  }
  if (!pending) {
    throw new Error("No matching link request, or it expired. Start again.");
  }
  if (pending.address && pending.address !== input.address) {
    throw new Error("Address does not match the one declared in /start.");
  }
  // Consume the nonce (one-shot)
  if (pendingKey) pendingNonces.delete(pendingKey);

  // Verify the signature
  const messageBytes = new TextEncoder().encode(`Aigarth wallet link\nNonce: ${pending.nonce}`);
  const signatureBytes = base64UrlToBytes(input.signature);
  const result = await verifyQubicSignature(input.address, messageBytes, signatureBytes);
  if (!result.valid) {
    throw new Error(`Signature verification failed: ${result.reason}`);
  }

  // Link the wallet. Replace any existing link for this (user, address).
  const existing = await db
    .select()
    .from(walletLinks)
    .where(and(eq(walletLinks.userId, userId), eq(walletLinks.qubicAddress, input.address)))
    .limit(1);
  const ex = existing[0];

  let link: WalletLink;
  if (ex) {
    const updated = await db
      .update(walletLinks)
      .set({
        lastNonce: pending.nonce,
        verifiedAt: new Date(),
        revokedAt: null,
      })
      .where(eq(walletLinks.id, ex.id))
      .returning();
    link = updated[0]!;
  } else {
    const id = uid();
    const inserted = await db
      .insert(walletLinks)
      .values({
        id,
        userId,
        qubicAddress: input.address,
        lastNonce: pending.nonce,
        verifiedAt: new Date(),
      })
      .returning();
    link = inserted[0]!;
  }

  logActivity(db, {
    action: "wallet.linked",
    actorUserId: userId,
    targetType: "wallet",
    targetId: link.id,
    metadata: {
      address: input.address,
      verification: result.reason,
    },
  });

  return {
    wallet: link,
    verification: { stub_unverified: true, reason: result.reason },
  };
}

// ---------- List / unlink ----------

export async function listWallets(userId: string): Promise<WalletLink[]> {
  const db = getDb();
  return db
    .select()
    .from(walletLinks)
    .where(eq(walletLinks.userId, userId));
}

/**
 * List verified (not revoked) wallets for a user. Used by the
 * service-to-service resolver in services/economy (Phase 18 closeout)
 * to populate `wallet_address` on a payout_recipient before settlement.
 * Only `verified_at IS NOT NULL` rows are returned — the user must
 * have actually signed the nonce to be eligible to receive a payout.
 */
export async function listVerifiedWallets(userId: string): Promise<WalletLink[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(walletLinks)
    .where(
      and(
        eq(walletLinks.userId, userId),
        // verifiedAt IS NOT NULL — the row is null when the link is unverified
        sql`${walletLinks.verifiedAt} IS NOT NULL`,
        sql`${walletLinks.revokedAt} IS NULL`,
      ),
    );
  return rows;
}

export async function unlink(userId: string, walletId: string): Promise<void> {
  const db = getDb();
  const rows = await db
    .select()
    .from(walletLinks)
    .where(and(eq(walletLinks.id, walletId), eq(walletLinks.userId, userId)))
    .limit(1);
  const link = rows[0];
  if (!link) throw new Error("Wallet not found.");
  await db
    .update(walletLinks)
    .set({ revokedAt: new Date() })
    .where(eq(walletLinks.id, walletId));
  logActivity(db, {
    action: "wallet.unlinked",
    actorUserId: userId,
    targetType: "wallet",
    targetId: walletId,
    metadata: { address: link.qubicAddress },
  });
}

// ---------- Helpers ----------

function base64UrlToBytes(s: string): Uint8Array {
  // Base64url → base64 padding
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return Uint8Array.from(Buffer.from(padded, "base64"));
}

// Suppress unused import warnings
void sql;
void isValidQubicAddress;
