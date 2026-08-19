# Aigarth Cloud — Project Agent Notes

These notes apply to this repo only.

## Build & run

- All services run from the repo root via `pnpm dev` (turbo)
- Apps: `apps/web` (port 3003), `apps/dashboard` (port 4000)
- Services: identity (7001), qubic (7002), compute (7003), gateway (7004), billing (7005), ann (7006), marketplace (7007), tissue (7008), dataset (7009), economy (7010), training (7011)
- Infrastructure: postgres 5432, redis 6379, nats 4222, minio 9000, mailhog 1025/8025 — managed by `infrastructure/docker-compose.yml`
- The `aigarth-node-chat` example (`examples/node-chat`) is a standalone demo, not part of `pnpm dev`. Run it separately with `pnpm --filter aigarth-node-chat dev` (or `node server.mjs` directly).
- The dashboard has a live `/services` page that pings all 18 targets in parallel
- `services/training` (port 7011) is the Phase 19C training orchestrator. It auto-bridges to `services/compute` (port 7003) for capacity and `services/ann` (port 7006) for version auto-publish. Mode switch: `TRAINING_COMPUTE_MODE=stub|http`

- **Internal-token pattern (Phase 18 closeout)** — Service-to-service calls on `/v1/internal/*` (e.g. `services/ann` retrain-scan, `services/economy` wallet-by-user) require a bearer token whose value matches `INTERNAL_TOKEN` on the target service. The dev default is `internal_dev_token_change_me`. Both `services/identity` and `services/economy` set it. Rotate before any non-dev environment.

## Doc path convention (important)

When seeding docs into the tracker (`apps/dashboard/src/lib/repo.ts` `upsertDoc`):
- Use `../../docs/...` paths — relative to `apps/dashboard/scripts/`
- The docs detail page (`/docs/[slug]`) and `seed.ts` follow this convention
- The unique constraint is on `path`; mixing `../../docs/PRD.md` with `docs/PRD.md` creates duplicates
- If duplicates appear, run `apps/dashboard/scripts/dedupe-docs.cjs` — it canonicalizes paths, dedupes by title, and renumbers `ord` 0..N-1

## pnpm + workspace packages

- `.npmrc` has `node-linker=isolated` and `shamefully-hoist=false` — strict dep isolation
- Every package that `require`s a module must declare it as a dep, including build-time-only modules (e.g. `tailwindcss-animate` is required by `packages/config/tailwind/preset.cjs`, so it lives in `packages/config/package.json` deps, not just `apps/dashboard`)
- For workspace packages in Next.js, import the SDK via a relative path to the dist (`../../../../packages/sdk/dist/index.js`) instead of the `@aigarth/sdk` alias — the alias follows the workspace symlink to `src/` which has `.js` extensions Next's bundler can't resolve

## apps/web tsconfig: ES2017 target

- `apps/web/tsconfig.json` extends `tsconfig.base.json` but overrides `target: "ES2017"`.
- That means **no BigInt literals** (`0n`, `26n`) in apps/web lib code. Wrap with `BigInt(0)` / `BigInt(26)` instead.
- `packages/sdk`, `services/*`, `packages/aigarthpool` are fine — they target ES2022+.
- Real gotcha hit: `apps/web/lib/wallet/snap.ts` (Phase 21) — `setBigInt64(64, 0n, true)` failed typecheck, had to use `BigInt(0)`.
- `packages/sdk` ships ESM dist with `.js` extensions stripped via `scripts/strip-js-extensions.mjs` (runs in `pnpm build`)

## Service build gotchas (Phase 28 — VPS halving deploy)

Three pre-existing tsconfig / package.json bugs blocked every Node service from booting on first ship. All fixed; do not undo without re-reading this section.

- **`packages/config/tsconfig/node.json` MUST override `noEmit: false`.** It extends `tsconfig/base.json` which sets `noEmit: true` (correct for typecheck, wrong for runtime emit). The override is the line `"noEmit": false` in `compilerOptions` of `node.json`. Without it, every service's `pnpm build` (`tsc`) exits 0 with no output → image has no `dist/index.js` → container fails with `Cannot find module '/app/dist/index.js'`.
- **`packages/utils` MUST have a `build` script and exports that point to `dist/`, not `src/*.ts`.** Node cannot run `.ts` files. The package used to ship `main: "./src/index.ts"` and `exports: { ".": "./src/index.ts" }` — fixed to `dist/index.js` with a `"build": "tsc"` script. If you see `ERR_UNKNOWN_FILE_EXTENSION ".ts" for /app/node_modules/.../@aigarth/utils/src/strings.ts`, this is the cause.
- **Trinary (and SDK) source files MUST use `.js` extensions on relative imports.** The base tsconfig has `module: ESNext` + `moduleResolution: bundler`, so tsc preserves source imports as-written. Trinary's source had `from "./state"` everywhere, producing a dist with no `.js` extensions, which Node ESM cannot resolve (`ERR_MODULE_NOT_FOUND` on `./state`). The fix is in source: 5 files in `packages/trinary/src/` were updated to `from "./state.js"`. The `strip-js-extensions.mjs` post-build step in both `packages/trinary/` and `packages/sdk/` is now a no-op — the rationale (Next.js's bundler used to break on `.js` in workspace packages) is obsolete as of Next.js 14+. If you need to re-introduce the strip for some package, also re-add `.js` to its source so `pnpm deploy` produces an importable dist.

The compose on the VPS ships these fixes. Rebuilding from a fresh local clone without these in place will reproduce the crash-loops.

## Auth flow

- Identity service issues JWTs at `/v1/auth/login` and `/v1/auth/signup`
- Apps/web stores the JWT in an HttpOnly + SameSite=Lax + 7-day-TTL cookie named `aigarth_session`
- Edge middleware (`apps/web/middleware.ts`) guards `/dashboard/*` (redirects to `/login?next=...`) and bounces authed users from `/login` and `/signup` back to `/dashboard`
- All server-side state changes go through API route handlers, NOT server actions — the `next-flight-action-entry-loader` has stricter import rules and the workspace-package + `.js`-extensions combo breaks it
- The `aigarth_session` cookie name matches the identity service's own cookie, so SSO works if both share a domain in production

## SDK resource module pattern

- Every resource extends `BaseResource(client, baseURL)` which carries a per-service URL
- `client.request<T>(path, init, baseURL?)` is the public escape hatch for unwrapped routes
- Type field names match the server response (snake_case: `total_credit_qubic`, `secret_last4`, `full_key`) — not the OpenAI-style camelCase convention
- QUBIC amounts come as strings; divide by 1_000_000 for display

## Time-to-Ship standard

Every phase delivery report (in `docs/deliveries/phase-N-delivery.md`) must include:
- Active build time
- SP velocity (min/SP)
- Breakdown table
- Comparison to prior phases

## Mojibake + em-dash hygiene

The public site copy is UTF-8, but some files have double-corrupted sequences
from a Latin-1 / Windows-1252 round-trip. Watch for these signatures:
- `â€` (em-dash `—`, en-dash `–`, smart quotes, ellipsis, bullet, arrows)
- `âˆ'` (minus sign `−` — 7 bytes, triple corruption)
- `â‰ˆ` (almost equal `≈`)
- `âŒ˜` (command `⌘` — Windows-1252, 5 bytes)
- `â­` (star `★` — Windows-1252, 5 bytes)
- `Â·` (middle dot `·` — double corruption, 4 bytes)
- `Â°` (degree `°`), `Â±` (plus-minus `±`)

Tooling:
- `apps/web/scripts/scan-mojibake.ps1` — quick scan of `app/(marketing)/*.tsx`
  for the `C3 A2` ("â") prefix
- `apps/web/scripts/fix-mojibake.ps1` — byte-level fix script; covers all
  patterns above. Scans the whole `apps/web` tree (not just marketing).
  Includes the rare 8-byte em-dash-with-trailing-smart-quote pattern.

**Em-dash policy**: copy should be em-dash-free. ` — ` (space em-dash space)
in user-facing strings is replaced with `: ` (colon) by convention, but
manual review is required for the awkward cases:
- `: and|or|but Y` — use `, and|or|but Y` (Oxford comma)
- `X: it/this/there Y` — use `X. It/This/There Y` (period)
- `AIs: List, items: verb` — split the two colons, e.g.
  `AIs, including List, items, all verb-ing`

The 2026-08-05 sweep removed 302 em-dashes + 7 mojibake instances across
66 files. If a future pass surfaces more awkward colons, they came from an
em-dash replacement — fix them with the rules above.

## Blog posts

The public blog lives at `apps/web/app/(marketing)/blog/_posts.tsx`
(source) + `apps/web/app/(marketing)/blog/page.tsx` (index) +
`apps/web/app/(marketing)/blog/[slug]/page.tsx` (route). All three
read from the same `POSTS` array. When you add a new post, add it
to all three (or to a shared `posts.tsx` that the three import).

### Byline (default: "Aigarth Cloud Team")

- New project-level posts (vision, engineering deep-dives, halving
  markers, build-in-public, product launches) **default to
  `author: "Aigarth Cloud Team"`**. The blog reads as a team
  publication, not a personal one.
- Named bylines (`"Marcus Tao"`, `"Sana Okonkwo"`, etc.) are still
  used when the post is genuinely authored by a specific named
  contributor. Reserve for guest posts, partner posts, and
  research write-ups where the individual's name carries the
  signal.
- Do not reintroduce `"Wesley Gervais, founder"` or any variant of
  `"X, founder"` on new or existing posts. The team owns the blog.
- The blog index (`page.tsx`) and the post body (`_posts.tsx`) must
  match. Update both when you change a byline.

### Voice (default: "we", not "I")

- Even Build-in-Public and "how we work" posts run in **plural
  first-person**. The reader sees the byline as the team; the
  body should match.
- "I" is reserved for genuinely personal reflections outside the
  blog (a CV, a personal note, a 1:1 post). On the blog, use
  "we" for the team, "the founder" / "our founder" for the
  single-person role, and "the team" when you want to emphasise
  the collective action over the individuals.
- Common softenings when an "I" sneaks in:
  - `"I want to be honest about how Aigarth is built."`
    → `"We want to be honest about how Aigarth is built."`
  - `"What I actually do"` → `"What we actually do"`
  - `"By myself, that would be 2 to 3 days of coding."`
    → `"By a single developer, that would be 2 to 3 days of coding."`
  - `"I spend maybe 10% of my time typing and 90% reviewing."`
    → `"The founder spends maybe 10% of their time typing and 90% reviewing."`
- Pronouns to check after every post: `I`, `my`, `me`, `myself`,
  `mine`. A grep over the post body for `\b(I|my|me|myself|mine)\b`
  should return zero matches except in quoted reader-address text
  (`"you would actually say"` etc., which is fine).
- Body voice also follows the rest of the brand-voice rules
  (`docs/BRAND-VOICE.md`): em-dashes become colons, no abstract
  nouns, no "Web3" framing, plain English, small uppercase labels
  under plain-English headlines.

### Categories

The `category` enum is locked to:
`"Engineering" | "Product" | "Research" | "Vision" | "Build in public"`.
Use cases and ecosystem posts live on their own pages
(`/use-cases/...`), not on the blog.
