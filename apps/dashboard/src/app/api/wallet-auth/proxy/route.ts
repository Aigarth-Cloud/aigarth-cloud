/**
 * POST /api/wallet-auth/proxy
 *
 * Lightweight reachability probe for the wallet-auth start/finish
 * endpoints. For the dashboard /wallet-auth endpoint-health matrix.
 *
 *   body: { action: "start" | "finish" }
 *
 * For "start" we send a deliberately invalid (too-short) address
 * so the upstream returns 400 quickly — that tells us the route is
 * wired and reachable, without us having to actually start a flow.
 *
 * For "finish" we do the same with empty body — we expect 400.
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const IDENTITY_URL = process.env.AIGARTH_IDENTITY_URL ?? "http://localhost:7001";
const TIMEOUT_MS = 2_000;

export async function POST(req: NextRequest) {
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  if (action !== "start" && action !== "finish") {
    return NextResponse.json({ error: "action must be 'start' or 'finish'" }, { status: 400 });
  }
  const path = action === "start" ? "/v1/auth/wallet/start" : "/v1/auth/wallet/finish";
  try {
    const res = await fetch(`${IDENTITY_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}), // intentionally empty to provoke a 400
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    // We treat 400/401 as "endpoint reachable" because the upstream
    // validated the empty body and rejected it — that's exactly what
    // we expect to confirm the route is wired and serving.
    return NextResponse.json(
      {
        ok: res.status === 400 || res.status === 401 || res.ok,
        status: res.status,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: `Could not reach the identity service: ${(err as Error).message}` },
      { status: 502 },
    );
  }
}
