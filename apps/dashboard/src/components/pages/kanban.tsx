"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Badge } from "@aigarth/ui";
import { cn } from "@aigarth/utils";

type Task = {
  id: string;
  phaseId: string;
  phaseName: string;
  phaseNumber: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  owner: string;
  storyPoints: number | null;
  tags: string;
};

const COLUMNS = [
  { key: "backlog", label: "Backlog" },
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "review", label: "In review" },
  { key: "done", label: "Done" },
];

export function KanbanView({ tasks, phases }: { tasks: Task[]; phases: { id: string; name: string; number: number }[] }) {
  const [filter, setFilter] = React.useState<string>("all");

  const filtered = filter === "all" ? tasks : tasks.filter((t) => t.phaseId === filter);
  const [boardTasks, setBoardTasks] = React.useState(filtered);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setBoardTasks(filtered);
  }, [filter, tasks]);

  async function moveTask(taskId: string, newStatus: string) {
    setBoardTasks((curr) =>
      curr.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      // swallow
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Kanban</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All tasks across all phases. Drag a card to change its status.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs transition-colors",
            filter === "all"
              ? "border-garden-500 bg-garden-500/10 text-garden-700 dark:text-garden-300"
              : "border-border hover:bg-accent"
          )}
        >
          All phases ({tasks.length})
        </button>
        {phases.map((p) => {
          const count = tasks.filter((t) => t.phaseId === p.id).length;
          return (
            <button
              key={p.id}
              onClick={() => setFilter(p.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                filter === p.id
                  ? "border-garden-500 bg-garden-500/10 text-garden-700 dark:text-garden-300"
                  : "border-border hover:bg-accent"
              )}
            >
              {p.number}. {p.name} ({count})
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {COLUMNS.map((col) => {
          const items = boardTasks.filter((t) => t.status === col.key);
          return (
            <div
              key={col.key}
              className={cn(
                "rounded-lg border bg-muted/20 p-3 min-h-[300px] transition-colors",
                draggingId && "border-dashed"
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingId) moveTask(draggingId, col.key);
                setDraggingId(null);
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {col.label}
                </div>
                <div className="rounded-full bg-muted px-2 text-[10px] font-mono">
                  {items.length}
                </div>
              </div>
              <div className="space-y-2">
                {items.length === 0 && (
                  <div className="rounded-md border border-dashed bg-background/50 py-6 text-center text-xs text-muted-foreground">
                    No tasks
                  </div>
                )}
                {items.map((t) => (
                  <KanbanCard
                    key={t.id}
                    task={t}
                    onDragStart={() => setDraggingId(t.id)}
                    onDragEnd={() => setDraggingId(null)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({
  task,
  onDragStart,
  onDragEnd,
}: {
  task: Task;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const priorityColors = {
    p0: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    p1: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    p2: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    p3: "bg-muted text-muted-foreground border-border",
  } as const;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="cursor-grab rounded-md border bg-card p-3 text-sm shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium leading-snug">{task.title}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            {task.phaseNumber}. {task.phaseName}
          </div>
        </div>
        <div
          className={cn(
            "shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase",
            priorityColors[task.priority as keyof typeof priorityColors] || priorityColors.p3
          )}
        >
          {task.priority}
        </div>
      </div>
      {task.description && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
      )}
      <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="truncate">{task.owner || "Unassigned"}</span>
        <div className="flex items-center gap-2">
          {task.storyPoints && <span className="font-mono">{task.storyPoints} SP</span>}
        </div>
      </div>
    </div>
  );
}
