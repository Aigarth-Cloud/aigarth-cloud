"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, Badge } from "@aigarth/ui";
import { ArrowLeft, GraduationCap, Clock, BookOpen, ArrowRight } from "lucide-react";
import { MarkdownArticle } from "../markdown-renderer";
import type { Frontmatter } from "@/lib/frontmatter";

type Doc = {
  id: string;
  path: string;
  title: string;
  description: string;
  category: string;
  status: string;
  readTimeMinutes: number;
};

type LessonRef = {
  path: string;
  title: string;
  description: string;
  readTimeMinutes: number;
};

export type { LessonRef };

export function AcademyDetailView({
  doc,
  content,
  frontmatter,
  lessons,
}: {
  doc: Doc;
  content: string;
  frontmatter: Frontmatter;
  lessons: LessonRef[];
}) {
  const totalMinutes = lessons.reduce((s, l) => s + l.readTimeMinutes, 0);
  const difficulty = (frontmatter.difficulty as string) || "beginner";
  return (
    <div className="space-y-6">
      <Link
        href="/academy"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        All learning paths
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-garden-500/10 text-garden-600">
              <GraduationCap className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-medium tracking-tight">{doc.title}</h1>
              {doc.description && (
                <p className="mt-1 text-sm text-muted-foreground">{doc.description}</p>
              )}
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px] capitalize">
                  {String(difficulty)}
                </Badge>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {totalMinutes} min total · {lessons.length} lessons
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {content.trim() && (
            <div className="mb-6">
              <MarkdownArticle content={content} />
            </div>
          )}

          {lessons.length > 0 && (
            <div className="mt-2">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Lessons
              </h2>
              <ol className="space-y-2">
                {lessons.map((l, i) => (
                  <li key={l.path}>
                    <Link
                      href={`/docs/${encodeURIComponent(l.path)}`}
                      className="group flex items-start gap-3 rounded-md border bg-card/40 p-3 transition-colors hover:border-garden-500/50 hover:bg-accent/30"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{l.title}</span>
                          <span className="text-xs text-muted-foreground">· {l.readTimeMinutes} min</span>
                        </div>
                        {l.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {l.description}
                          </p>
                        )}
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
