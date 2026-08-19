"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@aigarth/ui";
import { Button } from "@aigarth/ui";
import { Vote, Clock, Check, X } from "lucide-react";

export default function GovernancePage() {
  const proposals = [
    { id: "AIP-042", title: "Lower image generation fees by 12%", desc: "Reduce per-call cost for image APIs to drive adoption.", votes: 78, status: "Active", time: "2d left", for: "62%", against: "24%", abstain: "14%" },
    { id: "AIP-041", title: "Add Grok-2 to the model registry", desc: "Add Grok-2 as a supported base model for fine-tuning.", votes: 92, status: "Active", time: "5d left", for: "78%", against: "12%", abstain: "10%" },
    { id: "AIP-040", title: "Increase enterprise SLA compensation", desc: "Raise the auto-compensation rate for SLA misses from 5% to 12% of monthly bill.", votes: 61, status: "Active", time: "8d left", for: "47%", against: "31%", abstain: "22%" },
    { id: "AIP-039", title: "Reduce burn rate to 12%", desc: "Lower protocol burn from 15% to 12% to increase staker yield.", votes: 100, status: "Passed", time: "12d ago", for: "71%", against: "19%", abstain: "10%" },
    { id: "AIP-038", title: "Add Cairo as supported language", desc: "Extend the SDK to include Cairo smart contract bindings.", votes: 0, status: "Failed", time: "20d ago", for: "32%", against: "55%", abstain: "13%" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Governance"
        description="Vote on proposals. Your voting weight is proportional to your active stake."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-5">
          <div className="text-xs text-muted-foreground">Your voting weight</div>
          <div className="mt-1 text-2xl font-medium tracking-tight">2.5x</div>
          <div className="mt-1 text-xs text-muted-foreground">Builder plan (50M QUBIC)</div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="text-xs text-muted-foreground">Votes cast</div>
          <div className="mt-1 text-2xl font-medium tracking-tight">12</div>
          <div className="mt-1 text-xs text-muted-foreground">Last 90 days</div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="text-xs text-muted-foreground">Voter participation</div>
          <div className="mt-1 text-2xl font-medium tracking-tight">68%</div>
          <div className="mt-1 text-xs text-muted-foreground">Network-wide, 30d</div>
        </div>
      </div>

      <div className="space-y-4">
        {proposals.map((p) => (
          <div key={p.id} className="rounded-xl border bg-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{p.id}</span>
                  <span>·</span>
                  <Clock className="h-3 w-3" />
                  <span>{p.time}</span>
                </div>
                <h3 className="mt-1 font-semibold">{p.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
              </div>
              <Badge variant={p.status === "Passed" ? "success" : p.status === "Failed" ? "destructive" : "glow"}>
                {p.status}
              </Badge>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-mint-600 dark:text-mint-400">For</span>
                  <span className="font-mono">{p.for}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-mint-500" style={{ width: p.for }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-red-500">Against</span>
                  <span className="font-mono">{p.against}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-red-500" style={{ width: p.against }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Abstain</span>
                  <span className="font-mono">{p.abstain}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-stone-400" style={{ width: p.abstain }} />
                </div>
              </div>
            </div>
            {p.status === "Active" && (
              <div className="mt-5 flex gap-2">
                <Button size="sm" className="gap-1.5">
                  <Check className="h-3.5 w-3.5" />
                  Vote for
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <X className="h-3.5 w-3.5" />
                  Vote against
                </Button>
                <Button size="sm" variant="ghost">Abstain</Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
