/**
 * Data access layer. Pure functions over the SQLite database.
 * Each function returns plain objects (not DB rows).
 */

import { getDb, nowIso, uid, logActivity, type Phase, type Task, type Doc, type Asset, type Activity } from "./db";

// ---------- Phases ----------

export function listPhases(): Phase[] {
  return getDb()
    .prepare(`SELECT * FROM phases ORDER BY ord ASC, number ASC`)
    .all()
    .map(rowToPhase);
}

export function getPhase(id: string): Phase | null {
  const row = getDb().prepare(`SELECT * FROM phases WHERE id = ?`).get(id);
  return row ? rowToPhase(row) : null;
}

export function updatePhase(id: string, patch: Partial<Phase>): Phase {
  const d = getDb();
  const existing = getPhase(id);
  if (!existing) throw new Error(`Phase not found: ${id}`);

  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (key === "id" || key === "createdAt") continue;
    fields.push(`${camelToSnake(key)} = ?`);
    values.push(value);
  }
  fields.push("updated_at = ?");
  values.push(nowIso());
  values.push(id);

  d.prepare(`UPDATE phases SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  logActivity("phase_updated", `Phase "${existing.name}" updated`);
  return getPhase(id)!;
}

export function phaseProgress(phaseId: string): {
  total: number;
  done: number;
  pct: number;
} {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) as total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done FROM tasks WHERE phase_id = ?`
    )
    .get(phaseId) as { total: number; done: number };
  const total = row.total || 0;
  const done = row.done || 0;
  return {
    total,
    done,
    pct: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

export function overallProgress(): {
  totalTasks: number;
  doneTasks: number;
  pct: number;
  totalPhases: number;
  inProgressPhases: number;
  completePhases: number;
} {
  const d = getDb();
  const taskRow = d
    .prepare(
      `SELECT COUNT(*) as total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done FROM tasks`
    )
    .get() as { total: number; done: number };
  const phaseRow = d
    .prepare(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
              SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) as complete
       FROM phases`
    )
    .get() as { total: number; in_progress: number; complete: number };
  const totalTasks = taskRow.total || 0;
  const doneTasks = taskRow.done || 0;
  return {
    totalTasks,
    doneTasks,
    pct: totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100),
    totalPhases: phaseRow.total || 0,
    inProgressPhases: phaseRow.in_progress || 0,
    completePhases: phaseRow.complete || 0,
  };
}

// ---------- Tasks ----------

export function listTasksByPhase(phaseId: string): Task[] {
  return getDb()
    .prepare(
      `SELECT * FROM tasks WHERE phase_id = ? ORDER BY position ASC, created_at ASC`
    )
    .all(phaseId)
    .map(rowToTask);
}

export function listAllTasks(): Task[] {
  return getDb()
    .prepare(`SELECT * FROM tasks ORDER BY created_at DESC`)
    .all()
    .map(rowToTask);
}

export function getTask(id: string): Task | null {
  const row = getDb().prepare(`SELECT * FROM tasks WHERE id = ?`).get(id);
  return row ? rowToTask(row) : null;
}

export function createTask(input: Omit<Task, "id" | "createdAt" | "updatedAt">): Task {
  const d = getDb();
  const id = uid();
  d.prepare(
    `INSERT INTO tasks (id, phase_id, title, description, status, priority, owner, story_points, tags, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.phaseId,
    input.title,
    input.description,
    input.status,
    input.priority,
    input.owner,
    input.storyPoints,
    input.tags,
    input.position
  );
  logActivity("task_created", `Task "${input.title}" created`, { refType: "task", refId: id });
  return getTask(id)!;
}

export function updateTask(id: string, patch: Partial<Task>): Task {
  const d = getDb();
  const existing = getTask(id);
  if (!existing) throw new Error(`Task not found: ${id}`);

  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (key === "id" || key === "createdAt" || key === "phaseId") continue;
    fields.push(`${camelToSnake(key)} = ?`);
    values.push(value);
  }
  fields.push("updated_at = ?");
  values.push(nowIso());
  values.push(id);

  d.prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`).run(...values);

  if (patch.status && patch.status !== existing.status) {
    if (patch.status === "done") {
      logActivity("task_completed", `Task "${existing.title}" completed`, {
        refType: "task",
        refId: id,
      });
    } else {
      logActivity("task_moved", `Task "${existing.title}" → ${patch.status}`, {
        refType: "task",
        refId: id,
      });
    }
  }
  return getTask(id)!;
}

export function deleteTask(id: string): void {
  getDb().prepare(`DELETE FROM tasks WHERE id = ?`).run(id);
}

// ---------- Docs ----------

export function listDocs(): Doc[] {
  return getDb()
    .prepare(`SELECT * FROM docs ORDER BY ord ASC, title ASC`)
    .all()
    .map(rowToDoc);
}

/**
 * List docs whose stored path starts with the given prefix. Phase
 * 15 v1 uses this to scope the blog / tutorials / academy surfaces
 * by markdown-file location: `docs/blog/`, `docs/tutorials/`,
 * `docs/academy/`. Returns docs in (order, title) order.
 */
export function listDocsByPathPrefix(prefix: string): Doc[] {
  const like = prefix.endsWith("/") ? `${prefix}%` : `${prefix}/%`;
  return getDb()
    .prepare(`SELECT * FROM docs WHERE path LIKE ? ORDER BY ord ASC, title ASC`)
    .all(like)
    .map(rowToDoc);
}

export function getDoc(path: string): Doc | null {
  const row = getDb().prepare(`SELECT * FROM docs WHERE path = ?`).get(path);
  return row ? rowToDoc(row) : null;
}

export function upsertDoc(input: Omit<Doc, "id" | "createdAt" | "updatedAt">): Doc {
  const d = getDb();
  const existing = getDoc(input.path);
  if (existing) {
    d.prepare(
      `UPDATE docs SET title = ?, description = ?, category = ?, status = ?, read_time_minutes = ?, ord = ?, updated_at = ?
       WHERE path = ?`
    ).run(
      input.title,
      input.description,
      input.category,
      input.status,
      input.readTimeMinutes,
      input.order,
      nowIso(),
      input.path
    );
  } else {
    const id = uid();
    d.prepare(
      `INSERT INTO docs (id, path, title, description, category, status, read_time_minutes, ord)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.path,
      input.title,
      input.description,
      input.category,
      input.status,
      input.readTimeMinutes,
      input.order
    );
    logActivity("doc_added", `Doc added: ${input.title}`, { refType: "doc", refId: id });
  }
  return getDoc(input.path)!;
}

// ---------- Assets ----------

export function listAssets(): Asset[] {
  return getDb()
    .prepare(`SELECT * FROM assets ORDER BY created_at DESC`)
    .all()
    .map(rowToAsset);
}

export function upsertAsset(input: Omit<Asset, "id" | "createdAt">): Asset {
  const d = getDb();
  const existing = d.prepare(`SELECT * FROM assets WHERE path = ?`).get(input.path) as
    | { id: string }
    | undefined;
  if (existing) {
    d.prepare(
      `UPDATE assets SET name = ?, type = ?, description = ?, size_bytes = ? WHERE path = ?`
    ).run(input.name, input.type, input.description, input.sizeBytes, input.path);
  } else {
    const id = uid();
    d.prepare(
      `INSERT INTO assets (id, path, name, type, description, size_bytes) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, input.path, input.name, input.type, input.description, input.sizeBytes);
    logActivity("asset_added", `Asset added: ${input.name}`, { refType: "asset", refId: id });
  }
  return d.prepare(`SELECT * FROM assets WHERE path = ?`).get(input.path) as unknown as Asset;
}

// ---------- Activity ----------

export function listActivity(limit = 20): Activity[] {
  return getDb()
    .prepare(`SELECT * FROM activity ORDER BY created_at DESC LIMIT ?`)
    .all(limit)
    .map(rowToActivity);
}

// ---------- Mappers ----------

function rowToPhase(row: any): Phase {
  return {
    id: row.id,
    number: row.number,
    name: row.name,
    description: row.description,
    status: row.status,
    progress: row.progress,
    owner: row.owner,
    startedAt: row.started_at,
    targetEnd: row.target_end,
    notes: row.notes,
    order: row.ord,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToTask(row: any): Task {
  return {
    id: row.id,
    phaseId: row.phase_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    owner: row.owner,
    storyPoints: row.story_points,
    tags: row.tags,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToDoc(row: any): Doc {
  return {
    id: row.id,
    path: row.path,
    title: row.title,
    description: row.description,
    category: row.category,
    status: row.status,
    readTimeMinutes: row.read_time_minutes,
    order: row.ord,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToAsset(row: any): Asset {
  return {
    id: row.id,
    path: row.path,
    name: row.name,
    type: row.type,
    description: row.description,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  };
}

function rowToActivity(row: any): Activity {
  return {
    id: row.id,
    type: row.type,
    refType: row.ref_type,
    refId: row.ref_id,
    message: row.message,
    actor: row.actor,
    createdAt: row.created_at,
  };
}

function camelToSnake(str: string) {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}
