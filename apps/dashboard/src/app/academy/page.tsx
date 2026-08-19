import fs from "node:fs";
import path from "node:path";
import { listDocsByPathPrefix, getDoc } from "@/lib/repo";
import { parseFrontmatter, type Frontmatter } from "@/lib/frontmatter";
import { AcademyView, type LessonRef } from "@/components/pages/academy";

export const dynamic = "force-dynamic";

/**
 * /academy — listing of curated learning paths. Each path is a
 * markdown file under docs/academy/ whose frontmatter lists its
 * lessons under the `lessons:` key (either a bracketed YAML list
 * or a bare comma-separated list — both work):
 *
 *   ---
 *   title: "Getting Started with Aigarth"
 *   difficulty: beginner
 *   estimatedMinutes: 90
 *   lessons: ../../docs/PRD.md, ../../docs/DEVELOPER-GUIDE.md
 *   ---
 *
 * The lesson's `path` is resolved against the Doc store at render
 * time, so changing the order in a path doc instantly reorders
 * the displayed curriculum.
 */
export default function Page() {
  const docs = listDocsByPathPrefix("../../docs/academy/");
  const projectRoot = path.resolve(process.cwd(), "..", "..");

  const paths = docs.map((d) => {
    const storedRel = d.path.replace(/^\.\.\/\.\.\//, "").replace(/^\.\.\//, "");
    const absPath = path.resolve(projectRoot, storedRel);
    let frontmatter: Frontmatter = {};
    let lessonsRaw: string[] = [];
    try {
      const content = fs.readFileSync(absPath, "utf-8");
      frontmatter = parseFrontmatter(content).frontmatter;
      const raw = frontmatter.lessons;
      if (Array.isArray(raw)) {
        lessonsRaw = raw.map(String);
      }
    } catch {
      // file missing on disk; render the row with empty lessons
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

    return { ...d, frontmatter, lessons };
  });

  return <AcademyView paths={paths} />;
}
