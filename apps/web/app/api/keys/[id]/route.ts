import { NextRequest, NextResponse } from "next/server";
import { getAigarth } from "@/lib/server/aigarth";
import { getSession } from "@/lib/server/session";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const a = getAigarth();
  if (!a) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    await a.keys.revoke(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
