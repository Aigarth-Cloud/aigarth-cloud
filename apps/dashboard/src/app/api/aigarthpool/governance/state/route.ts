/**
 * GET /api/aigarthpool/governance/state
 *
 * Server-side proxy to services/ann's
 *   GET /v1/aigarthpool/governance/state
 * endpoint. Public-read on the upstream; the dashboard never
 * needs to auth for the read path (mutations are a different
 * story — the dashboard doesn't initiate those, the wallet UI
 * does, and that uses a JWT).
 *
 * Returns the governance state straight through.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ANN_URL = process.env.AIGARTH_ANN_URL ?? "http://localhost:7006";
const TIMEOUT_MS = 2_000;

export async function GET() {
  try {
    const res = await fetch(`${ANN_URL}/v1/aigarthpool/governance/state`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `ANN service returned ${res.status}` },
        { status: res.status },
      );
    }
    const data = await res.json();
    return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return NextResponse.json(
      { error: `Could not reach the ANN service: ${(err as Error).message}` },
      { status: 502 },
    );
  }
}
