"use client";

import * as React from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@aigarth/ui";
import { Input } from "@aigarth/ui";
import { Badge } from "@aigarth/ui";
import { User, Building, Shield, ScrollText } from "lucide-react";
import { cn } from "@aigarth/utils";

const SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "organizations", label: "Organizations", icon: Building },
  { id: "security", label: "Security", icon: Shield },
  { id: "audit", label: "Audit logs", icon: ScrollText },
];

export default function SettingsPage() {
  const [active, setActive] = React.useState("profile");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your account, organizations, and security preferences."
      />
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <nav className="space-y-1">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  active === s.id ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"
                )}
              >
                <Icon className="h-4 w-4" />
                {s.label}
              </button>
            );
          })}
        </nav>
        <div className="space-y-6">
          {active === "profile" && <ProfileSection />}
          {active === "organizations" && <OrganizationsSection />}
          {active === "security" && <SecuritySection />}
          {active === "audit" && <AuditSection />}
        </div>
      </div>
    </div>
  );
}

function ProfileSection() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-6">
        <h3 className="font-semibold">Profile</h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium">Full name</label>
            <Input defaultValue="Jordan Lee" className="mt-1.5" />
          </div>
          <div>
            <label className="text-xs font-medium">Email</label>
            <Input defaultValue="jordan@helixlabs.ai" className="mt-1.5" />
          </div>
          <div>
            <label className="text-xs font-medium">Display name</label>
            <Input defaultValue="Jordan L." className="mt-1.5" />
          </div>
          <div>
            <label className="text-xs font-medium">Time zone</label>
            <Input defaultValue="America/New_York" className="mt-1.5" />
          </div>
        </div>
        <div className="mt-5">
          <Button>Save changes</Button>
        </div>
      </div>
    </div>
  );
}

function OrganizationsSection() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Organizations</h3>
          <Button size="sm">New organization</Button>
        </div>
        <div className="mt-4 space-y-2">
          {[
            { name: "Helix Labs", role: "Owner", members: 12, plan: "Business" },
            { name: "Personal", role: "Owner", members: 1, plan: "Builder" },
          ].map((o) => (
            <div key={o.name} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-garden-500 to-emerald-500 text-sm font-medium text-white">
                {o.name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{o.name}</div>
                <div className="text-xs text-muted-foreground">{o.members} members · {o.plan}</div>
              </div>
              <Badge>{o.role}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SecuritySection() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-6">
        <h3 className="font-semibold">Authentication</h3>
        <div className="mt-4 space-y-3">
          {[
            { label: "Two-factor authentication", status: "Enabled", desc: "Authenticator app" },
            { label: "Hardware security key", status: "Not configured", desc: "YubiKey, Ledger" },
            { label: "Single sign-on", status: "Disabled", desc: "Available on Business plans" },
            { label: "Session timeout", status: "7 days", desc: "Auto logout after inactivity" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex-1">
                <div className="text-sm font-medium">{s.label}</div>
                <div className="text-xs text-muted-foreground">{s.desc}</div>
              </div>
              <Badge variant={s.status === "Enabled" ? "success" : "secondary"}>{s.status}</Badge>
              <Button size="sm" variant="outline">Configure</Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AuditSection() {
  return (
    <div className="rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-6 py-3 text-left">Time</th>
            <th className="px-6 py-3 text-left">Event</th>
            <th className="px-6 py-3 text-left">IP</th>
            <th className="px-6 py-3 text-left">Location</th>
            <th className="px-6 py-3 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }).map((_, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              <td className="px-6 py-3 text-muted-foreground">{i * 2 + 1}h ago</td>
              <td className="px-6 py-3">API key used</td>
              <td className="px-6 py-3 font-mono text-xs">192.168.1.{i + 1}</td>
              <td className="px-6 py-3 text-muted-foreground">New York, US</td>
              <td className="px-6 py-3"><Badge variant="success">Success</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
