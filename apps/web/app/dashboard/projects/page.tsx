"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@aigarth/ui";
import { Button } from "@aigarth/ui";
import { Plus, Folder, Key, Activity, MoreHorizontal } from "lucide-react";

export default function ProjectsPage() {
  const projects = [
    { name: "heli-prod", desc: "Customer-facing AI", env: "Production", keys: 3, calls: "412K", cost: "184.20" },
    { name: "heli-staging", desc: "Pre-prod testing", env: "Staging", keys: 1, calls: "82K", cost: "32.10" },
    { name: "vision-canvas", desc: "Image generation app", env: "Production", keys: 2, calls: "8.4K", cost: "164.80" },
    { name: "internal-tools", desc: "Internal automation", env: "Development", keys: 1, calls: "12K", cost: "8.40" },
    { name: "data-enrichment", desc: "Bulk enrichment", env: "Production", keys: 1, calls: "1.2M", cost: "62.10" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Organize work by project. Each project has its own keys, usage, and billing."
        action={{ label: "New project", icon: Plus }}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <div key={p.name} className="rounded-xl border bg-card p-5 card-hover">
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Folder className="h-4 w-4" />
              </div>
              <Badge variant={p.env === "Production" ? "default" : p.env === "Staging" ? "warning" : "secondary"}>
                {p.env}
              </Badge>
            </div>
            <h3 className="mt-4 font-medium">{p.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-xs">
              <div>
                <div className="text-muted-foreground">Keys</div>
                <div className="mt-0.5 font-mono">{p.keys}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Calls (7d)</div>
                <div className="mt-0.5 font-mono">{p.calls}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Cost (7d)</div>
                <div className="mt-0.5 font-mono">{p.cost}</div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="outline" className="flex-1">Manage</Button>
              <Button size="sm" variant="ghost" className="px-2">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
