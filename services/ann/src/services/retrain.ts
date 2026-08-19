/**
 * Auto-retrain config + trigger service (Phase 19D.2).
 *
 * Sits on top of the outcome stats from `outcomes.ts` (Phase 19D.1).
 * Two main flows:
 *
 *   1. Owner opt-in flow
 *      PUT  /v1/anns/:id/retrain-config — store opt-in + thresholds
 *      GET  /v1/anns/:id/retrain-config — read current config
 *
 *   2. Cron + manual trigger
 *      POST /v1/anns/:id/retrain — manual trigger (owner only, bypasses opt-in)
 *      POST /v1/internal/anns/retrain-scan — internal cron target
 *
 * The cron in services/training calls the internal endpoint every
 * RETRAIN_SCAN_INTERVAL_MS (default 6h). The scan walks every ANN with
 * opt-in=true, evaluates the trigger conditions, and enqueues a retrain
 * via the ann service's own recordRetrainEvent() helper. The training
 * service subscribes to retrain events to actually start the job.
 *
 * Note: in v1 the trigger logic lives in THIS service. The training
 * service is the cron caller. v2 can flip that.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/index.js";
import {
  anns,
  annRetrainConfigs,
  annRetrainEvents,
  type AnnRetrainConfig,
  type AnnRetrainEvent,
} from "../db/schema.js";
import { uid } from "../lib/ids.js";
import { logActivity } from "../lib/audit.js";
import { computeOutcomeStats } from "./outcomes.js";
import { loadConfig } from "../config/index.js";

// ---------- Zod schemas ----------

export const UpsertRetrainConfigSchema = z.object({
  optIn: z.boolean(),
  /** 0 < x ≤ 1. Default 0.05. */
  driftThreshold: z.number().min(0).max(1).optional(),
  /** ≥ 0. Default 50. */
  outcomeFloor: z.number().int().min(0).optional(),
  /** ≥ 0. Default 168. */
  cooldownHours: z.number().int().min(0).optional(),
  preferredDatasetVersionId: z.string().uuid().nullable().optional(),
  notifyMode: z.enum(["log", "email", "slack", "webhook"]).optional(),
});
export type UpsertRetrainConfigInput = z.infer<typeof UpsertRetrainConfigSchema>;

export const ListRetrainEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListRetrainEventsQuery = z.infer<typeof ListRetrainEventsQuerySchema>;

// ---------- Errors ----------

export class RetrainNotFoundError extends Error {
  constructor(annId: string) {
    super(`ANN '${annId}' has no retrain config.`);
    this.name = "RetrainNotFoundError";
  }
}

export class RetrainForbiddenError extends Error {
  constructor(action: string, annId: string) {
    super(`Not the owner of ANN '${annId}'; cannot ${action}.`);
    this.name = "RetrainForbiddenError";
  }
}

export class RetrainCooldownError extends Error {
  constructor(cooldownHours: number) {
    super(`Retrain cooldown (${cooldownHours}h) not yet elapsed.`);
    this.name = "RetrainCooldownError";
  }
}

export class TrainingServiceUnavailableError extends Error {
  constructor(detail: string) {
    super(`services/training is unavailable: ${detail}`);
    this.name = "TrainingServiceUnavailableError";
  }
}

// ---------- Helpers ----------

async function assertOwnerOrAdmin(annId: string, userId: string): Promise<void> {
  const db = getDb();
  const row = (
    await db
      .select({ creatorUserId: anns.creatorUserId })
      .from(anns)
      .where(eq(anns.id, annId))
      .limit(1)
  )[0];
  if (!row) throw new RetrainNotFoundError(annId);
  const cfg = loadConfig();
  const isAdmin = cfg.ANN_ADMIN_USER_IDS.includes(userId);
  if (row.creatorUserId !== userId && !isAdmin) {
    throw new RetrainForbiddenError("modify retrain config", annId);
  }
}

async function callTrainingServiceRetrain(
  annId: string,
  datasetVersionId: string | null,
  reason: "drift" | "low_volume" | "manual",
  userId: string,
): Promise<{ trainingJobId: string }> {
  const cfg = loadConfig();
  const url = `${cfg.TRAINING_SERVICE_URL}/v1/training/jobs`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.TRAINING_INTERNAL_TOKEN}`,
    },
    body: JSON.stringify({
      annId,
      datasetId: null, // server resolves the dataset id from the ann's last version
      datasetVersionId: datasetVersionId ?? null,
      recipeSlug: "mlp_classifier", // v1 default; will be replaced by per-ANN config in v2
      recipeOverrides: { reason },
      autoPublish: true,
      submittedBy: userId,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new TrainingServiceUnavailableError(
      `POST ${url} -> ${res.status} ${text}`.trim(),
    );
  }
  const body = (await res.json()) as { id?: string; trainingJobId?: string };
  const trainingJobId = body.id ?? body.trainingJobId;
  if (!trainingJobId) {
    throw new TrainingServiceUnavailableError("missing trainingJobId in response");
  }
  return { trainingJobId };
}

// ---------- Config CRUD ----------

/** Read the retrain config for an ANN, or null. */
export async function getRetrainConfig(annId: string): Promise<AnnRetrainConfig | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(annRetrainConfigs)
    .where(eq(annRetrainConfigs.annId, annId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Create or update the retrain config. Owner only.
 *
 * On the first call that sets optIn=true, captures the current
 * `successRate` from outcome stats as the baseline.
 */
export async function upsertRetrainConfig(
  annId: string,
  input: UpsertRetrainConfigInput,
  userId: string,
): Promise<AnnRetrainConfig> {
  await assertOwnerOrAdmin(annId, userId);
  const db = getDb();
  const existing = await getRetrainConfig(annId);

  // If turning optIn on for the first time, capture baseline from current stats.
  let baseline = existing?.baselineSuccessRate ?? null;
  if (input.optIn && !existing?.optIn) {
    const stats = await computeOutcomeStats(annId);
    if (stats.successRate !== null) {
      baseline = String(stats.successRate);
    }
  }

  const now = new Date();
  if (existing) {
    const updated = await db
      .update(annRetrainConfigs)
      .set({
        optIn: input.optIn,
        baselineSuccessRate: baseline,
        driftThreshold: input.driftThreshold !== undefined ? String(input.driftThreshold) : existing.driftThreshold,
        outcomeFloor: input.outcomeFloor !== undefined ? input.outcomeFloor : existing.outcomeFloor,
        cooldownHours: input.cooldownHours !== undefined ? input.cooldownHours : existing.cooldownHours,
        preferredDatasetVersionId:
          input.preferredDatasetVersionId !== undefined
            ? input.preferredDatasetVersionId
            : existing.preferredDatasetVersionId,
        notifyMode: input.notifyMode ?? existing.notifyMode,
        updatedAt: now,
      })
      .where(eq(annRetrainConfigs.annId, annId))
      .returning();
    return updated[0]!;
  }
  const id = uid();
  const inserted = await db
    .insert(annRetrainConfigs)
    .values({
      annId,
      optIn: input.optIn,
      baselineSuccessRate: baseline,
      driftThreshold: input.driftThreshold !== undefined ? String(input.driftThreshold) : "0.05",
      outcomeFloor: input.outcomeFloor !== undefined ? input.outcomeFloor : 50,
      cooldownHours: input.cooldownHours !== undefined ? input.cooldownHours : 168,
      preferredDatasetVersionId: input.preferredDatasetVersionId ?? null,
      notifyMode: input.notifyMode ?? "log",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return inserted[0]!;
}

/** Paginated list of retrain events for an ANN, newest first. */
export async function listRetrainEvents(
  annId: string,
  query: ListRetrainEventsQuery,
): Promise<{ data: AnnRetrainEvent[]; total: number; limit: number; offset: number }> {
  const db = getDb();
  const rows = await db
    .select()
    .from(annRetrainEvents)
    .where(eq(annRetrainEvents.annId, annId))
    .orderBy(desc(annRetrainEvents.triggeredAt))
    .limit(query.limit)
    .offset(query.offset);
  const totalRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(annRetrainEvents)
    .where(eq(annRetrainEvents.annId, annId));
  const total = Number(totalRow[0]?.count ?? 0);
  return { data: rows, total, limit: query.limit, offset: query.offset };
}

// ---------- Manual + cron trigger ----------

/**
 * Manually trigger a retrain for an ANN. Owner only. Bypasses opt-in
 * and cooldown. Throws RetrainCooldownError if a recent manual retrain
 * already exists in the last 60s (rate-limit per ANN).
 */
export async function triggerManualRetrain(
  annId: string,
  userId: string,
): Promise<{ trainingJobId: string; eventId: string }> {
  await assertOwnerOrAdmin(annId, userId);
  const db = getDb();

  // 60s rate-limit to prevent double-clicks. Done in JS because the
  // mock drizzle layer in tests treats operators as `eq`; the SQL
  // just narrows by ann + reason, then we filter by timestamp here.
  const recent = await db
    .select({ id: annRetrainEvents.id, triggeredAt: annRetrainEvents.triggeredAt })
    .from(annRetrainEvents)
    .where(
      and(
        eq(annRetrainEvents.annId, annId),
        eq(annRetrainEvents.reason, "manual"),
      ),
    )
    .limit(10);
  const now = Date.now();
  const foundRecent = recent.find((r) => {
    const t = r.triggeredAt instanceof Date ? r.triggeredAt.getTime() : 0;
    return now - t < 60_000;
  });
  if (foundRecent) {
    throw new RetrainCooldownError(0); // 0 = the 60s rate limit, not the config cooldown
  }

  const config = await getRetrainConfig(annId);
  const stats = await computeOutcomeStats(annId);

  const { trainingJobId } = await callTrainingServiceRetrain(
    annId,
    config?.preferredDatasetVersionId ?? null,
    "manual",
    userId,
  );

  const eventId = uid();
  await db.insert(annRetrainEvents).values({
    id: eventId,
    annId,
    trainingJobId,
    reason: "manual",
    baselineSuccessRate: config?.baselineSuccessRate ?? null,
    currentSuccessRate: stats.successRate !== null ? String(stats.successRate) : null,
    totalOutcomesAtTrigger: stats.totalOutcomes,
    notes: `manual retrain by user ${userId}`,
  });

  // Bump lastRetrainAt on the config (if any).
  if (config) {
    await db
      .update(annRetrainConfigs)
      .set({ lastRetrainAt: new Date(), updatedAt: new Date() })
      .where(eq(annRetrainConfigs.annId, annId));
  }

  await logActivity(db, {
    action: "ann.retrain_manual",
    actorUserId: userId,
    targetType: "ann_retrain_event",
    targetId: eventId,
    metadata: { annId, trainingJobId, reason: "manual" },
  });

  return { trainingJobId, eventId };
}

// ---------- Cron target ----------

/**
 * Internal scan: walk all ANNs with opt-in=true and enqueue retraining
 * jobs where the trigger conditions are met. Called by the training
 * service's cron on a fixed interval.
 *
 * Returns counters so the caller can log/monitor progress.
 */
export async function runRetrainScan(): Promise<{
  scanned: number;
  triggered: number;
  skipped: number;
  errors: number;
}> {
  const db = getDb();

  // Find all configs with optIn=true.
  const configs = await db
    .select()
    .from(annRetrainConfigs)
    .where(eq(annRetrainConfigs.optIn, true));

  let triggered = 0;
  let skipped = 0;
  let errors = 0;
  const now = new Date();

  for (const config of configs) {
    try {
      // Cooldown check.
      if (config.lastRetrainAt) {
        const elapsedHours = (now.getTime() - config.lastRetrainAt.getTime()) / (1000 * 60 * 60);
        if (elapsedHours < config.cooldownHours) {
          skipped++;
          continue;
        }
      }

      const stats = await computeOutcomeStats(config.annId);

      // Low-volume trigger: not enough data to trust the rate.
      if (stats.totalOutcomes < config.outcomeFloor) {
        if (stats.totalOutcomes === 0) {
          // No outcomes at all — skip silently (not actionable yet).
          skipped++;
          continue;
        }
        await fireRetrain(config.annId, config, stats, "low_volume", null, null);
        triggered++;
        continue;
      }

      // Drift trigger: current rate is significantly below baseline.
      const driftThreshold = Number(config.driftThreshold);
      const baseline = config.baselineSuccessRate ? Number(config.baselineSuccessRate) : null;
      const current = stats.successRate;
      if (baseline !== null && current !== null && current < baseline - driftThreshold) {
        await fireRetrain(config.annId, config, stats, "drift", baseline, current);
        triggered++;
        continue;
      }

      // No trigger condition met.
      skipped++;
    } catch (err) {
      // Log but keep scanning the rest.
      // eslint-disable-next-line no-console
      console.error(`[retrain] scan failed for ann ${config.annId}:`, err);
      errors++;
    }
  }

  return { scanned: configs.length, triggered, skipped, errors };
}

async function fireRetrain(
  annId: string,
  config: AnnRetrainConfig,
  stats: Awaited<ReturnType<typeof computeOutcomeStats>>,
  reason: "drift" | "low_volume",
  baselineNum: number | null,
  currentNum: number | null,
): Promise<void> {
  const db = getDb();
  let trainingJobId: string;
  try {
    const result = await callTrainingServiceRetrain(
      annId,
      config.preferredDatasetVersionId,
      reason,
      "system", // cron actor is "system"
    );
    trainingJobId = result.trainingJobId;
  } catch (err) {
    // Log the event as 'error' but still record an event for visibility.
    const eventId = uid();
    await db.insert(annRetrainEvents).values({
      id: eventId,
      annId,
      trainingJobId: null,
      reason,
      baselineSuccessRate: baselineNum !== null ? String(baselineNum) : null,
      currentSuccessRate: currentNum !== null ? String(currentNum) : null,
      totalOutcomesAtTrigger: stats.totalOutcomes,
      notes: `triggered retrain failed: ${(err as Error).message}`,
    });
    throw err;
  }

  const eventId = uid();
  await db.insert(annRetrainEvents).values({
    id: eventId,
    annId,
    trainingJobId,
    reason,
    baselineSuccessRate: baselineNum !== null ? String(baselineNum) : null,
    currentSuccessRate: currentNum !== null ? String(currentNum) : null,
    totalOutcomesAtTrigger: stats.totalOutcomes,
    notes: null,
  });

  await db
    .update(annRetrainConfigs)
    .set({ lastRetrainAt: new Date(), updatedAt: new Date() })
    .where(eq(annRetrainConfigs.annId, annId));

  await logActivity(db, {
    action: `ann.retrain_${reason}`,
    actorUserId: null,
    targetType: "ann_retrain_event",
    targetId: eventId,
    metadata: {
      annId,
      trainingJobId,
      reason,
      currentSuccessRate: currentNum,
      baselineSuccessRate: baselineNum,
      totalOutcomes: stats.totalOutcomes,
    },
  });
}

// ---------- Internal scan (called via HTTP) ----------

/** Returns ANNs that should be retried. Used by training service to bulk-read. */
export async function listOptedInAnns(): Promise<AnnRetrainConfig[]> {
  const db = getDb();
  return db.select().from(annRetrainConfigs).where(eq(annRetrainConfigs.optIn, true));
}
