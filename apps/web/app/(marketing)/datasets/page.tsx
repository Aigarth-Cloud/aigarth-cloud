/**
 * Public Dataset Catalog — Phase 19B.4.
 *
 *   The marketing-facing browse surface for the dataset registry.
 *   Lists public datasets, faceted by kind + license, with a "Train
 *   on this" CTA on each card. Lives at /datasets (not /dashboard
 *   — this is a public marketing page).
 *
 *   The page is a server component. The SDK is consumed via the
 *   no-auth factory in `lib/server/aigarth-public.ts` so anonymous
 *   visitors can browse.
 *
 *   Brand voice: "Stake QUBIC. Reserve compute. Build AI products.
 *   Earn when you're not using it." No abstract nouns, no
 *   "decentralized ecosystem", no "transform".
 */

import Link from "next/link";
import { Database, Sparkles, ArrowRight, FileText, Image as ImageIcon, Mic, BarChart3, Layers, Search } from "lucide-react";
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

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  } catch {
    return iso;
  }
}

const KIND_OPTIONS = [
  { value: "",          label: "All kinds" },
  { value: "tabular",   label: "Tabular" },
  { value: "text",      label: "Text" },
  { value: "image",     label: "Image" },
  { value: "audio",     label: "Audio" },
  { value: "time_series", label: "Time series" },
  { value: "multimodal", label: "Multimodal" },
];

const LICENSE_OPTIONS = [
  { value: "",          label: "All licenses" },
  { value: "open",      label: "Open" },
  { value: "cc_by",     label: "CC BY" },
  { value: "cc_by_sa",  label: "CC BY-SA" },
  { value: "commercial", label: "Commercial" },
  { value: "custom",    label: "Custom" },
];

export default async function DatasetsCatalogPage({
  searchParams,
}: {
  searchParams: { kind?: string; license?: string; search?: string };
}) {
  const a = getAigarthPublic();
  const result = await a.datasets
    .catalog({
      kind: searchParams.kind as never,
      license: searchParams.license as never,
      search: searchParams.search,
      sort: "newest",
      limit: 48,
    })
    .catch(() => ({ data: [] as RawDataset[], total: 0, limit: 0, offset: 0 }));

  const datasets = (result.data as unknown as RawDataset[]) ?? [];

  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <section className="border-b bg-gradient-to-b from-garden-500/5 to-transparent">
        <div className="container-wide py-16 md:py-24">
          <Badge variant="outline" className="mb-4 gap-1.5">
            <Database className="h-3 w-3" />
            Public catalog
          </Badge>
          <h1 className="text-balance font-display text-4xl font-medium leading-[1.05] tracking-tight md:text-5xl">
            Datasets for training
          </h1>
          <p className="mt-4 max-w-2xl text-balance text-lg text-muted-foreground">
            Public datasets uploaded by the Aigarth community. Use them to train
            your own ANNs, or upload your own and earn when other people train on it.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/dashboard/datasets">
              <Button className="gap-2">
                <Sparkles className="h-4 w-4" />
                Upload your own
              </Button>
            </Link>
            <Link href="/dashboard/garden">
              <Button variant="outline" className="gap-2">
                <ArrowRight className="h-4 w-4" />
                Go to your garden
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Faceted search */}
      <section className="container-wide py-8">
        <form action="/datasets" method="get" className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              name="search"
              defaultValue={searchParams.search}
              placeholder="Search by name..."
              className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm outline-none ring-garden-500/40 transition focus:ring-2"
            />
          </div>
          <select
            name="kind"
            defaultValue={searchParams.kind ?? ""}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            name="license"
            defaultValue={searchParams.license ?? ""}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            {LICENSE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <Button type="submit" variant="outline" size="sm">Filter</Button>
        </form>
        <p className="mt-3 text-sm text-muted-foreground">
          {datasets.length} of {result.total} public dataset{result.total === 1 ? "" : "s"} shown
        </p>
      </section>

      {/* Grid */}
      <section className="container-wide pb-16">
        {datasets.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card/40 p-12 text-center">
            <Database className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">No public datasets yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              The catalog is empty. Be the first — upload a dataset, mark it
              public, and it appears here. Every trained ANN that references it
              attributes your work.
            </p>
            <Link
              href="/dashboard/datasets"
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-garden-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-garden-700"
            >
              <Sparkles className="h-4 w-4" />
              Upload a dataset
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {datasets.map((d) => {
              const Icon = iconForKind(d.kind);
              return (
                <Link
                  key={d.id}
                  href={`/datasets/${d.slug}`}
                  className="group block"
                >
                  <div className="h-full rounded-xl border bg-card p-5 transition-all hover:border-garden-500/50 hover:shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-garden-500/10 text-garden-600 dark:text-garden-400">
                        <Icon className="h-4 w-4" />
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {d.kind}
                      </Badge>
                    </div>
                    <h3 className="mt-4 font-semibold leading-snug">{d.name}</h3>
                    {d.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {d.description}
                      </p>
                    )}
                    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-mono uppercase tracking-wider">{d.license.replace(/_/g, " ")}</span>
                      <span>Added {fmtDate(d.created_at)}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-end text-xs text-garden-600 dark:text-garden-400">
                      <span className="opacity-0 transition-opacity group-hover:opacity-100">View details</span>
                      <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
