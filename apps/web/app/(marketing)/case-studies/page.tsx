import { MarketingPageHero, Section } from "@/components/marketing/marketing-page";
import { ArrowRight, TrendingUp, Clock, DollarSign, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@aigarth/ui";
import { Badge } from "@aigarth/ui";

export const metadata = {
  title: "Case Studies",
  description: "How real teams ship production AI on Aigarth.",
};

const STUDIES = [
  {
    company: "Helix Labs",
    industry: "AI Research",
    title: "How Helix Labs cut inference costs by 73% while improving latency",
    summary: "Migrated from AWS to Aigarth in 12 weeks. Same models, dramatically better economics.",
    metrics: [
      { icon: DollarSign, label: "Cost reduction", value: "73%" },
      { icon: Clock, label: "P95 latency", value: "-48%" },
      { icon: TrendingUp, label: "Throughput", value: "+3.2x" },
    ],
  },
  {
    company: "Lumen Health",
    industry: "Healthcare",
    title: "HIPAA-compliant AI at scale, with full audit trails",
    summary: "Built a clinical decision support system serving 2,400 hospitals. Every call signed, every result auditable.",
    metrics: [
      { icon: Users, label: "Hospitals served", value: "2,400" },
      { icon: Clock, label: "Compliance review", value: "8 weeks" },
      { icon: TrendingUp, label: "Calls per day", value: "12M" },
    ],
  },
  {
    company: "Vector Capital",
    industry: "Finance",
    title: "Real-time market intelligence on a verifiable compute layer",
    summary: "A 200-ML-model ensemble running 24/7. Stake-secured honesty on every prediction.",
    metrics: [
      { icon: TrendingUp, label: "Models deployed", value: "200" },
      { icon: Clock, label: "Prediction latency", value: "8ms" },
      { icon: DollarSign, label: "Revenue per QUBIC staked", value: "1.4x" },
    ],
  },
];

export default function CaseStudiesPage() {
  return (
    <>
      <MarketingPageHero
        badge="Case studies"
        title="Real outcomes, from real teams."
        description="How leading organizations use Aigarth to ship AI in production."
        primaryCta={{ label: "Become a case study", href: "/contact" }}
      />

      <Section
        title="Featured stories"
      >
        <div className="space-y-6">
          {STUDIES.map((study) => (
            <div key={study.company} className="rounded-2xl border bg-card p-6 md:p-8">
              <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">{study.industry}</Badge>
                    <span>{study.company}</span>
                  </div>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight md:text-2xl">{study.title}</h3>
                  <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
                    {study.summary}
                  </p>
                </div>
                <Button variant="outline" className="gap-1.5 shrink-0">
                  Read story
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {study.metrics.map((m) => {
                  const Icon = m.icon;
                  return (
                    <div key={m.label} className="rounded-xl border bg-muted/30 p-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Icon className="h-3.5 w-3.5" />
                        {m.label}
                      </div>
                      <div className="mt-1 text-2xl font-medium tracking-tight">{m.value}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
