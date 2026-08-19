/**
 * Minimal frontmatter parser — used by the blog, tutorials, and
 * academy surfaces (Phase 15 v1) to extract metadata from the top
 * of a markdown file.
 *
 * Format: a YAML-ish block at the top of the file, fenced by `---`
 * on its own line. Supports:
 *   - string values
 *   - list values: `[a, b, c]` (returns string[])
 *   - date values: ISO date or "Month DD, YYYY" (returns a Date)
 *
 * Anything we don't recognise is preserved as a string. The
 * frontmatter block is stripped from the returned body so the
 * markdown renderer doesn't see it.
 *
 * Deliberately not a full YAML parser — the doc files in
 * docs/blog/, docs/tutorials/, docs/academy/ use a small,
 * consistent shape and adding a YAML dep isn't worth it.
 */

export interface Frontmatter {
  title?: string;
  date?: string;
  author?: string;
  tags?: string[];
  /** Free-form pass-through for any other keys. */
  [key: string]: string | string[] | undefined;
}

export interface ParsedMarkdown {
  frontmatter: Frontmatter;
  body: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseFrontmatter(src: string): ParsedMarkdown {
  const m = FRONTMATTER_RE.exec(src);
  if (!m) {
    return { frontmatter: {}, body: src };
  }
  const block = m[1] ?? "";
  const body = m[2] ?? "";
  return { frontmatter: parseBlock(block), body };
}

function parseBlock(block: string): Frontmatter {
  const out: Frontmatter = {};
  const lines = block.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Match `key: value` (with optional quotes around the value).
    const m = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(trimmed);
    if (!m) continue;
    const key = m[1]!;
    const raw = (m[2] ?? "").trim();
    if (raw.startsWith("[") && raw.endsWith("]")) {
      // List value: `[a, b, c]` (commas are optional if items are quoted).
      const inner = raw.slice(1, -1).trim();
      const items = inner
        .split(/,\s*/)
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      out[key] = items;
    } else if (raw.includes(",") && !raw.startsWith("\"") && !raw.startsWith("'")) {
      // Bare comma-separated list, e.g. `lessons: a.md, b.md`. Useful
      // for academy paths that want a flat list of lesson paths
      // without the YAML bracket-list syntax.
      const items = raw
        .split(/,\s*/)
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      out[key] = items;
    } else if (raw.startsWith("\"") || raw.startsWith("'")) {
      // Quoted string.
      out[key] = raw.slice(1, -1);
    } else {
      out[key] = raw;
    }
  }
  return out;
}

/** Pull a string list of tags out of a frontmatter record. */
export function frontmatterTags(fm: Frontmatter): string[] {
  const t = fm.tags;
  return Array.isArray(t) ? t : [];
}
