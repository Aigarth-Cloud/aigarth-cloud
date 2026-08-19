import { notFound } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import { getDoc } from "@/lib/repo";
import { parseFrontmatter } from "@/lib/frontmatter";
import { BlogDetailView } from "@/components/pages/blog-detail";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { slug: string };
}

/**
 * /blog/[slug] — render a single blog post. The slug is the
 * URL-encoded stored `path` of the doc. We try the stored path
 * first; if the row doesn't exist we canonicalize the path
 * (strip leading `../../`) and try again. (Same path-resolution
 * pattern as /docs/[slug].)
 */
export default function Page({ params }: PageProps) {
  const raw = decodeURIComponent(params.slug);
  const candidates = canonicalizePathVariants(raw);

  let doc = null;
  for (const candidate of candidates) {
    doc = getDoc(candidate);
    if (doc) break;
  }
  if (!doc) notFound();

  const projectRoot = path.resolve(process.cwd(), "..", "..");
  const storedRel = doc.path.replace(/^\.\.\/\.\.\//, "").replace(/^\.\.\//, "");
  const absPath = path.resolve(projectRoot, storedRel);

  let content = "";
  let frontmatter = {};
  try {
    const raw = fs.readFileSync(absPath, "utf-8");
    const parsed = parseFrontmatter(raw);
    content = parsed.body;
    frontmatter = parsed.frontmatter;
  } catch {
    notFound();
  }

  return <BlogDetailView doc={doc} content={content} frontmatter={frontmatter} />;
}

function canonicalizePathVariants(input: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (s: string) => {
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  };
  push(input);
  push(input.replace(/^\.\.\/\.\.\//, ""));
  push(input.replace(/^\.\.\/\.\.\/docs\//, "../../docs/"));
  push(input.replace(/^docs\//, "../../docs/"));
  push(`../../${input.replace(/^\.\.\//, "")}`);
  return out;
}
