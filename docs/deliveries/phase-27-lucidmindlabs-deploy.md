# Phase 27 — Aigarth Cloud Deploy to lucidmindlabs: Completion Report

**Status:** Pending (deploy has not run yet)
**Planned target:** Hostinger KVM2 (2 vCPU, 8 GB RAM, 100 GB SSD)
**Planned domain:** aigarth-cloud.lucidmindlabs.com
**Runbook:** [docs/launches/phase-27-lucidmindlabs-deploy.md](../../launches/phase-27-lucidmindlabs-deploy.md)

> **This is a placeholder.** The deploy agent in a future chat session
> will overwrite this file with the actual completion report after running
> the runbook. The dashboard command centre is already linked to this path.

## What the deploy agent will write here

1. The actual environment versions (OS, Node, pnpm, Caddy, Postgres, NATS, Redis, MinIO).
2. The actual port allocation used (with any conflicts noted).
3. The actual DNS verification (dig output).
4. The actual smoke test status codes (5 public + 5 dashboard + 12 service healthz + 2 auth).
5. The actual TLS cert verification.
6. The actual test suite results (`pnpm -r --filter "./services/*" typecheck && test`).
7. Any issues encountered.
8. The rollback status (should be "not needed").
9. The next steps for the user.

The deploy agent follows the template in §9 of the runbook exactly.
Once the deploy runs, this file is replaced and the dashboard picks it up
automatically (the dashboard reads markdown files by path; the registration
script is idempotent).

---

## Handoff

When the user triggers the deploy in another chat, the new agent should:

1. Read this file (it is a stub; do not treat its content as real).
2. Read the runbook at `docs/launches/phase-27-lucidmindlabs-deploy.md` end-to-end.
3. Run §0 Pre-flight. If anything fails, stop and write the gap here.
4. Run §2 through §7 in order.
5. Replace this file with the actual completion report.
6. Run `pnpm --filter @aigarth/dashboard tsx src/scripts/register-phase-27-deploy-completion.ts` to refresh the dashboard entry.
7. Hand back to the user with a one-paragraph summary and the dashboard URL.
