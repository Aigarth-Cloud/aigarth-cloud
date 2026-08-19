import { redirect } from "next/navigation";
import { Sparkles, Zap, Brain, MessageSquare, Code2, Image as ImageIcon } from "lucide-react";
import { Badge } from "@aigarth/ui";
import { PageHeader } from "@/components/dashboard/page-header";
import { getAigarth } from "@/lib/server/aigarth";
import { getSession } from "@/lib/server/session";

interface RawModel {
  id: string;
  object?: string;
  name?: string;
  description?: string | null;
  type?: string;
  family?: string | null;
  context_window?: number;
  max_output_tokens?: number;
  pricing?: { input_cost_qubic_per_1k: string; output_cost_qubic_per_1k: string };
  status?: string;
  owned_by?: string;
}

function iconFor(type?: string) {
  switch (type) {
    case "chat":       return MessageSquare;
    case "embedding":  return Brain;
    case "image":      return ImageIcon;
    case "code":       return Code2;
    default:           return Sparkles;
  }
}

function fmtQu(per1k: string | undefined): string {
  if (!per1k) return " ";
  const v = Number(per1k) / 1_000_000;
  if (!Number.isFinite(v)) return " ";
  return `${v.toFixed(4)} / 1K`;
}

export default async function ModelsPage() {
  const session = getSession();
  if (!session) redirect("/login");

  const a = getAigarth()!;
  const res = await a.models.list().catch(() => ({ data: [] as RawModel[] }));
  const models = (res.data as unknown as RawModel[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Models"
        description="The Aigarth gateway model catalog. All models are OpenAI-compatible."
        action={
          <Badge variant="success" className="gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-mint-500" />
            {models.length} available
          </Badge>
        }
      />

      {models.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Zap className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-4 font-semibold">No models available</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            The gateway has no active models configured.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {models.map((m) => {
            const Icon = iconFor(m.type);
            return (
              <div key={m.id} className="rounded-xl border bg-card p-5 transition-colors hover:bg-accent/30">
                <div className="flex items-start justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  {m.family && (
                    <Badge variant="outline" className="text-[10px]">{m.family}</Badge>
                  )}
                </div>
                <h3 className="mt-4 font-semibold">{m.name ?? m.id}</h3>
                {m.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {m.description}
                  </p>
                )}
                <dl className="mt-4 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Context</dt>
                    <dd className="font-mono">{m.context_window?.toLocaleString() ?? " "} tok</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Max output</dt>
                    <dd className="font-mono">{m.max_output_tokens?.toLocaleString() ?? " "} tok</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Input</dt>
                    <dd className="font-mono">{fmtQu(m.pricing?.input_cost_qubic_per_1k)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Output</dt>
                    <dd className="font-mono">{fmtQu(m.pricing?.output_cost_qubic_per_1k)}</dd>
                  </div>
                </dl>
                <div className="mt-4 truncate font-mono text-[10px] text-muted-foreground">
                  {m.id}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
