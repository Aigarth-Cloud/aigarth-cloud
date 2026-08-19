/**
 * LiveNeuralField — CSS-only art-directed visualisation of the
 * organism's "internal state" (Phase 26.D, Garden Organism view).
 *
 *   Per v0.2 §24 + ADR 005 §10, the "Live Neural Field" is
 *   **art-directed, not literal**. We are not rendering the
 *   organism's actual neural network weights, memory, or
 *   decision pipeline. We are rendering a procedural pattern
 *   that *evokes* an intelligence. The explicit caption is part
 *   of the contract — the user must be told this is decoration.
 *
 *   Why CSS-only?
 *     - No additional JS bundles; pure server-renderable.
 *     - Deterministic: a given (slug, generation) pair always
 *       produces the same pattern (we hash the slug into a seed
 *       so the same organism is visually stable).
 *     - Cheap: no recharts/canvas/three. Pure CSS gradients.
 *
 *   Caption placement is mandatory and tested for. The component
 *   will not render without the caption — see the data-testid
 *   and the text content of the <p> below.
 */

import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@aigarth/ui";

interface LiveNeuralFieldProps {
  /** The organism's slug — used as a deterministic seed for the pattern. */
  slug: string;
  /** The organism's current generation. Higher gen → denser pattern. */
  generation: number;
}

function hashSlug(slug: string): number {
  // FNV-1a-ish hash, in 32 bits. Deterministic across runs.
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Build a stable palette from the seed. Three hues around a base
 * hue, one accent. The card's parent provides the rest.
 */
function buildPalette(seed: number): {
  base: string;
  accent: string;
  shadow: string;
} {
  const baseHue = seed % 360;
  const accentHue = (baseHue + 40) % 360;
  const shadowHue = (baseHue + 200) % 360;
  return {
    base: `hsl(${baseHue} 70% 60%)`,
    accent: `hsl(${accentHue} 80% 65%)`,
    shadow: `hsl(${shadowHue} 60% 30%)`,
  };
}

export function LiveNeuralField({ slug, generation }: LiveNeuralFieldProps) {
  const seed = hashSlug(slug);
  const palette = buildPalette(seed);
  // Layer count: clamp 5..16 based on generation, so the pattern
  // visibly evolves with the lineage.
  const layers = Math.max(5, Math.min(16, 5 + Math.floor(generation / 4)));

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="h-4 w-4 text-garden-500" />
            Live neural field
          </h2>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            art-directed
          </span>
        </div>

        {/*
          The visual.  `data-testid="live-neural-field"` is what
          the UI tests assert on; do not rename without updating
          the test.
        */}
        <div
          data-testid="live-neural-field"
          aria-hidden="true"
          className="relative mt-4 h-44 w-full overflow-hidden rounded-md border bg-muted/40"
          style={{
            backgroundImage: `radial-gradient(circle at 30% 40%, ${palette.base}33 0%, transparent 55%),
                              radial-gradient(circle at 75% 65%, ${palette.accent}40 0%, transparent 50%),
                              radial-gradient(circle at 50% 50%, ${palette.shadow}22 0%, transparent 70%)`,
          }}
        >
          {/* Decorative layers — concentric, fading, slightly
              offset by the seed so each organism looks distinct. */}
          <div
            className="absolute inset-0"
            style={{
              background: `repeating-radial-gradient(
                circle at ${30 + (seed % 20)}% ${40 + (seed % 15)}%,
                transparent 0px,
                transparent 8px,
                ${palette.accent}10 8px,
                ${palette.accent}10 9px
              )`,
              mixBlendMode: "screen",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `repeating-conic-gradient(
                from ${seed % 360}deg at 50% 50%,
                ${palette.base}00 0deg,
                ${palette.base}18 12deg,
                ${palette.base}00 24deg
              )`,
              opacity: 0.6,
            }}
          />
          {/* "Neurons" — small dots whose count reflects the generation. */}
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {Array.from({ length: layers }).map((_, i) => {
              // Deterministic pseudo-random position from the seed + i.
              const a = (Math.imul(seed + i, 2654435761) >>> 0) % 100;
              const b = (Math.imul(seed + i + 1, 40503) >>> 0) % 100;
              return (
                <circle
                  key={i}
                  cx={a}
                  cy={b}
                  r={0.7}
                  fill={i % 2 === 0 ? palette.base : palette.accent}
                  opacity={0.55}
                />
              );
            })}
          </svg>
        </div>

        {/*
          The mandatory caption.  The text MUST stay roughly as
          written — the UI tests assert that the caption is
          visible.  Do not shorten it to a tooltip; the user must
          see the disclaimer in the surface itself.
        */}
        <p
          data-testid="live-neural-field-caption"
          className="mt-3 text-[11px] leading-relaxed text-muted-foreground"
        >
          This is an <strong>art-directed visualisation, not a live view of
          the organism&apos;s internal state</strong>. The pattern is a
          procedural decoration seeded from the organism&apos;s slug and
          generation. Real per-experience telemetry is in the Fitness curve
          and the episodic memory log (above and below).
        </p>
      </CardContent>
    </Card>
  );
}
