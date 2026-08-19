"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@aigarth/ui";
import { Gift, ArrowDownRight } from "lucide-react";

export default function RewardsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Rewards"
        description="Track staking rewards, distributions, and yield history."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total earned", value: "12,840", unit: "QUBIC" },
          { label: "Today", value: "12.4", unit: "QUBIC" },
          { label: "This week", value: "84.2", unit: "QUBIC" },
          { label: "Avg daily", value: "11.6", unit: "QUBIC" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-5">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-2xl font-medium tracking-tight">
              {s.value}<span className="ml-1 text-sm font-normal text-muted-foreground">{s.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h3 className="font-semibold">Reward history</h3>
        <div className="mt-4 space-y-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-mint-500/10 text-mint-600">
                <ArrowDownRight className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">Daily staking reward</div>
                <div className="text-xs text-muted-foreground">Builder position · {i + 1} day{i === 0 ? "" : "s"} ago</div>
              </div>
              <div className="font-mono text-sm text-mint-600 dark:text-mint-400">
                +{(8 + Math.random() * 6).toFixed(2)} QUBIC
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
