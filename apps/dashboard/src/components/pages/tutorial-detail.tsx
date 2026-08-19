"use client";

import * as React from "react";
import Link from "next/link";
import { Badge, Card, CardContent, CardHeader } from "@aigarth/ui";
import { ArrowLeft, BookOpen, Clock, Code2 } from "lucide-react";
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

export function TutorialDetailView({
  doc,
  content,
  frontmatter,
  runnable,
}: {
  doc: Doc;
  content: string;
  frontmatter: Frontmatter;
  runnable: boolean;
}) {
  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/tutorials"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          All tutorials
        </Link>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {runnable && (
            <Badge variant="success" className="text-[10px]">
              <Code2 className="mr-0.5 inline h-2.5 w-2.5" /> Runnable
            </Badge>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {doc.readTimeMinutes} min
          </span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
              <BookOpen className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-medium tracking-tight">{doc.title}</h1>
              {doc.description && (
                <p className="mt-1 text-sm text-muted-foreground">{doc.description}</p>
              )}
              {tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <MarkdownArticle content={content} />
        </CardContent>
      </Card>
    </div>
  );
}
