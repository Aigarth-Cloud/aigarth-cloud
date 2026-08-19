"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@aigarth/ui";
import { Badge } from "@aigarth/ui";
import { Plus, Building2, Users } from "lucide-react";

export default function OrganizationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        description="Manage organizations, members, and roles."
        action={{ label: "New organization", icon: Plus }}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { name: "Helix Labs", members: 12, plan: "Business", stake: "50M QUBIC", role: "Owner" },
          { name: "Personal", members: 1, plan: "Builder", stake: "8M QUBIC", role: "Owner" },
        ].map((o) => (
          <div key={o.name} className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-garden-500 to-emerald-500 text-base font-medium text-white">
                {o.name.charAt(0)}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{o.name}</h3>
                <div className="text-xs text-muted-foreground">{o.role} · {o.plan}</div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4 text-xs">
              <div>
                <div className="text-muted-foreground">Members</div>
                <div className="mt-0.5 font-mono">{o.members}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Plan</div>
                <div className="mt-0.5 font-mono">{o.plan}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Staked</div>
                <div className="mt-0.5 font-mono">{o.stake}</div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="outline" className="flex-1">Manage</Button>
              <Button size="sm" variant="ghost" className="flex-1">Members</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
