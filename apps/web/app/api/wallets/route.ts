/**
 * GET /api/wallets
 *
 * Returns the current user's linked Qubic wallets. Thin proxy to
 * `GET /v1/wallets` on the identity service. Used by the wallet
 * switcher in the dashboard topbar.
 *
 * Auth required (JWT cookie set at sign-in).
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/session";
import { getAigarth } from "@/lib/server/aigarth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const a = getAigarth();
  if (!a) {
    return NextResponse.json({ error: "Aigarth SDK not configured" }, { status: 500 });
  }
  try {
    const result = await a.identity.listWallets();
    return NextResponse.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Failed to load wallets" },
      { status: 502 },
    );
  }
}
