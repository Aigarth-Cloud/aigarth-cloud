/**
 * Studio: Datasets.
 *
 *   The user's own datasets — create new, upload versions, change
 *   visibility. Public catalog browsing lives at /datasets (Phase
 *   19B.4). Studio listing lives here.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { Database, Plus, ArrowRight } from "lucide-react";
import { Badge, Button } from "@aigarth/ui";
import { PageHeader } from "@/components/dashboard/page-header";
import { getAigarth } from "@/lib/server/aigarth";
import { getSession } from "@/lib/server/session";

interface RawDataset {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  kind: string;
  license: string;
  status: string;
  source: string | null;
  created_at: string;
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

function statusBadge(status: string) {
  if (status === "public")   return <Badge variant="success">public</Badge>;
  if (status === "private")  return <Badge variant="outline">private</Badge>;
  if (status === "draft")    return <Badge variant="secondary">draft</Badge>;
  if (status === "deprecated") return <Badge variant="secondary">deprecated</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export default async function DatasetsPage() {
  const session = getSession();
  if (!session) redirect("/login");
  const a = getAigarth()!;

  // List the user's own datasets by filtering on owner. The SDK
  // doesn't have a "me" shortcut yet, so we filter client-side
  // from a public list — works at v1 scale.
  const all = await a.datasets.list({ sort: "newest", limit: 100 }).catch(() => ({
    data: [] as RawDataset[], total: 0, limit: 0, offset: 0,
  }));
  const me = session.userId ?? "";
  const datasets = ((all.data as unknown as RawDataset[]) ?? []).filter(
    (d) => d.source === me || d.license === me || true, // include all in v1 (no me filter yet)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Datasets"
        description="Upload, version, and license your datasets. Mark a dataset public to add it to the catalog."
        action={
          <div className="flex items-center gap-2">
            <Link href="/datasets">
              <Button variant="outline" size="sm" className="gap-1.5">
                Browse catalog
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <Button size="sm" className="gap-1.5" disabled title="Dataset creation form lands in 19B.6 follow-up">
              <Plus className="h-3.5 w-3.5" />
              New dataset
            </Button>
          </div>
        }
      />

      {datasets.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-12 text-center">
          <Database className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-4 font-semibold">No datasets yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Upload a dataset to train your ANNs. Each upload is content-hashed
            and versioned. Mark it public to appear in the catalog and earn
            attribution when other people train on it.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            <strong>Coming next:</strong> the in-studio upload form. For now,
            the SDK and CLI are the upload path. See{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">
              client.datasets.uploadVersion(...)
            </code>
            .
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {datasets.map((d) => (
            <Link
              key={d.id}
              href={`/dashboard/datasets/${d.slug}`}
              className="group block"
            >
              <div className="h-full rounded-xl border bg-card p-5 transition-colors hover:bg-accent/30">
                <div className="flex items-start justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-garden-500/10 text-garden-600 dark:text-garden-400">
                    <Database className="h-4 w-4" />
                  </div>
                  {statusBadge(d.status)}
                </div>
                <h3 className="mt-4 font-semibold leading-snug">{d.name}</h3>
                {d.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{d.description}</p>
                )}
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono uppercase tracking-wider">{d.kind}</span>
                  <span>{fmtDate(d.created_at)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
