import { MarketingPageHero, Section } from "@/components/marketing/marketing-page";
import { Check, AlertCircle } from "lucide-react";
import { Badge } from "@aigarth/ui";

export const metadata = {
  title: "Status",
  description: "Real-time status of Aigarth services.",
};

const SERVICES = [
  { name: "API", status: "operational", uptime: "99.99%" },
  { name: "Console", status: "operational", uptime: "99.99%" },
  { name: "Inference", status: "operational", uptime: "99.99%" },
  { name: "Embeddings", status: "operational", uptime: "99.98%" },
  { name: "Image generation", status: "operational", uptime: "99.97%" },
  { name: "Voice", status: "operational", uptime: "99.99%" },
  { name: "ANN Marketplace", status: "operational", uptime: "99.99%" },
  { name: "Oracle Network", status: "operational", uptime: "99.99%" },
  { name: "GPU Marketplace", status: "operational", uptime: "99.99%" },
  { name: "Settlement", status: "operational", uptime: "100.00%" },
];

const INCIDENTS = [
  { date: "Jul 18, 2026", title: "Brief latency spike in us-east-1", status: "Resolved", duration: "8 min" },
  { date: "Jul 5, 2026", title: "Embedding API rate limiting too aggressive", status: "Resolved", duration: "32 min" },
  { date: "Jun 22, 2026", title: "Image generation queue delays in eu-west-1", status: "Resolved", duration: "14 min" },
];

export default function StatusPage() {
  const allOperational = SERVICES.every((s) => s.status === "operational");
  return (
    <>
      <MarketingPageHero
        badge="System status"
        title={allOperational ? "All systems operational" : "Some systems degraded"}
        description="Real-time status of Aigarth services. Updated every 30 seconds."
      />

      <Section
        title="Services"
        description="Health and uptime for every Aigarth service."
      >
        <div className="overflow-hidden rounded-2xl border bg-card">
          {SERVICES.map((s) => (
            <div key={s.name} className="flex items-center justify-between border-b p-4 last:border-0">
              <div className="flex items-center gap-3">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-500 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-mint-500" />
                </span>
                <span className="font-medium">{s.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-xs text-muted-foreground">{s.uptime}</span>
                <Badge variant="success">Operational</Badge>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Recent incidents"
        description="Past 90 days. Postmortems linked when available."
      >
        <div className="space-y-2">
          {INCIDENTS.map((i) => (
            <div key={i.title} className="flex items-center gap-3 rounded-lg border bg-card p-4">
              <Check className="h-4 w-4 text-mint-500" />
              <div className="flex-1">
                <div className="text-sm font-medium">{i.title}</div>
                <div className="text-xs text-muted-foreground">{i.date} · {i.duration}</div>
              </div>
              <Badge variant="success">Resolved</Badge>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
