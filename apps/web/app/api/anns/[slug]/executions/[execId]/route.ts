import { NextRequest, NextResponse } from "next/server";
import { getAigarth } from "@/lib/server/aigarth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/anns/:slug/executions/:execId
 *
 * Server-side proxy to services/ann's GET /v1/anns/:idOrSlug/executions/:execId.
 * The Run panel polls this every 2 s until the execution reaches a
 * terminal state.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string; execId: string } },
) {
  const a = getAigarth();
  if (!a) {
    return NextResponse.json({ error: { message: "Not authenticated" } }, { status: 401 });
  }
  try {
    const out = await a.anns.getExecution(params.slug, params.execId);
    return NextResponse.json(out);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.toLowerCase().includes("not found") ? 404 : 500;
    return NextResponse.json({ error: { message: msg } }, { status });
  }
}
