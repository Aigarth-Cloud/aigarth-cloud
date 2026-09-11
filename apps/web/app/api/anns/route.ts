import { NextRequest, NextResponse } from "next/server";
import { getAigarth } from "@/lib/server/aigarth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/anns
 *
 * Server-side proxy to services/ann's POST /v1/anns.
 * Reads the JWT from the session cookie and creates a draft ANN
 * on behalf of the signed-in user.
 *
 * Used by the dashboard Create-ANN form at /dashboard/models/new
 * (and any future self-serve UI). The browser can't reach
 * services/ann directly because the JWT sits in an HttpOnly
 * cookie.
 */
export async function POST(req: NextRequest) {
  const a = getAigarth();
  if (!a) {
    return NextResponse.json({ error: { message: "Not authenticated" } }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: { message: "Body required" } }, { status: 400 });
  }
  try {
    const out = await a.anns.create(body as Parameters<typeof a.anns.create>[0]);
    return NextResponse.json(out, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.toLowerCase().includes("invalid input")
      ? 400
      : msg.toLowerCase().includes("not authenticated") || msg.toLowerCase().includes("token")
        ? 401
        : msg.toLowerCase().includes("not found")
          ? 404
          : 500;
    return NextResponse.json({ error: { message: msg } }, { status });
  }
}
