import fs from "node:fs";
import path from "node:path";
import { listDocsByPathPrefix, getDoc } from "@/lib/repo";
import { parseFrontmatter, type Frontmatter } from "@/lib/frontmatter";
import { BlogView } from "@/components/pages/blog";

export const dynamic = "force-dynamic";

/**
 * /blog — listing of all posts under docs/blog/. We seed the path
 * as `../../docs/blog/<file>.md` in the doc store; the markdown is
 * read fresh from disk so editing the file is reflected on the
 * next page load (no re-seed step needed).
 */
export default function Page() {
  const docs = listDocsByPathPrefix("../../docs/blog/");
  const projectRoot = path.resolve(process.cwd(), "..", "..");

  const posts = docs.map((d) => {
    const storedRel = d.path.replace(/^\.\.\/\.\.\//, "").replace(/^\.\.\//, "");
    const absPath = path.resolve(projectRoot, storedRel);
    let frontmatter: Frontmatter = {};
    try {
      const content = fs.readFileSync(absPath, "utf-8");
      frontmatter = parseFrontmatter(content).frontmatter;
    } catch {
      // file missing on disk; render the doc row with empty frontmatter
    }
    return { ...d, frontmatter };
  });

  return <BlogView posts={posts} />;
}
