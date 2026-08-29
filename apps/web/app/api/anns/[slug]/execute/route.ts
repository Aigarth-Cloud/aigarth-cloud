import { NextRequest, NextResponse } from "next/server";
import { getAigarth } from "@/lib/server/aigarth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/anns/:slug/execute
 *
 * Server-side proxy to services/ann's POST /v1/anns/:idOrSlug/execute.
 * Carries the JWT from the session cookie so the user doesn't have
 * to manage keys. The browser can't reach services/ann directly
 * because the JWT is HttpOnly.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const a = getAigarth();
  if (!a) {
    return NextResponse.json({ error: { message: "Not authenticated" } }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  try {
    const out = await a.anns.execute(params.slug, body);
    return NextResponse.json(out, { status: 202 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.toLowerCase().includes("not found")
      ? 404
      : msg.toLowerCase().includes("mismatch")
        ? 409
        : msg.toLowerCase().includes("executor")
          ? 503
          : 500;
    return NextResponse.json({ error: { message: msg } }, { status });
  }
}
