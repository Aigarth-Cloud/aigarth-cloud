"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { Bell, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@aigarth/ui";

export default function NotificationsPage() {
  const items = [
    { type: "alert", title: "Compute at 68% of daily limit", desc: "Your Builder plan is approaching the daily allocation. Consider upgrading or routing to market.", time: "Just now", unread: true },
    { type: "info", title: "New ANN available: VisionCanvas", desc: "A new image generation ANN from Aurora Audio. 97.1% accuracy. 12M QUBIC stake.", time: "2h ago", unread: true },
    { type: "success", title: "Yield payout: +12.4 QUBIC", desc: "Daily staking reward distributed to your wallet.", time: "1d ago", unread: false },
    { type: "info", title: "Proposal AIP-042 is now active", desc: "Vote on lowering image generation fees by 12%. Voting closes in 2 days.", time: "2d ago", unread: false },
    { type: "alert", title: "API key rotation recommended", desc: "Your heli-prod key was last rotated 90 days ago. Best practice is 90 days or less.", time: "5d ago", unread: false },
    { type: "info", title: "New region: ap-southeast-2", desc: "Sydney region is now live. 18ms typical latency for AU customers.", time: "1w ago", unread: false },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="System events, alerts, and updates for your account."
        action={{ label: "Notification settings", icon: SettingsIcon, variant: "outline" }}
      />

      <div className="space-y-2">
        {items.map((n, i) => (
          <div key={i} className="flex items-start gap-3 rounded-xl border bg-card p-4">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              n.type === "alert" ? "bg-orange-500/10 text-orange-500" :
              n.type === "success" ? "bg-mint-500/10 text-mint-500" :
              "bg-primary/10 text-primary"
            }`}>
              <Bell className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold">{n.title}</div>
                {n.unread && <span className="h-1.5 w-1.5 rounded-full bg-garden-500" />}
              </div>
              <div className="mt-0.5 text-sm text-muted-foreground">{n.desc}</div>
              <div className="mt-1 text-xs text-muted-foreground">{n.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
