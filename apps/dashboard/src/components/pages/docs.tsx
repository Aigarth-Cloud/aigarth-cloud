"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Badge } from "@aigarth/ui";
import { FileText, Clock, BookOpen } from "lucide-react";
import { cn } from "@aigarth/utils";

type Doc = {
  id: string;
  path: string;
  title: string;
  description: string;
  category: string;
  status: string;
  readTimeMinutes: number;
};

const CATEGORIES = [
  { key: "Product", color: "bg-garden-500/10 text-garden-600 dark:text-garden-400" },
  { key: "Business", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  { key: "Engineering", color: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  { key: "Security", color: "bg-red-500/10 text-red-600 dark:text-red-400" },
  { key: "Operations", color: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  { key: "Brand", color: "bg-pink-500/10 text-pink-600 dark:text-pink-400" },
  { key: "Reference", color: "bg-stone-500/10 text-stone-600 dark:text-stone-400" },
];

export function DocsView({ docs }: { docs: Doc[] }) {
  const [filter, setFilter] = React.useState<string>("all");

  const filtered = filter === "all" ? docs : docs.filter((d) => d.category === filter);
  const byCategory = CATEGORIES.map((cat) => ({
    ...cat,
    docs: docs.filter((d) => d.category === cat.key),
  })).filter((c) => c.docs.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {docs.length} foundational documents. All written in <code className="rounded bg-muted px-1 py-0.5 text-xs">workspace/now/docs/</code>.
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
          All ({docs.length})
        </button>
        {byCategory.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              filter === c.key
                ? "border-garden-500 bg-garden-500/10 text-garden-700 dark:text-garden-300"
                : "border-border hover:bg-accent"
            )}
          >
            {c.key} ({c.docs.length})
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((d) => {
          const cat = CATEGORIES.find((c) => c.key === d.category);
          return (
            <Link key={d.path} href={`/docs/${encodeURIComponent(d.path)}`} className="group block">
              <Card className="h-full transition-all hover:border-garden-500/50">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-4 w-4" />
                    </div>
                    <Badge
                      variant={d.status === "final" ? "success" : "warning"}
                    >
                      {d.status}
                    </Badge>
                  </div>
                  <CardTitle className="mt-4 text-base">{d.title}</CardTitle>
                  <CardDescription className="line-clamp-2 min-h-[2.5rem]">
                    {d.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-xs">
                    <span className={cn("rounded px-1.5 py-0.5", cat?.color)}>
                      {d.category}
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {d.readTimeMinutes} min read
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
