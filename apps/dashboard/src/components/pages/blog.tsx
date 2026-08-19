"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from "@aigarth/ui";
import { Calendar, User, ArrowRight } from "lucide-react";
import { cn } from "@aigarth/utils";
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

type BlogPost = Doc & {
  frontmatter: Frontmatter;
};

/**
 * /blog — listing of engineering + product blog posts. Each post
 * is a markdown file under docs/blog/ with frontmatter (title /
 * date / author / tags) parsed at render time.
 *
 * Posts are sorted newest-first by frontmatter date (or by the
 * existing `ord` field as the tiebreaker), so the headline isn't
 * pinned to whatever happens to be alphabetically first.
 */
export function BlogView({ posts }: { posts: BlogPost[] }) {
  const sorted = React.useMemo(() => {
    return [...posts].sort((a, b) => {
      const ad = a.frontmatter.date ? Date.parse(a.frontmatter.date) : 0;
      const bd = b.frontmatter.date ? Date.parse(b.frontmatter.date) : 0;
      if (Number.isFinite(ad) && Number.isFinite(bd) && ad !== bd) return bd - ad;
      return a.order - b.order;
    });
  }, [posts]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Blog</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {posts.length} {posts.length === 1 ? "post" : "posts"} — engineering, product, and the people shipping Aigarth Cloud.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {sorted.map((p) => {
          const date = p.frontmatter.date;
          const author = p.frontmatter.author;
          const tags = Array.isArray(p.frontmatter.tags) ? p.frontmatter.tags : [];
          return (
            <Link
              key={p.path}
              href={`/blog/${encodeURIComponent(p.path)}`}
              className="group block"
            >
              <Card className="h-full transition-all hover:border-garden-500/50">
                <CardHeader>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
                    <span className="ml-auto">{p.readTimeMinutes} min</span>
                  </div>
                  <CardTitle className="mt-3 text-lg">{p.title}</CardTitle>
                  <CardDescription className="line-clamp-3 min-h-[3.5rem]">
                    {p.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((t) => (
                        <Badge key={t} variant="outline" className="text-[10px]">
                          {t}
                        </Badge>
                      ))}
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                      Read <ArrowRight className="h-3 w-3" />
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

function formatDate(s: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
