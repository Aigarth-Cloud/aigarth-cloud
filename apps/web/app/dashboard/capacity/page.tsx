import { redirect } from "next/navigation";
import { Coins, Wallet, Layers } from "lucide-react";
import { Badge } from "@aigarth/ui";
import { PageHeader } from "@/components/dashboard/page-header";
import { getAigarth } from "@/lib/server/aigarth";
import { getSession } from "@/lib/server/session";

interface RawReservation {
  id: string;
  principal_qubic: string;
  credit_qubic: string;
  used_qubic: string;
  remaining_qubic: string;
  fee_bps: number;
  epochs: number;
  start_epoch: number;
  end_epoch: number;
  status: string;
  tx_hash: string | null;
  qubic_wallet_id: string | null;
  released_at: string | null;
  created_at: string;
  updated_at: string;
}

interface RawWallet {
  id: string;
  qubic_address: string;
  network: string;
  stake_authorized: boolean;
  created_at: string;
}

function fmtQu(qubic: string | number | bigint | undefined, digits = 2): string {
  if (qubic === undefined || qubic === null) return " ";
  const v = Number(qubic) / 1_000_000;
  if (!Number.isFinite(v)) return " ";
  return `${v.toLocaleString("en-US", { maximumFractionDigits: digits })} Qu`;
}

export default async function CapacityPage() {
  const session = getSession();
  if (!session) redirect("/login");

  const a = getAigarth()!;

  const [credit, reservationsRes, walletsRes, stats] = await Promise.all([
    a.compute.credit().catch(() => null),
    a.compute.reservations.list({ limit: 20 }).catch(() => ({ data: [] as RawReservation[] })),
    a.qubic.wallets.list().catch(() => ({ data: [] as RawWallet[] })),
    a.compute.stats().catch(() => null),
  ]);

  const reservations = (reservationsRes.data as unknown as RawReservation[]) ?? [];
  const wallets = (walletsRes.data as unknown as RawWallet[]) ?? [];

  const total = credit ? Number(credit.total_credit_qubic) : 0;
  const used = credit ? Number(credit.used_qubic) : 0;
  const remaining = credit ? Number(credit.remaining_qubic) : 0;
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Capacity"
        description="Your compute credit, reservations, and Qubic wallet links."
        action={
          <Badge variant="outline" className="gap-1.5">
            <Coins className="h-3 w-3" />
            {fmtQu(remaining)} remaining
          </Badge>
        }
      />

      {/* Credit card */}
      {credit && (
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Compute credit</h3>
              <p className="text-sm text-muted-foreground">
                Total reserved: {fmtQu(total)} · {credit.active_reservation_count} active reservation{credit.active_reservation_count === 1 ? "" : "s"}
              </p>
            </div>
            <Badge variant={pct > 80 ? "warning" : "success"}>
              {pct.toFixed(0)}% used
            </Badge>
          </div>
          <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-garden-500 to-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Used</div>
              <div className="font-medium">{fmtQu(used)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Remaining</div>
              <div className="font-medium text-primary">{fmtQu(remaining)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Lifetime spent</div>
              <div className="font-medium">
                {fmtQu(stats ? stats.total_spent_qubic : 0)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Reservations */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b p-6">
            <div>
              <h3 className="flex items-center gap-2 font-semibold">
                <Layers className="h-4 w-4" /> Reservations
              </h3>
              <p className="text-sm text-muted-foreground">
                {reservations.length} reservation{reservations.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <div className="divide-y">
            {reservations.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No reservations yet.
              </div>
            ) : (
              reservations.map((r) => (
                <div key={r.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-xs">{r.id.slice(0, 8)}</div>
                    <Badge
                      variant={
                        r.status === "active"
                          ? "success"
                          : r.status === "released"
                            ? "secondary"
                            : "warning"
                      }
                    >
                      {r.status}
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Principal</div>
                      <div className="font-mono">{fmtQu(r.principal_qubic, 2)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Remaining</div>
                      <div className="font-mono">{fmtQu(r.remaining_qubic, 2)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Epochs</div>
                      <div className="font-mono">
                        {r.epochs} ({r.start_epoch} → {r.end_epoch})
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Fee</div>
                      <div className="font-mono">{(r.fee_bps / 100).toFixed(2)}%</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Wallets */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b p-6">
            <div>
              <h3 className="flex items-center gap-2 font-semibold">
                <Wallet className="h-4 w-4" /> Qubic wallets
              </h3>
              <p className="text-sm text-muted-foreground">
                {wallets.length} linked wallet{wallets.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <div className="divide-y">
            {wallets.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No wallets linked. Use the Qubic service to link one.
              </div>
            ) : (
              wallets.map((w) => (
                <div key={w.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-xs">{w.qubic_address.slice(0, 12)}…</div>
                    <Badge variant="outline">{w.network}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Staking authorized: {w.stake_authorized ? "✓ yes" : "no"} · linked {new Date(w.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
