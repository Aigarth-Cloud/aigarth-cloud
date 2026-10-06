import { ArchitectureView } from "@/components/pages/architecture";

export const dynamic = "force-dynamic";

/**
 * /architecture — visual topology of every Aigarth service.
 *
 * Server-rendered shell; the ReactFlow canvas itself is client-side.
 * Force-dynamic so the `/api/services/health` polling inside
 * ArchitectureView always picks up the freshest snapshot.
 */
export default function Page() {
  return <ArchitectureView />;
}