# ADR 004 — Dataset Ownership and Licensing Model

**Status:** Accepted
**Date:** 2026-08-07
**Authors:** Principal Architect
**Deciders:** Eng lead
**Phase:** 19B
**Builds on:** [ADR 003 — Trinary Protocol v1](./003-trinary-protocol-v1.md)

---

## Context

Phase 19B introduces first-class **datasets** to Aigarth Cloud. Today, the only "knowledge source" an ANN has is the `trinary_prompt_template` text field (max 20,000 chars) — useful for system-prompt-only ANNs, not for training. The dataset registry is the foundation for real training (19C), connectors (19B.5), public catalog (19B.4), and feedback loops (19D).

Three licensing questions had to be answered before the schema shipped. They each affect the data model in a way that's expensive to retrofit after the registry is in production.

### Q1. When a user trains on a public dataset, who owns the resulting weights?

**Three options were considered:**

| Option | Pros | Cons |
|--------|------|------|
| Trainer owns | Aligned with how ML has always worked; trainer invested the compute | The dataset author has no skin in the game; their work can be laundered into a commercial model with no credit or revenue |
| Dataset author owns | Authors are credited; ANNs become derivative works | A single public dataset (e.g. ImageNet) effectively becomes a chokepoint for the entire platform; in practice no one would ship a useful ANN without explicit per-trainer license grants |
| Both own (split) | Reflects the actual contribution; supports revenue share | Splits the data model in a way that complicates the listing, the API, and the marketplace fee logic |

**Decision: trainer owns the weights, dataset is referenced + attributed, **never** copied into the trained version.**

The trained ANN version is its own first-class object. The dataset is a *reference* — its `dataset_version_id` is stored on `ann_versions`, but the dataset's bytes do not move into the trained artifact. This means:

- The trainer has full commercial control over the resulting weights.
- The dataset author is credited on every listing that referenced their work, in a "Trained on" line (19B.4 catalog UI).
- If a public dataset is later set to private or removed, existing trained ANNs keep working (they hold a hash reference, not a live copy of the bytes). The catalog surfaces them as "Trained on: <dataset> (now private)" — the lineage is preserved.
- A future revenue-share model is possible: when a trained ANN earns QUBIC on the marketplace, an optional `dataset_revenue_bps` field on the dataset can route a configurable share back to the dataset author. **Not in v1** — out of scope.

### Q2. When a public dataset is removed or deprecated, do existing trained ANNs lose access?

**Two options were considered:**

| Option | Behavior |
|--------|----------|
| Hard delete | Trained versions become orphaned; calls fail with "missing source dataset" |
| Soft orphan | Trained versions keep working; the listing surfaces the dataset as `(now private)` for buyer transparency |

**Decision: soft orphan. Trained versions keep working; lineage is preserved and surfaced in the UI.**

Reasons:

- An ANN trained on a now-removed dataset is still a useful artifact. Killing it punishes the trainer, who did nothing wrong.
- Buyers of a listed ANN need to know what they bought. The "Trained on: <dataset> (now private)" line gives them transparency without breaking the contract.
- A future "frozen" status on a dataset can be added if a dataset author wants to *prevent future training* but allow existing trained versions to continue. Not in v1.

### Q3. How is attribution surfaced in the marketplace listing?

**Three places to surface it:**

1. The listing detail page — required, "Trained on" section.
2. The listing card on browse / search results — optional, short label ("Trained on ImageNet v1.2").
3. The decision envelope itself — not in v1; the envelope stays focused on the trinary protocol.

**Decision: required on the listing detail page (1), optional card label (2), not in the envelope (3) for v1.**

The reason for not adding it to the envelope: the envelope is signed and immutable; adding lineage fields changes the canonical JSON shape and breaks every existing envelope. A future "envelope annotation" or "provenance" sub-object can carry dataset references without touching the core shape. Punt to v2.

---

## Decision summary

| Question | v1 behavior |
|----------|-------------|
| Who owns trained weights? | Trainer. Dataset is a reference, never copied. |
| What happens when a public dataset is removed? | Trained versions keep working. Lineage preserved, surfaced in listing UI as `(now private)`. |
| How is attribution surfaced? | Required on listing detail. Optional card label. Not in the envelope. |
| Dataset revenue share | Not in v1. Schema has the hooks (`dataset_revenue_bps`) but the platform doesn't enforce it. |

---

## Schema impact (locked in for 19B)

```sql
-- Datasets (19B.2)
CREATE TABLE datasets (
  id UUID PRIMARY KEY,
  owner_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  kind dataset_kind NOT NULL,  -- tabular | text | image | audio | time_series | multimodal | other
  license dataset_license NOT NULL,  -- open | cc_by | cc_by_sa | commercial | custom
  source TEXT,  -- original source URL, paper, or "self-collected"
  status dataset_status NOT NULL DEFAULT 'private',  -- draft | private | public | deprecated
  description TEXT,
  dataset_revenue_bps INTEGER NOT NULL DEFAULT 0,  -- 0–10000. Reserved for v2. v1: ignored.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Versions (19B.2)
CREATE TABLE dataset_versions (
  id UUID PRIMARY KEY,
  dataset_id UUID NOT NULL REFERENCES datasets(id),
  version TEXT NOT NULL,  -- semver
  row_count BIGINT,
  size_bytes BIGINT NOT NULL,
  schema_json JSONB NOT NULL,  -- inferred schema (columns, types, sample)
  sample_uri TEXT,  -- s3://... to the first 1MB peek
  content_hash TEXT NOT NULL,  -- SHA-256 of the full bytes
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dataset_id, version)
);

-- Access grants (19B.2)
CREATE TABLE dataset_access (
  id UUID PRIMARY KEY,
  dataset_id UUID NOT NULL REFERENCES datasets(id),
  grantee_user_id UUID,  -- null = public
  mode dataset_access_mode NOT NULL,  -- read | derive
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

-- Trained-version lineage (19B.6, surfaced in 19B.4 catalog)
ALTER TABLE ann_versions
  ADD COLUMN trained_on_dataset_version_id UUID
    REFERENCES dataset_versions(id)
    ON DELETE SET NULL,  -- hard delete = orphan, lineage preserved
  ADD COLUMN trained_recipe_json JSONB,  -- the training recipe (19C.2)
  ADD COLUMN trained_metrics_json JSONB;  -- accuracy / loss / val_loss / etc.
```

The `ON DELETE SET NULL` on `trained_on_dataset_version_id` is the linchpin of Q2: a hard dataset-version delete orphans the trained version's lineage, but the trained version itself keeps working. Lineage is recovered via the `content_hash` (which is also stored in `ann_versions` for fast lookup if needed in v2).

---

## Consequences

### Positive

- Trainer commercial control over trained weights. Aligned with industry norms.
- Public dataset authors get attribution for free (the "Trained on" line) without having to register a license. This is the right default — the *default* should not require a contract.
- Schema is forward-compatible with a v2 revenue-share model. No retrofit needed.
- Lineage is preserved across the entire platform — useful for compliance, for buyers evaluating a listing, and for debugging "why is this model biased?" investigations later.

### Negative

- A public dataset author can't *force* a revenue share in v1. If you have a high-value dataset and need that, the only path is to keep the dataset private and grant `derive` access on a per-trainer basis. Acceptable for v1.
- The "Trained on" attribution depends on the trainer being honest. We can't prove the ANN wasn't trained on additional data we don't know about. The platform only attests to the *declared* lineage.
- Adding the lineage fields to `ann_versions` is a schema migration on a live table. The migration must be backward-compatible (nullable columns, no default that requires backfill).

### Mitigations

- For v1 revenue share: the platform supports `dataset_revenue_bps` as a hint, but the listing UI clearly states it's advisory. Real revenue split is a v2 marketplace extension.
- For honesty: the lineage line is signed at version-publish time using the same HMAC key as the envelope. A future "verifiable lineage" feature can let buyers cryptographically verify what an ANN claims to have been trained on.
- For the migration: nullable columns, no backfill required, no FK enforcement beyond `SET NULL` (already supported by Drizzle + Postgres).

---

## Alternatives considered

### Train-once-per-dataset license tokens

Every public dataset would issue license tokens; each trained version would carry the token. This is closer to how music sampling rights work. **Rejected** for v1: it adds three new tables (`dataset_licenses`, `dataset_license_tokens`, `dataset_license_grants`), two new SDK resources, and a new marketplace concept. The user benefit is "you can prove a commercial license exists." That's real, but v1 has no commercial-license flows in the marketplace yet. Build this when v2 ships the revenue-share model.

### Embed the dataset bytes in the trained version

A trained version would carry the dataset (or a fingerprint of it) inside its bytes. This makes "where did this model come from" trivially answerable. **Rejected**: it inflates every stored model by the size of the dataset, complicates storage, and is the *opposite* of how ML is done in practice. The trained artifact is a derived representation, not a container of its inputs.

### Permissioned derivatives only (no public datasets)

Public datasets are gated behind a manual review. **Rejected**: it's hostile to the open-source / research community and adds an ops cost we can't justify for v1. The soft-orphan model is the right default; commercial authors can opt out by keeping their dataset private.

---

## What this ADR does NOT decide

These are explicitly out of scope and deferred:

- **Dataset version diff** — comparing two versions of the same dataset. Useful but not load-bearing. Punt.
- **Connector quota / rate limits** — 19B.5 ships the framework, but quota and rate limits per connector are a v2 ops question.
- **Dataset deletion semantics** — `DELETE /v1/datasets/:id` is not yet defined. v1 allows `status = 'deprecated'` and `status = 'private'` but not hard delete (which is a destructive action and needs confirmation / undo window).
- **Public dataset approval workflow** — the platform trusts authors to label their license accurately. A "verified dataset" badge is a v2 trust-and-safety feature.

---

## See also

- [ADR 003 — Trinary Protocol v1](./003-trinary-protocol-v1.md)
- [Phase 19 plan and priority queue](../proposals/phase-3-vision-evaluation.md)
- [Phase 19B.2 schema spec](../deliveries/_TEMPLATE.md) (filled in by the next sprint)
