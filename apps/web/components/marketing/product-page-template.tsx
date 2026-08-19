import { MarketingPageHero, Section, FeatureGrid } from "@/components/marketing/marketing-page";
import { Badge } from "@aigarth/ui";
import { Button } from "@aigarth/ui";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

export interface ProductPageProps {
  badge: string;
  title: string;
  highlight?: string;
  description: string;
  features: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    body: string;
  }[];
  pricing: {
    label: string;
    price: string;
    unit: string;
    note: string;
  }[];
  benefits: string[];
  example: {
    title: string;
    code: string;
  };
  stakingRequirements: {
    tier: string;
    stake: string;
    access: string;
  }[];
}

export function ProductPage({
  badge,
  title,
  highlight,
  description,
  features,
  pricing,
  benefits,
  example,
  stakingRequirements,
}: ProductPageProps) {
  return (
    <>
      <MarketingPageHero
        badge={badge}
        title={title}
        highlight={highlight}
        description={description}
        primaryCta={{ label: "Start building", href: "/dashboard" }}
        secondaryCta={{ label: "Read the docs", href: "/docs" }}
      />

      <FeatureGrid features={features} />

      <Section
        title="Pricing"
        description="Token-efficient, with volume discounts and burn incentives."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pricing.map((p) => (
            <div key={p.label} className="rounded-2xl border bg-card p-6">
              <Badge variant="outline" className="mb-3 text-[10px]">{p.label}</Badge>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-medium tracking-tight">{p.price}</span>
                <span className="text-sm text-muted-foreground">{p.unit}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{p.note}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Pricing is illustrative. Final rates are governed by on-chain parameters and
          may vary based on network state.
        </p>
      </Section>

      <Section
        title="Staking requirements"
        description="Tier-based access. Higher stakes unlock better economics and more capacity."
      >
        <div className="overflow-hidden rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 text-left">Tier</th>
                <th className="px-6 py-3 text-left">Required stake</th>
                <th className="px-6 py-3 text-left">Access</th>
              </tr>
            </thead>
            <tbody>
              {stakingRequirements.map((r) => (
                <tr key={r.tier} className="border-b border-border/50 last:border-0">
                  <td className="px-6 py-4 font-medium">{r.tier}</td>
                  <td className="px-6 py-4 font-mono">{r.stake}</td>
                  <td className="px-6 py-4 text-muted-foreground">{r.access}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Example"
        description="Drop-in compatible with the OpenAI SDK."
      >
        <div className="rounded-3xl border bg-card p-6 md:p-10">
          <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-garden-500/70" />
            <span className="ml-2 font-mono">{example.title}</span>
          </div>
          <pre className="overflow-x-auto rounded-xl bg-muted/30 p-6 text-sm leading-relaxed">
            <code className="font-mono">{example.code}</code>
          </pre>
        </div>
      </Section>

      <Section
        title="Enterprise benefits"
        description="Everything in the standard tier, plus the things enterprises need."
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {benefits.map((b) => (
            <li key={b} className="flex items-start gap-2 rounded-xl border bg-card p-4">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-garden-500" />
              <span className="text-sm">{b}</span>
            </li>
          ))}
        </ul>
      </Section>

      <section className="py-20 md:py-28">
        <div className="container-narrow text-center">
          <h2 className="text-balance font-display text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
            Ready to get started?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
            Open the console, generate an API key, and run your first call in minutes.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/dashboard">
              <Button size="lg" className="gap-1.5">
                Open the console
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
