import { notFound } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import { getDoc } from "@/lib/repo";
import { parseFrontmatter } from "@/lib/frontmatter";
import { TutorialDetailView } from "@/components/pages/tutorial-detail";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { slug: string };
}

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
  let runnable = false;
  try {
    const raw = fs.readFileSync(absPath, "utf-8");
    const parsed = parseFrontmatter(raw);
    content = parsed.body;
    frontmatter = parsed.frontmatter;
    if (typeof parsed.frontmatter.runnable === "string") {
      runnable = parsed.frontmatter.runnable.toLowerCase() === "true";
    } else {
      runnable = /```[\s\S]*?```/.test(content);
    }
  } catch {
    notFound();
  }

  return (
    <TutorialDetailView
      doc={doc}
      content={content}
      frontmatter={frontmatter}
      runnable={runnable}
    />
  );
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
