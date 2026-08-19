/**
 * /dashboard/nodes — the user's hardware node reservations (Phase 24.6).
 *
 *   Lists the user's reservations, status, deposit, balance, and yield.
 *   Per-row actions: release (if held), confirm (if awaiting confirm).
 *   Per-row expandable escrow ledger view.
 *
 *   Composes:
 *     - compute.nodeReservations.list + retrieve
 *     - compute/node-reservations/escrow/balance + entries (per reservation)
 *
 *   Mutations (release, confirm) go through the wallet UI, not the
 *   dashboard. This page is read + action-redirect only.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  CircleCheck,
  CircleX,
  Clock,
  Coins,
  ExternalLink,
  Loader2,
  Wallet,
  WalletMinimal,
} from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@aigarth/ui";
import { PageHeader } from "@/components/dashboard/page-header";
import { getAigarth } from "@/lib/server/aigarth";
import type { NodeReservation, NodeReservationStatus } from "../../../../../packages/sdk/dist/types/compute.js";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<NodeReservationStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending_funding: { label: "Pending funding", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400", icon: <Clock className="h-3 w-3" /> },
  spot_held: { label: "Spot held", color: "bg-sky-500/10 text-sky-600 dark:text-sky-400", icon: <WalletMinimal className="h-3 w-3" /> },
  awaiting_confirm: { label: "Awaiting confirm", color: "bg-violet-500/10 text-violet-600 dark:text-violet-400", icon: <Loader2 className="h-3 w-3" /> },
  confirmed: { label: "Confirmed", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", icon: <CircleCheck className="h-3 w-3" /> },
  released: { label: "Released", color: "bg-muted text-muted-foreground", icon: <CircleX className="h-3 w-3" /> },
};

function formatQubic(amount: string | null): string {
  if (!amount) return "—";
  const n = BigInt(amount);
  // Display in millions for legibility.
  const million = BigInt(1_000_000);
  const millions = Number(n / million);
  return millions >= 1 ? `${(millions / 1_000_000).toFixed(2)}M` : n.toString();
}

function formatUsdCents(cents: string): string {
  return `$${(Number(cents) / 100).toFixed(2)}`;
}

export default async function NodeReservationsPage() {
  const aigarth = getAigarth();
  if (!aigarth) redirect("/login?next=/dashboard/nodes");

  let reservations: NodeReservation[] = [];
  let loadError: string | null = null;
  try {
    const r = await aigarth.compute.nodeReservations.list();
    reservations = r.data;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load reservations";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compute node reservations"
        description="Tier 1 hardware presale. Reserve, hold, confirm when mainnet launches."
        action={
          <Button asChild>
            <Link href="/nodes">
              Reserve a new node
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        }
      />

      {loadError && (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">
              Could not load reservations: {loadError}
            </p>
          </CardContent>
        </Card>
      )}

      {!loadError && reservations.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <Wallet className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">No reservations yet</h3>
            <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
              Reserve a tier 1 compute spot for $30. The deposit is fully refundable any time before mainnet.
            </p>
            <Button asChild className="mt-6">
              <Link href="/nodes">Reserve a node for $30</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {reservations.length > 0 && (
        <div className="grid gap-4">
          {reservations.map((r) => {
            const s = STATUS_LABELS[r.status];
            return (
              <Card key={r.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        Tier {r.tier} reservation
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${s.color}`}>
                          {s.icon}
                          {s.label}
                        </span>
                      </CardTitle>
                      <CardDescription>
                        Reserved {new Date(r.created_at).toLocaleString()}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">Deposit</div>
                      <div className="text-lg font-medium">{formatUsdCents(r.deposit_usd_cents)}</div>
                      <div className="text-xs text-muted-foreground">{formatQubic(r.deposit_qubic)} QUBIC</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">Balance</div>
                      <div className="mt-1 text-sm font-medium">
                        {r.balance_usd_cents ? formatUsdCents(r.balance_usd_cents) : "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.balance_qubic ? `${formatQubic(r.balance_qubic)} QUBIC` : "due at confirm"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">Yield accrued</div>
                      <div className="mt-1 text-sm font-medium">
                        {Number(r.yield_credit_qubic) > 0
                          ? formatQubic(r.yield_credit_qubic) + " QUBIC"
                          : r.yield_opt_in
                            ? "Accruing (opt-in)"
                            : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">Window</div>
                      <div className="mt-1 text-sm font-medium">
                        {r.confirm_window_opens_at
                          ? new Date(r.confirm_window_opens_at).toLocaleDateString()
                          : "Opens at mainnet"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.confirm_window_closes_at
                          ? `closes ${new Date(r.confirm_window_closes_at).toLocaleDateString()}`
                          : "14-day window"}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    {(r.status === "spot_held" || r.status === "awaiting_confirm") && (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/nodes/${r.id}/release`}>
                          Release
                        </Link>
                      </Button>
                    )}
                    {r.status === "awaiting_confirm" && (
                      <Button asChild size="sm">
                        <Link href={`/dashboard/nodes/${r.id}/confirm`}>
                          Confirm
                          <ArrowRight className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    )}
                    {r.tx_hash_reserve && (
                      <a
                        href={`https://testnet-explorer.qubic.org/tx/${r.tx_hash_reserve}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Deposit tx
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {r.tx_hash_confirm && (
                      <a
                        href={`https://testnet-explorer.qubic.org/tx/${r.tx_hash_confirm}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Balance tx
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Yield is computed at 5% APY in the marketing stub. The real Qearn rate will replace this at mainnet.{" "}
        <Link href="/nodes" className="underline">See the marketing page for the full FAQ.</Link>
      </p>
    </div>
  );
}
