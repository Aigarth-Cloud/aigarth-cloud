/**
 * POST /api/wallets/link/finish
 *
 * Submit the signed nonce for the wallet-link flow. The identity
 * service verifies the signature (real K12 + SchnorrQ, 64-byte),
 * then links the new wallet to the current user.
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
  let body: {
    address?: string;
    signature?: string;
    nonce?: string;
    label?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { address, signature, nonce, label } = body;
  if (!address || !signature || !nonce) {
    return NextResponse.json(
      { error: "address, signature, and nonce are required" },
      { status: 400 },
    );
  }
  try {
    const result = await a.identity.finishLinkWallet({
      address,
      signature,
      nonce,
      label,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Failed to finish link" },
      { status: 502 },
    );
  }
}
