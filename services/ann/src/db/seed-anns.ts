/**
 * Seed the ANN service with a starter catalog of real ANNs.
 *
 * Idempotent — re-running updates existing rows by slug, never
 * duplicates. Each ANN has a single v1.0.0 version with placeholder
 * metrics; the gateway can route to stub backends per the
 * `artifactHash` until real training is wired.
 *
 *   1. Caribbean Crop Doctor       (Vision / Agriculture)
 *   2. Qubic Treasury Sentinel     (Finance / Crypto)
 *   3. Trinidad Creole Translator  (Language / Caribbean)
 *   4. SME Compliance Advisor      (Government / Legal)
 *   5. Solar Yield Forecaster      (Science / Energy)
 *   6. SQL Cockpit Copilot         (Coding / DevTools)
 *
 * Material Science Intelligence (Phase 17) — 8 specialized ANNs:
 *   7.  Material Research Director    (Science / role:director)
 *   8.  Material Literature Ingester  (Science / role:literature)
 *   9.  Material Simulation Runner    (Science / role:simulation)
 *   10. Material Physics Reasoner     (Science / role:physics)
 *   11. Material Designer             (Science / role:design)
 *   12. Material Multi-Obj Optimizer  (Science / role:optimization)
 *   13. Material Experiment Planner   (Science / role:experiment)
 *   14. Material Validation Engine    (Science / role:validation)
 *
 * Run: pnpm --filter @aigarth/ann db:seed-anns
 */

import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getDb, closeDb } from "./index.js";
import { anns, annVersions, categories, licenses, type NewAnn } from "./schema.js";

/** Stable artifact hash derived from (slug, version). Not cryptographic;
 *  just a deterministic placeholder until real K12 signing is wired. */
function hashAnn(slug: string, version: string): string {
  return createHash("sha256").update(`${slug}:${version}`).digest("hex");
}

interface AnnSeed {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  tags: string[];
  categorySlug: string;
  licenseSlug: string;
  accuracy: string;
  latencyP50Ms: number;
  latencyP99Ms: number;
  creatorName: string;
  /** Per-call price override (QUBIC). Falls back to license's default. */
  pricePerCallQubic?: bigint;
  /** What the ANN does in one sentence (the "capability" line). */
  capability: string;
  /** Example input the demo can show. */
  demoInputExample: string;
  /** Version changelog. */
  changelog: string;
}

const CREATOR_USER_ID = "00000000-0000-0000-0000-000000000001"; // system creator for demo seeds
const DEMO_WALLET = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const SEED_ANNS: AnnSeed[] = [
  {
    slug: "caribbean-crop-doctor",
    name: "Caribbean Crop Doctor",
    tagline: "Diagnose crop diseases from a leaf photo.",
    description:
      "A vision model fine-tuned on Caribbean agriculture. Upload a photo of a leaf and get a top-3 disease prediction with confidence and treatment recommendations tailored to the local climate. Currently covers tomato, bell pepper, lettuce, cabbage, plantain, and banana.",
    icon: "leaf",
    tags: ["agriculture", "vision", "caribbean", "trinidad", "jamaica", "barbados"],
    categorySlug: "vision",
    licenseSlug: "commercial",
    accuracy: "92.30",
    latencyP50Ms: 380,
    latencyP99Ms: 1100,
    creatorName: "Caribbean Agri Lab",
    pricePerCallQubic: 250_000n, // 0.25 Qu per call
    capability: "Classify plant diseases from a leaf image with 92% top-3 accuracy.",
    demoInputExample: "Photo of a tomato leaf with yellow-brown spots on the lower leaves.",
    changelog: "Initial release. Trained on 14k labelled Caribbean field samples.",
  },
  {
    slug: "qubic-treasury-sentinel",
    name: "Qubic Treasury Sentinel",
    tagline: "Detect anomalous QUBIC flows across the platform treasury.",
    description:
      "A real-time anomaly detector for the Aigarth platform treasury. Watches inbound and outbound QUBIC flows, flags unusual patterns (sudden spikes, micro-transaction bursts, dust attacks), and produces a human-readable incident report. Useful for ops teams and the Aigarth platform admins.",
    icon: "shield",
    tags: ["finance", "anomaly-detection", "qubic", "treasury", "ops"],
    categorySlug: "finance",
    licenseSlug: "restricted",
    accuracy: "96.80",
    latencyP50Ms: 95,
    latencyP99Ms: 280,
    creatorName: "Qubic Watch",
    pricePerCallQubic: 1_000_000n, // 1 Qu per call (restricted scope)
    capability: "Score a treasury flow bundle 0–1.0 with reasoning.",
    demoInputExample: "Last 24h of treasury_movements: 14 deposits, 8 unstake payouts, 1 burn event.",
    changelog: "Initial release. Trained on 6 months of synthetic Aigarth-like flow data.",
  },
  {
    slug: "trinidad-creole-translator",
    name: "Trinidad Creole Translator",
    tagline: "Translate between English and Trinidadian Creole.",
    description:
      "A small but capable English ↔ Trinidadian Creole translator. Handles the everyday registers (market, family, news) and the code-switching that shows up in casual Caribbean text. Designed for hospitality, customer service, and content teams that need to localise into the regional market.",
    icon: "languages",
    tags: ["language", "translation", "caribbean", "trinidad", "creole", "english"],
    categorySlug: "language",
    licenseSlug: "open",
    accuracy: "88.10",
    latencyP50Ms: 210,
    latencyP99Ms: 600,
    creatorName: "UWI Creole Project",
    pricePerCallQubic: 0n,
    capability: "Translate one paragraph between English and Trinidadian Creole.",
    demoInputExample: "“Where yuh reach from? Ah just come from Maracas.”",
    changelog: "Initial release. 9.4k parallel sentences across 4 dialect regions.",
  },
  {
    slug: "sme-compliance-advisor",
    name: "SME Compliance Advisor",
    tagline: "Plain-English compliance guidance for Caribbean small businesses.",
    description:
      "A regulatory advisor for SMEs operating in the Caribbean. Covers data protection (TT DPA, Jamaica DPA), consumer protection basics, and tax-filing cadence. Answers in plain English and cites the relevant statute. Best for: a small business owner wondering whether they need to register a data controller, or what to file by quarter-end.",
    icon: "scale",
    tags: ["legal", "compliance", "smb", "sme", "caribbean", "data-protection"],
    categorySlug: "legal",
    licenseSlug: "commercial",
    accuracy: "94.20",
    latencyP50Ms: 720,
    latencyP99Ms: 2400,
    creatorName: "Caribbean Compliance Co.",
    pricePerCallQubic: 500_000n, // 0.5 Qu per call
    capability: "Answer a compliance question with statute citation and a 1-paragraph action list.",
    demoInputExample: "I'm a 3-person SaaS in Port of Spain. Do I need to register as a data controller under the TT DPA?",
    changelog: "Initial release. 4 jurisdictions (TT, JM, BB, GY). 380 cited statutes.",
  },
  {
    slug: "solar-yield-forecaster",
    name: "Solar Yield Forecaster",
    tagline: "Forecast monthly kWh for a Caribbean rooftop PV install.",
    description:
      "Estimates monthly energy yield for a rooftop solar install in the Caribbean. Takes location (lat/lon), panel area, tilt, and orientation; returns a 12-month kWh forecast and a payback estimate at the current local feed-in tariff. Calibrated against 3 years of data from installations in T&T, Jamaica, and Barbados.",
    icon: "sun",
    tags: ["energy", "solar", "forecast", "caribbean", "sustainability"],
    categorySlug: "science",
    licenseSlug: "open",
    accuracy: "91.40",
    latencyP50Ms: 540,
    latencyP99Ms: 1500,
    creatorName: "Caribbean Solar Lab",
    pricePerCallQubic: 0n,
    capability: "Estimate monthly kWh and payback for a rooftop PV install.",
    demoInputExample: "10 kWp array, 15° tilt, south-facing, Port of Spain, current FIT = 0.18 USD/kWh.",
    changelog: "Initial release. 3.2 years of measurement data across 14 sites.",
  },
  {
    slug: "sql-cockpit-copilot",
    name: "SQL Cockpit Copilot",
    tagline: "Translate natural-language questions into Aigarth SQL queries.",
    description:
      "A coding copilot tuned on the Aigarth data model. Given a question in plain English (and an optional org/data-warehouse context), returns a SQL query against the `anns`, `stakes`, `payout_runs`, etc. schema. Includes an explanation and a list of assumptions. Designed for non-technical operators answering their own questions.",
    icon: "code",
    tags: ["coding", "sql", "copilot", "devtools", "aigarth"],
    categorySlug: "coding",
    licenseSlug: "commercial",
    accuracy: "89.60",
    latencyP50Ms: 1100,
    latencyP99Ms: 3200,
    creatorName: "Aigarth DevRel",
    pricePerCallQubic: 200_000n, // 0.2 Qu per call
    capability: "Convert a plain-English question into a SQL query against the Aigarth data model.",
    demoInputExample: "Show me the top 10 contributors by earnings last quarter.",
    changelog: "Initial release. Trained on 12k Q→SQL pairs against the Aigarth schema.",
  },

  // ====================================================================
  //  Material Science Intelligence ANNs (Phase 17, Phase 0 stub)
  //
  //  All 8 use `categorySlug: "science"` so they show up under
  //  "Science" in the marketplace filter. The `tags` array carries
  //  the material-science marker + the per-role tag for future
  //  domain-based filtering (Phase 2+).
  // ====================================================================

  {
    slug: "mat-research-director",
    name: "Material Research Director",
    tagline: "Plan a material discovery workflow from a research question.",
    description:
      "Reads a research question and returns a structured research plan: which stages to run, in what order, with what budget. Breaks 'find a battery cathode with 400 Wh/kg' into a literature pass, a generative design pass, a DFT refinement pass, and a Pareto sort. Coordinates the other 7 material science ANNs.",
    icon: "compass",
    tags: [
      "material-science",
      "material-science:role:director",
      "material-science:domain:generic",
      "research",
      "orchestration",
    ],
    categorySlug: "science",
    licenseSlug: "open",
    accuracy: "94.50",
    latencyP50Ms: 2000,
    latencyP99Ms: 6500,
    creatorName: "Aigarth Research",
    pricePerCallQubic: 50_000n, // 0.05 Qu per call
    capability: "Decompose a material research question into a 4–8 stage plan with cost estimates.",
    demoInputExample:
      "Find a low-cost, high-cycle-life Na-ion cathode. Target energy density > 400 Wh/kg, 1-week wall time.",
    changelog:
      "Initial release. Stub backend. Returns a deterministic 5-stage plan for known question templates; falls back to a templated plan for novel inputs.",
  },
  {
    slug: "mat-literature-ingester",
    name: "Material Literature Ingester",
    tagline: "Ingest scientific papers into a structured knowledge graph.",
    description:
      "Reads open-access material science papers (arXiv, open journals), extracts structured facts: composition, property values, measurement method, citation. Builds a knowledge graph the other ANNs can query. Returns paper summaries with cited property values and a list of newly-added knowledge graph nodes.",
    icon: "book-open",
    tags: [
      "material-science",
      "material-science:role:literature",
      "material-science:domain:generic",
      "nlp",
      "knowledge-graph",
    ],
    categorySlug: "science",
    licenseSlug: "open",
    accuracy: "91.20",
    latencyP50Ms: 5000,
    latencyP99Ms: 18000,
    creatorName: "Materials Intel Lab",
    pricePerCallQubic: 100_000n, // 0.10 Qu per call
    capability: "Ingest one paper and return structured property values + knowledge graph nodes.",
    demoInputExample:
      "PDF of 'High-Energy Cathode Materials for Sodium-Ion Batteries' (2024, J. Electrochem. Soc.).",
    changelog:
      "Initial release. Stub backend. Returns a templated summary with one fabricated property for testing the knowledge graph; real ingestion wired in Phase 1.",
  },
  {
    slug: "mat-simulation-runner",
    name: "Material Simulation Runner",
    tagline: "Run DFT, MD, or ML surrogate simulations for material properties.",
    description:
      "Routes a simulation request to the right engine: VASP or Quantum ESPRESSO for DFT, LAMMPS or GROMACS for molecular dynamics, MACE or Allegro for ML surrogate. Returns predicted properties (band gap, formation energy, bulk modulus) with uncertainty. Stub backend returns deterministic placeholder values; real engine integration ships in Phase 2.",
    icon: "flask-conical",
    tags: [
      "material-science",
      "material-science:role:simulation",
      "material-science:domain:generic",
      "dft",
      "molecular-dynamics",
      "mlip",
      "compute-heavy",
    ],
    categorySlug: "science",
    licenseSlug: "commercial",
    accuracy: "88.60",
    latencyP50Ms: 60_000,
    latencyP99Ms: 600_000,
    creatorName: "Aigarth HPC",
    pricePerCallQubic: 500_000n, // 0.50 Qu per call (DFT cost dominates)
    capability: "Run a DFT relaxation on a small unit cell, return formation energy ± uncertainty.",
    demoInputExample:
      "Material: LiNi0.8Mn0.1Co0.1O2, engine: VASP, calculation: full relaxation, k-point mesh: 4×4×2.",
    changelog:
      "Initial release. Stub backend. Returns a placeholder (formation energy = -2.4 eV/atom, uncertainty = ±0.3) for known materials; random fallback for unknown.",
  },
  {
    slug: "mat-physics-reasoner",
    name: "Material Physics Reasoner",
    tagline: "Sanity-check a DFT result against first principles.",
    description:
      "Takes a simulation output and a candidate material, returns a verdict: is the structure physically plausible? Is the formation energy within a sane range? Are there any red flags (e.g. the structure collapsed during relaxation, the band gap is impossibly zero, the magnetic moment is wrong)? Rule-based, no GPU.",
    icon: "zap",
    tags: [
      "material-science",
      "material-science:role:physics",
      "material-science:domain:generic",
      "rule-based",
      "first-principles",
    ],
    categorySlug: "science",
    licenseSlug: "open",
    accuracy: "96.80",
    latencyP50Ms: 200,
    latencyP99Ms: 800,
    creatorName: "Open Physics",
    pricePerCallQubic: 20_000n, // 0.02 Qu per call
    capability: "Score a simulation result 0–1.0 with reasoning.",
    demoInputExample:
      "Formation energy = -2.4 eV/atom, band gap = 0.0 eV, magnetic moment = 0.5 μB, structure: layered oxide.",
    changelog:
      "Initial release. Stub backend. Returns a deterministic 0.85 score for known-good inputs; flags obviously wrong ones (negative formation energy with positive band gap, etc.).",
  },
  {
    slug: "mat-material-designer",
    name: "Material Designer",
    tagline: "Generate candidate materials for a target property profile.",
    description:
      "Generative model that produces candidate material compositions + structures for a target profile (e.g. 'cathode with band gap 2.5-3.5 eV, formation energy < -2 eV/atom, synthesizable'). Returns 10–100 candidates ranked by predicted fit. Stub backend returns a deterministic candidate set; real diffusion model ships in Phase 2.",
    icon: "pencil-ruler",
    tags: [
      "material-science",
      "material-science:role:design",
      "material-science:domain:generic",
      "generative",
      "inverse-design",
    ],
    categorySlug: "science",
    licenseSlug: "commercial",
    accuracy: "87.40",
    latencyP50Ms: 30_000,
    latencyP99Ms: 120_000,
    creatorName: "Aigarth Design",
    pricePerCallQubic: 200_000n, // 0.20 Qu per call
    capability: "Generate 100 candidate materials for a target property profile, ranked by fit.",
    demoInputExample:
      "Target: layered oxide cathode, band gap 2.5-3.5 eV, formation energy < -2 eV/atom, no Co.",
    changelog:
      "Initial release. Stub backend. Returns 10 templated layered oxide candidates for known templates; empty list for unknown.",
  },
  {
    slug: "mat-multi-obj-optimizer",
    name: "Material Multi-Objective Optimizer",
    tagline: "Pareto-sort candidates on (energy density, cost, cycle life, ...).",
    description:
      "Takes a list of candidate materials with their predicted properties and returns the Pareto front. Multi-objective optimization (NSGA-II) over user-specified axes. Best for: 'which 3 of these 100 candidates are the best trade-off between energy density and cost?'",
    icon: "trending-up",
    tags: [
      "material-science",
      "material-science:role:optimization",
      "material-science:domain:generic",
      "pareto",
      "nsga-ii",
      "multi-objective",
    ],
    categorySlug: "science",
    licenseSlug: "open",
    accuracy: "93.00",
    latencyP50Ms: 100,
    latencyP99Ms: 500,
    creatorName: "Open Optim",
    pricePerCallQubic: 50_000n, // 0.05 Qu per call
    capability: "Return the top-K Pareto-optimal candidates for a multi-objective profile.",
    demoInputExample:
      "100 candidates, axes: (energy_density_max, cost_min, cycle_life_max), top 5.",
    changelog:
      "Initial release. Stub backend. Returns the first 5 candidates unchanged; real NSGA-II ships in Phase 2.",
  },
  {
    slug: "mat-experiment-planner",
    name: "Material Experiment Planner",
    tagline: "Convert a candidate material into a lab protocol.",
    description:
      "Takes the top-K candidates from the Optimizer and converts each into a synthesizable lab protocol: synthesis method, calcination temperature and time, expected characterization (XRD, SEM, galvanostatic cycling), expected outcomes. Returns a printable protocol + an equipment list.",
    icon: "test-tube",
    tags: [
      "material-science",
      "material-science:role:experiment",
      "material-science:domain:generic",
      "lab-protocol",
      "synthesis",
    ],
    categorySlug: "science",
    licenseSlug: "commercial",
    accuracy: "90.50",
    latencyP50Ms: 2000,
    latencyP99Ms: 8000,
    creatorName: "Aigarth Lab",
    pricePerCallQubic: 50_000n, // 0.05 Qu per call
    capability: "Generate a synthesizable lab protocol + equipment list for one candidate material.",
    demoInputExample:
      "Material: LiNi0.8Mn0.1Co0.1O2, scale: 5g, technique: solid-state.",
    changelog:
      "Initial release. Stub backend. Returns a templated solid-state protocol for known families; 'manual review required' for unknown.",
  },
  {
    slug: "mat-validation-engine",
    name: "Material Validation Engine",
    tagline: "Cross-check a prediction against literature and historical data.",
    description:
      "Takes a material prediction (composition, property, uncertainty) and returns a validation verdict: does the literature agree? Has anyone measured this composition before? Is the predicted value within ±2σ of the historical mean? Returns a confidence score + the literature citations.",
    icon: "shield-check",
    tags: [
      "material-science",
      "material-science:role:validation",
      "material-science:domain:generic",
      "literature-cross-check",
      "uncertainty-calibration",
    ],
    categorySlug: "science",
    licenseSlug: "open",
    accuracy: "95.20",
    latencyP50Ms: 800,
    latencyP99Ms: 3000,
    creatorName: "Aigarth Validate",
    pricePerCallQubic: 50_000n, // 0.05 Qu per call
    capability: "Score a prediction 0–1.0 against literature + historical data, with citations.",
    demoInputExample:
      "Prediction: band_gap = 2.8 eV ± 0.4, material: LiNi0.5Mn0.5O2, source: mat-simulation-runner.",
    changelog:
      "Initial release. Stub backend. Returns a deterministic 0.72 score for known materials; 0.50 for unknown with 'no prior data' note.",
  },
];

async function getCategoryId(slug: string): Promise<string | null> {
  const db = getDb();
  const rows = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)).limit(1);
  return rows[0]?.id ?? null;
}

async function getLicenseId(slug: string): Promise<string | null> {
  const db = getDb();
  const rows = await db.select({ id: licenses.id }).from(licenses).where(eq(licenses.slug, slug)).limit(1);
  return rows[0]?.id ?? null;
}

async function upsertAnn(seed: AnnSeed): Promise<void> {
  const db = getDb();
  const categoryId = await getCategoryId(seed.categorySlug);
  const licenseId = await getLicenseId(seed.licenseSlug);
  if (!categoryId || !licenseId) {
    throw new Error(
      `Missing category (${seed.categorySlug}) or license (${seed.licenseSlug}) — run pnpm db:seed first.`,
    );
  }

  const existing = await db.select().from(anns).where(eq(anns.slug, seed.slug)).limit(1);
  const baseFields = {
    name: seed.name,
    tagline: seed.tagline,
    description: seed.description,
    icon: seed.icon,
    tags: seed.tags,
    categoryId,
    licenseId,
    creatorUserId: CREATOR_USER_ID,
    creatorName: seed.creatorName,
    visibility: "public" as const,
    status: "published" as const,
    creatorWalletAddress: DEMO_WALLET,
    signature: "format-only-stub",
    accuracy: seed.accuracy,
    latencyP50Ms: seed.latencyP50Ms,
    latencyP99Ms: seed.latencyP99Ms,
    totalCalls: 0n,
    totalRevenueQubic: 0n,
    monthlyCalls: 0n,
    downloads: 0n,
    publishedAt: new Date(),
  } satisfies Partial<NewAnn>;

  let annId: string;
  if (existing[0]) {
    annId = existing[0].id;
    await db.update(anns).set({ ...baseFields, updatedAt: new Date() }).where(eq(anns.id, annId));
  } else {
    const inserted = await db.insert(anns).values({ slug: seed.slug, ...baseFields }).returning();
    annId = inserted[0]!.id;
  }

  // Insert v1.0.0 if it doesn't exist.
  const existingVersion = await db
    .select()
    .from(annVersions)
    .where(eq(annVersions.annId, annId))
    .limit(1);
  if (!existingVersion[0]) {
    const versionId = crypto.randomUUID();
    const artifactHash = hashAnn(seed.slug, "1.0.0");
    await db.insert(annVersions).values({
      id: versionId,
      annId,
      version: "1.0.0",
      changelog: seed.changelog,
      artifactUrl: `s3://aigarth-artifacts/anns/${seed.slug}/v1.0.0.bin`,
      artifactSizeBytes: 1_024_000n, // 1MB placeholder
      artifactHash,
      hyperparameters: {
        learning_rate: 0.0001,
        epochs: 12,
        batch_size: 32,
        base_model: "stub-base-v1",
      },
      metrics: {
        accuracy: parseFloat(seed.accuracy),
        latency_p50_ms: seed.latencyP50Ms,
        latency_p99_ms: seed.latencyP99Ms,
        training_samples: 12_000,
      },
      isLatest: true,
    });
    await db
      .update(anns)
      .set({ currentVersionId: versionId, updatedAt: new Date() })
      .where(eq(anns.id, annId));
  }
}

async function main() {
  const db = getDb();
  console.log("[ann] seeding starter catalog of ANNs");
  for (const seed of SEED_ANNS) {
    await upsertAnn(seed);
    console.log(`  ann: ${seed.slug} (${seed.name})`);
  }
  await closeDb();
  console.log(`[ann] seed complete: ${SEED_ANNS.length} ANNs`);
}

main().catch((err) => {
  console.error("[ann] seed-anns failed:", err);
  process.exit(1);
});
