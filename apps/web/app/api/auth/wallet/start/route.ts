/**
 * POST /api/auth/wallet/start
 *
 * Thin proxy to the identity service's wallet-as-identity start endpoint.
 * The browser calls this to get a nonce for the Qubic address it
 * wants to sign in with.
 *
 * No auth required.
 */

import { NextRequest, NextResponse } from "next/server";

const IDENTITY_URL = process.env.AIGARTH_IDENTITY_URL ?? "http://localhost:7001";

export async function POST(req: NextRequest) {
  const { address } = (await req.json().catch(() => ({}))) as { address?: string };
  if (!address) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`${IDENTITY_URL}/v1/auth/wallet/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address }),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Could not reach the identity service: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  if (!res.ok) {
    let msg = `Wallet start failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body?.error?.message) msg = body.error.message;
    } catch { /* keep default */ }
    return NextResponse.json({ error: msg }, { status: res.status });
  }

  const data = (await res.json()) as {
    nonce: string;
    address: string;
    message: string;
    expiresInSeconds: number;
  };
  return NextResponse.json(data);
}
