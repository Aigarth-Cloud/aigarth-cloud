import { redirect } from "next/navigation";
import { Gavel, ShoppingBag, Clock } from "lucide-react";
import { Badge } from "@aigarth/ui";
import { PageHeader } from "@/components/dashboard/page-header";
import { getAigarth } from "@/lib/server/aigarth";
import { getSession } from "@/lib/server/session";

interface RawListing {
  id: string;
  slug: string;
  title: string;
  description: string;
  kind: string;
  seller_name: string;
  region_id: string;
  cluster_id: string;
  capacity_amount_qubic: string;
  capacity_remaining_qubic: string;
  price_per_unit_qubic: string;
  duration_seconds: string;
  min_purchase_qubic: string;
  status: string;
  rating_average: number;
  rating_count: number;
  total_offers: number;
  total_purchases: number;
}

interface RawAuction {
  id: string;
  slug: string;
  title: string;
  description: string;
  kind: "dutch" | "english" | "sealed_bid";
  seller_name: string;
  capacity_amount_qubic: string;
  start_price_qubic: string;
  min_price_qubic: string;
  current_price_qubic: string | null;
  current_winning_bid_qubic: string | null;
  status: string;
  starts_at: string;
  ends_at: string;
}

function fmtQu(qubic: string | number | bigint | undefined, digits = 2): string {
  if (qubic === undefined || qubic === null) return " ";
  const v = Number(qubic) / 1_000_000;
  if (!Number.isFinite(v)) return " ";
  return `${v.toLocaleString("en-US", { maximumFractionDigits: digits })} Qu`;
}

function fmtDuration(seconds: number): string {
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function fmtEndsAt(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "ended";
  if (ms < 60_000) return "< 1m";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
  return `${Math.floor(ms / 86_400_000)}d`;
}

export default async function MarketplacePage() {
  const session = getSession();
  if (!session) redirect("/login");

  const a = getAigarth()!;
  const [listingsRes, auctionsRes] = await Promise.all([
    a.marketplace.listings.list({ limit: 30 }).catch(() => ({ data: [] as RawListing[] })),
    a.marketplace.auctions.list().catch(() => ({ data: [] as RawAuction[] })),
  ]);

  const listings = (listingsRes.data as unknown as RawListing[]) ?? [];
  const auctions = (auctionsRes.data as unknown as RawAuction[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketplace"
        description="Buy and sell compute capacity across the Aigarth network."
        action={
          <div className="flex items-center gap-2">
            <Badge variant="outline">{listings.length} listings</Badge>
            <Badge variant="outline">{auctions.length} auctions</Badge>
          </div>
        }
      />

      {/* Listings */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <ShoppingBag className="h-4 w-4" /> Listings
        </h3>
        {listings.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            No active listings.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <div key={l.id} className="rounded-xl border bg-card p-5 transition-colors hover:bg-accent/30">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">{l.title}</h4>
                  <Badge variant="outline">{l.kind}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {l.description}
                </p>
                <dl className="mt-4 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Price</dt>
                    <dd className="font-mono">{fmtQu(l.price_per_unit_qubic, 4)}/u</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Available</dt>
                    <dd className="font-mono">{fmtQu(l.capacity_remaining_qubic, 0)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Duration</dt>
                    <dd className="font-mono">{fmtDuration(Number(l.duration_seconds))}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Seller</dt>
                    <dd>{l.seller_name}</dd>
                  </div>
                </dl>
                {l.total_purchases > 0 && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    {l.total_purchases} purchase{l.total_purchases === 1 ? "" : "s"} ·
                    {" "}rating {l.rating_average.toFixed(1)}/5 ({l.rating_count})
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Auctions */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Gavel className="h-4 w-4" /> Auctions
        </h3>
        {auctions.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            No active auctions.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {auctions.map((a) => {
              const priceStr =
                a.kind === "dutch"
                  ? fmtQu(a.current_price_qubic ?? a.start_price_qubic, 4)
                  : a.kind === "english"
                    ? fmtQu(a.current_winning_bid_qubic ?? a.start_price_qubic, 4)
                    : `${fmtQu(a.start_price_qubic, 4)} (sealed)`;
              return (
                <div key={a.id} className="rounded-xl border bg-card p-5 transition-colors hover:bg-accent/30">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{a.title}</h4>
                    <Badge
                      variant={
                        a.kind === "dutch"
                          ? "warning"
                          : a.kind === "english"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {a.kind}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {a.description}
                  </p>
                  <dl className="mt-4 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Price</dt>
                      <dd className="font-mono">{priceStr}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Min</dt>
                      <dd className="font-mono">{fmtQu(a.min_price_qubic, 4)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Capacity</dt>
                      <dd className="font-mono">{fmtQu(a.capacity_amount_qubic, 0)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Status</dt>
                      <dd>
                        <Badge
                          variant={
                            a.status === "live"
                              ? "success"
                              : a.status === "ended" || a.status === "settled"
                                ? "secondary"
                                : "warning"
                          }
                        >
                          {a.status}
                        </Badge>
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {a.status === "scheduled"
                      ? `starts in ${fmtEndsAt(a.starts_at)}`
                      : a.status === "live"
                        ? `ends in ${fmtEndsAt(a.ends_at)}`
                        : a.status}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
