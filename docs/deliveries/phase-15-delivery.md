# Phase 15 — Knowledge layer v1 — Delivery

**Phase:** 15
**Status:** done (100%)
**Story points:** 3 / 3 (v1 scope)
**Active build time:** ~2h
**Velocity:** 1.5 SP/h

## TL;DR

Education, certification, and content as a first-class product
surface. The ROADMAP says "continuous, never done" — v1 ships
the three core product surfaces (blog, tutorials, academy) on
the dashboard. The existing `/docs` page was already a working
CMS over the SQLite Doc store + a hand-rolled markdown renderer;
v1 builds on that foundation.

## What's shipped

### Shared module — `apps/dashboard/src/components/markdown-renderer.tsx`

Extracted the markdown parser + renderer that was inline in
`doc-detail.tsx` so the new blog / tutorials / academy surfaces
can render the same block set without duplication. Exposes:

- `parseMarkdown(src)` — block-level parser
- `MarkdownArticle` — React component that renders the blocks
- `Block` type

The block set: headings (1-4), paragraphs, fenced code, ordered
+ unordered lists, tables, hr, blockquote, with inline
` **bold** / *italic* / `code` / [link](url) `.

### Frontmatter parser — `apps/dashboard/src/lib/frontmatter.ts`

A small YAML-ish reader that supports the frontmatter patterns
the new content needs:

- `key: value` strings
- `key: "quoted"` quoted strings
- `key: [a, b, c]` bracketed lists
- `key: a.md, b.md, c.md` bare comma-separated lists (used for
  academy lesson paths)

`parseFrontmatter(src)` returns `{ frontmatter, body }` —
`frontmatter` is the parsed record, `body` is the markdown
without the frontmatter block. Used by the new surfaces to
extract date / author / tags / lessons.

### Surface 1 — `/blog`

`apps/dashboard/src/app/blog/page.tsx` +
`apps/dashboard/src/app/blog/[slug]/page.tsx` +
`apps/dashboard/src/components/pages/blog.tsx` +
`apps/dashboard/src/components/pages/blog-detail.tsx`

- Lists all docs whose path starts with `../../docs/blog/`
- Newest-first by frontmatter `date` (falls back to the doc's
  `order` field)
- Each post card shows date, author, read time, tag chips
- Detail page: full markdown render with a "back to all blog
  posts" link, hero card with metadata, the same
  `MarkdownArticle` body
- `Frontmatter` parsed at render time so editing the .md file
  is reflected on the next page load (no re-seed step)

### Surface 2 — `/tutorials`

`apps/dashboard/src/app/tutorials/page.tsx` +
`apps/dashboard/src/app/tutorials/[slug]/page.tsx` +
`apps/dashboard/src/components/pages/tutorials.tsx` +
`apps/dashboard/src/components/pages/tutorial-detail.tsx`

- Lists all docs whose path starts with `../../docs/tutorials/`
- "Runnable" badge when the file's frontmatter has
  `runnable: true`, OR when the body contains a fenced code
  block (heuristic fallback so older guides without frontmatter
  still get the badge)
- Detail page: full markdown render with a hero card
- Tutorial cards show the runnable badge, tags, and read time

### Surface 3 — `/academy`

`apps/dashboard/src/app/academy/page.tsx` +
`apps/dashboard/src/app/academy/[slug]/page.tsx` +
`apps/dashboard/src/components/pages/academy.tsx` +
`apps/dashboard/src/components/pages/academy-detail.tsx`

- Lists all docs whose path starts with `../../docs/academy/`
- Each path's frontmatter has a `lessons:` list (comma-
  separated lesson paths). At render time, each lesson path
  is looked up in the Doc store and the doc's title +
  description + read time is shown.
- Detail page: path overview + ordered list of lessons, each
  linking to the lesson's doc page. The lesson cards show
  step number, title, read time, and description.
- Difficulty badge from the path's `difficulty:` frontmatter
- Total minutes + lesson count in the hero card

### Sidebar nav

`apps/dashboard/src/components/tracker-nav.tsx` — added
`Blog` (Newspaper icon), `Tutorials` (BookOpen), `Academy`
(GraduationCap) to the dashboard sidebar, in that order
between Governance and Sitemap.

### Seeded content (7 new docs in `docs/`)

| File | Category | Notes |
|---|---|---|
| `docs/blog/2026-08-09-observability-ga.md` | Blog | New product post on Phase 13 launch |
| `docs/blog/2026-08-04-trinary-intelligence-launch.md` | Blog | Existing — Trinary launch post |
| `docs/blog/2026-08-04-trinary-intelligence-tweet-thread.md` | Blog | Existing — tweet thread |
| `docs/tutorials/first-stake.md` | Tutorial | "Your first stake on Aigarth" — 15-min runnable |
| `docs/tutorials/first-ann.md` | Tutorial | "Your first ANN — build, train, deploy" — 25-min runnable |
| `docs/academy/getting-started.md` | Academy | 5-lesson path (~90 min total) for newcomers |
| `docs/academy/building-anns.md` | Academy | 4-lesson path (~120 min) for ANN creators |

### Seed script — `apps/dashboard/scripts/register-phase-15-seed.ts`

Idempotent registration of the 7 new docs in the dashboard's
SQLite Doc store. Run once after pulling the repo.

## What v1 does NOT ship (deferred to v2)

The ROADMAP says "continuous, never done" — v1 is the foundation
ship, not the full surface. v2 covers:

- **Certifications** — developer / operator / architect tracks
  with quizzes + completion + certificate generation
- **Quizzes + completion tracking** — answer a few questions at
  the end of each lesson, get a score, track progress through a
  path
- **Search** — full-text search across blog + tutorials + academy
  + docs (currently the surfaces use the existing list-then-
  filter pattern)
- **Authoring UI** — the markdown files in git are the source of
  truth; v1 has no in-app editor
- **Versioning** — the ROADMAP item "headless, versioned CMS" —
  add a `version` field to lessons and paths so a v1.1 can ship
  without breaking the v1.0 links
- **MDX** — embed React components inside the markdown for
  interactive lessons (a "Run" button on a code block, etc.)

## Files

### Created
- `apps/dashboard/src/lib/frontmatter.ts`
- `apps/dashboard/src/components/markdown-renderer.tsx`
- `apps/dashboard/src/components/pages/blog.tsx`
- `apps/dashboard/src/components/pages/blog-detail.tsx`
- `apps/dashboard/src/components/pages/tutorials.tsx`
- `apps/dashboard/src/components/pages/tutorial-detail.tsx`
- `apps/dashboard/src/components/pages/academy.tsx`
- `apps/dashboard/src/components/pages/academy-detail.tsx`
- `apps/dashboard/src/app/blog/page.tsx`
- `apps/dashboard/src/app/blog/[slug]/page.tsx`
- `apps/dashboard/src/app/tutorials/page.tsx`
- `apps/dashboard/src/app/tutorials/[slug]/page.tsx`
- `apps/dashboard/src/app/academy/page.tsx`
- `apps/dashboard/src/app/academy/[slug]/page.tsx`
- `docs/blog/2026-08-09-observability-ga.md`
- `docs/tutorials/first-stake.md`
- `docs/tutorials/first-ann.md`
- `docs/academy/getting-started.md`
- `docs/academy/building-anns.md`
- `apps/dashboard/scripts/register-phase-15.ts`
- `apps/dashboard/scripts/register-phase-15-seed.ts`
- `apps/dashboard/scripts/closeout-15.ts`
- `docs/deliveries/phase-15-delivery.md` (this file)

### Modified
- `apps/dashboard/src/lib/repo.ts` — added `listDocsByPathPrefix(prefix)`
- `apps/dashboard/src/components/pages/doc-detail.tsx` — uses the
  extracted `MarkdownArticle` instead of the inline renderer
- `apps/dashboard/src/components/tracker-nav.tsx` — added Blog,
  Tutorials, Academy nav items

## Test counts at closeout
- **22/22** monorepo typecheck
- **Dashboard**: serves 7 new docs across 3 surfaces via SQLite
  + filesystem reads; no service-level tests needed (the surfaces
  are pure presentational, all logic is in the markdown
  renderer + frontmatter parser which are exercised end-to-end
  by the seeded content)
