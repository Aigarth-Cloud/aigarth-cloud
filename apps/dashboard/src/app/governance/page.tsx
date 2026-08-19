import { TrackerNav } from "@/components/tracker-nav";
import { GovernanceView } from "@/components/pages/governance";

export const dynamic = "force-dynamic";

/**
 * /governance — AigarthPool multi-sig command centre (Phase 22, M1+M2).
 * Public-read: anyone can observe the signer set + pending ops.
 * Mutations (init / submit / approve / execute) are JWT-gated on the
 * ANN service and out of scope for this page.
 */
export default function GovernancePage() {
  return (
    <TrackerNav>
      <GovernanceView />
    </TrackerNav>
  );
}
