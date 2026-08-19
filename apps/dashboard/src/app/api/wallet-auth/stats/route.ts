/**
 * GET /api/wallet-auth/stats
 *
 * Server-side proxy to the identity service's
 *   GET /v1/auth/wallet/stats
 * endpoint. Used by the dashboard /wallet-auth page.
 *
 * The identity service's stats endpoint is public-read; we still
 * proxy through the dashboard so the browser never needs to know
 * the upstream URL, and so CORS / network reachability is handled
 * server-side.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const IDENTITY_URL = process.env.AIGARTH_IDENTITY_URL ?? "http://localhost:7001";
const TIMEOUT_MS = 2_000;

export async function GET() {
  try {
    const res = await fetch(`${IDENTITY_URL}/v1/auth/wallet/stats`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Identity service returned ${res.status}` },
        { status: res.status },
      );
    }
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Could not reach the identity service: ${(err as Error).message}` },
      { status: 502 },
    );
  }
}
