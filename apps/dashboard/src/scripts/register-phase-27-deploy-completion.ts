/**
 * Register the Phase 27 Aigarth Cloud deploy completion report.
 *
 * Run AFTER the deploy has run: pnpm --filter @aigarth/dashboard tsx \
 *   src/scripts/register-phase-27-deploy-completion.ts
 *
 * Idempotent (upsertDoc). The completion report itself lives at
 * docs/deliveries/phase-27-lucidmindlabs-deploy.md and is the deploy
 * agent's closeout. The agent fills in the report from the deploy runbook
 * (docs/launches/phase-27-lucidmindlabs-deploy.md, §9) before running
 * this script.
 *
 * This is the deployment agent's handoff back to the user. The
 * completion report shows up in the dashboard command centre under
 * /deliveries/phase-27-lucidmindlabs-deploy.
 */

import { getDb, nowIso, logActivity } from "../lib/db";
import { upsertDoc } from "../lib/repo";

const db = getDb();
const now = nowIso();

console.log(
  "Registering Phase 27 deploy completion report with the dashboard..."
);

const doc = upsertDoc({
  path: "../../../docs/deliveries/phase-27-lucidmindlabs-deploy.md",
  title: "Phase 27 — Aigarth Cloud Deploy to lucidmindlabs: Completion Report",
  description:
    "Closeout of the Aigarth Cloud stack deploy to aigarth-cloud.lucidmindlabs.com. Written by the deploy agent after running the runbook at docs/launches/phase-27-lucidmindlabs-deploy.md. Documents environment versions, port conflicts, DNS, smoke tests (5 public + 5 dashboard + 12 service healthz), test suite results, issues encountered, rollback status, and next steps.",
  category: "Deliveries",
  status: "final",
  readTimeMinutes: 8,
  order: 200, // appears in the deliveries list
});

console.log(`OK  path: ${doc.path}`);
console.log(`OK  title: ${doc.title}`);
console.log(`OK  id: ${doc.id}`);

logActivity(
  "doc_added",
  `Phase 27 deploy completion report registered: ${doc.title}`,
  { refType: "delivery", refId: doc.id }
);

console.log("Done. The completion report is now linked in the dashboard.");
