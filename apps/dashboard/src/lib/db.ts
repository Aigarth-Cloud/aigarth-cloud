/**
 * Local SQLite database for the Aigarth Cloud project tracker.
 *
 * Schema covers the operational concerns of building the project:
 *   - Phases (from ROADMAP.md) and their progress
 *   - Kanban tasks per phase
 *   - Documents in the workspace/now/docs/ tree
 *   - Assets in the workspace/now/assets/ tree
 *   - Activity feed of recent changes
 *
 * Designed to be swapped for Supabase later via the same query API.
 */

import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

export type PhaseStatus = "not_started" | "in_progress" | "blocked" | "complete";
export type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done";
export type TaskPriority = "p0" | "p1" | "p2" | "p3";
export type DocStatus = "draft" | "review" | "final";
export type AssetType = "image" | "doc" | "video" | "audio" | "data" | "other";

export type Phase = {
  id: string;
  number: number;
  name: string;
  description: string;
  status: PhaseStatus;
  progress: number; // 0-100
  owner: string;
  startedAt: string | null;
  targetEnd: string | null;
  notes: string;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type Task = {
  id: string;
  phaseId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  owner: string;
  storyPoints: number | null;
  tags: string; // comma-separated
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type Doc = {
  id: string;
  path: string;
  title: string;
  description: string;
  category: string;
  status: DocStatus;
  readTimeMinutes: number;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type Asset = {
  id: string;
  path: string;
  name: string;
  type: AssetType;
  description: string;
  sizeBytes: number;
  createdAt: string;
};

export type Activity = {
  id: string;
  type: "phase_updated" | "task_created" | "task_moved" | "task_completed" | "doc_added" | "asset_added" | "note";
  refType: string | null;
  refId: string | null;
  message: string;
  actor: string;
  createdAt: string;
};

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "tracker.db");

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  initSchema(db);
  return db;
}

function initSchema(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS phases (
      id TEXT PRIMARY KEY,
      number INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'not_started',
      progress INTEGER NOT NULL DEFAULT 0,
      owner TEXT NOT NULL DEFAULT '',
      started_at TEXT,
      target_end TEXT,
      notes TEXT NOT NULL DEFAULT '',
      ord INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      phase_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'backlog',
      priority TEXT NOT NULL DEFAULT 'p2',
      owner TEXT NOT NULL DEFAULT '',
      story_points INTEGER,
      tags TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (phase_id) REFERENCES phases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS docs (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      read_time_minutes INTEGER NOT NULL DEFAULT 0,
      ord INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'other',
      description TEXT NOT NULL DEFAULT '',
      size_bytes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      ref_type TEXT,
      ref_id TEXT,
      message TEXT NOT NULL,
      actor TEXT NOT NULL DEFAULT 'system',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_phase ON tasks(phase_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_activity_created ON activity(created_at DESC);
  `);
}

export function nowIso() {
  return new Date().toISOString();
}

export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function logActivity(
  type: Activity["type"],
  message: string,
  opts?: { refType?: string; refId?: string; actor?: string; docPaths?: string[] }
) {
  const d = getDb();
  // When the caller is logging a bulk doc operation (e.g. "registered 3
  // docs"), inline the touched paths into the message so the audit trail
  // is preserved without a schema change. Single-doc operations
  // continue to set refType/refId and pass no docPaths.
  const finalMessage =
    opts?.docPaths && opts.docPaths.length > 0
      ? `${message}  [docs: ${opts.docPaths.join(", ")}]`
      : message;
  d.prepare(
    `INSERT INTO activity (id, type, ref_type, ref_id, message, actor) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(uid(), type, opts?.refType ?? null, opts?.refId ?? null, finalMessage, opts?.actor ?? "system");
}
