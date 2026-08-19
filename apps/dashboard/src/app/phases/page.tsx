import { listPhases, overallProgress } from "@/lib/repo";
import { PhasesView } from "@/components/pages/phases";

export const dynamic = "force-dynamic";

export default function Page() {
  const phases = listPhases();
  const stats = overallProgress();
  return <PhasesView phases={phases} stats={stats} />;
}
