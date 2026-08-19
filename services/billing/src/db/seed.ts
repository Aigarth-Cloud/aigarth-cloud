/**
 * Seed the billing service with default plans.
 *
 *   free          → $0 / 10K tokens
 *   pro           → $30 / 1M tokens (~$30/month, $0.03 per 1K overage)
 *   team          → $300 / 10M tokens (5 seats included)
 *   enterprise    → $3000 / unlimited tokens (custom contract)
 *
 * Idempotent.
 */

import { eq } from "drizzle-orm";
import { getDb, closeDb } from "./index.js";
import { plans } from "./schema.js";

async function main() {
  const db = getDb();
  console.log("[billing] seeding default plans");

  const seed = [
    {
      id: "free",
      name: "Free",
      description: "Get started. 10,000 tokens per month. Perfect for trying things out.",
      tier: "free" as const,
      monthlyPriceQubic: 0n,
      includedTokens: 10_000n,
      overageRateQubicPer1k: 1_000n,
      signupCreditsQubic: 0n,
      features: ["community_support", "rate_limit_60rpm", "rate_limit_100k_tpm"],
      sortOrder: 10,
    },
    {
      id: "pro",
      name: "Pro",
      description: "For individuals building with the Aigarth SDK. 1M tokens per month.",
      tier: "pro" as const,
      monthlyPriceQubic: 30_000_000n, // 30 Qu
      includedTokens: 1_000_000n,
      overageRateQubicPer1k: 30_000n, // 0.03 Qu per 1K
      signupCreditsQubic: 30_000_000n, // 30 Qu signup bonus — first month free
      features: ["email_support", "rate_limit_300rpm", "rate_limit_1m_tpm", "priority_queue"],
      sortOrder: 20,
    },
    {
      id: "team",
      name: "Team",
      description: "For teams. 10M tokens per month, 5 seats, priority routing.",
      tier: "team" as const,
      monthlyPriceQubic: 300_000_000n, // 300 Qu
      includedTokens: 10_000_000n,
      overageRateQubicPer1k: 20_000n, // 0.02 Qu per 1K (volume discount)
      signupCreditsQubic: 50_000_000n, // 50 Qu signup bonus
      features: [
        "email_support",
        "rate_limit_1000rpm",
        "rate_limit_10m_tpm",
        "priority_queue",
        "5_seats",
        "shared_workspaces",
      ],
      sortOrder: 30,
    },
    {
      id: "enterprise",
      name: "Enterprise",
      description: "Custom. Volume pricing. Dedicated support. SLA.",
      tier: "enterprise" as const,
      monthlyPriceQubic: 3_000_000_000n, // 3000 Qu
      includedTokens: 1_000_000_000_000n, // 1B (effectively unlimited)
      overageRateQubicPer1k: 10_000n, // 0.01 Qu per 1K (deepest discount)
      signupCreditsQubic: 1_000_000_000n, // 1000 Qu signup bonus
      features: [
        "dedicated_support",
        "unlimited_rpm",
        "unlimited_tpm",
        "top_priority_queue",
        "unlimited_seats",
        "sla_99_9",
        "custom_contracts",
      ],
      sortOrder: 40,
    },
  ];

  for (const p of seed) {
    const existing = await db.select().from(plans).where(eq(plans.id, p.id)).limit(1);
    if (existing[0]) {
      // Upsert: update mutable fields if the seed values differ
      const cur = existing[0];
      const changed =
        cur.name !== p.name ||
        cur.description !== p.description ||
        cur.monthlyPriceQubic !== p.monthlyPriceQubic ||
        cur.includedTokens !== p.includedTokens ||
        cur.overageRateQubicPer1k !== p.overageRateQubicPer1k ||
        cur.signupCreditsQubic !== p.signupCreditsQubic ||
        JSON.stringify(cur.features) !== JSON.stringify(p.features);
      if (changed) {
        await db
          .update(plans)
          .set({
            name: p.name,
            description: p.description,
            monthlyPriceQubic: p.monthlyPriceQubic,
            includedTokens: p.includedTokens,
            overageRateQubicPer1k: p.overageRateQubicPer1k,
            signupCreditsQubic: p.signupCreditsQubic,
            features: p.features,
            updatedAt: new Date(),
          })
          .where(eq(plans.id, p.id));
        console.log(`  plan: ${p.id} (updated: signup_credits_qubic=${p.signupCreditsQubic})`);
      } else {
        console.log(`  plan: ${p.id} (unchanged)`);
      }
      continue;
    }
    await db.insert(plans).values(p);
    console.log(`  plan: ${p.id} (${p.tier}) — ${p.name}`);
  }

  await closeDb();
  console.log("[billing] seed complete");
}

main().catch((err) => {
  console.error("[billing] seed failed:", err);
  process.exit(1);
});
