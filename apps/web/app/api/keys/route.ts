import { NextRequest, NextResponse } from "next/server";
import { getAigarth } from "@/lib/server/aigarth";
import { getSession } from "@/lib/server/session";

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    scopes?: string[];
  };

  if (!body.name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const scopes = (body.scopes ?? ["chat:read", "chat:write"]) as never;

  const a = getAigarth();
  if (!a) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const key = await a.keys.create({ name: body.name, scopes });
    return NextResponse.json({
      ok: true,
      full_key: key.full_key,
      id: key.id,
      prefix: key.prefix,
      secret_last4: key.secret_last4,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
