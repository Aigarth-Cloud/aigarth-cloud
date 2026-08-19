import { notFound } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import { getDoc } from "@/lib/repo";
import { parseFrontmatter } from "@/lib/frontmatter";
import { AcademyDetailView, type LessonRef } from "@/components/pages/academy-detail";

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
  let lessonsRaw: string[] = [];
  try {
    const raw = fs.readFileSync(absPath, "utf-8");
    const parsed = parseFrontmatter(raw);
    content = parsed.body;
    frontmatter = parsed.frontmatter;
    const raw2 = parsed.frontmatter.lessons;
    if (Array.isArray(raw2)) {
      lessonsRaw = raw2.map(String);
    }
  } catch {
    notFound();
  }

  const lessons: LessonRef[] = lessonsRaw
    .map((p) => {
      const lesson = getDoc(p);
      if (!lesson) return null;
      return {
        path: lesson.path,
        title: lesson.title,
        description: lesson.description,
        readTimeMinutes: lesson.readTimeMinutes,
      };
    })
    .filter((l): l is LessonRef => l !== null);

  return (
    <AcademyDetailView
      doc={doc}
      content={content}
      frontmatter={frontmatter}
      lessons={lessons}
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
