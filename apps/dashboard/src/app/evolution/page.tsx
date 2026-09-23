import { EvolutionView } from "@/components/pages/evolution";
import { runBattery } from "@/lib/evolution";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * /evolution — AIGARTH-EVO-01 dashboard panel.
 *
 * Server component that runs the full AIGARTH-EVO-01 battery on
 * first render and passes the result to the client view. The view
 * can trigger a re-run via POST /api/evolution/battery.
 *
 * Read-mostly. The mutation (Run battery) lives on the client view.
 */
export default async function EvolutionPage() {
  const rows = runBattery({
    seed: 42,
    population_size: 64,
    offspring_size: 64,
    generations: 100,
  });

  const startedAt = new Date().toISOString();
  const initial = {
    started_at: startedAt,
    finished_at: startedAt,
    duration_ms: 0,
    config: {
      seed: 42,
      population_size: 64,
      offspring_size: 64,
      generations: 100,
    },
    rows,
  };

  return <EvolutionView initial={initial} />;
}
