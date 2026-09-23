/**
 * POST /api/evolution/run
 *
 * Runs evolution against a single environment. Accepts:
 *
 *   {
 *     "env": "xor",                      // Evo01BatteryName
 *     "seed": 42,                        // optional, default 42
 *     "population_size": 64,             // optional, default 64
 *     "offspring_size": 64,              // optional, default 64
 *     "generations": 100                 // optional, default 100
 *   }
 *
 * Returns the dashboard-shaped row (`DashboardEvolutionRow`).
 *
 * The substrate runs in-process via @aigarth/evo. The wire contract
 * with services/work is established (evo_step is registered), but
 * the worker container is the next-step delivery; the dashboard
 * consumes the same package directly to keep latency low and the
 * payload predictable.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { runOne, listEnvironments } from "@/lib/evolution";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RunBody = z.object({
  env: z.string().min(1).max(64),
  seed: z.number().int().min(0).max(0x7fffffff).optional(),
  population_size: z.number().int().min(1).max(512).optional(),
  offspring_size: z.number().int().min(0).max(512).optional(),
  generations: z.number().int().min(1).max(500).optional(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof RunBody>;
  try {
    const raw = await req.json();
    const parsed = RunBody.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: "Invalid request body", issues: parsed.error.issues } },
        { status: 400 },
      );
    }
    body = parsed.data;
  } catch (err) {
    return NextResponse.json(
      { error: { message: "Request body must be JSON" } },
      { status: 400 },
    );
  }

  const known = listEnvironments();
  if (!known.includes(body.env as (typeof known)[number])) {
    return NextResponse.json(
      {
        error: {
          message: `Unknown environment '${body.env}'. Known: ${known.join(", ")}`,
        },
      },
      { status: 400 },
    );
  }

  const row = runOne(body.env as (typeof known)[number], {
    seed: body.seed,
    population_size: body.population_size,
    offspring_size: body.offspring_size,
    generations: body.generations,
  });

  return NextResponse.json(row, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
