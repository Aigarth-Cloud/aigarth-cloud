import { TrackerNav } from "@/components/tracker-nav";
import { WalletAuthView } from "@/components/pages/wallet-auth";

export const dynamic = "force-dynamic";

export default function WalletAuthPage() {
  return (
    <TrackerNav>
      <WalletAuthView />
    </TrackerNav>
  );
}
