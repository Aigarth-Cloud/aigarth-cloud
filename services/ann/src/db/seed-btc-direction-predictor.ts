/**
 * Phase 29 — seed the demo "BTC Direction Predictor v1" ANN.
 *
 * Idempotent. Re-running upserts by (slug, version) and skips the
 * repository row if one already exists for the same
 * (repo_owner, repo_name, commit_sha, manifest_hash) tuple.
 *
 * What this seed ships:
 *   - The ANN row (slug: btc-direction-predictor)
 *   - A v1.0.0 version with a deterministic placeholder artifact hash
 *   - The manifest (see BTC_DIRECTION_PREDICTOR_MANIFEST below)
 *   - An ann_repositories row whose releaseUrl encodes the
 *     architecture ("local://manifest/btc-direction-predictor-v1")
 *     so the execution layer can find the right adapter without
 *     a separate manifest-store table
 *
 * What this seed does NOT ship (out of scope this session):
 *   - A real GitHub repository or release
 *   - A live git push (publication_kind = "seed")
 *   - A signed manifest (v1 has a stable hash, not a signature)
 *
 * Run: pnpm --filter @aigarth/ann db:seed-btc
 */

import { eq, and } from "drizzle-orm";
import { getDb, closeDb } from "./index.js";
import {
  anns,
  annVersions,
  annRepositories,
  categories,
  licenses,
} from "./schema.js";
import {
  buildManifest,
  manifestHash,
  type AnnManifest,
} from "../types/ann-manifest.js";
import { attachRepository } from "../services/executions.js";
import { uid } from "../lib/ids.js";

const SYSTEM_CREATOR_USER_ID = "00000000-0000-0000-0000-000000000001";
const SYSTEM_DEMO_WALLET = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const BTC_DIRECTION_PREDICTOR_MANIFEST: AnnManifest = buildManifest({
  id: "btc-direction-predictor",
  name: "BTC Direction Predictor",
  version: "v1.0.0",
  creator: "Aigarth Demo",
  architecture: "btc-direction-predictor-v1",
  modelHash: "sha256:" + "1".repeat(64),
  inputSchema: {
    type: "object",
    description: "A 30-day window of daily closing prices.",
    required: ["features"],
    properties: {
      features: {
        type: "array",
        description: "30 numeric closing prices, oldest first.",
      },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      prediction: { type: "string", description: "up | down | flat" },
      confidence: { type: "number", description: "0..1" },
      momentum: { type: "number" },
      last_price: { type: "number" },
      mean_price: { type: "number" },
      window_size: { type: "number" },
      adapter: { type: "string" },
    },
  },
  benchmark: { name: "btc-5d-momentum", score: 51.2 },
  repository: "https://github.com/aigarth-cloud/ann-btc-direction-predictor",
  commit: "0".repeat(40),
  license: "Apache-2.0",
  description:
    "Demo ANN for the Phase 29 superprompt. Predicts next-5d BTC direction from a 30-day price window using a trivial 5-day momentum rule. Not a real model — its job is to prove the ANN → Execution Router → local + Qubic OC pipeline end-to-end.",
});

async function getCategoryId(slug: string): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);
  return rows[0]?.id ?? null;
}

async function getLicenseId(slug: string): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({ id: licenses.id })
    .from(licenses)
    .where(eq(licenses.slug, slug))
    .limit(1);
  return rows[0]?.id ?? null;
}

async function upsertAnn(): Promise<{ annId: string; versionId: string }> {
  const db = getDb();
  const categoryId = await getCategoryId("science");
  const licenseId = await getLicenseId("open");
  if (!categoryId) throw new Error("category 'science' not found — run pnpm db:seed first");
  if (!licenseId) throw new Error("license 'open' not found — run pnpm db:seed first");

  // ANN row
  const existingAnn = await db
    .select({ id: anns.id })
    .from(anns)
    .where(eq(anns.slug, BTC_DIRECTION_PREDICTOR_MANIFEST.id))
    .limit(1);
  let annId: string;
  if (existingAnn[0]) {
    annId = existingAnn[0].id;
  } else {
    const [row] = await db
      .insert(anns)
      .values({
        slug: BTC_DIRECTION_PREDICTOR_MANIFEST.id,
        name: BTC_DIRECTION_PREDICTOR_MANIFEST.name,
        tagline: "Predict next-5d BTC direction from a 30-day price window.",
        description: BTC_DIRECTION_PREDICTOR_MANIFEST.description ?? "",
        icon: "trending-up",
        tags: ["btc", "finance", "time-series", "demo", "phase-29"],
        categoryId,
        licenseId,
        creatorUserId: SYSTEM_CREATOR_USER_ID,
        creatorOrgId: null,
        creatorName: BTC_DIRECTION_PREDICTOR_MANIFEST.creator,
        creatorWalletAddress: SYSTEM_DEMO_WALLET,
        visibility: "public",
        status: "published",
        accuracy: "51.20",
        latencyP50Ms: 50,
        latencyP99Ms: 200,
        totalCalls: BigInt(0),
        totalRevenueQubic: BigInt(0),
        monthlyCalls: BigInt(0),
        downloads: BigInt(0),
        ratingCount: 0,
        publishedAt: new Date(),
        decisionProtocol: "openai_chat",
        authorityWeight: "0.500",
      })
      .returning();
    if (!row) throw new Error("failed to insert btc-direction-predictor ANN");
    annId = row.id;
    console.log(`[seed] inserted ANN '${BTC_DIRECTION_PREDICTOR_MANIFEST.id}' (${annId})`);
  }

  // Version row
  const existingVersion = await db
    .select({ id: annVersions.id })
    .from(annVersions)
    .where(
      and(
        eq(annVersions.annId, annId),
        eq(annVersions.version, BTC_DIRECTION_PREDICTOR_MANIFEST.version),
      ),
    )
    .limit(1);
  let versionId: string;
  if (existingVersion[0]) {
    versionId = existingVersion[0].id;
  } else {
    const [row] = await db
      .insert(annVersions)
      .values({
        annId,
        version: BTC_DIRECTION_PREDICTOR_MANIFEST.version,
        changelog: "Initial demo release. Trivial 5-day momentum rule.",
        artifactUrl: `local://manifest/${BTC_DIRECTION_PREDICTOR_MANIFEST.architecture}`,
        artifactSizeBytes: BigInt(JSON.stringify(BTC_DIRECTION_PREDICTOR_MANIFEST).length),
        artifactHash: BTC_DIRECTION_PREDICTOR_MANIFEST.modelHash,
        hyperparameters: {},
        metrics: { benchmark: BTC_DIRECTION_PREDICTOR_MANIFEST.benchmark ?? null },
        isLatest: true,
      })
      .returning();
    if (!row) throw new Error("failed to insert btc-direction-predictor version");
    versionId = row.id;
    console.log(`[seed] inserted version ${BTC_DIRECTION_PREDICTOR_MANIFEST.version} (${versionId})`);
  }
  return { annId, versionId };
}

async function upsertRepository(annId: string, annVersionId: string): Promise<void> {
  const m = BTC_DIRECTION_PREDICTOR_MANIFEST;
  const mh = manifestHash(m);
  // Use the manifest hash as the synthetic commit SHA. The seed
  // does not push to a real git repository; this is the canonical
  // "seed commit" identity. A real GitHub App publish flow (Phase
  // 30+) will replace this with a real SHA.
  const syntheticCommitSha = mh.slice(7); // strip "sha256:" → 64 hex chars
  const releaseUrl = `local://manifest/${m.architecture}`;
  const row = await attachRepository({
    annId,
    annVersionId,
    repoOwner: "aigarth-cloud",
    repoName: `ann-${m.id}`,
    commitSha: syntheticCommitSha,
    manifestHash: mh,
    releaseTag: m.version,
    releaseUrl,
    publicationKind: "seed",
  });
  console.log(
    `[seed] repository row for ${row.repoOwner}/${row.repoName}@${row.commitSha.slice(0, 7)} (manifest_hash=${row.manifestHash.slice(0, 14)}...)`,
  );
}

async function main(): Promise<void> {
  try {
    const { annId, versionId } = await upsertAnn();
    await upsertRepository(annId, versionId);
    console.log("[seed] done. Run `pnpm dev:web` and visit /anns/btc-direction-predictor to exercise the pipeline.");
  } finally {
    await closeDb();
  }
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
