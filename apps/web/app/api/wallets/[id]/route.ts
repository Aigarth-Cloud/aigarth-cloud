/**
 * DELETE /api/wallets/[id]
 *
 * Unlink a Qubic wallet from the current user. Thin proxy to
 * `DELETE /v1/wallets/:id` on the identity service.
 *
 * Auth required.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/server/session";
import { getAigarth } from "@/lib/server/aigarth";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const a = getAigarth();
  if (!a) {
    return NextResponse.json({ error: "Aigarth SDK not configured" }, { status: 500 });
  }
  try {
    const result = await a.identity.unlinkWallet(params.id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Failed to unlink wallet" },
      { status: 502 },
    );
  }
}
