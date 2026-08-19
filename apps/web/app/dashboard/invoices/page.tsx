"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@aigarth/ui";
import { Button } from "@aigarth/ui";
import { Download, FileText, Check } from "lucide-react";

export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="View, download, and reconcile your Aigarth invoices."
      />
      <div className="rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-6 py-3 text-left">Invoice</th>
              <th className="px-6 py-3 text-left">Period</th>
              <th className="px-6 py-3 text-left">Issued</th>
              <th className="px-6 py-3 text-left">Amount</th>
              <th className="px-6 py-3 text-left">Status</th>
              <th className="px-6 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b border-border/50 last:border-0">
                <td className="px-6 py-4 font-mono text-xs">INV-2026-{String(120 - i).padStart(3, "0")}</td>
                <td className="px-6 py-4">Jul 2026</td>
                <td className="px-6 py-4 text-muted-foreground">Aug 1, 2026</td>
                <td className="px-6 py-4 font-mono">{(350 + Math.random() * 200).toFixed(2)} QUBIC</td>
                <td className="px-6 py-4">
                  <Badge variant="success">
                    <Check className="h-3 w-3" /> Paid
                  </Badge>
                </td>
                <td className="px-6 py-4 text-right">
                  <Button size="sm" variant="ghost" className="gap-1.5">
                    <Download className="h-3.5 w-3.5" />
                    PDF
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
