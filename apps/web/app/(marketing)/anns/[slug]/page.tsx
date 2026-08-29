import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Cpu, GitBranch, ShieldCheck } from "lucide-react";
import { Badge } from "@aigarth/ui";
import { getAigarth } from "@/lib/server/aigarth";
import { RunAnnPanel } from "./_components/run-ann-panel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: { slug: string };
}

/**
 * /anns/[slug] — individual ANN detail page.
 *
 * Phase 29 — pairs the existing marketing page with the new
 * Execution Router. The hero summarises the ANN; the Run panel
 * below is the new surface where a visitor can submit a Run
 * against either the local executor or the Qubic OC executor
 * and watch the execution history.
 *
 * The page is **public** for ANNs with `visibility=public` (the
 * default). The Run panel is read-only when the visitor isn't
 * signed in; the auth gate is enforced server-side on the proxy
 * route, not here.
 */
export default async function AnnDetailPage({ params }: PageProps) {
  const a = getAigarth();
  // The execute + history endpoints require auth. We don't redirect
  // here (the visitor can still read the public summary); the Run
  // panel itself shows a sign-in CTA if no session is present.

  // The retrieve + listRepositories endpoints are public on services/ann
  // (no JWT required). We call them directly via the ANN service URL
  // (defaults to the in-network Docker alias "ann:7006") so the page
  // works for unauthenticated visitors too. The SDK's session-bound
  // call path is kept as a fallback for when getAigarth() returns a
  // real client (the only difference is that the SDK sends the JWT,
  // which services/ann ignores on read endpoints).
  const annBase = process.env.AIGARTH_ANN_URL ?? "http://ann:7006";

  async function fetchPublic<T>(path: string): Promise<T | null> {
    try {
      const res = await fetch(`${annBase}${path}`, {
        // Always send a Host header that the ANN service accepts. In
        // production the service is behind Traefik which sets the
        // Host; the explicit header is a defensive default.
        headers: { host: "aigarth.cloud" },
        cache: "no-store",
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  // Fetch the ANN + version + repositories (all public) so we
  // can populate the manifest hash + the list of published
  // GitHub commits. If the ANN doesn't exist, 404.
  //
  // We use the public fetch path always (the SDK's Ann type is
  // out of sync with the actual service shape; the public fetch
  // returns the live snake_case shape and works for both
  // authenticated and anonymous visitors).
  const ann = await fetchPublic<Record<string, unknown>>(
    `/v1/anns/${encodeURIComponent(params.slug)}`,
  );
  if (!ann) {
    notFound();
  }

  // Repositories are public too.
  const reposResult = await fetchPublic<{ data: Array<Record<string, unknown>> }>(
    `/v1/anns/${encodeURIComponent(params.slug)}/repositories`,
  );
  const repos: Array<Record<string, unknown>> = reposResult?.data ?? [];

  // `a` is kept around for the Run panel below (it needs auth to
  // submit executions). Suppress the unused-binding warning.
  void a;

  const name = (ann.name as string) ?? params.slug;
  const tagline = (ann.tagline as string) ?? "";
  const description = (ann.description as string) ?? "";
  const creatorName = (ann.creator_name as string) ?? (ann.creatorName as string) ?? "Unknown";
  const currentVersion = (ann.current_version as string) ?? (ann.currentVersion as string) ?? "v1.0.0";
  const accuracy = ann.accuracy ? `${ann.accuracy}%` : null;
  const latencyMs = (ann.latency_p50_ms as number) ?? ((ann as unknown as Record<string, unknown>).latencyP50Ms as number) ?? null;
  const manifestHash = repos[0]?.manifest_hash as string | undefined;
  const architecture = (() => {
    const url = repos[0]?.release_url as string | undefined;
    if (url && url.startsWith("local://manifest/")) return url.slice("local://manifest/".length);
    return "deterministic-stub";
  })();

  return (
    <div className="min-h-screen">
      <section className="relative border-b">
        <div className="container-wide py-12 md:py-16">
          <Link
            href="/anns"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            All ANNs
          </Link>
          <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_400px]">
            <div>
              <Badge variant="glow" className="mb-4">
                <Cpu className="h-3 w-3" />
                Phase 29 — Execution Router enabled
              </Badge>
              <h1 className="font-display text-4xl font-medium leading-tight tracking-tight md:text-5xl">
                {name}
              </h1>
              {tagline && (
                <p className="mt-3 max-w-2xl text-pretty text-lg text-muted-foreground">{tagline}</p>
              )}
              {description && (
                <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              )}
              <div className="mt-8 grid grid-cols-2 gap-3 sm:max-w-md">
                <Stat label="Creator" value={creatorName} />
                <Stat label="Version" value={currentVersion} />
                {accuracy && <Stat label="Accuracy" value={accuracy} />}
                {latencyMs && <Stat label="Latency p50" value={`${latencyMs} ms`} />}
              </div>
            </div>
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="font-semibold tracking-tight">Identity</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The published artifact and its manifest hash.
              </p>
              <dl className="mt-4 space-y-3 text-sm">
                <Row label="Architecture" value={architecture} mono />
                <Row
                  label="Manifest hash"
                  value={manifestHash ? `${manifestHash.slice(0, 14)}…` : "(no repository row)"}
                  mono
                />
                <Row
                  label="GitHub"
                  value={
                    repos[0]
                      ? `${repos[0].repo_owner}/${repos[0].repo_name}`
                      : "not published yet"
                  }
                  mono
                />
                <Row
                  label="Publication"
                  value={(repos[0]?.publication_kind as string) ?? "—"}
                />
              </dl>
              <div className="mt-6 flex flex-wrap gap-2">
                <Badge variant="outline">
                  <GitBranch className="h-3 w-3" />
                  Local
                </Badge>
                <Badge variant="outline">
                  <ShieldCheck className="h-3 w-3" />
                  Qubic OC
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b">
        <div className="container-wide py-10 md:py-14">
          <RunAnnPanel
            slug={params.slug}
            version={currentVersion}
            manifestHash={manifestHash ?? ""}
            architecture={architecture}
            signedIn={!!a}
          />
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-sm">{value}</div>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-right" : "text-right"}>{value}</dd>
    </div>
  );
}
