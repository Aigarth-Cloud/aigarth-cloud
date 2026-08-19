"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, Badge, Separator } from "@aigarth/ui";
import { ArrowLeft, Calendar, CheckCircle2, Clock, FileText } from "lucide-react";

type Doc = {
  id: string;
  path: string;
  title: string;
  description: string;
  category: string;
  status: string;
  readTimeMinutes: number;
};

type Phase = {
  id: string;
  number: number;
  name: string;
  status: string;
  progress: number;
};

type Props = {
  doc: Doc;
  phase: Phase | null;
  content: string;
};

/**
 * Minimal markdown renderer for delivery reports. We don't want to
 * pull in a heavy markdown lib for this one page; the structure
 * is simple (headings, paragraphs, lists, tables, code).
 */
function renderMarkdown(md: string): React.ReactNode[] {
  const lines = md.split(/\r?\n/);
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const next = lines[i + 1] ?? "";

    // Code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").startsWith("```")) {
        codeLines.push(lines[i] ?? "");
        i++;
      }
      i++; // skip closing ```
      out.push(
        <pre
          key={key++}
          className="my-4 overflow-x-auto rounded-lg border bg-stone-50 px-4 py-3 text-sm dark:bg-stone-900/50"
        >
          {lang && (
            <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              {lang}
            </div>
          )}
          <code className="text-foreground">{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h && h[1] && h[2] !== undefined) {
      const level = h[1].length;
      const text = h[2];
      const cls =
        level === 1
          ? "text-3xl font-medium tracking-tight mt-2 mb-4"
          : level === 2
            ? "text-xl font-medium tracking-tight mt-10 mb-3 border-b pb-2"
            : level === 3
              ? "text-base font-semibold mt-6 mb-2"
              : level === 4
                ? "text-sm font-semibold mt-4 mb-2 text-muted-foreground uppercase tracking-wider"
                : "text-sm font-medium mt-3 mb-1";
      const Tag = (`h${level}` as unknown) as keyof React.JSX.IntrinsicElements;
      out.push(
        <Tag key={key++} className={cls}>
          {renderInline(text)}
        </Tag>,
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line)) {
      out.push(<Separator key={key++} className="my-6" />);
      i++;
      continue;
    }

    // Table
    if (line.startsWith("|") && next.startsWith("|") && /^\|[\s\-|:]+\|$/.test(next)) {
      const headerCells = line
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && (lines[i] ?? "").startsWith("|")) {
        const row = (lines[i] ?? "")
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim());
        rows.push(row);
        i++;
      }
      out.push(
        <div key={key++} className="my-4 overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {headerCells.map((c, j) => (
                  <th key={j} className="px-3 py-2 text-left font-medium">
                    {renderInline(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-t">
                  {row.map((c, ci) => (
                    <td key={ci} className="px-3 py-2 align-top">
                      {renderInline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Unordered list
    if (/^[\s]*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[\s]*[-*]\s+/.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^[\s]*[-*]\s+/, ""));
        i++;
      }
      out.push(
        <ul key={key++} className="my-3 ml-6 list-disc space-y-1 text-sm">
          {items.map((it, j) => (
            <li key={j}>{renderInline(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^[\s]*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[\s]*\d+\.\s+/.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^[\s]*\d+\.\s+/, ""));
        i++;
      }
      out.push(
        <ol key={key++} className="my-3 ml-6 list-decimal space-y-1 text-sm">
          {items.map((it, j) => (
            <li key={j}>{renderInline(it)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const lines2: string[] = [];
      while (i < lines.length && (lines[i] ?? "").startsWith("> ")) {
        lines2.push((lines[i] ?? "").slice(2));
        i++;
      }
      out.push(
        <blockquote
          key={key++}
          className="my-4 border-l-2 border-primary/30 bg-muted/30 px-4 py-2 text-sm italic text-muted-foreground"
        >
          {lines2.map((l, j) => (
            <React.Fragment key={j}>
              {renderInline(l)}
              {j < lines2.length - 1 && <br />}
            </React.Fragment>
          ))}
        </blockquote>,
      );
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph (collect contiguous non-empty, non-special lines)
    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() !== "" &&
      !/^(#{1,6}\s|```|>|\||\d+\.\s|[\s]*[-*]\s|---+$)/.test(lines[i] ?? "")
    ) {
      paraLines.push(lines[i] ?? "");
      i++;
    }
    out.push(
      <p key={key++} className="my-3 text-sm leading-relaxed text-foreground/90">
        {renderInline(paraLines.join(" "))}
      </p>,
    );
  }

  return out;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let key = 0;

  // Use sentinel markers, then re-scan with a single regex. This avoids
  // the classic problem of nesting same-character markers (e.g. `*` inside
  // a code span).
  const CODE = "\u0000CODE\u0000";
  const BOLD = "\u0000BOLD\u0000";
  const ITAL = "\u0000ITAL\u0000";
  const LINK = "\u0000LINK\u0000";

  // Replace inline code first (preserve raw content).
  const protectedText = text
    .replace(/`([^`]+)`/g, (_, code) => `${CODE}${code}${CODE}`)
    .replace(/\*\*([^*]+)\*\*/g, (_, b) => `${BOLD}${b}${BOLD}`)
    .replace(/__([^_]+)__/g, (_, b) => `${BOLD}${b}${BOLD}`)
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, (_, prefix, i) => `${prefix}${ITAL}${i}${ITAL}`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => `${LINK}${label}|||${url}${LINK}`);

  const tokenRegex = /\u0000(CODE|BOLD|ITAL|LINK)\u0000([^\u0000]*?)\u0000(CODE|BOLD|ITAL|LINK)\u0000/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = tokenRegex.exec(protectedText)) !== null) {
    if (m.index > lastIndex) {
      parts.push(protectedText.slice(lastIndex, m.index));
    }
    const open = m[1];
    const inner = m[2] ?? "";
    if (open === "CODE") {
      parts.push(
        <code
          key={`c-${key++}`}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]"
        >
          {inner}
        </code>,
      );
    } else if (open === "BOLD") {
      parts.push(
        <strong key={`b-${key++}`} className="font-semibold">
          {inner}
        </strong>,
      );
    } else if (open === "ITAL") {
      parts.push(
        <em key={`i-${key++}`} className="italic">
          {inner}
        </em>,
      );
    } else if (open === "LINK") {
      const sep = inner.indexOf("|||");
      const label = sep >= 0 ? inner.slice(0, sep) : inner;
      const url = sep >= 0 ? inner.slice(sep + 3) : "#";
      const isExternal = /^https?:\/\//.test(url);
      parts.push(
        <a
          key={`l-${key++}`}
          href={url}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noreferrer" : undefined}
          className="text-primary underline-offset-4 hover:underline"
        >
          {label}
        </a>,
      );
    }
    lastIndex = tokenRegex.lastIndex;
  }
  if (lastIndex < protectedText.length) {
    parts.push(protectedText.slice(lastIndex));
  }
  return <>{parts}</>;
}

export function DeliveryDetailView({ doc, phase, content }: Props) {
  // Strip leading H1 (the title is rendered in the header card)
  const body = content.replace(/^#\s+.*?\n/, "").trim();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/deliveries"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All deliveries
        </Link>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                {phase ? (
                  <>
                    <span>Phase {phase.number}</span>
                    <span>·</span>
                    <span>{phase.name}</span>
                  </>
                ) : (
                  <span>Delivery report</span>
                )}
              </div>
              <h1 className="text-2xl font-medium tracking-tight">{doc.title}</h1>
              <p className="text-sm text-muted-foreground">{doc.description}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant={doc.status === "final" ? "success" : "warning"}>
                {doc.status}
              </Badge>
              {phase?.status === "complete" && (
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Phase signed off
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {doc.readTimeMinutes} min read
            </span>
            <span className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.7rem]">
                {doc.path}
              </code>
            </span>
          </div>
        </CardContent>
      </Card>

      <article className="prose-like mx-auto max-w-3xl">
        {renderMarkdown(body)}
      </article>
    </div>
  );
}
