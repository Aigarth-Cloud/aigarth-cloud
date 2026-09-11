import { NextRequest, NextResponse } from "next/server";
import { getAigarth } from "@/lib/server/aigarth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/licenses
 *
 * Server-side proxy to services/ann's GET /v1/licenses.
 * Public list of ANN license types — used by the Create-ANN
 * form dropdown.
 */
export async function GET(_req: NextRequest) {
  const a = getAigarth();
  if (!a) {
    return NextResponse.json({ error: { message: "Not authenticated" } }, { status: 401 });
  }
  try {
    const out = await a.request<{ data: Array<{ slug: string; name: string; kind: string; is_active: boolean }> }>(
      "/v1/licenses",
      { method: "GET" },
      a.services.ann,
    );
    return NextResponse.json(out);
  } catch (err) {
    return NextResponse.json(
      { error: { message: err instanceof Error ? err.message : "Licenses fetch failed" } },
      { status: 500 },
    );
  }
}
