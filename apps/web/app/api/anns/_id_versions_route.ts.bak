import { NextRequest, NextResponse } from "next/server";
import { getAigarth } from "@/lib/server/aigarth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/anns/:id/versions
 *
 * Server-side proxy to services/ann's POST /v1/anns/:id/versions.
 *
 * Required because publishAnn (POST /v1/anns/:id/publish) refuses
 * to flip an ANN to "published" without ≥1 version — see
 * services/ann/src/services/anns.ts publishAnn(). The Create-ANN
 * form calls this once with version "1.0.0" before publishing.
 *
 * The SDK dist (Wave 3 / Phase B) does not ship an addVersion()
 * method yet — we hit the upstream endpoint via the SDK's
 * `client.request<T>` escape hatch so we don't have to ship a
 * separate fetch in the route.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const a = getAigarth();
  if (!a) {
    return NextResponse.json({ error: { message: "Not authenticated" } }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  try {
    const out = await a.request<unknown>(
      `/v1/anns/${encodeURIComponent(params.id)}/versions`,
      { method: "POST", body: JSON.stringify(body) },
      a.services.ann,
    );
    return NextResponse.json(out, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.toLowerCase().includes("invalid input")
      ? 400
      : msg.toLowerCase().includes("not found")
        ? 404
        : 500;
    return NextResponse.json({ error: { message: msg } }, { status });
  }
}
