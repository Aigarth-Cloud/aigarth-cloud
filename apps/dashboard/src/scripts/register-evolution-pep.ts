/**
 * Register the Aigarth Cloud Evolution PEP with the dashboard command centre.
 *
 * Run: pnpm --filter @aigarth/dashboard tsx src/scripts/register-evolution-pep.ts
 *
 * Idempotent — uses upsertDoc.
 *
 * Path is relative to the dashboard package root (apps/dashboard), so
 * "src/scripts/..." is the script location, "../../../docs/proposals/..."
 * is the canonical doc path.
 */

import { getDb, nowIso, logActivity } from "../lib/db";
import { upsertDoc } from "../lib/repo";

const db = getDb();
const now = nowIso();

console.log("Registering Aigarth Cloud Evolution PEP with the dashboard command centre...");

// 1. The PEP itself — register as a doc.
const pep = upsertDoc({
  path: "../../../docs/proposals/aigarth-cloud-evolution-pep.md",
  title: "Aigarth Cloud Evolution PEP — From Neural Networks to Evolving Useful Intelligence",
  description:
    "A 27-section engineering-grade Product Evolution Proposal. Audits the current Aigarth Cloud (Trinary Intelligence Layer, Training Orchestration, AigarthPool, Phase 17 Material Science), pressure-tests the conversation thread's proposals against the live codebase and verified Neuraxon/Qubic state, and proposes: (1) an Organism primitive (genome, environment, fitness, lineage) on top of the existing Trinary envelope; (2) a four-tier Work Runtime (local → federated → Qubic OC → arbitrary useful work); (3) the correct understanding of Qubic OC (outbound, not a compute marketplace); (4) a phased roadmap (Phase 26 Organism → 27 Work Runtime → 28 Federated → 29 OC Processor → 30 Multi-workload → 31 Neuraxon integration); (5) a kill list; (6) ten immediate engineering tasks. Critical corrections: Neuraxon 2.0 is NOT yet integrated; OC is outbound (Aigarth is the processor, not the renter); BPP-9000 is the current uPoW, not a heterogeneous-mining precedent; the Tissue primitive already exists; the Materials Science 8-ANN coordinator was designed in Phase 17.",
  category: "Proposals",
  status: "draft",
  readTimeMinutes: 38,
  order: 100, // end of proposals list
});

console.log(`  Proposals   ${pep.path}  (${pep.readTimeMinutes} min)`);

// 2. A short executive-summary doc that links to the full PEP — for the dashboard home.
const summary = upsertDoc({
  path: "../../../docs/proposals/aigarth-cloud-evolution-pep-summary.md",
  title: "Aigarth Cloud Evolution PEP — Executive Summary",
  description:
    "Short summary of the 27-section PEP. What we keep, what we add, what we kill. Five critical corrections to the conversation thread. The Aigarth Thesis. The first 10 engineering tasks. (~8 min read) — See the full PEP for the audit, the architecture, and the phased roadmap.",
  category: "Proposals",
  status: "draft",
  readTimeMinutes: 8,
  order: 101,
});

console.log(`  Proposals   ${summary.path}  (${summary.readTimeMinutes} min)`);

// 3. A companion "What this PEP changes in the roadmap" note for the dashboard tracker.
const note = upsertDoc({
  path: "../../../docs/proposals/aigarth-cloud-evolution-pep-roadmap-impact.md",
  title: "Aigarth Cloud Evolution PEP — Roadmap Impact",
  description:
    "Mapping the PEP to existing phases and the proposed Phase 26-31. What it adds (Organism, Work Runtime, OC Processor, Neuraxon integration). What it preserves (Tissue, Training, AigarthPool, all shipped Phases 0-24). What it defers (Universal Useful Work Protocol as consensus change, TEE attestation, ZK proofs, multi-organism symbiosis). The decision needed: approve Phase 26 + 27 as the next two phases.",
  category: "Proposals",
  status: "draft",
  readTimeMinutes: 5,
  order: 102,
});

console.log(`  Proposals   ${note.path}  (${note.readTimeMinutes} min)`);

// 4. The executive summary content (inline so the dashboard's /docs page renders it
//    even before the user clicks through to the full PEP).
//    We use a single doc entry that points to the canonical path; the dashboard
//    fetches the markdown body via the path. No additional wiring needed.

logActivity(
  "note",
  `Aigarth Cloud Evolution PEP registered with command centre (3 docs). Status: draft. Pending architecture review.`,
  { docPaths: [pep.path, summary.path, note.path] }
);

console.log("");
console.log("Done. Open the dashboard at /docs to see the new entries.");
console.log("  - " + pep.title);
console.log("  - " + summary.title);
console.log("  - " + note.title);

// 5. v0.2 — supersedes v0.1. Approved 2026-08-12 (Wave 1 execution in progress).
//    v0.1 entries above are preserved as the historical record per
//    `docs/evolution/CHECKPOINT-2026-08-12.md` §8 (no edits to v0.1).
//    v0.2 reorganises v0.1 into the 30-section superprompt structure and
//    adds the Falsification Audit, Proof Lab, Proof Test Suite, Capability
//    Card, Data Provenance, Baselines, Ultimate Proof, Worker Model, and
//    a Final Thesis that maps the boxed equation to Aigarth primitives.
const pepV02 = upsertDoc({
  path: "../../../docs/proposals/aigarth-cloud-evolution-pep-v0.2.md",
  title: "Aigarth Cloud Evolution PEP v0.2 — From Neural Networks to Evolving Useful Intelligence",
  description:
    "The 30-section superprompt-aligned Aigarth Cloud Evolution PEP v0.2, approved 2026-08-12 and superseding v0.1. Opens with a Falsification Audit (§1) that pressure-tests the v0.1 claims against the live codebase, then introduces the Proof Lab (§18) and Proof Test Suite (§19, N/V/O/Q/G/M/VIDEO series) as the public apparatus for proving the thesis experimentally. Closes with a Final Thesis (§32) that maps the boxed equation to Aigarth primitives and ten immediately-scoped First Tasks (§33) whose file paths are verified against the current code on 2026-08-11.",
  category: "Proposals",
  status: "draft",
  readTimeMinutes: 45,
  order: 100, // co-located with v0.1 at the end of the proposals list
});

console.log(`  Proposals   ${pepV02.path}  (${pepV02.readTimeMinutes} min)`);

logActivity(
  "note",
  `Aigarth Cloud Evolution PEP v0.2 registered with command centre (supersedes v0.1; 30-section superprompt-aligned). Status: draft. Approved 2026-08-12; Wave 1 execution in progress.`,
  { docPaths: [pepV02.path] }
);

console.log("");
console.log("v0.2 (live) — open the dashboard at /docs to see the new entry.");
console.log("  - " + pepV02.title);
