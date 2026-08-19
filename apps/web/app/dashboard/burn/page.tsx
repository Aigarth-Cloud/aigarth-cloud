"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { Flame } from "lucide-react";

export default function BurnPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Burn history"
        description="Token burn events from protocol fees. Total supply reduction is verifiable on-chain."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total burned (30d)", value: "184,290", unit: "QUBIC" },
          { label: "Burn rate (24h)", value: "6,210", unit: "QUBIC" },
          { label: "Network burn (24h)", value: "1.4M", unit: "QUBIC" },
          { label: "Your share", value: "0.44%", unit: "" },
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
        <h3 className="font-semibold">Recent burn events</h3>
        <div className="mt-4 space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-orange-500/10 text-orange-500">
                <Flame className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">Protocol fee burn</div>
                <div className="font-mono text-xs text-muted-foreground">
                  0x4f2a9c1a8a12{i}b8214d2e...{Math.random().toString(36).substring(2, 8)}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm text-orange-500">
                  −{(5000 + Math.random() * 3000).toFixed(0)} QUBIC
                </div>
                <div className="text-xs text-muted-foreground">{i + 1}h ago</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
