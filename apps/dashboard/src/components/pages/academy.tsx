"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from "@aigarth/ui";
import { GraduationCap, Clock, ArrowRight, BookOpen } from "lucide-react";
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

type AcademyPath = Doc & {
  frontmatter: Frontmatter;
  lessons: LessonRef[];
};

type LessonRef = {
  path: string;
  title: string;
  description: string;
  readTimeMinutes: number;
};

export type { LessonRef };

/**
 * /academy — listing of curated learning paths. Each path is a
 * markdown file under docs/academy/ whose frontmatter lists its
 * lessons under the `lessons:` block:
 *
 *   ---
 *   title: "Getting Started with Aigarth"
 *   difficulty: beginner
 *   estimatedMinutes: 90
 *   lessons:
 *     - path: "../../docs/PRD.md"
 *       title: "Product Requirements Document"
 *     - path: "../../docs/DEVELOPER-GUIDE.md"
 *       title: "Developer Guide"
 *   ---
 *
 * The lesson's `path` is resolved against the Doc store at render
 * time, so changing the order in a path doc instantly reorders
 * the displayed curriculum.
 */
export function AcademyView({ paths }: { paths: AcademyPath[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Academy</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {paths.length} curated learning {paths.length === 1 ? "path" : "paths"} — read in order, or jump to the lesson you need.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {paths.map((p) => {
          const totalMinutes = p.lessons.reduce((s, l) => s + l.readTimeMinutes, 0);
          const difficulty = (p.frontmatter.difficulty as string) || "beginner";
          return (
            <Link
              key={p.path}
              href={`/academy/${encodeURIComponent(p.path)}`}
              className="group block"
            >
              <Card className="h-full transition-all hover:border-garden-500/50">
                <CardHeader>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <GraduationCap className="h-3 w-3" />
                      Learning path
                    </span>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {String(difficulty)}
                    </Badge>
                    <span className="ml-auto flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {totalMinutes} min · {p.lessons.length} lessons
                    </span>
                  </div>
                  <CardTitle className="mt-3 text-lg">{p.title}</CardTitle>
                  <CardDescription className="line-clamp-3 min-h-[3.5rem]">
                    {p.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <BookOpen className="h-3 w-3" />
                      <span>
                        {p.lessons.length === 0
                          ? "no lessons yet"
                          : `${p.lessons.length} lesson${p.lessons.length === 1 ? "" : "s"}`}
                      </span>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                      Start <ArrowRight className="h-3 w-3" />
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
