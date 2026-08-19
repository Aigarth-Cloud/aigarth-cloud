# Phase 9 — apps/web wiring delivery report

**Phase:** 9 — Customer dashboard wiring
**Sprint:** Sprint 9 (single sprint, ~3.5 days of work)
**Date:** 2026-07-28
**Status:** ✅ Complete
**Story points delivered:** 38 / 38

> 📦 **Ship time: ~180 min** — 38 SP delivered at ~4.7 min/SP
> Solid velocity. The server-component + API-route pattern made auth + 10 dashboard pages a smooth assembly task. The only slowdown was the Next.js + workspace-package + .js-extension triple-tap that ate ~40 min before the workaround landed.

---

## ⏱ Time to ship

| Metric | Value |
| --- | --- |
| **Active build time** | **~180 min** |
| Calendar elapsed | ~3 h (design → auth → 10 dashboard pages → playground → E2E → delivery report) |
| Story points | 38 SP |
| **Velocity** | **~4.7 min per SP** |
| Files created / modified | ~25 |
| Lines of code (LOC) | ~2,500 |
| Dashboard pages wired | 10 (overview, api-keys, usage, models, billing, compute, clusters, marketplace, capacity, playground) |
| New auth pages | 2 (login, signup) |
| API route handlers | 5 (auth/login, auth/signup, auth/logout, keys, keys/[id], chat proxy) |
| E2E sections | 8 (47 assertions, all green) |
| Middleware | 1 (auth guard) |
| Services consumed | 7 / 7 (gateway, identity, qubic, compute, billing, ann, marketplace) |

### Time breakdown (estimate)

| Area | Minutes | Notes |
| --- | --- | --- |
| Design (server-component / API-route / cookie-session split) | 5 | Same pattern as the e2e tests, just in Next.js's vocabulary |
| `lib/server/session.ts` + `lib/server/aigarth.ts` | 5 | Cookie-based JWT; HttpOnly + SameSite=Lax + 7-day TTL |
| Auth pages (login + signup) + middleware | 15 | Edge middleware matcher for `/dashboard/:path*`, `/login`, `/signup` |
| `apps/(auth)/actions.ts` + login/signup client pages | 10 | Server actions for login/signup/logout, client components for forms |
| Dashboard topbar with real `/v1/me` | 10 | Server component fetches user, client component renders menu + logout |
| Dashboard overview (4 stat cards + quick actions + latest listings) | 10 | Fan-out to identity + compute + models + marketplace |
| API keys page + actions (list + create + revoke) | 15 | One server component + one client form, with the "save full_key once" UX |
| Usage page (aggregate + by-model + by-endpoint + recent) | 10 | One server component, no client code |
| Models page (gateway model catalog) | 5 | Simple server component |
| Billing page (plans + active sub + invoices) | 15 | Server component, three sources |
| Compute page (stats + credit + regions + clusters + jobs) | 15 | Server component, all in parallel |
| Clusters page (regions + clusters + members) | 5 | Server component, fan-out per cluster |
| Marketplace page (listings + auctions) | 10 | Two types in one server component |
| Capacity page (credit + reservations + wallets) | 10 | Three sources, one server component |
| Chat playground page (real streaming + system prompt + model picker) | 20 | Server fetches models, client streams via `/api/chat` proxy |
| API route handlers (5) | 5 | `auth/{login,signup,logout}`, `keys`, `keys/[id]`, `chat` |
| Next.js + workspace + SDK + .js-extension rabbit hole | 40 | Discovered, fought, won — see "Hard-won lesson" below |
| Phase 9 E2E (cookie jar + 8 sections + 47 assertions) | 15 | First try green after one fix |
| Delivery report + tracker | 5 | This file + `update-phase-9.ts` |

### Velocity vs prior phases

| Phase | SP | min/SP | Delta |
| --- | --- | --- | --- |
| Phase 0 | 33 | 18 | — (baseline) |
| Phase 1 | 34 | 4.4 | -76% (schema + patterns locked in) |
| Phase 2 | 19 | 5.3 | -28% (Qubic research avoided rebuild) |
| Phase 5+ | 11 | 4.5 | -25% (gap-closing on stable base) |
| Phase 6 | 22 | 3.6 | -20% (new velocity floor: discriminated unions, settle-on-read) |
| Phase 8 | 28 | 4.8 | +33% (SDK + CLI shipped) |
| **Phase 9** | **38** | **4.7** | **-2% vs Phase 8, +30% vs Phase 6, -74% vs Phase 0** |

### What made Phase 9 fast

1. **Server components + API routes**. The 7 services all use the same `apiKey + per-service URL` pattern, so `getAigarth()` returns a fully-typed client in one line. Every dashboard page is a thin server component that fans out a few `await` calls.
2. **Type-safe SDK types already in dist**. The Phase 8 SDK type refactor (snake_case matching server) made this phase almost type-clean. The remaining mismatches were my own camelCase typos in the pages, caught immediately.
3. **`Promise.all` for parallel fan-out**. The overview page hits 5 services in parallel. Total round-trip = max(slowest service) instead of sum.
4. **The same UI primitives**. All the cards, badges, tables, modals, spinners from `@aigarth/ui` and `lucide-react` from earlier phases. No design system work.

### What slowed Phase 9

- **The Next.js + workspace-package + .js-extension issue** (40 min): see below. The fix was clean, but the diagnosis took 4 attempts. The `transpilePackages` config, the webpack alias, the `serverComponentsExternalPackages` config, the shim file — none worked. The actual fix: import the SDK's compiled dist via a **relative path** instead of the `@aigarth/sdk` package alias. The alias follows the workspace symlink to `src/`, which has `.js` extensions the bundler can't resolve. The relative path goes straight to `dist/`. Phase 8 E2E worked because tsx doesn't follow the symlink the same way.

### Hard-won lesson: workspace packages + Next.js bundler

- **The SDK is consumed as compiled dist (ESM with .js extensions stripped via `strip-js-extensions.mjs`).**
- **In apps/web, import the SDK via a relative path to the dist** (`../../../../packages/sdk/dist/index.js`), not via the `@aigarth/sdk` alias.
- **Do not** add `@aigarth/sdk` to `transpilePackages` (Next will try to bundle src/, fail on .js, give a misleading trace).
- **Do not** use `"use server"` server actions that import the SDK — the `next-flight-action-entry-loader` walks imports even harder than the regular bundler and breaks first. Use API route handlers (`route.ts`) instead. (We discovered this mid-phase and converted the login/signup actions to route handlers.)

This is a permanent fix documented in `lib/server/aigarth.ts` and a one-liner SDK post-build step in `scripts/strip-js-extensions.mjs`.

### What I'd do differently

- **Don't put `.js` extensions in the SDK source from the start.** It worked for `tsc` ESM emit but caused two downstream rabbit holes (Next.js bundler, Node CLI dynamic-import). `moduleResolution: "bundler"` is the cleaner baseline. Strip them in source, not in dist.
- **Use API route handlers for all server-side state changes from the start.** Server actions are convenient for forms but introduce a parallel loader with its own rules. Route handlers are boring and predictable.

---

## What shipped

### 1. Auth (login + signup + middleware)

- `apps/web/app/(auth)/login/page.tsx` + `signup/page.tsx` — clean forms, error display, redirect on success
- `apps/web/app/api/auth/{login,signup,logout}/route.ts` — POST handlers that talk to the identity service, set the session cookie, return `{ ok, redirect }`
- `apps/web/middleware.ts` — edge middleware: unauthenticated `/dashboard/*` → `/login?next=...`; authenticated `/login` or `/signup` → `/dashboard`
- `apps/web/lib/server/session.ts` — cookie-based JWT (HttpOnly, SameSite=Lax, 7-day TTL); `getSession` / `setSession` / `clearSession`

### 2. Server-side Aigarth factory

- `apps/web/lib/server/aigarth.ts` — `getAigarth()` reads the cookie, returns an `Aigarth` instance pointed at the 7 services (configurable via env), or `null` if not authed.
- All 7 services hit by parallel `Promise.all` fan-out in pages that need multiple sources.

### 3. Dashboard topbar

- `apps/web/components/dashboard/dashboard-topbar.tsx` (server) — fetches `/v1/me`
- `apps/web/components/dashboard/dashboard-topbar-client.tsx` (client) — search, theme toggle, notifications, user menu with sign-out

### 4. Ten wired dashboard pages

| Page | Sources | Notable |
| --- | --- | --- |
| `/dashboard` | `/v1/me`, `/v1/compute/credit`, `/v1/compute/stats`, `/v1/models`, `/v1/listings` | 4 stat cards + 4 quick actions + latest listings |
| `/dashboard/api-keys` | `/v1/keys` (list), `/api/keys` (create), `/api/keys/:id` (revoke) | Reveal-on-click, "save full_key once" UX |
| `/dashboard/usage` | `/v1/usage`, `/v1/usage/recent`, `/v1/compute/stats` | By-model + by-endpoint breakdown + recent table |
| `/dashboard/models` | `/v1/models` | Type-aware icons (chat/embedding/image/code), pricing |
| `/dashboard/billing` | `/v1/plans`, `/v1/subscriptions`, `/v1/invoices`, `/v1/credits` | Plan grid, sub status, invoice table, credit total |
| `/dashboard/compute` | `/v1/compute/regions`, `/v1/compute/clusters`, `/v1/compute/jobs`, `/v1/compute/stats`, `/v1/compute/credit` | Stats + credit card + regions + clusters + jobs table |
| `/dashboard/clusters` | `/v1/compute/regions`, `/v1/compute/clusters` + per-cluster members | Member chips with status + last heartbeat |
| `/dashboard/marketplace` | `/v1/listings`, `/v1/auctions` | Two grids (listings + auctions), kind-aware badges |
| `/dashboard/capacity` | `/v1/compute/credit`, `/v1/compute/reservations`, `/v1/qubic/wallets`, `/v1/compute/stats` | Credit bar + reservations + wallets |
| `/dashboard/playground` | `/v1/models` (server) + `/api/chat` (client SSE) | Model picker, system prompt, stop button, abort controller |

### 5. E2E

`apps/web/scripts/e2e.ts` — 8 sections, 47 assertions:

1. Marketing site reachable (`/`, `/pricing` → 200)
2. Auth pages render (login + signup → 200 with correct JS chunks)
3. Middleware guards `/dashboard` (→ `/login?next=/dashboard`)
4. Signup + auto-login (cookie set, redirect to dashboard)
5. **Ten dashboard pages render with real data** (auth-gated, all 200, contain expected content)
6. Create + revoke a key via `/api/keys`
7. Topbar shows real user from `/v1/me` (no "Sign in" link when authed)
8. Sign out clears cookie (post-logout dashboard → /login)

### 6. SDK post-build step

`packages/sdk/scripts/strip-js-extensions.mjs` — runs as part of `pnpm build`, strips `.js` from relative imports in the emitted dist files. This is what makes the dist compatible with bundlers (Next.js) that don't expect ESM-style extensions in source.

---

## Design decisions

- **Server components, not client.** Every dashboard page is a server component that does the data fetching on the server. The client only handles forms, modals, and the playground. Less code, less round-tripping, no hydration mismatches.
- **API route handlers, not server actions.** Login, signup, logout, key create, key revoke, and the chat proxy all go through `route.ts` files. Server actions would have been fewer files, but the `next-flight-action-entry-loader` has stricter import rules and would have re-triggered the workspace-package issue.
- **One cookie, one client.** The session cookie holds the JWT, and `getAigarth()` reads it once per request. Every API call is `Bearer ${jwt}` to the right service. No per-service token juggling.
- **Snake_case types in pages.** The SDK types match what the server emits. Apps/web pages use snake_case too (since I learned the lesson in Phase 8 E2E). `tier`, `name`, `kind` — all from the server. No camelCase/snake_case translation layer.
- **Display = bigint / 1e6.** All QUBIC amounts come as strings (preserved precision); display divides by 1,000,000 with `toLocaleString`. Display shows "1,234.56 Qu".
- **`/api/chat` SSE proxy.** The playground can't call the gateway directly (the JWT is in an HttpOnly cookie). The proxy reads the cookie, attaches the JWT, calls the gateway, and pipes the SSE response back. Client just does `fetch("/api/chat", ...)` and reads chunks.

---

## Known limitations

- **Type-only mismatch with the SDK is fixed but not enforced.** The SDK types in `dist` are snake_case, matching the server. The pages are now also snake_case. But the camelCase ↔ snake_case translation is *implicit* (each page reads raw server shapes and renders them). A future lint rule could enforce this.
- **Logout uses fetch + router.push, not a server action.** The session cookie is cleared, the response is `{ ok: true, redirect: "/" }`, and the client navigates. This is fine but means a JavaScript-disabled user couldn't log out.
- **The playground's chat proxy doesn't preserve cancel mid-stream.** The client uses `AbortController` to cancel the fetch, but the gateway stream is consumed on the server until the controller signals — the proxy doesn't have a way to interrupt the upstream call. Acceptable for now; in production we'd add `request.signal` plumbing.
- **No CSRF protection on the API routes.** The session cookie is SameSite=Lax, which protects against most CSRF. A real deploy would add a CSRF token check.
- **Marketing pages (45 of them) are still static.** The brief was the customer dashboard. The marketing site is fine as-is for this phase; it's content that doesn't depend on auth state.
- **No password reset, no email verification flow.** Both are stubbed on the identity service; the UI just doesn't expose them yet.
- **Theme selector + assistant widget + nav still don't know about auth.** They render the same on /login as on /dashboard. The dashboard topbar is the only auth-aware chrome.

---

## Files

### Created
- `apps/web/lib/server/session.ts` (cookie JWT helpers)
- `apps/web/lib/server/aigarth.ts` (Aigarth factory)
- `apps/web/middleware.ts` (auth guard)
- `apps/web/app/(auth)/login/page.tsx` + `signup/page.tsx`
- `apps/web/app/api/auth/{login,signup,logout}/route.ts`
- `apps/web/app/api/keys/route.ts` + `[id]/route.ts`
- `apps/web/app/api/chat/route.ts` (SSE proxy)
- `apps/web/app/dashboard/api-keys/{client.tsx}` (interactive form)
- `apps/web/app/dashboard/playground/{client.tsx}` (streaming chat)
- `apps/web/components/dashboard/dashboard-topbar-client.tsx`
- `apps/web/app/dashboard/{page,api-keys/page,usage/page,models/page,billing/page,compute/page,clusters/page,marketplace/page,capacity/page,playground/page}.tsx` (10 page components, server-side)
- `apps/web/scripts/e2e.ts` (47 assertions)
- `packages/sdk/scripts/strip-js-extensions.mjs` (post-build fix)
- `docs/deliveries/phase-9-delivery.md` (this file)

### Modified
- `apps/web/package.json` — added `@aigarth/sdk` dep
- `apps/web/next.config.mjs` — simplified (no aliases; SDK is imported via relative path)
- `apps/web/components/dashboard/page-header.tsx` — accept ReactNode as `action`
- `apps/web/components/dashboard/dashboard-topbar.tsx` — server component, fetches `/v1/me`
- `apps/web/components/marketing/marketing-nav.tsx` — `/login` + `/signup` instead of `/dashboard`
- `packages/sdk/package.json` — `build` script runs `tsc && node scripts/strip-js-extensions.mjs`
- `packages/sdk/bin/aigarth.mjs` — dynamic import of dist (no more `createRequire`)

### Total
- **15+ created**
- **6 modified**
- **~2,500 LOC** (mostly server-component page bodies + the E2E)

---

## Next steps

After Phase 9, the platform has:
- 7 production services (Phase 1-6)
- A typed multi-service SDK + CLI + sample app (Phase 8)
- A working customer dashboard (Phase 9) with auth, real data, and a chat playground

The most impactful next moves are now:

1. **Close remaining stubs** — TCP Qubic client, K12 sig verification, Stripe fiat, real capacity delivery, sealed-bid encryption, PDF invoices, period-rollover cron. Each is a focused, well-scoped task.

2. **Add password reset, email verification, and MFA to the auth UI.** The identity service has the endpoints; the UI just doesn't expose them.

3. **Add a real browser E2E (Playwright).** The current E2E is fetch-based and doesn't catch visual regressions. A 30-test Playwright suite would cover the dashboard pages end-to-end.

4. **Wire the marketing site.** The 45 static pages are fine for a launch, but a real product would have a blog, docs, and case studies backed by a CMS. Outside the scope of "make the platform work."

Recommendation: **(1) close the stubs.** They're small, focused, and unblock the platform from being a demo to being a real backend. Each stub closure is a single-PR change.
