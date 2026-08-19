import { listAllTasks, listPhases } from "@/lib/repo";
import { KanbanView } from "@/components/pages/kanban";

export const dynamic = "force-dynamic";

export default function Page() {
  const tasks = listAllTasks();
  const phases = listPhases().map((p) => ({ id: p.id, name: p.name, number: p.number }));
  const enriched = tasks.map((t) => {
    const phase = phases.find((p) => p.id === t.phaseId);
    return { ...t, phaseName: phase?.name || "Unknown", phaseNumber: phase?.number || 0 };
  });
  return <KanbanView tasks={enriched} phases={phases} />;
}
