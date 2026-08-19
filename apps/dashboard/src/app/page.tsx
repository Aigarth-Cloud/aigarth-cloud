import { listPhases, listAllTasks, listDocs, listActivity, overallProgress } from "@/lib/repo";
import { OverviewView } from "@/components/pages/overview";

export const dynamic = "force-dynamic";

export default function Page() {
  const phases = listPhases();
  const tasks = listAllTasks();
  const docs = listDocs();
  const activity = listActivity(20);
  const stats = overallProgress();

  return (
    <OverviewView
      phases={phases}
      tasks={tasks}
      docs={docs}
      activity={activity}
      stats={stats}
    />
  );
}
