import { AnnExecutionView } from "@/components/pages/ann-execution";
import { loadAnnsWithExecutionInfo, loadRecentExecutions } from "@/lib/ann-execution";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * /ann-execution — Phase 29 command panel.
 *
 * The operator surface for the Execution Router. Lists ANNs with
 * their manifest + repository + architecture; surfaces recent
 * runs with verification status; provides the entry point to the
 * per-ANN detail page.
 *
 * Read-mostly. Mutations (Run, Pause) happen on the per-ANN page
 * or via curl with the AIGARTH_DASHBOARD_SYSTEM_TOKEN.
 */
export default async function AnnExecutionPage() {
  const [anns, executions] = await Promise.all([
    loadAnnsWithExecutionInfo(),
    loadRecentExecutions(50),
  ]);
  return <AnnExecutionView anns={anns} executions={executions} />;
}
