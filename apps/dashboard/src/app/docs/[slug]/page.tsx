import { notFound } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import { getDoc } from "@/lib/repo";
import { DocDetailView } from "@/components/pages/doc-detail";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { slug: string };
}

/**
 * /docs/[slug] — render a single doc.
 *
 * The slug is the URL-encoded stored `path` of the doc. The stored
 * paths follow the `../../docs/...` convention (relative to
 * apps/dashboard/scripts/ when seeded by update-phase-*.ts and
 * seed.ts).
 *
 * We try the stored path first; if the row doesn't exist we
 * canonicalize the path (strip leading `../../`) and try again.
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

  // Resolve the actual file on disk. Stored paths are relative to
  // apps/dashboard/scripts/ — i.e. `../../docs/PRD.md` is at
  // <repo>/docs/PRD.md. The dashboard runs from apps/dashboard, so
  // process.cwd() is there; the project root is two levels up.
  const projectRoot = path.resolve(process.cwd(), "..", "..");
  const storedRel = doc.path.replace(/^\.\.\/\.\.\//, "").replace(/^\.\.\//, "");
  const absPath = path.resolve(projectRoot, storedRel);

  let content = "";
  try {
    content = fs.readFileSync(absPath, "utf-8");
  } catch {
    notFound();
  }

  return <DocDetailView doc={doc} content={content} />;
}

/**
 * Given a path that may have been URL-encoded from any number of
 * historical conventions, return the candidate strings to look up.
 * Order matters: prefer the most-canonical form first.
 */
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
  // Use-case friendly aliases: a slug like "use-case-video-synthesis"
  // is meant to refer to docs/use-cases/video-synthesis[-eval].md.
  // Convention:
  //   - bare slug `use-case-X`        → detailed doc (X-eval.md first, then X.md)
  //   - `-blog` suffix `use-case-X-blog` → marketing article (X.md, NOT -eval)
  if (input.startsWith("use-case-") || input.startsWith("../use-case-") || input.startsWith("../../use-case-")) {
    const cleaned = input
      .replace(/^\.\.\//, "")
      .replace(/^\.\.\/\.\.\//, "")
      .replace(/^use-case-/, "");
    const isBlogAlias = cleaned.endsWith("-blog");
    const isProposalAlias = !isBlogAlias && cleaned.endsWith("-proposal");
    const stem = isBlogAlias
      ? cleaned.replace(/-blog$/, "")
      : isProposalAlias
      ? cleaned.replace(/-proposal$/, "")
      : cleaned;
    if (isBlogAlias) {
      // Blog alias: only the plain (non-eval) doc.
      push(`../../docs/use-cases/${stem}.md`);
      push(`docs/use-cases/${stem}.md`);
    } else if (isProposalAlias) {
      // Proposal alias: only the original proposal doc.
      push(`../../docs/use-cases/${stem}-proposal.md`);
      push(`docs/use-cases/${stem}-proposal.md`);
    } else {
      // Default alias: detailed doc first, plain as fallback.
      push(`../../docs/use-cases/${stem}-eval.md`);
      push(`../../docs/use-cases/${stem}.md`);
      push(`docs/use-cases/${stem}-eval.md`);
      push(`docs/use-cases/${stem}.md`);
    }
  }
  return out;
}
