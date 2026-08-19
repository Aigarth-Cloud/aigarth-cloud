/**
 * Public Dataset Detail — Phase 19B.4.
 *
 *   The /datasets/:slug page. Shows the dataset's metadata,
 *   versions, inferred schema, and a "Train on this" CTA.
 *
 *   Public read — uses the no-auth SDK factory.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Database,
  ArrowRight,
  Sparkles,
  FileText,
  Image as ImageIcon,
  Mic,
  BarChart3,
  Layers,
  ExternalLink,
} from "lucide-react";
import { Badge, Button } from "@aigarth/ui";
import { getAigarthPublic } from "@/lib/server/aigarth-public";

interface RawDataset {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  kind: string;
  license: string;
  source: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface RawVersion {
  id: string;
  version: string;
  size_bytes: number;
  row_count: number | null;
  content_hash: string;
  schema: {
    kind: string;
    columns?: Array<{ name: string; type: string; nullable?: boolean }>;
    mimeType?: string;
    encoding?: string;
    notes?: string;
  };
  changelog: string | null;
  created_at: string;
}

function iconForKind(kind?: string) {
  switch (kind) {
    case "tabular":     return BarChart3;
    case "text":        return FileText;
    case "image":       return ImageIcon;
    case "audio":       return Mic;
    case "time_series": return Layers;
    default:            return Database;
  }
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MiB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  } catch {
    return iso;
  }
}

export default async function DatasetDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const a = getAigarthPublic();
  const dataset = await a.datasets.retrieve(params.slug).catch(() => null);
  if (!dataset) notFound();
  const d = dataset as unknown as RawDataset;
  const versionsRes = await a.datasets.listVersions(d.id, { limit: 10 }).catch(() => ({
    data: [] as RawVersion[],
    total: 0,
    limit: 0,
    offset: 0,
  }));
  const versions = (versionsRes.data as unknown as RawVersion[]) ?? [];
  const latest = versions[0];
  const Icon = iconForKind(d.kind);

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b bg-gradient-to-b from-garden-500/5 to-transparent">
        <div className="container-wide py-12 md:py-16">
          <Link
            href="/datasets"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            ← All datasets
          </Link>
          <div className="mt-4 flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-garden-500/10 text-garden-600 dark:text-garden-400">
              <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-balance font-display text-3xl font-medium leading-[1.1] tracking-tight md:text-4xl">
                {d.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[10px] uppercase">{d.kind}</Badge>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {d.license.replace(/_/g, " ")}
                </Badge>
                {d.source && (
                  <a
                    href={d.source}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Source
                  </a>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Link href="/dashboard/datasets">
                <Button className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Train on this
                </Button>
              </Link>
            </div>
          </div>
          {d.description && (
            <p className="mt-6 max-w-3xl text-base text-muted-foreground">{d.description}</p>
          )}
        </div>
      </section>

      <section className="container-wide grid gap-8 py-10 md:grid-cols-3">
        {/* Versions */}
        <div className="md:col-span-2">
          <h2 className="text-base font-semibold">Versions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Content-hashed versions. The first line is the latest.
          </p>
          <div className="mt-4 space-y-2">
            {versions.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-card/40 p-6 text-sm text-muted-foreground">
                No versions uploaded yet.
              </div>
            ) : (
              versions.map((v) => (
                <div key={v.id} className="rounded-lg border bg-card p-4">
                  <div className="flex items-baseline justify-between">
                    <div className="font-mono text-sm">v{v.version}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(v.created_at)}</div>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <div className="text-muted-foreground">Size</div>
                      <div className="mt-0.5 font-mono">{fmtBytes(v.size_bytes)}</div>
                    </div>
                    {v.row_count != null && (
                      <div>
                        <div className="text-muted-foreground">Rows</div>
                        <div className="mt-0.5 font-mono">{v.row_count.toLocaleString()}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-muted-foreground">Content hash</div>
                      <div className="mt-0.5 font-mono">{v.content_hash.slice(0, 16)}…</div>
                    </div>
                  </div>
                  {v.changelog && (
                    <p className="mt-2 text-xs text-muted-foreground">{v.changelog}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Inferred schema */}
        <div>
          <h2 className="text-base font-semibold">Inferred schema</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            From the first 1 MiB of the upload.
          </p>
          {latest ? (
            <div className="mt-4 rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Kind</span>
                <span className="font-mono uppercase tracking-wider">{latest.schema.kind}</span>
              </div>
              {latest.schema.mimeType && (
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">MIME</span>
                  <span className="font-mono">{latest.schema.mimeType}</span>
                </div>
              )}
              {latest.schema.columns && latest.schema.columns.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-muted-foreground">Columns</div>
                  <ul className="mt-1 space-y-0.5 text-xs font-mono">
                    {latest.schema.columns.map((c) => (
                      <li key={c.name} className="flex items-center justify-between">
                        <span>{c.name}</span>
                        <span className="text-muted-foreground">{c.type}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {latest.schema.notes && (
                <p className="mt-3 text-xs text-muted-foreground">{latest.schema.notes}</p>
              )}
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed bg-card/40 p-6 text-sm text-muted-foreground">
              No schema inferred (no versions yet).
            </div>
          )}
          <div className="mt-6">
            <Link
              href="/dashboard/datasets"
              className="inline-flex items-center gap-1 text-xs text-garden-600 hover:underline dark:text-garden-400"
            >
              Train on this dataset <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
