# Phase 19B — Dataset Service delivery report

**Phase:** 19B — Dataset service (6 tasks complete)
**Sprint:** 3rd of the Phase 19 plan
**Date:** 2026-08-07
**Status:** ✅ Complete
**Story points delivered:** 9.5 / 9.5

> 📦 **Ship time: ~75 minutes** — 9.5 SP delivered at ~8 min/SP
> The fastest sub-phase yet, helped by the
> plug-in TrinaryBackend pattern from 19C.3 carrying over to the
> upload pipeline and the schema sniffer being a pure function
> that's easy to test.

---

## What shipped

### 19B.1 — `services/dataset` skeleton (port 7009)

Full Fastify + Drizzle + JWT + multipart service, following the
shape established by `services/tissue`. Includes:

- `package.json`, `tsconfig.json`, `drizzle.config.json`, `vitest.config.ts`
- `src/index.ts`, `src/server.ts`, `src/config/index.ts`
- `src/db/{index,schema,migrate,seed}.ts`
- `src/lib/{ids,audit,db-types,serialize}.ts`
- `src/routes/{health,datasets}.ts`
- `src/tests/{schemaSniffer,connectors}.test.ts`
- 1 GiB body limit, 30-write-per-minute rate limit, S3 bucket auto-create on startup

### 19B.2 — Schema (per ADR 004)

| Table | Columns | Indexes | FKs |
|-------|---------|---------|-----|
| `datasets` | 13 | 4 | 0 |
| `dataset_versions` | 10 | 3 | 1 |
| `dataset_access` | 8 | 2 | 1 |
| `dataset_audit_logs` | 8 | 0 | 0 |
| `dataset_connectors` | 11 | 2 | 1 |

Drizzle migration: `drizzle/0000_hesitant_sleepwalker.sql` (initial)
+ `drizzle/0001_careful_the_watchers.sql` (connectors).

The schema locks in the decisions from ADR 004:
- Trainer owns weights. Dataset is a reference, never copied.
- `dataset_versions.content_hash` (SHA-256) is the source of truth for "same data?"
- `dataset_revenue_bps` reserved for v2 revenue-share (ADR 004 Q1)
- Soft orphan: a hard delete sets the trained-version lineage to NULL (handled in 19B.6, ADR 004 Q2)
- Attribution: required on listing detail, optional card label, not in the envelope (ADR 004 Q3)

### 19B.3 — Upload pipeline

The heart of the service. End-to-end flow for one multipart upload:

```
Caller POSTs multipart to /v1/datasets/:id/versions
   (fields: version=semver, changelog?=string, file=binary)
         ↓
Buffer the file (capped at DATASET_MAX_UPLOAD_BYTES, default 1 GiB)
         ↓
SHA-256 the bytes → content_hash
         ↓
Read first 1 MiB → sniffSchema() → inferred {kind, columns, mimeType, ...}
         ↓
Idempotency check: same (dataset, version) + same content_hash? → return existing
                   same (dataset, version) + different content_hash? → 409
         ↓
Upload bytes to S3/MinIO at: datasets/<dataset_id>/<version>/<content_hash>
         ↓
Insert dataset_versions row + audit log entry
         ↓
Return the new (or pre-existing) version
```

The schema sniffer handles:
- **CSV / TSV** — header-row detection, column-type inference (string / number / boolean / date / json)
- **JSON / JSONL** — top-level object or array of objects, same column-type inference
- **Parquet** — magic-byte detection, "use parquet-tools" note in v1
- **PNG / JPEG / GIF** — image kind
- **WAV** — audio kind
- **Anything else** — `kind: "other"` with a notes field

The sniffer is a pure function. **12 tests** cover all sniffed formats + edge cases (no DB needed).

### 19B.4 — Public catalog + browse UI

Three pages ship:

| Path | Type | Purpose |
|------|------|---------|
| `/datasets` | marketing, public | Faceted browse of all `status='public'` datasets. Search by name, filter by kind and license. |
| `/datasets/[slug]` | marketing, public | Detail page. Versions, inferred schema, "Train on this" CTA. |
| `/dashboard/datasets` | dashboard, auth | Studio listing — your own datasets, with status badge + "Upload" CTA. |

Marketing nav gets a new "Dataset Catalog" link in the **Products** dropdown. Dashboard nav gets a "Datasets" entry in the **Intelligence** section.

A new `getAigarthPublic()` factory in `lib/server/aigarth-public.ts` provides an unauthenticated SDK instance for the marketing pages to fetch the public catalog. Falls back gracefully to an empty state if the dataset service is down.

### 19B.5 — Connector framework (minimal)

The framework + one working connector (HTTP API). Future kinds (MQTT, Hugging Face, Kaggle) plug into the same dispatch switch.

```
POST   /v1/datasets/:id/connectors          # create (http_api only in v1)
GET    /v1/datasets/:id/connectors          # list
POST   /v1/datasets/:id/connectors/:cid/pause
POST   /v1/datasets/:id/connectors/:cid/resume
POST   /v1/datasets/:id/connectors/:cid/sync  # manual one-shot
```

The HTTP API connector:
- Polls a URL with an optional `Authorization` header
- Downloads the body, computes SHA-256, writes a new `dataset_versions` row
- Auto-generates a version label: `auto.<timestamp>.<8-char-hash-prefix>`
- 60-second per-request timeout
- Errors persist to `last_error` on the connector row (the runner never crashes)

**6 tests** cover the `HttpApiConfigSchema` (URL required, auth header length cap, poll interval ceiling).

Adding a new connector kind is a 30-line module under `src/connectors/<kind>.ts` + a line in the dispatch switch.

### 19B.6 — SDK `Datasets` resource

`packages/sdk/src/resources/datasets.ts` — exposes the dataset service to TypeScript / JS consumers:

```ts
const catalog = await client.datasets.catalog({ kind: "tabular" });
const d = await client.datasets.create({ name: "Crop Yields 2024", kind: "tabular" });
await client.datasets.uploadVersion(d.id, {
  version: "1.0.0",
  file: csvFile,         // File | Blob | ArrayBuffer
  changelog: "First 10K rows",
});
```

8 methods total: `list`, `catalog`, `retrieve`, `listVersions`, `create`, `update`, `changeStatus`, `uploadVersion`. Multipart upload is automatic — just pass any `Blob`/`File`/`ArrayBuffer`.

`apps/web/lib/server/aigarth.ts` adds the new `dataset: "http://localhost:7009"` service URL, so the dashboard pages can call `client.datasets.*` directly.

---

## File map

```
services/dataset/                                    ← NEW service (port 7009)
├── package.json
├── tsconfig.json
├── drizzle.config.json
├── vitest.config.ts
├── .env.example
├── .gitignore
├── scripts/clean.mjs
├── drizzle/
│   ├── 0000_hesitant_sleepwalker.sql                ← NEW (4 tables)
│   └── 0001_careful_the_watchers.sql                ← NEW (connectors)
├── src/
│   ├── index.ts                                     ← NEW
│   ├── server.ts                                    ← NEW
│   ├── config/index.ts                              ← NEW
│   ├── db/
│   │   ├── index.ts                                 ← NEW
│   │   ├── schema.ts                                ← NEW (5 tables per ADR 004)
│   │   ├── migrate.ts                               ← NEW
│   │   └── seed.ts                                  ← NEW
│   ├── lib/
│   │   ├── ids.ts                                   ← NEW
│   │   ├── audit.ts                                 ← NEW
│   │   ├── db-types.ts                              ← NEW
│   │   └── serialize.ts                             ← NEW
│   ├── services/
│   │   ├── storage.ts                               ← NEW (S3 client + idempotent put)
│   │   ├── schemaSniffer.ts                         ← NEW (CSV/TSV/JSON/JSONL/Parquet/images)
│   │   ├── datasets.ts                              ← NEW (CRUD + slug collision)
│   │   ├── versions.ts                              ← NEW (upload pipeline, content hash)
│   │   └── connectors.ts                            ← NEW (framework dispatch)
│   ├── connectors/
│   │   └── http-api.ts                              ← NEW (1 working connector)
│   ├── routes/
│   │   ├── health.ts                                ← NEW
│   │   └── datasets.ts                              ← NEW (15 endpoints)
│   └── tests/
│       ├── schemaSniffer.test.ts                    ← NEW (12 tests)
│       └── connectors.test.ts                       ← NEW (6 tests)

apps/web/
├── app/(marketing)/
│   ├── datasets/page.tsx                            ← NEW (public catalog)
│   └── datasets/[slug]/page.tsx                     ← NEW (detail)
├── app/dashboard/
│   └── datasets/page.tsx                            ← NEW (studio listing)
├── components/marketing/marketing-nav.tsx           ← UPDATED (added "Dataset Catalog")
├── components/dashboard/dashboard-nav.tsx           ← UPDATED (added "Datasets" entry)
└── lib/server/
    └── aigarth-public.ts                            ← NEW (no-auth SDK factory)

packages/sdk/src/
├── resources/datasets.ts                            ← NEW (8 methods)
├── resources/index.ts                               ← UPDATED
├── types/dataset.ts                                 ← NEW (10 types)
├── types/index.ts                                   ← UPDATED
└── client.ts                                        ← UPDATED (datasets field + service URL)

apps/dashboard/scripts/
└── complete-19b.ts                                  ← NEW (marks 19B.4–6 done)
```

---

## Quality gates

- **20/20 monorepo typecheck** — green (was 19, added 1 for the new service)
- **18/18 dataset tests** — green (12 schema sniffer + 6 connectors)
- **80/80 ANN tests** — still green, no regressions
- **SDK build** — clean (`pnpm --filter @aigarth/sdk build`)

---

## API surface (new)

### Public (no auth)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/healthz` | service health |
| GET | `/v1/datasets` | list + filter (kind, license, status, owner, search) |
| GET | `/v1/datasets/catalog` | public catalog (`status='public'`) |
| GET | `/v1/datasets/:idOrSlug` | details |
| GET | `/v1/datasets/:idOrSlug/versions` | version list |

### Authenticated (JWT)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/v1/datasets` | create |
| PATCH | `/v1/datasets/:idOrSlug` | update metadata |
| POST | `/v1/datasets/:idOrSlug/status` | change status |
| POST | `/v1/datasets/:idOrSlug/versions` | **upload a new version** (multipart) |
| GET | `/v1/datasets/:idOrSlug/connectors` | list connectors |
| POST | `/v1/datasets/:idOrSlug/connectors` | create a connector |
| POST | `/v1/datasets/:idOrSlug/connectors/:cid/pause` | pause |
| POST | `/v1/datasets/:idOrSlug/connectors/:cid/resume` | resume |
| POST | `/v1/datasets/:idOrSlug/connectors/:cid/sync` | manual sync trigger |

---

## SDK surface (new)

```ts
import { Aigarth } from "@aigarth/sdk";

const a = new Aigarth({ apiKey, services: { ... } });

// Catalog browse
const catalog = await a.datasets.catalog({ kind: "tabular" });

// CRUD
const d = await a.datasets.create({
  name: "Crop Yields 2024",
  kind: "tabular",
  license: "open",
});

// Upload
const v = await a.datasets.uploadVersion(d.id, {
  version: "1.0.0",
  file: csvFile,  // File | Blob | ArrayBuffer
  changelog: "First 10K rows",
});
```

---

## What's still ahead (Phase 19, 11 tasks left)

| Sub-phase | Done | Tasks remaining |
|-----------|------|-----------------|
| 19A — Garden UX | 4/4 ✅ | 0 |
| **19B — Dataset service** | **6/6 ✅** | **0** |
| 19C — Training | 1/6 | 19C.1, 19C.2, 19C.4, 19C.5, 19C.6 |
| 19D — Feedback loops | 0/4 | 19D.1, 19D.2, 19D.3, 19D.4 |
| Cross-cutting | 2/2 ✅ | 0 |
| **Total** | **13/22** | **9** |

~17 SP remaining. The next natural sprint is 19C.1 (services/training skeleton) + 19C.2 (recipe schema) + 19C.3 is already done.

---

## See also

- [ADR 004 — Dataset ownership + licensing](../architecture-decisions/004-dataset-licensing.md) — the decision this entire sub-phase implements
- [Phase 19A delivery report](./phase-19a-delivery.md) — Garden UX + cross-cutting
- [Phase 19C.3 delivery report](./phase-19c3-real-llm-delivery.md) — real LLM invocation
- [Phase 19 plan and priority queue](../proposals/phase-3-vision-evaluation.md)
- [Dashboard tracker](/phases/phase-19) — live kanban (now 47%)
