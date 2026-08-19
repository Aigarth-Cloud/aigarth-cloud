"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@aigarth/ui";
import { Button } from "@aigarth/ui";
import { Shield, Check } from "lucide-react";

export default function SecurityPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Security"
        description="Authentication, devices, and security posture for your account."
      />

      <div className="rounded-xl border bg-gradient-to-br from-garden-500/10 to-emerald-500/5 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-mint-500/20">
            <Shield className="h-6 w-6 text-mint-600" />
          </div>
          <div>
            <h3 className="font-semibold">Your account is secure</h3>
            <p className="text-sm text-muted-foreground">All recommended security measures are in place.</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h3 className="font-semibold">Authentication</h3>
        <div className="mt-4 space-y-3">
          {[
            { label: "Two-factor authentication", desc: "Authenticator app configured", enabled: true },
            { label: "Hardware security key", desc: "Not configured", enabled: false },
            { label: "Single sign-on", desc: "Available on Business plans", enabled: false },
            { label: "Backup codes", desc: "10 of 10 unused", enabled: true },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex-1">
                <div className="text-sm font-medium">{s.label}</div>
                <div className="text-xs text-muted-foreground">{s.desc}</div>
              </div>
              {s.enabled ? (
                <Badge variant="success">
                  <Check className="h-3 w-3" />
                  Enabled
                </Badge>
              ) : (
                <Button size="sm" variant="outline">Configure</Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h3 className="font-semibold">Active devices</h3>
        <div className="mt-4 space-y-2">
          {[
            { name: "MacBook Pro", location: "New York, US", lastActive: "Active now", current: true },
            { name: "iPhone 15", location: "New York, US", lastActive: "2h ago", current: false },
            { name: "iPad Pro", location: "Brooklyn, US", lastActive: "1d ago", current: false },
          ].map((d) => (
            <div key={d.name} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex-1">
                <div className="text-sm font-medium">{d.name}</div>
                <div className="text-xs text-muted-foreground">{d.location} · {d.lastActive}</div>
              </div>
              {d.current && <Badge variant="success">This device</Badge>}
              {!d.current && <Button size="sm" variant="ghost">Revoke</Button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
