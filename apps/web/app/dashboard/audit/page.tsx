"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@aigarth/ui";
import { Download } from "lucide-react";
import { Button } from "@aigarth/ui";

export default function AuditPage() {
  const events = [
    { time: "Just now", event: "API key used", user: "heli-prod", ip: "192.168.1.42", location: "New York, US", status: "Success" },
    { time: "5m ago", event: "Stake created", user: "Jordan Lee", ip: "203.0.113.42", location: "New York, US", status: "Success" },
    { time: "14m ago", event: "Login", user: "Jordan Lee", ip: "203.0.113.42", location: "New York, US", status: "Success" },
    { time: "1h ago", event: "API key created", user: "Jordan Lee", ip: "203.0.113.42", location: "New York, US", status: "Success" },
    { time: "2h ago", event: "Login attempt", user: "jordan@helixlabs.ai", ip: "198.51.100.42", location: "Unknown", status: "Failed" },
    { time: "1d ago", event: "Withdrawal", user: "Jordan Lee", ip: "203.0.113.42", location: "New York, US", status: "Success" },
    { time: "2d ago", event: "Vote cast", user: "Jordan Lee", ip: "203.0.113.42", location: "New York, US", status: "Success" },
    { time: "3d ago", event: "API key revoked", user: "Jordan Lee", ip: "203.0.113.42", location: "New York, US", status: "Success" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit logs"
        description="Complete record of every action on your account. Export for compliance."
        action={{ label: "Export CSV", icon: Download }}
      />

      <div className="rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-6 py-3 text-left">Time</th>
              <th className="px-6 py-3 text-left">Event</th>
              <th className="px-6 py-3 text-left">User / Key</th>
              <th className="px-6 py-3 text-left">IP</th>
              <th className="px-6 py-3 text-left">Location</th>
              <th className="px-6 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => (
              <tr key={i} className="border-b border-border/50 last:border-0">
                <td className="px-6 py-3 text-muted-foreground">{e.time}</td>
                <td className="px-6 py-3 font-medium">{e.event}</td>
                <td className="px-6 py-3 text-muted-foreground">{e.user}</td>
                <td className="px-6 py-3 font-mono text-xs">{e.ip}</td>
                <td className="px-6 py-3 text-muted-foreground">{e.location}</td>
                <td className="px-6 py-3">
                  <Badge variant={e.status === "Success" ? "success" : "destructive"}>
                    {e.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
