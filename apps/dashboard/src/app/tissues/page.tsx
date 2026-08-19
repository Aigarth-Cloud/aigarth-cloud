/**
 * Internal dashboard — Tissue decision history.
 *
 *   Phase 18E productization. Surfaces the most recent
 *   tissue-level decisions across the network for ops + audit.
 *
 *   NOTE: this view calls the tissue service directly via the
 *   server-side SDK client. It is NOT the user-facing Studio
 *   view (that lives in apps/web at /dashboard/tissues).
 */

import { TissuesHistoryView } from "@/components/pages/tissues";
import { loadAllTissues, loadRecentTissueDecisions } from "@/lib/tissues";

export const dynamic = "force-dynamic";

export default async function TissuesPage() {
  const [tissues, decisions] = await Promise.all([
    loadAllTissues(),
    loadRecentTissueDecisions(50),
  ]);

  return <TissuesHistoryView tissues={tissues} decisions={decisions} />;
}
