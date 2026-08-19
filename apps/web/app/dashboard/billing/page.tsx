import { redirect } from "next/navigation";
import { Check, Coins, CreditCard, Receipt } from "lucide-react";
import { Badge, Button } from "@aigarth/ui";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { getAigarth } from "@/lib/server/aigarth";
import { getSession } from "@/lib/server/session";

interface RawPlan {
  id: string;
  name: string;
  description: string | null;
  tier: string;
  monthly_price_qubic: string;
  included_tokens: string;
  overage_rate_qubic_per_1k: string;
  signup_credits_qubic: string;
  features: string[];
  is_active: boolean;
  sort_order: number;
}

interface RawSubscription {
  id: string;
  plan_id: string;
  status: string;
  payment_method: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  started_at: string;
}

interface RawInvoice {
  id: string;
  number: string;
  status: string;
  subtotal_qubic: string;
  total_qubic: string;
  paid_qubic: string;
  paid_at: string | null;
  due_at: string | null;
  period_start: string;
  period_end: string;
  created_at: string;
}

function fmtQu(qubic: string | number | bigint | undefined): string {
  if (qubic === undefined || qubic === null) return " ";
  const v = Number(qubic) / 1_000_000;
  if (!Number.isFinite(v)) return " ";
  return `${v.toLocaleString("en-US", { maximumFractionDigits: 2 })} Qu`;
}

function fmtTokens(t: string | number | bigint | undefined): string {
  if (t === undefined || t === null) return " ";
  const v = Number(t);
  if (!Number.isFinite(v)) return " ";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toString();
}

export default async function BillingPage() {
  const session = getSession();
  if (!session) redirect("/login");

  const a = getAigarth()!;

  const [plansRes, subsRes, invoicesRes, creditsRes] = await Promise.all([
    a.billing.plans.list().catch(() => ({ data: [] as RawPlan[] })),
    a.billing.subscriptions.list().catch(() => ({ data: [] as RawSubscription[] })),
    a.billing.invoices.list().catch(() => ({ data: [] as RawInvoice[] })),
    a.billing.credits.list().catch(() => ({ active_total_qubic: "0", data: [] })),
  ]);

  const plans = (plansRes.data as unknown as RawPlan[]) ?? [];
  const subs = (subsRes.data as unknown as RawSubscription[]) ?? [];
  const invoices = (invoicesRes.data as unknown as RawInvoice[]) ?? [];
  const credits = creditsRes as unknown as { active_total_qubic: string; data: unknown[] };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Plans, subscriptions, invoices, and credits."
        action={
          <Badge variant="outline" className="gap-1.5">
            <Coins className="h-3 w-3" />
            {fmtQu(credits.active_total_qubic)} credits
          </Badge>
        }
      />

      {/* Active subscription */}
      {subs.length > 0 && (
        <div className="rounded-xl border bg-card p-6">
          <h3 className="font-semibold">Active subscription</h3>
          <div className="mt-4 space-y-3">
            {subs.map((s) => {
              const plan = plans.find((p) => p.id === s.plan_id);
              return (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                  <div>
                    <div className="font-medium">{plan?.name ?? s.plan_id}</div>
                    <div className="text-xs text-muted-foreground">
                      Status: <span className="font-mono">{s.status}</span> · payment: <span className="font-mono">{s.payment_method}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Current period: {new Date(s.current_period_start).toLocaleDateString()} – {new Date(s.current_period_end).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.cancel_at_period_end && <Badge variant="warning">cancels at period end</Badge>}
                    {s.status === "active" || s.status === "trialing" ? (
                      <Badge variant="success">{s.status}</Badge>
                    ) : (
                      <Badge variant="secondary">{s.status}</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Plans */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">Plans</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.sort((a, b) => a.sort_order - b.sort_order).map((p) => (
            <div
              key={p.id}
              className="rounded-xl border bg-card p-5 transition-colors hover:bg-accent/30"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">{p.name}</h4>
                {p.tier === "pro" && <Badge>Popular</Badge>}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-medium tracking-tight">
                  {p.monthly_price_qubic === "0" ? "Free" : fmtQu(p.monthly_price_qubic)}
                </span>
                {p.monthly_price_qubic !== "0" && (
                  <span className="text-sm text-muted-foreground">/mo</span>
                )}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {fmtTokens(p.included_tokens)} tokens included
              </div>
              <ul className="mt-4 space-y-1.5 text-xs">
                {(p.features ?? []).slice(0, 4).map((f) => (
                  <li key={f} className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              {Number(p.signup_credits_qubic) > 0 && (
                <div className="mt-3 text-xs text-mint-600 dark:text-mint-400">
                  +{fmtQu(p.signup_credits_qubic)} signup credits
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Invoices */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b p-6">
          <div>
            <h3 className="flex items-center gap-2 font-semibold">
              <Receipt className="h-4 w-4" /> Invoices
            </h3>
            <p className="text-sm text-muted-foreground">
              {invoices.length} {invoices.length === 1 ? "invoice" : "invoices"}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 text-left">Number</th>
                <th className="px-6 py-3 text-left">Period</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-right">Total</th>
                <th className="px-6 py-3 text-right">Paid</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    No invoices yet.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-border/50 last:border-0">
                    <td className="px-6 py-3 font-mono text-xs">{inv.number}</td>
                    <td className="px-6 py-3 text-muted-foreground">
                      {new Date(inv.period_start).toLocaleDateString()} – {new Date(inv.period_end).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3">
                      <Badge
                        variant={
                          inv.status === "paid"
                            ? "success"
                            : inv.status === "open"
                              ? "warning"
                              : "secondary"
                        }
                      >
                        {inv.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 text-right font-mono">{fmtQu(inv.total_qubic)}</td>
                    <td className="px-6 py-3 text-right font-mono text-muted-foreground">
                      {fmtQu(inv.paid_qubic)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
