import { NextRequest, NextResponse } from "next/server";
import { getAigarth } from "@/lib/server/aigarth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/categories
 *
 * Server-side proxy to services/ann's GET /v1/categories.
 * Public list of ANN categories — used by the Create-ANN form
 * dropdown. Public at the ANN service; we just funnel it
 * through the web app so the form can fetch on the server.
 */
export async function GET(_req: NextRequest) {
  const a = getAigarth();
  if (!a) {
    return NextResponse.json({ error: { message: "Not authenticated" } }, { status: 401 });
  }
  try {
    const out = await a.request<{ data: Array<{ slug: string; name: string; description: string | null; icon: string | null }> }>(
      "/v1/categories",
      { method: "GET" },
      a.services.ann,
    );
    return NextResponse.json(out);
  } catch (err) {
    return NextResponse.json(
      { error: { message: err instanceof Error ? err.message : "Categories fetch failed" } },
      { status: 500 },
    );
  }
}
