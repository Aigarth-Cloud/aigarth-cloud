import { MarketingPageHero, Section, FeatureGrid } from "@/components/marketing/marketing-page";
import { Shield, Lock, Network, Building2, Users, Headphones, ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@aigarth/ui";
import { Badge } from "@aigarth/ui";

export const metadata = {
  title: "Enterprise",
  description: "Dedicated infrastructure, compliance, and white-glove support for teams that ship AI at scale.",
};

const COMPLIANCE = [
  { name: "SOC 2 Type II", status: "In progress", year: "2026" },
  { name: "ISO 27001", status: "In progress", year: "2026" },
  { name: "HIPAA", status: "Available", year: "Business+ plans" },
  { name: "GDPR", status: "Compliant", year: "All plans" },
  { name: "FedRAMP Moderate", status: "Roadmap", year: "2027" },
  { name: "PCI DSS", status: "Available", year: "Enterprise" },
];

const TESTIMONIALS = [
  {
    quote: "We moved 80% of our inference to Aigarth in three months. The economics are simply better.",
    name: "Sarah Chen",
    role: "VP Engineering, Northwind AI",
  },
  {
    quote: "The audit trail on every call made our compliance team finally approve AI at scale.",
    name: "Marcus Webb",
    role: "CTO, Lumen Health",
  },
  {
    quote: "Aigarth's staking model aligns incentives in a way no cloud provider can match.",
    name: "Priya Nair",
    role: "Head of AI, Vector Capital",
  },
];

export default function EnterprisePage() {
  return (
    <>
      <MarketingPageHero
        badge="Enterprise"
        title="AI infrastructure for serious teams."
        description="Dedicated clusters, compliance, and white-glove support. Built for the teams that ship AI at scale."
        primaryCta={{ label: "Talk to sales", href: "/contact" }}
        secondaryCta={{ label: "See plans", href: "/pricing" }}
      />

      <FeatureGrid
        features={[
          { icon: Building2, title: "Dedicated infrastructure", body: "Private clusters. Custom hardware. Multi-region replication. Single-tenant deployment available." },
          { icon: Shield, title: "Compliance & audit", body: "SOC 2, ISO 27001, HIPAA, GDPR, FedRAMP roadmap. Signed receipts for every inference." },
          { icon: Network, title: "Private networking", body: "VPC peering, private endpoints, BYO encryption. Your data never leaves your perimeter." },
          { icon: Lock, title: "Data isolation", body: "On-prem, air-gapped, or hybrid. Run Aigarth compute where your data already lives." },
          { icon: Users, title: "Dedicated CSM", body: "A named contact. Quarterly reviews. SLA-backed response times." },
          { icon: Headphones, title: "24/7 on-call", body: "Engineers, not bots. 15-minute P1 response. Direct access to platform team." },
        ]}
      />

      <Section
        title="Compliance"
        description="Independent audits and certifications. Status reflects current state at time of writing."
      >
        <div className="overflow-hidden rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 text-left">Framework</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Available</th>
              </tr>
            </thead>
            <tbody>
              {COMPLIANCE.map((c) => (
                <tr key={c.name} className="border-b border-border/50 last:border-0">
                  <td className="px-6 py-4 font-medium">{c.name}</td>
                  <td className="px-6 py-4">
                    <Badge variant={c.status === "Compliant" || c.status === "Available" ? "success" : c.status === "Roadmap" ? "secondary" : "warning"}>
                      {c.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{c.year}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Compliance status shown reflects Aigarth's general position. Customers with
          specific obligations should confirm applicability with their auditor.
        </p>
      </Section>

      <Section
        title="SLAs"
        description="Enterprise plans include contractual SLAs with financial compensation."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { tier: "Business", uptime: "99.95%", support: "Priority email", p1: "1h" },
            { tier: "Enterprise", uptime: "99.99%", support: "Dedicated CSM", p1: "15m" },
            { tier: "Custom", uptime: "Custom", support: "On-call engineers", p1: "5m" },
          ].map((s) => (
            <div key={s.tier} className="rounded-2xl border bg-card p-6">
              <h3 className="font-semibold tracking-tight">{s.tier}</h3>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Uptime</span>
                  <span className="font-mono">{s.uptime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Support</span>
                  <span className="text-right">{s.support}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">P1 response</span>
                  <span className="font-mono">{s.p1}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="What customers say" align="center">
        <div className="grid gap-6 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="rounded-2xl border bg-card p-6 text-left">
              <p className="text-pretty leading-relaxed">"{t.quote}"</p>
              <div className="mt-5 border-t border-border pt-4">
                <div className="text-sm font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <section className="py-20 md:py-28">
        <div className="container-narrow text-center">
          <h2 className="text-balance font-display text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
            Move your AI to a network that grows with you.
          </h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/contact">
              <Button size="lg" className="gap-1.5">
                Talk to sales
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline">See plans</Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
