/**
 * ANN catalog: surfaces the starter catalog of ANNs that are also
 * registered in services/ann (seed: `services/ann/src/db/seed-anns.ts`).
 *
 * These two sources are kept in sync manually. The marketing pages
 * (which can't reach the ann service without auth) read this file.
 * The dashboard pages fetch real data from the ann service via the
 * SDK. The shapes are slightly different (this file is a marketing
 * projection; the SDK returns the full Drizzle row).
 *
 * If you're adding a new ANN: add it to BOTH this file and the
 * services/ann seed. The seed controls what's registered; this file
 * controls what's surfaced on the public marketing site.
 */

export type ANN = {
  id: string;
  name: string;
  creator: string;
  /** One-sentence summary (the "tagline" used in the marketplace card and detail hero). */
  tagline: string;
  description: string;
  category: string;
  accuracy: number;
  latencyMs: number;
  monthlyCalls: string;
  downloads: string;
  revenue: string;
  /** Minimum QUBIC to lock in Qearn to unlock access (per ADR 002). */
  stakeRequired: string;
  pricePerCall: string;
  licenseType: "Open" | "Commercial" | "Restricted";
  icon: string;
  tags: string[];
  trend: number;
  /** A short capability sentence used on the detail page. */
  capability: string;
  /** Example input for the demo CTA. */
  demoInputExample: string;
};

export const ANN_CATEGORIES = [
  "All",
  "Vision",
  "Medical",
  "Legal",
  "Finance",
  "Education",
  "Government",
  "Engineering",
  "Creative",
  "Agents",
  "Research",
  "Science",
  "Coding",
  "Enterprise",
  "Search",
  "Oracles",
  "Language",
];

export const FEATURED_ANNS: ANN[] = [
  {
    id: "caribbean-crop-doctor",
    name: "Caribbean Crop Doctor",
    tagline: "Diagnose crop diseases from a leaf photo.",
    creator: "Caribbean Agri Lab",
    description:
      "Diagnose crop diseases from a leaf photo. A vision model fine-tuned on Caribbean agriculture, covering tomato, bell pepper, lettuce, cabbage, plantain, and banana. Top-3 predictions with confidence and treatment recommendations tailored to the local climate.",
    category: "Vision",
    accuracy: 92.3,
    latencyMs: 380,
    monthlyCalls: " ",
    downloads: " ",
    revenue: " ",
    stakeRequired: "8M QUBIC",
    pricePerCall: "0.00025",
    licenseType: "Commercial",
    icon: "leaf",
    tags: ["agriculture", "vision", "caribbean", "trinidad", "jamaica", "barbados"],
    trend: 14,
    capability: "Classify plant diseases from a leaf image with 92% top-3 accuracy.",
    demoInputExample: "Photo of a tomato leaf with yellow-brown spots on the lower leaves.",
  },
  {
    id: "qubic-treasury-sentinel",
    name: "Qubic Treasury Sentinel",
    tagline: "Detect anomalous QUBIC flows across the platform treasury.",
    creator: "Qubic Watch",
    description:
      "Real-time anomaly detector for the Aigarth platform treasury. Watches inbound and outbound QUBIC flows, flags unusual patterns (sudden spikes, micro-transaction bursts, dust attacks), and produces a human-readable incident report.",
    category: "Finance",
    accuracy: 96.8,
    latencyMs: 95,
    monthlyCalls: " ",
    downloads: " ",
    revenue: " ",
    stakeRequired: "30M QUBIC",
    pricePerCall: "0.001",
    licenseType: "Restricted",
    icon: "shield",
    tags: ["finance", "anomaly-detection", "qubic", "treasury", "ops"],
    trend: 18,
    capability: "Score a treasury flow bundle 0–1.0 with reasoning.",
    demoInputExample: "Last 24h of treasury_movements: 14 deposits, 8 unstake payouts, 1 burn event.",
  },
  {
    id: "trinidad-creole-translator",
    name: "Trinidad Creole Translator",
    tagline: "Translate between English and Trinidadian Creole.",
    creator: "UWI Creole Project",
    description:
      "Translate between English and Trinidadian Creole. Handles the everyday registers (market, family, news) and the code-switching that shows up in casual Caribbean text. Designed for hospitality, customer service, and content teams localising into the regional market.",
    category: "Language",
    accuracy: 88.1,
    latencyMs: 210,
    monthlyCalls: " ",
    downloads: " ",
    revenue: " ",
    stakeRequired: "2M QUBIC",
    pricePerCall: "Free",
    licenseType: "Open",
    icon: "languages",
    tags: ["language", "translation", "caribbean", "trinidad", "creole", "english"],
    trend: 11,
    capability: "Translate one paragraph between English and Trinidadian Creole.",
    demoInputExample: "“Where yuh reach from? Ah just come from Maracas.”",
  },
  {
    id: "sme-compliance-advisor",
    name: "SME Compliance Advisor",
    tagline: "Plain-English compliance guidance for Caribbean small businesses.",
    creator: "Caribbean Compliance Co.",
    description:
      "Plain-English compliance guidance for Caribbean small businesses. Covers data protection (TT DPA, Jamaica DPA), consumer protection basics, and tax-filing cadence. Answers in plain English and cites the relevant statute.",
    category: "Legal",
    accuracy: 94.2,
    latencyMs: 720,
    monthlyCalls: " ",
    downloads: " ",
    revenue: " ",
    stakeRequired: "12M QUBIC",
    pricePerCall: "0.0005",
    licenseType: "Commercial",
    icon: "scale",
    tags: ["legal", "compliance", "smb", "sme", "caribbean", "data-protection"],
    trend: 9,
    capability: "Answer a compliance question with statute citation and a 1-paragraph action list.",
    demoInputExample: "I'm a 3-person SaaS in Port of Spain. Do I need to register as a data controller under the TT DPA?",
  },
  {
    id: "solar-yield-forecaster",
    name: "Solar Yield Forecaster",
    tagline: "Forecast monthly kWh for a Caribbean rooftop PV install.",
    creator: "Caribbean Solar Lab",
    description:
      "Forecast monthly kWh for a Caribbean rooftop PV install. Takes location, panel area, tilt, and orientation; returns a 12-month kWh forecast and a payback estimate at the current local feed-in tariff. Calibrated against 3 years of data from T&T, Jamaica, and Barbados.",
    category: "Science",
    accuracy: 91.4,
    latencyMs: 540,
    monthlyCalls: " ",
    downloads: " ",
    revenue: " ",
    stakeRequired: "4M QUBIC",
    pricePerCall: "Free",
    licenseType: "Open",
    icon: "sun",
    tags: ["energy", "solar", "forecast", "caribbean", "sustainability"],
    trend: 7,
    capability: "Estimate monthly kWh and payback for a rooftop PV install.",
    demoInputExample: "10 kWp array, 15° tilt, south-facing, Port of Spain, current FIT = 0.18 USD/kWh.",
  },
  {
    id: "sql-cockpit-copilot",
    name: "SQL Cockpit Copilot",
    tagline: "Translate natural-language questions into Aigarth SQL queries.",
    creator: "Aigarth DevRel",
    description:
      "Translate natural-language questions into Aigarth SQL queries. Given a question and an optional org/data-warehouse context, returns a SQL query against the anns, stakes, payout_runs, etc. schema. Includes an explanation and a list of assumptions.",
    category: "Coding",
    accuracy: 89.6,
    latencyMs: 1100,
    monthlyCalls: " ",
    downloads: " ",
    revenue: " ",
    stakeRequired: "6M QUBIC",
    pricePerCall: "0.0002",
    licenseType: "Commercial",
    icon: "code",
    tags: ["coding", "sql", "copilot", "devtools", "aigarth"],
    trend: 13,
    capability: "Convert a plain-English question into a SQL query against the Aigarth data model.",
    demoInputExample: "Show me the top 10 contributors by earnings last quarter.",
  },

  // ====================================================================
  //  Material Science Intelligence ANNs (Phase 17): 8 specialists
  //  that collaborate to discover and validate new materials.
  //  Source: services/ann/src/db/seed-anns.ts (Phase 0 stub backend)
  // ====================================================================

  {
    id: "mat-research-director",
    name: "Material Research Director",
    tagline: "Plan a material discovery workflow from a research question.",
    creator: "Aigarth Research",
    description:
      "Plan a material discovery workflow from a research question. Decomposes 'find a battery cathode with 400 Wh/kg' into a literature pass, a generative design pass, a DFT refinement pass, and a Pareto sort. Coordinates the other 7 material science ANNs in the workflow.",
    category: "Science",
    accuracy: 94.5,
    latencyMs: 2000,
    monthlyCalls: " ",
    downloads: " ",
    revenue: " ",
    stakeRequired: "3M QUBIC",
    pricePerCall: "0.00005",
    licenseType: "Open",
    icon: "compass",
    tags: ["material-science", "material-science:role:director", "research", "orchestration"],
    trend: 24,
    capability: "Decompose a material research question into a 4–8 stage plan with cost estimates.",
    demoInputExample:
      "Find a low-cost, high-cycle-life Na-ion cathode. Target energy density > 400 Wh/kg, 1-week wall time.",
  },
  {
    id: "mat-literature-ingester",
    name: "Material Literature Ingester",
    tagline: "Ingest open-access material science papers into a structured knowledge graph.",
    creator: "Materials Intel Lab",
    description:
      "Ingest open-access material science papers into a structured knowledge graph. Extracts composition, property values, measurement method, and citation. Returns paper summaries with cited property values and a list of newly-added knowledge graph nodes.",
    category: "Science",
    accuracy: 91.2,
    latencyMs: 5000,
    monthlyCalls: " ",
    downloads: " ",
    revenue: " ",
    stakeRequired: "2M QUBIC",
    pricePerCall: "0.0001",
    licenseType: "Open",
    icon: "book-open",
    tags: ["material-science", "material-science:role:literature", "nlp", "knowledge-graph"],
    trend: 22,
    capability: "Ingest one paper and return structured property values + knowledge graph nodes.",
    demoInputExample: "PDF of 'High-Energy Cathode Materials for Sodium-Ion Batteries' (2024, JES).",
  },
  {
    id: "mat-simulation-runner",
    name: "Material Simulation Runner",
    tagline: "Run DFT, MD, or ML surrogate simulations for material properties.",
    creator: "Aigarth HPC",
    description:
      "Run DFT, molecular dynamics, or ML surrogate simulations for material properties. Routes to VASP, Quantum ESPRESSO, LAMMPS, GROMACS, MACE, or Allegro based on the request. Returns predicted properties (band gap, formation energy, bulk modulus) with uncertainty. Stub backend returns deterministic placeholder values; real engine integration ships in Phase 2.",
    category: "Science",
    accuracy: 88.6,
    latencyMs: 60000,
    monthlyCalls: " ",
    downloads: " ",
    revenue: " ",
    stakeRequired: "15M QUBIC",
    pricePerCall: "0.0005",
    licenseType: "Commercial",
    icon: "flask-conical",
    tags: [
      "material-science",
      "material-science:role:simulation",
      "dft",
      "molecular-dynamics",
      "mlip",
      "compute-heavy",
    ],
    trend: 19,
    capability: "Run a DFT relaxation on a small unit cell, return formation energy ± uncertainty.",
    demoInputExample:
      "Material: LiNi0.8Mn0.1Co0.1O2, engine: VASP, calculation: full relaxation, k-point mesh: 4×4×2.",
  },
  {
    id: "mat-physics-reasoner",
    name: "Material Physics Reasoner",
    tagline: "Sanity-check a simulation result against first principles.",
    creator: "Open Physics",
    description:
      "Sanity-check a simulation result against first principles. Catches impossible structures, runaway formation energies, metastable traps. Returns a 0–1 score with reasoning. Rule-based, no GPU.",
    category: "Science",
    accuracy: 96.8,
    latencyMs: 200,
    monthlyCalls: " ",
    downloads: " ",
    revenue: " ",
    stakeRequired: "1M QUBIC",
    pricePerCall: "0.00002",
    licenseType: "Open",
    icon: "zap",
    tags: ["material-science", "material-science:role:physics", "rule-based", "first-principles"],
    trend: 20,
    capability: "Score a simulation result 0–1.0 with reasoning.",
    demoInputExample:
      "Formation energy = -2.4 eV/atom, band gap = 0.0 eV, magnetic moment = 0.5 μB, structure: layered oxide.",
  },
  {
    id: "mat-material-designer",
    name: "Material Designer",
    tagline: "Generate candidate materials for a target property profile.",
    creator: "Aigarth Design",
    description:
      "Generate candidate materials for a target property profile. Returns 10–100 candidate compositions + structures ranked by predicted fit. Stub backend returns a deterministic candidate set; real diffusion model ships in Phase 2.",
    category: "Science",
    accuracy: 87.4,
    latencyMs: 30000,
    monthlyCalls: " ",
    downloads: " ",
    revenue: " ",
    stakeRequired: "8M QUBIC",
    pricePerCall: "0.0002",
    licenseType: "Commercial",
    icon: "pencil-ruler",
    tags: ["material-science", "material-science:role:design", "generative", "inverse-design"],
    trend: 21,
    capability: "Generate 100 candidate materials for a target property profile, ranked by fit.",
    demoInputExample:
      "Target: layered oxide cathode, band gap 2.5-3.5 eV, formation energy < -2 eV/atom, no Co.",
  },
  {
    id: "mat-multi-obj-optimizer",
    name: "Material Multi-Objective Optimizer",
    tagline: "Pareto-sort candidates on (energy density, cost, cycle life, ...).",
    creator: "Open Optim",
    description:
      "Pareto-sort candidates on (energy density, cost, cycle life, environmental impact, ...). Multi-objective NSGA-II over user-specified axes. Best for: 'which 3 of these 100 candidates are the best trade-off?'",
    category: "Science",
    accuracy: 93.0,
    latencyMs: 100,
    monthlyCalls: " ",
    downloads: " ",
    revenue: " ",
    stakeRequired: "2M QUBIC",
    pricePerCall: "0.00005",
    licenseType: "Open",
    icon: "trending-up",
    tags: [
      "material-science",
      "material-science:role:optimization",
      "pareto",
      "nsga-ii",
      "multi-objective",
    ],
    trend: 18,
    capability: "Return the top-K Pareto-optimal candidates for a multi-objective profile.",
    demoInputExample: "100 candidates, axes: (energy_density_max, cost_min, cycle_life_max), top 5.",
  },
  {
    id: "mat-experiment-planner",
    name: "Material Experiment Planner",
    tagline: "Convert a candidate material into a synthesizable lab protocol.",
    creator: "Aigarth Lab",
    description:
      "Convert a candidate material into a synthesizable lab protocol. Returns synthesis method, calcination temperature and time, expected characterization (XRD, SEM, galvanostatic cycling), and an equipment list. Printable.",
    category: "Science",
    accuracy: 90.5,
    latencyMs: 2000,
    monthlyCalls: " ",
    downloads: " ",
    revenue: " ",
    stakeRequired: "4M QUBIC",
    pricePerCall: "0.00005",
    licenseType: "Commercial",
    icon: "test-tube",
    tags: ["material-science", "material-science:role:experiment", "lab-protocol", "synthesis"],
    trend: 16,
    capability: "Generate a synthesizable lab protocol + equipment list for one candidate material.",
    demoInputExample: "Material: LiNi0.8Mn0.1Co0.1O2, scale: 5g, technique: solid-state.",
  },
  {
    id: "mat-validation-engine",
    name: "Material Validation Engine",
    tagline: "Cross-check a material prediction against literature and historical data.",
    creator: "Aigarth Validate",
    description:
      "Cross-check a material prediction against literature and historical data. Returns a confidence score, the literature citations, and the historical mean ± σ. Catches predictions that are numerically correct but physically wrong.",
    category: "Science",
    accuracy: 95.2,
    latencyMs: 800,
    monthlyCalls: " ",
    downloads: " ",
    revenue: " ",
    stakeRequired: "2M QUBIC",
    pricePerCall: "0.00005",
    licenseType: "Open",
    icon: "shield-check",
    tags: [
      "material-science",
      "material-science:role:validation",
      "literature-cross-check",
      "uncertainty-calibration",
    ],
    trend: 17,
    capability: "Score a prediction 0–1.0 against literature + historical data, with citations.",
    demoInputExample:
      "Prediction: band_gap = 2.8 eV ± 0.4, material: LiNi0.5Mn0.5O2, source: mat-simulation-runner.",
  },
];
