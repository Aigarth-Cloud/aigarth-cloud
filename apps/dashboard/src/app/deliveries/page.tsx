import { listDocs, listPhases } from "@/lib/repo";
import { DeliveriesView } from "@/components/pages/deliveries";

export const dynamic = "force-dynamic";

export default function Page() {
  const docs = listDocs();
  const phases = listPhases();
  return <DeliveriesView docs={docs} phases={phases} />;
}
