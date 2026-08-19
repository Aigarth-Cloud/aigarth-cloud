"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  FolderOpen,
  Layers,
  ListChecks,
  Rocket,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Badge } from "@aigarth/ui";

type Phase = { id: string; number: number; name: string; status: string; progress: number; description: string };
type Task = { id: string; phaseId: string; title: string; status: string; priority: string; owner: string };
type Doc = { id: string; path: string; title: string; description: string; category: string; status: string };
type Activity = { id: string; type: string; message: string; createdAt: string; actor: string };

export function OverviewView({
  phases,
  tasks,
  docs,
  activity,
  stats,
}: {
  phases: Phase[];
  tasks: Task[];
  docs: Doc[];
  activity: Activity[];
  stats: {
    totalTasks: number;
    doneTasks: number;
    pct: number;
    totalPhases: number;
    inProgressPhases: number;
    completePhases: number;
  };
}) {
  const inProgressPhases = phases.filter((p) => p.status === "in_progress");
  const nextPhases = phases
    .filter((p) => p.status === "not_started")
    .sort((a, b) => a.number - b.number)
    .slice(0, 3);

  return (
    <div className="space-y-8">
      <PageHeader />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Overall progress"
          value={`${stats.pct}%`}
          icon={TrendingUp}
          hint={`${stats.doneTasks} / ${stats.totalTasks} tasks done`}
          accent="primary"
        />
        <StatCard
          label="In progress"
          value={String(stats.inProgressPhases)}
          icon={Rocket}
          hint={`${stats.totalPhases} phases total`}
          accent="amber"
        />
        <StatCard
          label="Documents"
          value={String(docs.length)}
          icon={FileText}
          hint="All in workspace/now/docs/"
          accent="emerald"
        />
        <StatCard
          label="Open tasks"
          value={String(stats.totalTasks - stats.doneTasks)}
          icon={ListChecks}
          hint="Across all phases"
          accent="blue"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Phases</CardTitle>
            <CardDescription>
              All 16 phases from the engineering roadmap. Click into any phase for its tasks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {phases.map((p) => (
                <PhaseRow key={p.id} phase={p} />
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Last 10 events in the tracker</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {activity.slice(0, 10).map((a) => (
                  <li key={a.id} className="flex items-start gap-2.5 text-sm">
                    <span
                      className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                        a.type === "task_completed"
                          ? "bg-emerald-500"
                          : a.type === "task_created"
                          ? "bg-garden-500"
                          : a.type === "doc_added"
                          ? "bg-amber-500"
                          : "bg-muted-foreground"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="leading-snug">{a.message}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(a.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Next up</CardTitle>
              <CardDescription>Phases about to start</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {nextPhases.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-xs font-mono">
                      {p.number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.description}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-medium tracking-tight">Overview</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Live state of the Aigarth Cloud build. Source of truth for what's outstanding.
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  hint: string;
  accent: "primary" | "amber" | "emerald" | "blue";
}) {
  const accentClass = {
    primary: "bg-primary/10 text-primary",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    blue: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  }[accent];

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accentClass}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3 text-2xl font-medium tracking-tight">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      </CardContent>
    </Card>
  );
}

function PhaseRow({ phase }: { phase: Phase }) {
  const statusIcon = {
    complete: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    in_progress: <Rocket className="h-4 w-4 text-amber-500" />,
    blocked: <Clock className="h-4 w-4 text-red-500" />,
    not_started: <Circle className="h-4 w-4 text-muted-foreground" />,
  }[phase.status] || <Circle className="h-4 w-4 text-muted-foreground" />;

  return (
    <Link
      href={`/phases/${phase.id}`}
      className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-mono">
        {phase.number}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{phase.name}</span>
          {statusIcon}
        </div>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${
              phase.status === "complete"
                ? "bg-emerald-500"
                : phase.status === "in_progress"
                ? "bg-amber-500"
                : phase.status === "blocked"
                ? "bg-red-500"
                : "bg-garden-500/40"
            }`}
            style={{ width: `${phase.progress}%` }}
          />
        </div>
      </div>
      <div className="w-12 shrink-0 text-right text-xs font-mono text-muted-foreground">
        {phase.progress}%
      </div>
    </Link>
  );
}
