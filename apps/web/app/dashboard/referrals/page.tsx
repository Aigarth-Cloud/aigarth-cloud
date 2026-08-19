"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@aigarth/ui";
import { Badge } from "@aigarth/ui";
import { Copy, Users, Gift } from "lucide-react";

export default function ReferralsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Referrals"
        description="Invite teams and earn a share of their protocol fees for 12 months."
      />

      <div className="rounded-xl border bg-gradient-to-br from-garden-500/10 to-emerald-500/5 p-6">
        <h3 className="font-semibold">Your referral link</h3>
        <p className="mt-1 text-sm text-muted-foreground">Share this link. Earn 15% of their protocol fees for 12 months.</p>
        <div className="mt-4 flex items-center gap-2">
          <div className="flex-1 rounded-lg border bg-background px-3 py-2 font-mono text-sm">
            https://aigarth.cloud/?ref=jordan-4f2a
          </div>
          <Button className="gap-1.5">
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Active referrals", value: "12", icon: Users },
          { label: "Lifetime earnings", value: "284", unit: "QUBIC", icon: Gift },
          { label: "This month", value: "84.2", unit: "QUBIC", icon: Gift },
          { label: "Conversion rate", value: "24%", icon: Users },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl border bg-card p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div className="mt-4 text-xs text-muted-foreground">{s.label}</div>
              <div className="mt-1 text-2xl font-medium tracking-tight">
                {s.value}
                {s.unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{s.unit}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h3 className="font-semibold">Your referrals</h3>
        <div className="mt-4 space-y-2">
          {[
            { name: "Vector Capital", stake: "78M QUBIC", joined: "12d ago", earnings: "84.20" },
            { name: "Northwind AI", stake: "21M QUBIC", joined: "24d ago", earnings: "32.10" },
            { name: "Aurora Audio", stake: "18M QUBIC", joined: "32d ago", earnings: "48.40" },
            { name: "Lumen Legal", stake: "32M QUBIC", joined: "60d ago", earnings: "62.10" },
          ].map((r) => (
            <div key={r.name} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-garden-500 to-emerald-500 text-xs font-medium text-white">
                {r.name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{r.name}</div>
                <div className="text-xs text-muted-foreground">Staked {r.stake} · joined {r.joined}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm text-mint-600 dark:text-mint-400">+{r.earnings} QUBIC</div>
                <Badge variant="success" className="mt-1">Active</Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
