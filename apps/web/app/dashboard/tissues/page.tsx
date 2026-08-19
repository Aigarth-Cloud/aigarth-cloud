/**
 * Studio: Tissues.
 *
 *   Phase 18E productization. Lists the caller's tissues, lets
 *   them create a new tissue, and (after creation) add ANN members.
 *   Decision history lives in apps/dashboard.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@aigarth/ui";
import { PageHeader } from "@/components/dashboard/page-header";
import { getAigarth } from "@/lib/server/aigarth";
import { getSession } from "@/lib/server/session";
import { CreateTissueForm } from "./client";

interface RawTissue {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  status: string;
  access: string;
  policy_kind: string;
  total_decisions: string;
  created_at: string;
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

function stateBadge(t: RawTissue) {
  if (t.status === "active")
    return <Badge variant="success">active</Badge>;
  if (t.status === "paused")
    return <Badge variant="warning">paused</Badge>;
  if (t.status === "deprecated")
    return <Badge variant="secondary">deprecated</Badge>;
  return <Badge variant="outline">{t.status}</Badge>;
}

export default async function TissuesPage() {
  const session = getSession();
  if (!session) redirect("/login");

  const a = getAigarth()!;
  // We don't have an explicit "my tissues" filter on the SDK yet, so we
  // list all public+unlisted and let the UI sort by created_at desc.
  const res = await a.tissues
    .list({ sort: "newest", limit: 50 })
    .catch(() => ({ data: [] as RawTissue[] }));
  const tissues = (res.data as unknown as RawTissue[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tissues"
        description="Compose ANNs into a single trinary decision. Each tissue calls its members, combines their envelopes, and signs the result."
        action={
          <div className="flex items-center gap-2">
            <Badge variant="outline">{tissues.length} tissue{tissues.length === 1 ? "" : "s"}</Badge>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* List of existing tissues */}
        <div>
          {tissues.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
              No tissues yet. Use the form on the right to create one.
            </div>
          ) : (
            <div className="grid gap-3">
              {tissues.map((t) => (
                <Link
                  key={t.id}
                  href={`/dashboard/tissues/${t.slug}`}
                  className="block rounded-xl border bg-card p-5 transition-colors hover:bg-accent/30"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <h4 className="truncate font-semibold">{t.name}</h4>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {t.tagline ?? t.slug}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {stateBadge(t)}
                      <Badge variant="outline">{t.access}</Badge>
                      <Badge variant="secondary">{t.policy_kind}</Badge>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {Number(t.total_decisions).toLocaleString("en-US")} decision{Number(t.total_decisions) === 1 ? "" : "s"}
                    </span>
                    <span>created {fmtDate(t.created_at)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Create form */}
        <aside>
          <CreateTissueForm />
        </aside>
      </div>
    </div>
  );
}
