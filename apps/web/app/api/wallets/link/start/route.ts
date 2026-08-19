/**
 * POST /api/wallets/link/start
 *
 * Request a nonce to sign for the wallet-link flow. The user signs
 * the nonce with the new wallet's private key, then we submit the
 * signed nonce to /finish which links the wallet to the existing
 * account.
 *
 * Auth required.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/server/session";
import { getAigarth } from "@/lib/server/aigarth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const a = getAigarth();
  if (!a) {
    return NextResponse.json({ error: "Aigarth SDK not configured" }, { status: 500 });
  }
  let body: { address?: string } = {};
  try {
    body = (await req.json()) as { address?: string };
  } catch {
    /* empty body is fine: server will use any wallet the user signs for */
  }
  try {
    const result = await a.identity.startLinkWallet({ address: body.address });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Failed to start link" },
      { status: 502 },
    );
  }
}
