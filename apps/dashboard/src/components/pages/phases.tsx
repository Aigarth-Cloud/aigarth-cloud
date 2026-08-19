"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Rocket, CheckCircle2, Clock, Circle, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Badge } from "@aigarth/ui";
import { cn } from "@aigarth/utils";

type Phase = { id: string; number: number; name: string; status: string; progress: number; description: string; owner: string };

const STATUSES = [
  { key: "not_started", label: "Not started", color: "bg-muted-foreground/30" },
  { key: "in_progress", label: "In progress", color: "bg-amber-500" },
  { key: "complete", label: "Complete", color: "bg-emerald-500" },
  { key: "blocked", label: "Blocked", color: "bg-red-500" },
];

export function PhasesView({ phases, stats }: { phases: Phase[]; stats: any }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Phases</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {phases.length} phases from the engineering roadmap. {stats.completePhases} complete,{" "}
          {stats.inProgressPhases} in progress.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {phases.map((p) => (
          <PhaseCard key={p.id} phase={p} />
        ))}
      </div>
    </div>
  );
}

function PhaseCard({ phase }: { phase: Phase }) {
  const found = STATUSES.find((s) => s.key === phase.status);
  const status = found ?? STATUSES[0];
  if (!status) throw new Error("STATUSES must have a default entry");
  return (
    <Link
      href={`/phases/${phase.id}`}
      className="group block"
    >
      <Card className="h-full transition-all hover:border-garden-500/50">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-sm font-mono">
              {phase.number.toString().padStart(2, "0")}
            </div>
            <div className="flex h-6 items-center gap-1.5 rounded-full border bg-background/50 px-2.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <span className={cn("h-1.5 w-1.5 rounded-full", status.color)} />
              {status.label}
            </div>
          </div>
          <CardTitle className="mt-4">{phase.name}</CardTitle>
          <CardDescription className="line-clamp-2 min-h-[2.5rem]">{phase.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-mono">{phase.progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full transition-all",
                  phase.status === "complete"
                    ? "bg-emerald-500"
                    : phase.status === "in_progress"
                    ? "bg-amber-500"
                    : "bg-garden-500/40"
                )}
                style={{ width: `${phase.progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
              <span>Owner: {phase.owner || "—"}</span>
              <span className="inline-flex items-center gap-1 text-garden-600 dark:text-garden-400 group-hover:translate-x-0.5 transition-transform">
                Open
                <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function PhaseDetailView({
  phase,
  tasks,
  progress,
}: {
  phase: Phase;
  tasks: any[];
  progress: { total: number; done: number; pct: number };
}) {
  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/phases"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          All phases
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-lg font-mono">
            {phase.number.toString().padStart(2, "0")}
          </div>
          <div>
            <h1 className="text-2xl font-medium tracking-tight">{phase.name}</h1>
            <p className="text-sm text-muted-foreground">{phase.description}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">Progress</div>
            <div className="mt-1 text-2xl font-medium tracking-tight">{progress.pct}%</div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full",
                  phase.status === "complete" ? "bg-emerald-500" : "bg-amber-500"
                )}
                style={{ width: `${progress.pct}%` }}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">Tasks done</div>
            <div className="mt-1 text-2xl font-medium tracking-tight">
              {progress.done} / {progress.total}
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              {progress.total - progress.done} remaining
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">Owner</div>
            <div className="mt-1 text-base font-medium">{phase.owner || "Unassigned"}</div>
            <div className="mt-3 text-xs text-muted-foreground">
              Status: <span className="font-mono">{phase.status}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tasks</CardTitle>
              <CardDescription>
                Kanban for this phase. Move tasks between columns to update status.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Kanban phaseId={phase.id} initialTasks={tasks} />
        </CardContent>
      </Card>
    </div>
  );
}

const COLUMNS = [
  { key: "backlog", label: "Backlog" },
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "review", label: "In review" },
  { key: "done", label: "Done" },
];

function Kanban({ phaseId, initialTasks }: { phaseId: string; initialTasks: any[] }) {
  const [tasks, setTasks] = React.useState(initialTasks);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);

  async function moveTask(taskId: string, newStatus: string) {
    setTasks((curr) =>
      curr.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (e) {
      // revert
      const original = initialTasks.find((t) => t.id === taskId);
      if (original) {
        setTasks((curr) =>
          curr.map((t) => (t.id === taskId ? original : t))
        );
      }
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
      {COLUMNS.map((col) => {
        const items = tasks.filter((t) => t.status === col.key);
        return (
          <div
            key={col.key}
            className={cn(
              "rounded-lg border bg-muted/20 p-3 min-h-[200px] transition-colors",
              draggingId && "border-dashed"
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (draggingId) moveTask(draggingId, col.key);
              setDraggingId(null);
            }}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {col.label}
              </div>
              <div className="rounded-full bg-muted px-1.5 text-[10px] font-mono">
                {items.length}
              </div>
            </div>
            <div className="space-y-2">
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
  );
}

function KanbanCard({
  task,
  onDragStart,
  onDragEnd,
}: {
  task: any;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const priorityColors = {
    p0: "bg-red-500/10 text-red-600 dark:text-red-400",
    p1: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    p2: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    p3: "bg-muted text-muted-foreground",
  } as const;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="cursor-grab rounded-md border bg-card p-2.5 text-sm shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium leading-snug">{task.title}</div>
        <div
          className={cn(
            "shrink-0 rounded px-1 py-0.5 text-[10px] font-mono uppercase",
            priorityColors[task.priority as keyof typeof priorityColors] || priorityColors.p3
          )}
        >
          {task.priority}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="truncate">{task.owner || "Unassigned"}</span>
        {task.storyPoints && <span className="font-mono">{task.storyPoints} SP</span>}
      </div>
    </div>
  );
}
