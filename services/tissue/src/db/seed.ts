/**
 * Seed the database with the demo tissue.
 *
 * The demo tissue is the Sales+Risk+Finance example from the
 * original proposal:
 *
 *   tissue_executive_v1
 *     ├─ ann-sales-v1     (voting,   authority 0.4)
 *     ├─ ann-risk-v1      (veto,     authority 0.3)   ← any -1 blocks
 *     └─ ann-finance-v1   (voting,   authority 0.3)
 *
 * Policy: veto_aware, threshold 0.4.
 *
 * Member slugs MUST match the slugify rules in services/ann/src/lib/ids.ts
 * (lowercase, non-alnum → "-", trim leading/trailing "-"). The seed derives
 * the slug from the human name via the same `slugify()` helper to stay in
 * lock-step with the ANN service, so re-seeding after a future slugify
 * change picks up the new convention automatically.
 *
 * Idempotent. The seed does NOT validate that the ANNs exist
 * in the ANN service — at /decide time, the tissue will call
 * the ANN service and any missing member becomes "ignored".
 */

import { eq, and } from "drizzle-orm";
import { getDb, closeDb } from "./index.js";
import { tissues, tissueMembers, type NewTissue, type NewTissueMember } from "./schema.js";
import { uid, slugify } from "../lib/ids.js";

const DEMO_OWNER_USER_ID = "00000000-0000-0000-0000-000000000001"; // dev placeholder
const DEMO_TISSUE_NAME = "Executive Tissue";
const DEMO_TISSLE_SLUG = "tissue_executive_v1";
const DEMO_POLICY = { kind: "veto_aware", threshold: 0.4 };

// Ann-* member slugs are derived from the human name so they match the
// slugify output the ANN service would produce for an ANN named identically.
// ("Ann Sales V1" -> "ann-sales-v1", etc.)
const DEMO_MEMBERS = [
  { ann_name: "Ann Sales V1",   role: "voting" as const, authority_weight: 0.4, position: 0 },
  { ann_name: "Ann Risk V1",    role: "veto"   as const, authority_weight: 0.3, position: 1 },
  { ann_name: "Ann Finance V1", role: "voting" as const, authority_weight: 0.3, position: 2 },
].map((m) => ({ ...m, ann_slug: slugify(m.ann_name) }));

async function main() {
  const db = getDb();
  console.log("[tissue] seeding demo tissue");

  // Check if the demo tissue already exists
  const existing = (
    await db.select().from(tissues).where(eq(tissues.slug, DEMO_TISSLE_SLUG)).limit(1)
  )[0];

  let tissueId: string;
  if (existing) {
    console.log(`  demo tissue: ${DEMO_TISSLE_SLUG} (already exists)`);
    tissueId = existing.id;
  } else {
    tissueId = uid();
    await db.insert(tissues).values({
      id: tissueId,
      slug: DEMO_TISSLE_SLUG,
      name: DEMO_TISSUE_NAME,
      tagline: "Demo: Sales + Risk + Finance, veto-aware consensus",
      description:
        "A demonstration tissue that combines three specialized ANNs into a single executive decision. Any -1 from Risk blocks the entire tissue. See ADR 003 — Trinary Protocol v1 — and Phase 18D delivery report.",
      ownerUserId: DEMO_OWNER_USER_ID,
      ownerOrgId: null,
      visibility: "public",
      status: "active", // seed directly to active so it's immediately usable
      version: "1.0.0",
      policy: DEMO_POLICY as unknown as Record<string, unknown>,
      policyKind: DEMO_POLICY.kind,
      totalDecisions: 0n,
      metadata: {
        demo: true,
        seeded_at: new Date().toISOString(),
        note: "requires ANNs named 'Ann Sales V1' / 'Ann Risk V1' / 'Ann Finance V1' in the ANN service (slugs: ann-sales-v1, ann-risk-v1, ann-finance-v1, decision_protocol='trinary')",
      },
    } satisfies NewTissue);
    console.log(`  demo tissue: ${DEMO_TISSLE_SLUG} (created)`);
  }

  // Add members idempotently
  for (const m of DEMO_MEMBERS) {
    const dup = (
      await db
        .select({ id: tissueMembers.id })
        .from(tissueMembers)
        .where(and(eq(tissueMembers.tissueId, tissueId), eq(tissueMembers.annSlug, m.ann_slug)))
        .limit(1)
    )[0];
    if (dup) {
      console.log(`    member: ${m.ann_slug} (${m.role}, weight ${m.authority_weight}) — already exists`);
      continue;
    }
    await db.insert(tissueMembers).values({
      id: uid(),
      tissueId,
      annSlug: m.ann_slug,
      annId: null,
      role: m.role,
      authorityWeight: m.authority_weight.toString(),
      position: m.position,
    } satisfies NewTissueMember);
    console.log(`    member: ${m.ann_slug} (${m.role}, weight ${m.authority_weight}) — added`);
  }

  await closeDb();
  console.log("[tissue] seed complete");
}

main().catch((err) => {
  console.error("[tissue] seed failed:", err);
  process.exit(1);
});
