import { Cpu, Zap, Globe, Server, Shield, Sparkles } from "lucide-react";
import { MarketingPageHero, Section, FeatureGrid } from "@/components/marketing/marketing-page";
import { Button } from "@aigarth/ui";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "AI Compute",
  description: "Reserve dedicated AI compute. Run any model, anywhere, with the performance and economics of a hyperscaler.",
};

export default function AIComputePage() {
  return (
    <>
      <MarketingPageHero
        badge="AI Compute"
        title="AI compute, reserved, not rented."
        highlight="Grow it like a garden."
        description="Stake to reserve dedicated AI capacity. Scale globally. Pay in tokens, not dollars. Earn when idle."
        primaryCta={{ label: "Reserve compute", href: "/pricing" }}
        secondaryCta={{ label: "View product docs", href: "/docs" }}
      />

      <FeatureGrid
        features={[
          { icon: Cpu, title: "Any model", body: "Run frontier open models, fine-tunes, or your own. The network treats them as first-class citizens." },
          { icon: Zap, title: "Sub-50ms inference", body: "Multi-region routing. Edge nodes. Burst capacity. Latency that competes with hyperscalers." },
          { icon: Globe, title: "47 regions", body: "North America, Europe, Asia-Pacific, South America, Africa. Compute where your users are." },
          { icon: Server, title: "Dedicated capacity", body: "Skip the noisy neighbor. Reserve capacity for production workloads with predictable performance." },
          { icon: Shield, title: "Verifiable compute", body: "Every inference has a signed receipt. Audit trails for compliance, finance, and regulated industries." },
          { icon: Sparkles, title: "Same APIs", body: "OpenAI-compatible endpoints. Drop-in replacement. Migration in hours, not months." },
        ]}
      />

      <Section
        title="Built for production."
        description="Aigarth compute is the same silicon you'd find in any hyperscaler  ” but reserved, owned, and monetizable."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "GPU types", value: "H100, A100, MI300X" },
            { label: "vCPUs", value: "Up to 192 per cluster" },
            { label: "Memory", value: "Up to 2TB per node" },
            { label: "Network", value: "Up to 400GbE" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border bg-card p-6">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
              <div className="mt-2 text-lg font-medium">{s.value}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Architecture"
        description="Three layers: a global scheduler, regional clusters, and edge nodes. Compute routes to the lowest-latency available capacity."
      >
        <div className="rounded-3xl border bg-card p-6 md:p-10">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { title: "Edge", desc: "Sub-50ms. Cached responses, small models, routing.", tag: "Tier 1" },
              { title: "Regional", desc: "Sub-200ms. Standard inference, embeddings, agents.", tag: "Tier 2" },
              { title: "Cluster", desc: "Sub-1s. Fine-tuning, large models, batch jobs.", tag: "Tier 3" },
            ].map((tier, i) => (
              <div key={tier.title} className="relative rounded-2xl border bg-muted/30 p-6">
                <div className="absolute right-4 top-4 text-xs font-mono text-muted-foreground">{tier.tag}</div>
                <div className="text-xs uppercase tracking-wider text-garden-600 dark:text-garden-400">Tier {i + 1}</div>
                <h3 className="mt-1 text-xl font-semibold">{tier.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{tier.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <section className="py-20 md:py-28">
        <div className="container-narrow text-center">
          <h2 className="text-balance font-display text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
            Ready to reserve compute?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
            Pick a plan, stake QUBIC, and start running AI workloads in minutes.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/pricing">
              <Button size="lg" className="gap-1.5">
                See plans
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline">
                Open the console
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
