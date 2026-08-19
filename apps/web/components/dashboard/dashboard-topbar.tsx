import { getAigarth } from "@/lib/server/aigarth";
import { DashboardTopbarClient } from "./dashboard-topbar-client";

/**
 * Server component. Fetches the current user from /v1/me using the
 * session JWT. Hands the data to the client component which renders
 * the search + theme + notifications + user menu.
 */
export async function DashboardTopbar() {
  const aigarth = getAigarth();
  let user: { id: string; name: string; email: string } | null = null;
  let activeAddressPrefix: string | null = null;
  if (aigarth) {
    try {
      const me = await aigarth.identity.whoami();
      user = { id: me.id, name: me.name, email: me.email };
      // Derive the active wallet's 12-char prefix from the email local part.
      // Email format: qubic-NFSIMEG...@wallet.local
      const m = /^qubic-([a-z0-9]+)@/i.exec(me.email);
      if (m && m[1]) activeAddressPrefix = m[1].toUpperCase();
    } catch {
      /* swallow: render signed-out state */
    }
  }
  return (
    <DashboardTopbarClient
      user={user}
      activeAddressPrefix={activeAddressPrefix}
    />
  );
}
