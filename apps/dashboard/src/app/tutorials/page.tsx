import fs from "node:fs";
import path from "node:path";
import { listDocsByPathPrefix } from "@/lib/repo";
import { parseFrontmatter, type Frontmatter } from "@/lib/frontmatter";
import { TutorialsView } from "@/components/pages/tutorials";

export const dynamic = "force-dynamic";

/**
 * /tutorials — listing of step-by-step guides under docs/tutorials/.
 * Each tutorial's `runnable` flag is set when the frontmatter has
 * `runnable: true`; if the file has no frontmatter, we fall back
 * to "the body contains a fenced code block" as a heuristic so
 * older guides still get the badge.
 */
export default function Page() {
  const docs = listDocsByPathPrefix("../../docs/tutorials/");
  const projectRoot = path.resolve(process.cwd(), "..", "..");

  const tutorials = docs.map((d) => {
    const storedRel = d.path.replace(/^\.\.\/\.\.\//, "").replace(/^\.\.\//, "");
    const absPath = path.resolve(projectRoot, storedRel);
    let frontmatter: Frontmatter = {};
    let runnable = false;
    try {
      const content = fs.readFileSync(absPath, "utf-8");
      const parsed = parseFrontmatter(content);
      frontmatter = parsed.frontmatter;
      // Explicit frontmatter wins; otherwise any fenced code block
      // is enough to flip the badge on.
      if (typeof frontmatter.runnable === "string") {
        runnable = frontmatter.runnable.toLowerCase() === "true";
      } else {
        runnable = /```[\s\S]*?```/.test(parsed.body);
      }
    } catch {
      // file missing on disk; render the row with empty frontmatter
    }
    return { ...d, frontmatter, runnable };
  });

  return <TutorialsView tutorials={tutorials} />;
}
