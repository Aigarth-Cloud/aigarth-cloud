/**
 * Seed the ANN service with default categories and license types.
 *
 *   Categories (16) — matches the existing marketplace UI taxonomy
 *   Licenses (4)    — Open, Commercial, Restricted, custom
 *
 * Idempotent (upsert-aware).
 */

import { eq } from "drizzle-orm";
import { getDb, closeDb } from "./index.js";
import { categories, licenses } from "./schema.js";

async function main() {
  const db = getDb();
  console.log("[ann] seeding default categories and licenses");

  // ---------- Categories ----------
  const categorySeed = [
    { slug: "vision", name: "Vision", icon: "scan", sortOrder: 10 },
    { slug: "medical", name: "Medical", icon: "heart-pulse", sortOrder: 20 },
    { slug: "legal", name: "Legal", icon: "scale", sortOrder: 30 },
    { slug: "finance", name: "Finance", icon: "trending-up", sortOrder: 40 },
    { slug: "education", name: "Education", icon: "graduation-cap", sortOrder: 50 },
    { slug: "government", name: "Government", icon: "landmark", sortOrder: 60 },
    { slug: "engineering", name: "Engineering", icon: "cog", sortOrder: 70 },
    { slug: "creative", name: "Creative", icon: "palette", sortOrder: 80 },
    { slug: "agents", name: "Agents", icon: "bot", sortOrder: 90 },
    { slug: "research", name: "Research", icon: "flask-conical", sortOrder: 100 },
    { slug: "science", name: "Science", icon: "atom", sortOrder: 110 },
    { slug: "coding", name: "Coding", icon: "code", sortOrder: 120 },
    { slug: "enterprise", name: "Enterprise", icon: "building", sortOrder: 130 },
    { slug: "search", name: "Search", icon: "search", sortOrder: 140 },
    { slug: "oracles", name: "Oracles", icon: "crystal-ball", sortOrder: 150 },
    { slug: "language", name: "Language", icon: "languages", sortOrder: 160 },
  ];

  for (const c of categorySeed) {
    const existing = await db.select().from(categories).where(eq(categories.slug, c.slug)).limit(1);
    if (existing[0]) {
      const cur = existing[0];
      if (cur.name !== c.name || cur.icon !== c.icon || cur.sortOrder !== c.sortOrder) {
        await db
          .update(categories)
          .set({ name: c.name, icon: c.icon, sortOrder: c.sortOrder, updatedAt: new Date() })
          .where(eq(categories.id, cur.id));
        console.log(`  category: ${c.slug} (updated)`);
      } else {
        console.log(`  category: ${c.slug} (unchanged)`);
      }
      continue;
    }
    await db.insert(categories).values({ ...c, id: undefined as unknown as string });
    console.log(`  category: ${c.slug} (${c.name})`);
  }

  // ---------- Licenses ----------
  const licenseSeed = [
    {
      slug: "open",
      name: "Open",
      description: "Anyone can use, modify, and redistribute. Free of charge.",
      kind: "open" as const,
      terms: "## Open License\n\nThis ANN is released under an open license. You may use, modify, and redistribute it freely, including for commercial purposes, subject to attribution requirements.",
      pricePerCallQubic: 0n,
      revenueShareBps: 0,
      allowsModification: true,
      allowsCommercialUse: true,
      allowsRedistribution: true,
      requiresAttribution: true,
    },
    {
      slug: "commercial",
      name: "Commercial",
      description: "Pay-per-call licensing. Commercial use allowed. No modification or redistribution.",
      kind: "commercial" as const,
      terms: "## Commercial License\n\nYou may use this ANN for commercial purposes. You may not modify or redistribute the model. Pricing is per call.",
      pricePerCallQubic: 100_000n, // 0.1 Qu per call
      revenueShareBps: 7000, // 70% to creator
      allowsModification: false,
      allowsCommercialUse: true,
      allowsRedistribution: false,
      requiresAttribution: true,
    },
    {
      slug: "restricted",
      name: "Restricted",
      description: "Limited commercial use. Higher price. Strict redistribution terms.",
      kind: "restricted" as const,
      terms: "## Restricted License\n\nUse is limited to the licensee organization. No redistribution, modification, or competitive use. Pricing reflects the restricted scope.",
      pricePerCallQubic: 1_000_000n, // 1 Qu per call
      revenueShareBps: 8500, // 85% to creator
      allowsModification: false,
      allowsCommercialUse: true,
      allowsRedistribution: false,
      requiresAttribution: true,
    },
    {
      slug: "custom",
      name: "Custom",
      description: "Negotiated terms. Contact the creator.",
      kind: "custom" as const,
      terms: "## Custom License\n\nTerms are negotiated directly with the creator.",
      pricePerCallQubic: 0n,
      revenueShareBps: 0,
      allowsModification: false,
      allowsCommercialUse: false,
      allowsRedistribution: false,
      requiresAttribution: true,
    },
  ];

  for (const l of licenseSeed) {
    const existing = await db.select().from(licenses).where(eq(licenses.slug, l.slug)).limit(1);
    if (existing[0]) {
      const cur = existing[0];
      if (
        cur.name !== l.name ||
        cur.pricePerCallQubic !== l.pricePerCallQubic ||
        cur.revenueShareBps !== l.revenueShareBps
      ) {
        await db
          .update(licenses)
          .set({
            name: l.name,
            description: l.description,
            kind: l.kind,
            terms: l.terms,
            pricePerCallQubic: l.pricePerCallQubic,
            revenueShareBps: l.revenueShareBps,
            allowsModification: l.allowsModification,
            allowsCommercialUse: l.allowsCommercialUse,
            allowsRedistribution: l.allowsRedistribution,
            requiresAttribution: l.requiresAttribution,
            updatedAt: new Date(),
          })
          .where(eq(licenses.id, cur.id));
        console.log(`  license: ${l.slug} (updated: price=${l.pricePerCallQubic})`);
      } else {
        console.log(`  license: ${l.slug} (unchanged)`);
      }
      continue;
    }
    await db.insert(licenses).values(l);
    console.log(`  license: ${l.slug} (${l.kind})`);
  }

  await closeDb();
  console.log("[ann] seed complete");
}

main().catch((err) => {
  console.error("[ann] seed failed:", err);
  process.exit(1);
});
