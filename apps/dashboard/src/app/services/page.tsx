import { ServicesView } from "@/components/pages/services";

export const dynamic = "force-dynamic";

/**
 * /services — the local stack manifest.
 *
 * Static manifest + live health checks (server-side ping, no CORS).
 * Re-renders on every request; the health check itself is sub-second
 * and runs in parallel for all 15 targets.
 */
export default function Page() {
  return <ServicesView />;
}
