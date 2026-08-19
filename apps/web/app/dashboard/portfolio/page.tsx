"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@aigarth/ui";
import { Badge } from "@aigarth/ui";
import { Plus, ArrowUpRight, ArrowDownRight, Wallet, Flame, TrendingUp, Coins } from "lucide-react";

export default function PortfolioPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfolio"
        description="Your stakes, rewards, and token flows across the Aigarth network."
        action={{ label: "Stake more", icon: Plus }}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total staked", value: "50,000,000", unit: "QUBIC", sub: "Builder plan", icon: Wallet, color: "garden" },
          { label: "Available balance", value: "8,420,000", unit: "QUBIC", sub: "Withdrawable", icon: Coins, color: "mint" },
          { label: "Lifetime rewards", value: "12,840", unit: "QUBIC", sub: "Since start", icon: TrendingUp, color: "amber" },
          { label: "Burn contribution", value: "184,290", unit: "QUBIC", sub: "Last 30 days", icon: Flame, color: "orange" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl border bg-card p-5">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-${s.color}-500/10 text-${s.color}-600`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="mt-4 text-xs text-muted-foreground">{s.label}</div>
              <div className="mt-1 text-2xl font-medium tracking-tight">
                {s.value}
                <span className="ml-1 text-sm font-normal text-muted-foreground">{s.unit}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{s.sub}</div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h3 className="font-semibold">Active positions</h3>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-3 text-left">Position</th>
                <th className="py-3 text-right">Stake</th>
                <th className="py-3 text-right">Allocated</th>
                <th className="py-3 text-right">Yield (APY)</th>
                <th className="py-3 text-right">Earned</th>
                <th className="py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: "Builder · 50M", desc: "Reserved compute", stake: "50,000,000", alloc: "48 GPU-hr/d", apy: "8.4%", earned: "12,840", status: "Active" },
                { name: "Staker pool A1", desc: "Community delegation", stake: "8,000,000", alloc: "Best-effort", apy: "5.2%", earned: "1,204", status: "Active" },
                { name: "Liquidity provision", desc: "AMM pool", stake: "420,000", alloc: "-", apy: "3.1%", earned: "84", status: "Active" },
              ].map((p, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  <td className="py-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.desc}</div>
                  </td>
                  <td className="py-3 text-right font-mono">{p.stake}</td>
                  <td className="py-3 text-right font-mono text-sm">{p.alloc}</td>
                  <td className="py-3 text-right font-mono text-mint-600 dark:text-mint-400">{p.apy}</td>
                  <td className="py-3 text-right font-mono">+{p.earned}</td>
                  <td className="py-3 text-right">
                    <Badge variant="success">{p.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <h3 className="font-semibold">Recent transactions</h3>
          <div className="mt-4 space-y-3">
            {[
              { type: "stake", label: "Staked", amount: "50,000,000", token: "QUBIC", time: "2 days ago" },
              { type: "reward", label: "Daily reward", amount: "+12.4", token: "QUBIC", time: "1 day ago" },
              { type: "burn", label: "Burn distribution", amount: "-184", token: "QUBIC", time: "1 day ago" },
              { type: "fee", label: "Inference fee", amount: "-0.42", token: "QUBIC", time: "2 hours ago" },
              { type: "reward", label: "Weekly reward", amount: "+84.2", token: "QUBIC", time: "1 week ago" },
            ].map((t, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-md ${
                  t.type === "stake" ? "bg-garden-500/10 text-garden-600" :
                  t.type === "reward" ? "bg-mint-500/10 text-mint-600" :
                  t.type === "burn" ? "bg-orange-500/10 text-orange-500" :
                  "bg-stone-500/10 text-stone-500"
                }`}>
                  {t.type === "reward" ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{t.label}</div>
                  <div className="text-xs text-muted-foreground">{t.time}</div>
                </div>
                <div className="font-mono text-sm">{t.amount} {t.token}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h3 className="font-semibold">Token flow (30d)</h3>
          <p className="mt-1 text-sm text-muted-foreground">Net position across the network</p>
          <div className="mt-6 space-y-5">
            {[
              { label: "Staking rewards", value: 1240, color: "bg-mint-500" },
              { label: "Marketplace fees", value: 480, color: "bg-garden-500" },
              { label: "Oracle revenue", value: 320, color: "bg-emerald-500" },
              { label: "Inference usage", value: -2840, color: "bg-orange-500" },
              { label: "Burn contribution", value: -184, color: "bg-red-500" },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-sm">
                  <span>{row.label}</span>
                  <span className={`font-mono ${row.value >= 0 ? "text-mint-600 dark:text-mint-400" : "text-orange-500"}`}>
                    {row.value >= 0 ? "+" : ""}{row.value} QUBIC
                  </span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${row.color}`}
                    style={{ width: `${Math.min(100, Math.abs(row.value) / 30)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
