"use client";

import * as React from "react";
import Link from "next/link";
import { Badge, Card, CardContent, CardHeader } from "@aigarth/ui";
import { ArrowLeft, Calendar, Clock, User } from "lucide-react";
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

export function BlogDetailView({
  doc,
  content,
  frontmatter,
}: {
  doc: Doc;
  content: string;
  frontmatter: Frontmatter;
}) {
  const date = frontmatter.date;
  const author = frontmatter.author;
  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          All blog posts
        </Link>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {doc.readTimeMinutes} min read
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-garden-500/10 text-garden-600">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-medium tracking-tight">{doc.title}</h1>
              {doc.description && (
                <p className="mt-1 text-sm text-muted-foreground">{doc.description}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(date)}
                  </span>
                )}
                {author && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {author}
                  </span>
                )}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <Badge key={t} variant="outline" className="text-[10px]">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
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

function formatDate(s: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
