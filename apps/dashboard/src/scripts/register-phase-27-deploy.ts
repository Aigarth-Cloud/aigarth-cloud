/**
 * Register the Phase 27 Aigarth Cloud deploy runbook with the dashboard
 * command centre.
 *
 * Run: pnpm --filter @aigarth/dashboard tsx src/scripts/register-phase-27-deploy.ts
 *
 * Idempotent (upsertDoc). The runbook itself lives at
 * docs/launches/phase-27-lucidmindlabs-deploy.md and is the deployment
 * contract the orchestrator hands off to the deploy agent in a future
 * chat session.
 *
 * This script is run ONCE, in this session, to make the runbook
 * discoverable from the dashboard. The future completion report is
 * registered by a different script (register-phase-27-deploy-completion.ts)
 * after the deploy has run.
 */

import { getDb, nowIso, logActivity } from "../lib/db";
import { upsertDoc } from "../lib/repo";

const db = getDb();
const now = nowIso();

console.log(
  "Registering Phase 27 deploy runbook (lucidmindlabs) with the dashboard..."
);

const doc = upsertDoc({
  path: "../../../docs/launches/phase-27-lucidmindlabs-deploy.md",
  title: "Phase 27 — Aigarth Cloud Deploy to lucidmindlabs Hostinger KVM2",
  description:
    "Deployment runbook for the entire Aigarth Cloud stack (12 services + 2 Next.js apps + 4 backing services) on a Hostinger KVM2 VPS at aigarth-cloud.lucidmindlabs.com. The runbook covers pre-flight, provisioning, source + build, database migrations, PM2 process management, Caddy reverse proxy + Let's Encrypt, DNS, smoke tests, rollback, and a completion report template. Estimated wall clock: 90-120 minutes.",
  category: "Launches",
  status: "final",
  readTimeMinutes: 12,
  order: 110, // after the Phase 18 launch
});

console.log(`OK  path: ${doc.path}`);
console.log(`OK  title: ${doc.title}`);
console.log(`OK  id: ${doc.id}`);

logActivity(
  "doc_added",
  `Phase 27 deploy runbook registered: ${doc.title}`,
  { refType: "launch", refId: doc.id }
);

console.log("Done. The runbook now shows up in the dashboard under /deliveries.");
