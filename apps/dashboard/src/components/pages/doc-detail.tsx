"use client";

import * as React from "react";
import Link from "next/link";
import { Badge, Card, CardContent, CardHeader } from "@aigarth/ui";
import { ArrowLeft, Clock, FileText } from "lucide-react";
import { MarkdownArticle } from "../markdown-renderer";

type Doc = {
  id: string;
  path: string;
  title: string;
  description: string;
  category: string;
  status: string;
  readTimeMinutes: number;
};

/**
 * Render the doc detail. The markdown parsing + rendering now lives
 * in `../markdown-renderer` (Phase 15 v1) so the blog / tutorials /
 * academy surfaces can share the same block set.
 */
export function DocDetailView({ doc, content }: { doc: Doc; content: string }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/docs"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          All documents
        </Link>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{doc.category}</Badge>
          <Badge variant={doc.status === "final" ? "success" : "warning"}>{doc.status}</Badge>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {doc.readTimeMinutes} min read
          </span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-2xl font-medium tracking-tight">{doc.title}</h1>
              {doc.description && (
                <p className="mt-1 text-sm text-muted-foreground">{doc.description}</p>
              )}
              <div className="mt-1 font-mono text-[10px] text-muted-foreground/70">
                {doc.path}
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

