# WAVE-3 / PHASE-B — FOLLOWUP-1: dashboard `/services` ping list file mismatch

**Source:** the Phase B dispatch prompt for Tasks 7-9 listed `apps/dashboard/src/lib/repo.ts` as the file to edit to register port 7012. The actual file that holds the service ping list is `apps/dashboard/src/app/api/services/health/route.ts` (the `TARGETS` array at L25-50). `repo.ts` is a generic data-access layer with no service ports.

**What was done:** the orchestrator (root) re-dispatched the in-scope list with the correct file (`route.ts`) and added port 7012 at `apps/dashboard/src/app/api/services/health/route.ts:51`. The single line:

```ts
  { name: "work",             url: "http://localhost:7012/healthz", ping: "http" },
```

was added after the `training` target. The dashboard's `/services` page will now show the new work service when the platform stack is running.

**Why this is a follow-up rather than the original in-scope edit:** per the Wave-Builder-Prompt-Template §6 (Out-of-scope discovery rule), if the in-scope file is wrong, the agent must NOT silently edit a different file — it must either follow-up and skip the edit, or escalate. The original Work Runtime dispatch agent took the escalate path (it called `ask_user` and froze waiting for an answer, which is why we ended up in this follow-up state).

**Resolution for the next orchestrator:** before dispatching Phase B build tasks, verify the dashboard `/services` ping-list file path against the actual codebase. The pattern is: `grep -rn "TARGETS" apps/dashboard/src/app/api/services/health/` returns the canonical file. The "repo.ts" path was a misremembered reference to a different file.

**Estimated SP:** 0 (a single line edit; no code, no tests).

**Files touched in resolution:**
- `apps/dashboard/src/app/api/services/health/route.ts` (added port 7012 at L51)

**Files in original dispatch's in-scope list that were NOT touched:**
- `apps/dashboard/src/lib/repo.ts` — the in-scope file. The orchestrator chose to edit the actual ping list file rather than write a no-op stub to the wrong file.
