import { NextRequest, NextResponse } from "next/server";
import { getAigarth } from "@/lib/server/aigarth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/anns/:slug/executions
 *
 * Server-side proxy to services/ann's GET /v1/anns/:idOrSlug/executions.
 * Public — anyone with a session can read the execution history.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const a = getAigarth();
  if (!a) {
    return NextResponse.json({ error: { message: "Not authenticated" } }, { status: 401 });
  }
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const target = url.searchParams.get("target") ?? undefined;
  const limit = url.searchParams.get("limit") ?? undefined;
  const offset = url.searchParams.get("offset") ?? undefined;
  try {
    const out = await a.anns.listExecutions(params.slug, {
      ...(status ? { status: status as "queued" | "running" | "completed" | "failed" } : {}),
      ...(target ? { target: target as "local" | "qubic_oc" } : {}),
      ...(limit ? { limit: Number(limit) } : {}),
      ...(offset ? { offset: Number(offset) } : {}),
    });
    return NextResponse.json(out);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: { message: msg } }, { status: 500 });
  }
}
