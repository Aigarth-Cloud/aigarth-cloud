import { OcProcessorView } from "@/components/pages/oc-processor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * /oc — the Qubic OC processor operator dashboard.
 *
 *   In Phase 29 the OC processor is a library (`@aigarth/oc-processor`)
 *   that the operator hydrates in their own boot sequence. The
 *   dashboard reads the process-local registry via a server-side
 *   import. If the registry is empty (the typical case before the
 *   operator wires it), the page surfaces the empty state with a
 *   pointer to ADR 007 and the public test surface.
 *
 *   Phase 30+ will hydrate the registry from a small
 *   `oc_processors` table in services/work so the dashboard can
 *   run in its own process.
 */
export default async function OcProcessorPage() {
  // Phase 29: empty registry. The page is honest about this.
  // Phase 30+: read from services/work.
  const processors: Array<{
    processor_id: string;
    capabilities: string[];
    fee_qubic: string;
    endpoint: string;
    breaker_state: "CLOSED" | "OPEN" | "HALF_OPEN";
    error_rate: number;
    samples: number;
  }> = [];
  return <OcProcessorView processors={processors} />;
}
