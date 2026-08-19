"use client";

import * as React from "react";
import { Card, CardContent, Badge } from "@aigarth/ui";
import { Activity, CheckCircle2, FileText, Plus, Edit, AlertCircle } from "lucide-react";

type ActivityItem = {
  id: string;
  type: string;
  message: string;
  actor: string;
  createdAt: string;
};

const ICON_MAP = {
  task_completed: CheckCircle2,
  task_created: Plus,
  task_moved: Edit,
  task_updated: Edit,
  doc_added: FileText,
  asset_added: FileText,
  phase_updated: Edit,
  note: AlertCircle,
} as const;

const COLOR_MAP = {
  task_completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  task_created: "bg-garden-500/10 text-garden-600 dark:text-garden-400",
  task_moved: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  task_updated: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  doc_added: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  asset_added: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  phase_updated: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  note: "bg-stone-500/10 text-stone-600 dark:text-stone-400",
} as const;

export function ActivityView({ items }: { items: ActivityItem[] }) {
  // Group by day
  const byDay = new Map<string, ActivityItem[]>();
  for (const item of items) {
    const day = new Date(item.createdAt).toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(item);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every change in the tracker, in chronological order. The audit log of the build.
        </p>
      </div>

      <div className="space-y-8">
        {Array.from(byDay.entries()).map(([day, dayItems]) => (
          <div key={day}>
            <div className="mb-3 flex items-center gap-3">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {day}
              </div>
              <div className="h-px flex-1 bg-border" />
            </div>
            <ul className="space-y-2">
              {dayItems.map((item) => {
                const Icon = ICON_MAP[item.type as keyof typeof ICON_MAP] || Activity;
                const colorClass = COLOR_MAP[item.type as keyof typeof COLOR_MAP] || COLOR_MAP.note;
                return (
                  <li key={item.id}>
                    <Card>
                      <CardContent className="flex items-start gap-3 p-4">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colorClass}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm">{item.message}</div>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                            <span>·</span>
                            <span>{item.actor}</span>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {item.type.replace(/_/g, " ")}
                        </Badge>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
