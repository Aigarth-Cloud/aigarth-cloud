"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from "@aigarth/ui";
import { BookOpen, Clock, ArrowRight, Code2 } from "lucide-react";
import type { Frontmatter } from "@/lib/frontmatter";

type Doc = {
  id: string;
  path: string;
  title: string;
  description: string;
  category: string;
  status: string;
  readTimeMinutes: number;
  order: number;
};

type Tutorial = Doc & {
  frontmatter: Frontmatter;
  runnable: boolean;
};

/**
 * /tutorials — step-by-step runnable guides. A tutorial's
 * `runnable` flag is set when the file's frontmatter has
 * `runnable: true` (or, more loosely, when the body contains a
 * fenced code block — the latter is a heuristic fallback so
 * older files without frontmatter still get the badge).
 */
export function TutorialsView({ tutorials }: { tutorials: Tutorial[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Tutorials</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tutorials.length} {tutorials.length === 1 ? "tutorial" : "tutorials"} — step-by-step guides, copy-paste runnable.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {tutorials.map((t) => {
          const tags = Array.isArray(t.frontmatter.tags) ? t.frontmatter.tags : [];
          return (
            <Link
              key={t.path}
              href={`/tutorials/${encodeURIComponent(t.path)}`}
              className="group block"
            >
              <Card className="h-full transition-all hover:border-garden-500/50">
                <CardHeader>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />
                      Tutorial
                    </span>
                    {t.runnable && (
                      <Badge variant="success" className="text-[10px]">
                        <Code2 className="mr-0.5 inline h-2.5 w-2.5" /> Runnable
                      </Badge>
                    )}
                    <span className="ml-auto">{t.readTimeMinutes} min</span>
                  </div>
                  <CardTitle className="mt-3 text-lg">{t.title}</CardTitle>
                  <CardDescription className="line-clamp-3 min-h-[3.5rem]">
                    {t.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {tags.slice(0, 4).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                      Open <ArrowRight className="h-3 w-3" />
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
