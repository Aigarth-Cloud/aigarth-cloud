/**
 * Seed the gateway with default models.
 *
 *   aigarth-meridian-1        chat     8K context  10/30 QUBIC per 1K tok
 *   aigarth-meridian-1-pro    chat    32K context  30/90 QUBIC per 1K tok
 *   aigarth-embed-1          embed  1536 dim      1 QUBIC per 1K tok
 *   aigarth-image-1          image  1024x1024    100 QUBIC per image
 *
 * Idempotent.
 */

import { eq } from "drizzle-orm";
import { getDb, closeDb } from "./index.js";
import { gatewayModels, gatewayDeployments } from "./schema.js";

async function main() {
  const db = getDb();
  console.log("[gateway] seeding default models");

  const models = [
    {
      id: "aigarth-meridian-1",
      name: "Aigarth Meridian 1",
      family: "aigarth-meridian",
      type: "chat" as const,
      description: "Fast chat model. Good for everyday tasks.",
      contextWindow: 8192,
      maxOutputTokens: 2048,
      inputCostQubic: 10n,
      outputCostQubic: 30n,
    },
    {
      id: "aigarth-meridian-1-pro",
      name: "Aigarth Meridian 1 Pro",
      family: "aigarth-meridian",
      type: "chat" as const,
      description: "Larger context, better reasoning. Slower and pricier.",
      contextWindow: 32_768,
      maxOutputTokens: 4096,
      inputCostQubic: 30n,
      outputCostQubic: 90n,
    },
    {
      id: "aigarth-embed-1",
      name: "Aigarth Embed 1",
      family: "aigarth-embed",
      type: "embedding" as const,
      description: "Text embeddings. 1536 dimensions.",
      contextWindow: 8192,
      maxOutputTokens: 1536,
      inputCostQubic: 1n,
      outputCostQubic: 0n,
    },
    {
      id: "aigarth-image-1",
      name: "Aigarth Image 1",
      family: "aigarth-image",
      type: "image" as const,
      description: "Image generation. 1024×1024 default.",
      contextWindow: 1024,
      maxOutputTokens: 1,
      inputCostQubic: 100n,
      outputCostQubic: 0n,
    },
  ];

  for (const m of models) {
    const existing = await db
      .select()
      .from(gatewayModels)
      .where(eq(gatewayModels.id, m.id))
      .limit(1);
    if (existing[0]) {
      console.log(`  model: ${m.id} (already exists)`);
      continue;
    }
    await db.insert(gatewayModels).values(m);
    console.log(`  model: ${m.id} (${m.type})`);

    // Create default deployments (global region)
    const existingDep = await db
      .select()
      .from(gatewayDeployments)
      .where(eq(gatewayDeployments.modelId, m.id))
      .limit(1);
    if (!existingDep[0]) {
      await db.insert(gatewayDeployments).values({
        modelId: m.id,
        region: "global",
        clusterHint: m.type === "chat" ? "inference-pool" : m.type === "embedding" ? "inference-pool" : "general-pool",
        priority: 5,
      });
      console.log(`    deployment: global (priority 5)`);
    }
  }

  await closeDb();
  console.log("[gateway] seed complete");
}

main().catch((err) => {
  console.error("[gateway] seed failed:", err);
  process.exit(1);
});
