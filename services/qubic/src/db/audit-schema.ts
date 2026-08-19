/**
 * Local audit log table for the Qubic service.
 *
 * Mirrors the identity service's audit_logs but with a free-form
 * text action column (not a pgEnum) so we can keep the two services
 * decoupled.
 */

import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const auditLogs = pgTable(
  "qubic_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id"),
    orgId: uuid("org_id"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    actorIdx: index("qubic_audit_logs_actor_idx").on(t.actorUserId),
    actionIdx: index("qubic_audit_logs_action_idx").on(t.action),
    createdIdx: index("qubic_audit_logs_created_idx").on(t.createdAt),
  }),
);

export type AuditLog = typeof auditLogs.$inferSelect;
