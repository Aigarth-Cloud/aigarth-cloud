# Aigarth Tracker

A local-first project tracker for building Aigarth Cloud.

- **What it does:** Shows the live state of the build. Phases, tasks, kanban, documents, activity.
- **What's stored:** SQLite, in `data/tracker.db`. No external services.
- **How to run:** `pnpm install && pnpm db:seed && pnpm dev` → http://localhost:4000

## Stack

- Next.js 14 App Router
- TypeScript strict
- Tailwind + minimal shadcn-style components
- Framer Motion
- better-sqlite3 (no ORM, raw SQL for transparency)

## What's here

- **Overview** — KPIs, all phases, recent activity, next up
- **Phases** — All 16 phases from `ROADMAP.md`, with per-phase progress
- **Phase detail** — Kanban for a single phase
- **Kanban** — All tasks across all phases, drag-and-drop to move
- **Docs** — Every document in `workspace/now/docs/`, with filter
- **Activity** — Chronological change log

## Scripts

- `pnpm dev` — Run on port 4000
- `pnpm build` — Production build
- `pnpm start` — Run production build
- `pnpm typecheck` — TypeScript check
- `pnpm db:seed` — Initialize database with phases, tasks, and docs

## Data model

Five tables: `phases`, `tasks`, `docs`, `assets`, `activity`. See `src/lib/db.ts`.

## Adding a doc

Run the seed — it auto-detects files in `workspace/now/docs/`. Or add manually:

```ts
import { upsertDoc } from "@/lib/repo";

upsertDoc({
  path: "docs/MY-NEW-DOC.md",
  title: "My New Doc",
  description: "What it's about",
  category: "Engineering",
  status: "draft",
  readTimeMinutes: 5,
  order: 99,
});
```

## Future: swap SQLite for Supabase

The repo functions in `src/lib/repo.ts` are the abstraction layer. When ready to switch to Supabase, replace the body of each function with a Supabase query — the public API stays the same. The dashboard code doesn't change.
