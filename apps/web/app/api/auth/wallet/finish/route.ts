/**
 * POST /api/auth/wallet/finish
 *
 * Thin proxy to the identity service's wallet-as-identity finish endpoint.
 * On success, mirrors the response into the apps/web session cookie
 * so the dashboard / middleware sees a valid session.
 *
 * No auth required.
 */

import { NextRequest, NextResponse } from "next/server";
import { setSession } from "@/lib/server/session";

const IDENTITY_URL = process.env.AIGARTH_IDENTITY_URL ?? "http://localhost:7001";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    address?: string;
    signature?: string;
    nonce?: string;
    label?: string;
  };

  if (!body.address || !body.signature || !body.nonce) {
    return NextResponse.json(
      { error: "address, signature and nonce are required" },
      { status: 400 },
    );
  }

  let res: Response;
  try {
    res = await fetch(`${IDENTITY_URL}/v1/auth/wallet/finish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        address: body.address,
        signature: body.signature,
        nonce: body.nonce,
        label: body.label,
      }),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Could not reach the identity service: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  if (!res.ok) {
    let msg = `Wallet sign-in failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: { message?: string } };
      if (data?.error?.message) msg = data.error.message;
    } catch { /* keep default */ }
    return NextResponse.json({ error: msg }, { status: res.status });
  }

  const data = (await res.json()) as {
    access_token: string;
    user: { id: string; email: string; name: string };
    wallet: { id: string; address: string; verifiedAt: string | null };
    created: boolean;
    verification: { reason: string };
  };

  setSession({
    accessToken: data.access_token,
    userId: data.user.id,
    email: data.user.email,
    name: data.user.name,
  });

  return NextResponse.json({
    ok: true,
    redirect: "/dashboard",
    created: data.created,
    user: data.user,
    wallet: data.wallet,
    verification: data.verification,
  });
}
