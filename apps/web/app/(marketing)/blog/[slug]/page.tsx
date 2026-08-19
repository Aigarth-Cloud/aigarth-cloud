/**
 * /blog/[slug] : individual blog post.
 *
 * Posts are sourced from the in-repo `_posts.tsx` file (no CMS
 * yet). Each post supplies its own metadata and a JSX body, so the
 * visual treatment matches the rest of the marketing site.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { Badge, Button } from "@aigarth/ui";
import { MarketingPageHero } from "@/components/marketing/marketing-page";
import { POSTS_BY_SLUG, POSTS, type Post } from "../_posts";

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const post = POSTS_BY_SLUG[params.slug];
  if (!post) return { title: "Post not found" };
  return {
    title: post.title,
    description: post.excerpt,
  };
}

export default function PostPage({ params }: { params: { slug: string } }) {
  const post: Post | undefined = POSTS_BY_SLUG[params.slug];
  if (!post) notFound();

  const Body = post.Body;
  const idx = POSTS.findIndex((p) => p.slug === post.slug);
  const newer = idx > 0 ? POSTS[idx - 1] : null;
  const older = idx < POSTS.length - 1 ? POSTS[idx + 1] : null;

  return (
    <>
      <MarketingPageHero
        badge={post.category}
        title={post.title}
        description={post.excerpt}
      />

      <article className="border-b py-20 md:py-28">
        <div className="container-narrow max-w-3xl">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{post.date}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {post.readTime}
            </span>
            <span>By {post.author}</span>
          </div>

          <div className="mt-8">
            <Body />
          </div>

          <div className="mt-16 flex items-center justify-between border-t pt-8">
            {older ? (
              <Link
                href={`/blog/${older.slug}`}
                className="group flex max-w-[45%] flex-col gap-1"
              >
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Older
                </span>
                <span className="text-sm font-medium group-hover:text-primary">
                  <ArrowLeft className="mr-1 inline h-3 w-3" />
                  {older.title}
                </span>
              </Link>
            ) : (
              <span />
            )}
            {newer ? (
              <Link
                href={`/blog/${newer.slug}`}
                className="group flex max-w-[45%] flex-col items-end gap-1 text-right"
              >
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Newer
                </span>
                <span className="text-sm font-medium group-hover:text-primary">
                  {newer.title}
                </span>
              </Link>
            ) : (
              <span />
            )}
          </div>

          <div className="mt-10">
            <Link href="/blog">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowLeft className="h-3 w-3" />
                All posts
              </Button>
            </Link>
          </div>
        </div>
      </article>
    </>
  );
}
