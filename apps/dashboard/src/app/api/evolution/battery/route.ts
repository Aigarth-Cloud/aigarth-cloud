/**
 * GET /api/evolution/battery
 *
 * Runs the full AIGARTH-EVO-01 battery sequentially and returns
 * one row per environment. Accepts the same query params as the
 * single-env POST:
 *
 *   ?seed=42&population_size=64&offspring_size=64&generations=100
 *
 * Returns:
 *
 *   {
 *     "started_at": "<iso>",
 *     "finished_at": "<iso>",
 *     "duration_ms": <int>,
 *     "config": { seed, population_size, offspring_size, generations },
 *     "rows": [DashboardEvolutionRow, ...]   // length === 10
 *   }
 *
 * This is the dashboard's "press the button" endpoint for the
 * AIGARTH-EVO-01 demo. The full battery converges well under 5s
 * with the default config on a laptop.
 */

import { NextResponse } from "next/server";
import { runBattery, type DashboardEvolutionRow } from "@/lib/evolution";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_GENERATIONS = 500;
const MAX_POPULATION = 512;
const MAX_OFFSPRING = 512;

function paramInt(value: string | null, min: number, max: number, fallback: number): number {
  if (value == null) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min) return min;
  if (n > max) return max;
  return n;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const seed = paramInt(url.searchParams.get("seed"), 0, 0x7fffffff, 42);
  const pop = paramInt(url.searchParams.get("population_size"), 1, MAX_POPULATION, 64);
  const off = paramInt(url.searchParams.get("offspring_size"), 0, MAX_OFFSPRING, 64);
  const gens = paramInt(url.searchParams.get("generations"), 1, MAX_GENERATIONS, 100);

  const t0 = Date.now();
  const rows: DashboardEvolutionRow[] = runBattery({
    seed,
    population_size: pop,
    offspring_size: off,
    generations: gens,
  });
  const t1 = Date.now();

  return NextResponse.json(
    {
      started_at: new Date(t0).toISOString(),
      finished_at: new Date(t1).toISOString(),
      duration_ms: t1 - t0,
      config: {
        seed,
        population_size: pop,
        offspring_size: off,
        generations: gens,
      },
      rows,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
