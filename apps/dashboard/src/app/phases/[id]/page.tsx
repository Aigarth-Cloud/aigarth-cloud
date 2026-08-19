import { notFound } from "next/navigation";
import { getPhase, listTasksByPhase, phaseProgress } from "@/lib/repo";
import { PhaseDetailView } from "@/components/pages/phases";

export const dynamic = "force-dynamic";

export default function Page({ params }: { params: { id: string } }) {
  const phase = getPhase(params.id);
  if (!phase) notFound();
  const tasks = listTasksByPhase(params.id);
  const progress = phaseProgress(params.id);
  return <PhaseDetailView phase={phase} tasks={tasks} progress={progress} />;
}
