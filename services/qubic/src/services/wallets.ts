/**
 * Wallet + balance services.
 *
 * Caches the (user, Qubic address) link and the most recent known
 * balance per wallet. Reads through to the Qubic client on miss.
 */

import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { qubicWallets, qubicBalances, type QubicWallet, type QubicBalance } from "../db/schema.js";
import { uid } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";
import { getQubicClient } from "../client/index.js";

export const LinkWalletSchema = z.object({
  qubicAddress: z.string().regex(/^[A-Z]{60}$/),
  /** Idempotency key from identity.wallet_links. */
  identityLinkId: z.string().uuid(),
  network: z.enum(["mainnet", "testnet"]).default("testnet"),
});

export async function linkWallet(
  userId: string,
  input: z.infer<typeof LinkWalletSchema>,
): Promise<QubicWallet> {
  const db = getDb();
  // Idempotent: if a wallet with the same (user, address) exists, return it.
  const existing = await db
    .select()
    .from(qubicWallets)
    .where(and(eq(qubicWallets.userId, userId), eq(qubicWallets.qubicAddress, input.qubicAddress)))
    .limit(1);
  const ex = existing[0];
  if (ex) {
    return ex;
  }
  const id = uid();
  const inserted = await db
    .insert(qubicWallets)
    .values({
      id,
      userId,
      qubicAddress: input.qubicAddress,
      identityLinkId: input.identityLinkId,
      network: input.network,
    })
    .returning();
  logActivity(db, {
    action: "wallet.linked",
    actorUserId: userId,
    targetType: "qubic_wallet",
    targetId: id,
    metadata: { address: input.qubicAddress, network: input.network },
  });
  return inserted[0]!;
}

export async function listUserWallets(userId: string): Promise<QubicWallet[]> {
  const db = getDb();
  return db.select().from(qubicWallets).where(eq(qubicWallets.userId, userId));
}

export async function getWallet(userId: string, walletId: string): Promise<QubicWallet | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(qubicWallets)
    .where(and(eq(qubicWallets.id, walletId), eq(qubicWallets.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getBalance(
  userId: string,
  walletId: string,
  options: { refresh?: boolean } = {},
): Promise<QubicBalance> {
  const db = getDb();
  const wallet = await getWallet(userId, walletId);
  if (!wallet) throw new Error("Wallet not found.");

  // Cache TTL: 30s
  const cached = await db
    .select()
    .from(qubicBalances)
    .where(eq(qubicBalances.walletId, walletId))
    .limit(1);
  const cachedRow = cached[0];
  if (cachedRow && !options.refresh && Date.now() - cachedRow.refreshedAt.getTime() < 30_000) {
    return cachedRow;
  }

  // Fetch from Qubic
  const client = getQubicClient();
  const bal = await client.getBalance(wallet.qubicAddress);

  if (cachedRow) {
    await db
      .update(qubicBalances)
      .set({ balanceQubic: bal.balanceQubic, tickNumber: bal.tickNumber, refreshedAt: new Date() })
      .where(eq(qubicBalances.id, cachedRow.id));
    return (await db.select().from(qubicBalances).where(eq(qubicBalances.id, cachedRow.id)).limit(1))[0]!;
  }
  const id = uid();
  const inserted = await db
    .insert(qubicBalances)
    .values({
      id,
      walletId,
      balanceQubic: bal.balanceQubic,
      tickNumber: bal.tickNumber,
    })
    .returning();
  return inserted[0]!;
}

export async function authorizeStaking(
  userId: string,
  walletId: string,
  options: { expiresInDays?: number } = {},
): Promise<QubicWallet> {
  const db = getDb();
  const expiresInDays = options.expiresInDays ?? 365;
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
  const updated = await db
    .update(qubicWallets)
    .set({
      stakeAuthorized: true,
      stakeAuthorizationExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(and(eq(qubicWallets.id, walletId), eq(qubicWallets.userId, userId)))
    .returning();
  if (!updated[0]) throw new Error("Wallet not found.");
  logActivity(db, {
    action: "stake.authorized",
    actorUserId: userId,
    targetType: "qubic_wallet",
    targetId: walletId,
    metadata: { expiresAt: expiresAt.toISOString() },
  });
  return updated[0]!;
}
