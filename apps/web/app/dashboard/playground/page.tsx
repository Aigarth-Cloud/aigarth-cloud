import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { getAigarth } from "@/lib/server/aigarth";
import { getSession } from "@/lib/server/session";
import { PlaygroundClient } from "./client";

interface RawModel {
  id: string;
  name?: string;
  type?: string;
  context_window?: number;
}

export default async function PlaygroundPage() {
  const session = getSession();
  if (!session) redirect("/login");

  const a = getAigarth()!;
  const res = await a.models.list().catch(() => ({ data: [] as RawModel[] }));
  const models = (res.data as unknown as RawModel[]) ?? [];
  const chatModels = models.filter((m) => (m.type ?? "chat") === "chat" || !m.type);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Playground"
        description="Stream a chat completion. Same surface as the OpenAI API."
      />
      <PlaygroundClient
        models={chatModels.map((m) => ({ id: m.id, name: m.name ?? m.id }))}
        defaultModelId={chatModels[0]?.id ?? "aigarth-meridian-1"}
      />
    </div>
  );
}
