"use client";

/**
 * Hand-rolled markdown renderer — shared by /docs, /blog,
 * /tutorials, and /academy. Extracted from doc-detail.tsx in
 * Phase 15 v1 so the new surfaces can render the same block set
 * (headings, paragraphs, fenced code, lists, tables, hr, blockquote)
 * with the same inline formatting (**bold**, *italic*, `code`,
 * [link](url)).
 *
 * Not a full CommonMark implementation — just the patterns that
 * show up in the project's docs. The original doc-detail.tsx
 * remains the canonical consumer; this module is a sibling that
 * re-exports the same primitives.
 */

import * as React from "react";
import { cn } from "@aigarth/utils";

export type Block =
  | { kind: "h"; level: 1 | 2 | 3 | 4; text: string; id: string }
  | { kind: "p"; text: string; id: string }
  | { kind: "code"; lang: string; text: string; id: string }
  | { kind: "ul"; items: string[]; id: string }
  | { kind: "ol"; items: string[]; id: string }
  | { kind: "table"; rows: string[][]; id: string }
  | { kind: "hr"; id: string }
  | { kind: "quote"; text: string; id: string };

export function parseMarkdown(src: string): Block[] {
  const lines = src.split(/\r?\n/);
  const blocks: Block[] = [];
  let i = 0;
  let id = 0;
  const nextId = () => `b${id++}`;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!line.trim()) {
      i++;
      continue;
    }

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").startsWith("```")) {
        codeLines.push(lines[i] ?? "");
        i++;
      }
      i++;
      blocks.push({ kind: "code", lang, text: codeLines.join("\n"), id: nextId() });
      continue;
    }

    const h = line.match(/^(#{1,4})\s+(.+)$/);
    if (h) {
      const level = h[1]!.length as 1 | 2 | 3 | 4;
      blocks.push({ kind: "h", level, text: h[2]!.trim(), id: nextId() });
      i++;
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      blocks.push({ kind: "hr", id: nextId() });
      i++;
      continue;
    }

    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i] ?? "").startsWith("> ")) {
        quoteLines.push((lines[i] ?? "").slice(2));
        i++;
      }
      blocks.push({ kind: "quote", text: quoteLines.join(" "), id: nextId() });
      continue;
    }

    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      const tableRows: string[][] = [];
      while (
        i < lines.length &&
        (lines[i] ?? "").trim().startsWith("|") &&
        (lines[i] ?? "").trim().endsWith("|")
      ) {
        const row = (lines[i] ?? "")
          .trim()
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim());
        tableRows.push(row);
        i++;
      }
      if (tableRows.length >= 2 && /^-+$/.test((tableRows[1]?.[0] ?? "").replace(/-+/g, "-"))) {
        tableRows.splice(1, 1);
      }
      if (tableRows.length > 0) blocks.push({ kind: "table", rows: tableRows, id: nextId() });
      continue;
    }

    if (/^(\s*)[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^(\s*)[-*+]\s+/.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ul", items, id: nextId() });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ol", items, id: nextId() });
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() &&
      !/^(#{1,4}\s|```|---+$|> |\|.*\|$|\s*[-*+]\s|\s*\d+\.\s)/.test(lines[i] ?? "")
    ) {
      paraLines.push(lines[i] ?? "");
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ kind: "p", text: paraLines.join(" "), id: nextId() });
    }
  }

  return blocks;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  const push = (s: string) => {
    if (!s) return;
    parts.push(<React.Fragment key={key++}>{s}</React.Fragment>);
  };

  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/;
  while (i < text.length) {
    const rest = text.slice(i);
    const m = rest.match(re);
    if (!m || m.index === undefined) {
      push(text.slice(i));
      break;
    }
    push(text.slice(i, i + m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      parts.push(<code key={key++}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("[")) {
      const linkMatch = token.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        parts.push(
          <a
            key={key++}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:no-underline"
          >
            {linkMatch[1]}
          </a>,
        );
      } else {
        push(token);
      }
    } else if (token.startsWith("*")) {
      parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
    } else {
      push(token);
    }
    i += m.index + token.length;
  }
  return parts;
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case "h": {
      const cls = cn(
        block.level === 1 && "mt-8 text-2xl font-semibold tracking-tight first:mt-0",
        block.level === 2 && "mt-6 text-xl font-semibold tracking-tight first:mt-0 border-b pb-1.5",
        block.level === 3 && "mt-5 text-lg font-semibold first:mt-0",
        block.level === 4 && "mt-4 text-base font-semibold first:mt-0",
      );
      if (block.level === 1) return <h1 id={block.id} className={cls}>{renderInline(block.text)}</h1>;
      if (block.level === 2) return <h2 id={block.id} className={cls}>{renderInline(block.text)}</h2>;
      if (block.level === 3) return <h3 id={block.id} className={cls}>{renderInline(block.text)}</h3>;
      return <h4 id={block.id} className={cls}>{renderInline(block.text)}</h4>;
    }
    case "p":
      return <p className="my-3 text-sm leading-relaxed text-foreground/90">{renderInline(block.text)}</p>;
    case "code":
      return (
        <pre
          key={block.id}
          className="my-4 overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed"
        >
          <code className={block.lang ? `language-${block.lang}` : undefined}>{block.text}</code>
        </pre>
      );
    case "ul":
      return (
        <ul key={block.id} className="my-3 ml-6 list-disc space-y-1 text-sm">
          {block.items.map((it, i) => (
            <li key={i}>{renderInline(it)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={block.id} className="my-3 ml-6 list-decimal space-y-1 text-sm">
          {block.items.map((it, i) => (
            <li key={i}>{renderInline(it)}</li>
          ))}
        </ol>
      );
    case "table": {
      const [header, ...body] = block.rows;
      return (
        <div key={block.id} className="my-4 overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            {header && (
              <thead>
                <tr className="border-b bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  {header.map((c, i) => (
                    <th key={i} className="px-3 py-2 text-left font-medium">{c}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri} className="border-b last:border-0">
                  {row.map((c, i) => (
                    <td key={i} className="px-3 py-2 align-top">{renderInline(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "hr":
      return <hr key={block.id} className="my-6 border-border" />;
    case "quote":
      return (
        <blockquote
          key={block.id}
          className="my-3 border-l-2 border-primary/40 pl-3 italic text-muted-foreground"
        >
          {renderInline(block.text)}
        </blockquote>
      );
  }
}

/**
 * Render the parsed markdown blocks inside a `<article>` with the
 * shared `prose-doc` style hook. The host page (e.g. /docs/[slug],
 * /blog/[slug], /tutorials/[slug], /academy/[slug]) wraps this in
 * the surrounding chrome (header, back link, side nav, etc.).
 */
export function MarkdownArticle({ content }: { content: string }) {
  const blocks = React.useMemo(() => parseMarkdown(content), [content]);
  return (
    <article className="prose-doc">
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </article>
  );
}
