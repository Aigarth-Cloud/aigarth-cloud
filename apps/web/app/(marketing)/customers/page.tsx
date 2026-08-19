import { MarketingPageHero, Section } from "@/components/marketing/marketing-page";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@aigarth/ui";
import { Badge } from "@aigarth/ui";

export const metadata = {
  title: "Customers",
  description: "The teams that ship AI products on Aigarth.",
};

const CUSTOMERS = [
  { name: "Helix Labs", industry: "AI Research", plan: "Business", quote: "We moved 80% of our inference to Aigarth in three months. The economics are simply better." },
  { name: "Northwind AI", industry: "Customer Service", plan: "Startup", quote: "Sub-50ms inference means our agents feel instant. The cost savings let us price competitively." },
  { name: "Lumen Health", industry: "Healthcare", plan: "Business", quote: "The audit trail on every call made our compliance team finally approve AI at scale." },
  { name: "Vector Capital", industry: "Finance", plan: "Business", quote: "Aigarth's staking model aligns incentives in a way no cloud provider can match." },
  { name: "Atlas Robotics", industry: "Robotics", plan: "Enterprise", quote: "Edge nodes to enterprise clusters on one platform. That's the future we wanted." },
  { name: "Quanta Systems", industry: "Defense", plan: "Enterprise", quote: "The verifiability is what sealed it. Every result is auditable. That's non-negotiable for us." },
  { name: "Orbital Defense", industry: "Government", plan: "Enterprise", quote: "Sovereign deployment plus decentralized economics. We didn't think this was possible." },
  { name: "Aurora Audio", industry: "Media", plan: "Startup", quote: "We trained and deployed a voice model in a week. The marketplace handles the rest." },
  { name: "Lumen Legal", industry: "Legal", plan: "Business", quote: "Custom ANNs we can license, stake, and earn from. The economics finally work for legal AI." },
];

export default function CustomersPage() {
  return (
    <>
      <MarketingPageHero
        badge="Customers"
        title="Built with the teams that ship AI."
        description="From two-person startups to government agencies  ” Aigarth powers production AI for hundreds of teams."
        primaryCta={{ label: "Become a customer", href: "/contact" }}
        secondaryCta={{ label: "Read case studies", href: "/case-studies" }}
      />

      <Section
        title="Who builds on Aigarth"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CUSTOMERS.map((c) => (
            <div key={c.name} className="rounded-2xl border bg-card p-6">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-garden-500 to-emerald-500 text-sm font-medium text-white">
                  {c.name.charAt(0)}
                </div>
                <Badge variant="outline" className="text-[10px]">{c.plan}</Badge>
              </div>
              <h3 className="mt-4 font-semibold tracking-tight">{c.name}</h3>
              <div className="text-xs text-muted-foreground">{c.industry}</div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">"{c.quote}"</p>
            </div>
          ))}
        </div>
      </Section>

      <section className="py-20 md:py-28">
        <div className="container-narrow text-center">
          <h2 className="text-balance font-display text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
            Join the next generation of AI companies.
          </h2>
          <div className="mt-8">
            <Link href="/contact">
              <Button size="lg" className="gap-1.5">
                Get started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
