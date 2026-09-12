import { NextRequest, NextResponse } from "next/server";
import { getAigarth } from "@/lib/server/aigarth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/anns/:slug/publish
 *
 * Server-side proxy to services/ann's POST /v1/anns/:idOrSlug/publish.
 * Flips the ANN status from "draft" to "published" (requires ≥1
 * version — the Create-ANN form adds v1.0.0 before this call).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const a = getAigarth();
  if (!a) {
    return NextResponse.json({ error: { message: "Not authenticated" } }, { status: 401 });
  }
  try {
    const out = await a.anns.publish(params.slug);
    return NextResponse.json(out, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // publishAnn throws "ANN has no published version" — that's a 400
    // from the service. Anything claiming to be a 401/403 also
    // bubbles up here.
    const status = msg.toLowerCase().includes("no published version")
      || msg.toLowerCase().includes("invalid input")
        ? 400
        : msg.toLowerCase().includes("not found")
          ? 404
          : msg.toLowerCase().includes("forbidden") || msg.toLowerCase().includes("not owner")
            ? 403
            : 500;
    return NextResponse.json({ error: { message: msg } }, { status });
  }
}
