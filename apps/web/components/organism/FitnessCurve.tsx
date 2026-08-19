/**
 * FitnessCurve — line chart of an organism's fitness over generations
 * (Phase 26.D, Garden Organism view).
 *
 *   The chart renders the latest 50 fitness entries (in reverse
 *   chronological order, the way the API returns them) oldest-to-
 *   newest, left-to-right. SVG-only — no recharts — to keep the
 *   component a server component and the bundle small.
 *
 *   Data shape matches the snake_case wire format from
 *   /v1/organisms/:slug/fitness. The server page is responsible
 *   for the fetch; this component just renders.
 */

import { Card, CardContent } from "@aigarth/ui";

export interface FitnessPoint {
  generation: number;
  fitness: number;
  recordedAt: string;
}

interface FitnessCurveProps {
  entries: FitnessPoint[];
}

const VIEW_W = 640;
const VIEW_H = 200;
const PAD_L = 40;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 28;

/**
 * Build a polyline path from a list of (x, y) screen coords.
 * `null` between segments — the caller handles gaps in generation
 * numbers (we draw a continuous line for v1; the ADR 005 §6 says
 * generations can be sparse).
 */
function buildPath(points: Array<[number, number]>): string {
  if (points.length === 0) return "";
  const parts: string[] = [];
  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i]!;
    parts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return parts.join(" ");
}

export function FitnessCurve({ entries }: FitnessCurveProps) {
  // Render oldest-to-newest. The API returns generation desc; reverse.
  const data = entries.slice().sort((a, b) => a.generation - b.generation);

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <h2 className="text-base font-semibold">Fitness curve</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            No fitness measurements yet. The platform records a row in{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              organism_fitness_history
            </code>{" "}
            whenever a generation completes an evaluation.
          </p>
        </CardContent>
      </Card>
    );
  }

  const xs = data.map((d) => d.generation);
  const ys = data.map((d) => d.fitness);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  const innerW = VIEW_W - PAD_L - PAD_R;
  const innerH = VIEW_H - PAD_T - PAD_B;

  const points: Array<[number, number]> = data.map((d) => {
    const xRatio = (d.generation - xMin) / xRange;
    const yRatio = (d.fitness - yMin) / yRange;
    return [PAD_L + xRatio * innerW, PAD_T + (1 - yRatio) * innerH];
  });
  const path = buildPath(points);

  // Y-axis labels: min, mid, max.
  const yLabels = [yMax, (yMax + yMin) / 2, yMin].map((v) => v.toFixed(2));
  // X-axis labels: first, mid, last generation.
  const xLabels = [xMin, Math.round((xMin + xMax) / 2), xMax];

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Fitness curve</h2>
          <p className="text-[11px] text-muted-foreground">
            {data.length} measurement{data.length === 1 ? "" : "s"} · gen {xMin}
            {" → "}
            {xMax}
          </p>
        </div>
        <div
          className="mt-4 w-full overflow-x-auto"
          data-testid="fitness-curve"
          aria-label="Fitness curve over generations"
        >
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className="block h-auto w-full min-w-[480px]"
            preserveAspectRatio="none"
            role="img"
          >
            {/* Y gridlines + labels */}
            {[1, 0.5, 0].map((ratio, i) => {
              const y = PAD_T + ratio * innerH;
              return (
                <g key={`y-${i}`}>
                  <line
                    x1={PAD_L}
                    x2={VIEW_W - PAD_R}
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity="0.08"
                    strokeWidth="1"
                  />
                  <text
                    x={PAD_L - 6}
                    y={y + 3}
                    textAnchor="end"
                    className="fill-muted-foreground"
                    style={{ fontSize: 10, fontFamily: "ui-monospace" }}
                  >
                    {yLabels[i]}
                  </text>
                </g>
              );
            })}

            {/* X axis labels */}
            {xLabels.map((g, i) => {
              const xRatio = xRange === 0 ? 0 : (g - xMin) / xRange;
              const x = PAD_L + xRatio * innerW;
              return (
                <text
                  key={`x-${i}`}
                  x={x}
                  y={VIEW_H - 8}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  style={{ fontSize: 10, fontFamily: "ui-monospace" }}
                >
                  {g}
                </text>
              );
            })}

            {/* The line itself */}
            <path
              d={path}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-garden-600 dark:text-garden-400"
            />

            {/* Data points */}
            {points.map(([x, y], i) => (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={2.5}
                className="fill-garden-600 dark:fill-garden-400"
              />
            ))}
          </svg>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          The curve is read from{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
            /v1/organisms/:slug/fitness
          </code>
          . The platform is the source of truth — never trust the
          denormalized{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
            organisms.fitness
          </code>{" "}
          column for billing or ranking decisions (ADR 005 §10 negative 2).
        </p>
      </CardContent>
    </Card>
  );
}
