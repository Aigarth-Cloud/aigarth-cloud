# Contributing

**Product:** Aigarth Cloud
**Status:** Active
**Last updated:** 2026-07-27

This document covers how humans and AI agents contribute code, docs, and decisions to the Aigarth Cloud project.

---

## 1. For everyone

- **Read first:** [`PRD.md`](./PRD.md), [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`SPRINT-PLAN.md`](./SPRINT-PLAN.md)
- **Stay current:** Subscribe to `#eng-changes` for the engineering change log
- **Update docs:** If you change behavior, update the relevant doc in `now/docs/`
- **Open an issue:** For any meaningful change, open a Linear/GitHub issue first
- **Time-to-ship:** Every phase delivery report (`docs/deliveries/phase-N-delivery.md`) must include the `⏱ Time to ship` section. Use [`_TEMPLATE.md`](./deliveries/_TEMPLATE.md) and report active build time (not calendar), the SP velocity, and a breakdown. This is how we track whether we're getting faster.

## 2. For humans

### 2.1 Workflow

1. Pick a story from the current sprint in the tracker dashboard
2. Move it to "In Progress" in the Kanban
3. Branch from `main`: `git checkout -b feat/<story-id>-<short-name>`
4. Commit in small, focused chunks
5. Open a PR; reference the story ID in the title
6. CI runs lint, type-check, tests, build
7. Request review from the relevant lead
8. After approval, the lead merges

### 2.2 Commit conventions

Conventional Commits:

- `feat:` new feature
- `fix:` bug fix
- `refactor:` internal change, no behavior change
- `docs:` doc-only change
- `test:` test-only change
- `chore:` tooling, deps, build

Example: `feat(identity): add API key scoping`

### 2.3 PR checklist

- [ ] Tests added/updated
- [ ] Docs updated (if behavior changed)
- [ ] Type check passes
- [ ] Lint passes
- [ ] No secrets in code
- [ ] Preview deploy reviewed

## 3. For AI agents

### 3.1 Scope

Each agent has explicit scope. Don't go outside it. The agents currently in scope:

- Front-end agent: dashboard + marketing site components
- API agent: per-service endpoints
- Infra agent: Docker, CI/CD, K8s
- QA agent: tests
- Docs agent: API reference and guides
- Data agent: migrations and seeds

### 3.2 Inputs

Every agent takes:
- A documented contract (OpenAPI spec, component spec, etc.)
- Acceptance criteria as bullet points
- The relevant docs in `now/docs/`
- A repository or service to work in

### 3.3 Outputs

Every agent produces:
- A PR linked to a Linear/GitHub issue
- Updated tests
- A short written summary of what changed and why

### 3.4 Review gate

All agent output is reviewed by a human lead before merge. No exceptions. The review is fast (the lead skims, runs the tests, and merges) but mandatory.

### 3.5 Permissions

Each agent has a scoped set of permissions:
- Read: everything in the project
- Write: only within its scope (e.g. front-end agent cannot touch backend services)
- Delete: never (a human must approve)
- External: only the explicitly listed integrations (per the agent's spec)

### 3.6 Audit

All agent actions are logged. The log includes:
- Agent ID
- Action (read/write/run/...)
- File or resource affected
- Timestamp
- Result

Logs are retained for 1 year minimum.

## 4. Code style

- **TypeScript:** strict, no `any`, no implicit returns
- **Naming:** `camelCase` for variables/functions, `PascalCase` for components/types, `SCREAMING_SNAKE_CASE` for constants
- **Files:** `kebab-case.ts` for utilities, `PascalCase.tsx` for components
- **Comments:** Explain *why*, not *what*. The code shows what.
- **Formatting:** Prettier runs in CI. Don't argue with Prettier.
- **Linting:** ESLint with the project's config. Don't disable rules without a comment explaining why.

## 5. Testing

- **Unit:** Vitest, colocated with source (`foo.ts` → `foo.test.ts`)
- **Integration:** Vitest, in `tests/integration/`
- **E2E:** Playwright, in `tests/e2e/`
- **Coverage target:** 80% on new code, 70% overall
- **Critical paths:** 100% — auth, billing settlement, smart contract calls

## 6. Security

- No secrets in code. CI blocks.
- All inputs validated with Zod at the API boundary.
- All outputs sanitized.
- All dependencies pinned.
- Run `npm audit` weekly.

## 7. Performance

- API P95 < 200ms for read paths, < 2s for write paths (excluding async jobs)
- Page LCP < 2.5s on 4G
- Bundle size budgets enforced in CI

## 8. Code of conduct

Be kind. Disagree on ideas, not on people. Assume good intent. Ask before judging.

## 9. Linked documents

- [`SPRINT-PLAN.md`](./SPRINT-PLAN.md)
- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`TEAM-AND-ROLES.md`](./TEAM-AND-ROLES.md)
- [`SECURITY.md`](./SECURITY.md)
