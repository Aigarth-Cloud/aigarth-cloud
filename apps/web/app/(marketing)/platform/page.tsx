import { MarketingPageHero, Section, FeatureGrid } from "@/components/marketing/marketing-page";
import { Cpu, Server, Network, Globe, Shield, Sparkles, ArrowRight, Brain, Database } from "lucide-react";
import Link from "next/link";
import { Button } from "@aigarth/ui";

export const metadata = {
  title: "Platform",
  description: "The Aigarth platform: AI compute, oracles, ANNs, and outsourced computation, unified on Qubic.",
};

const PILLARS = [
  {
    icon: Shield,
    title: "Useful Proof of Staking",
    href: "/useful-proof-of-staking",
    body: "Stake QUBIC to reserve compute. Earn from idle capacity. Vote on protocol direction.",
  },
  {
    icon: Cpu,
    title: "AI Compute",
    href: "/ai-compute",
    body: "Reserved GPU capacity, sub-50ms inference, any model. The hyperscaler experience, owned by you.",
  },
  {
    icon: Brain,
    title: "ANNs",
    href: "/anns",
    body: "Train, version, license, and monetize Artificial Neural Networks. Intelligence you can own.",
  },
  {
    icon: Network,
    title: "Oracle Network",
    href: "/oracle-network",
    body: "Real-world data feeds. Sub-second updates. Stake-secured, multi-source aggregated.",
  },
  {
    icon: Server,
    title: "Outsourced Computation",
    href: "/outsourced-computation",
    body: "Heavy workloads, batch jobs, distributed training. Verifiable receipts included.",
  },
  {
    icon: Database,
    title: "ANN Marketplace",
    href: "/marketplace",
    body: "Discover, license, and stake behind the best community-built ANNs.",
  },
];

export default function PlatformPage() {
  return (
    <>
      <MarketingPageHero
        badge="Platform"
        title="One platform, every primitive."
        description="Compute, intelligence, oracles, and verifiable work  ” unified on the most performant decentralized network in the world."
        primaryCta={{ label: "Open the console", href: "/dashboard" }}
        secondaryCta={{ label: "See pricing", href: "/pricing" }}
      />

      <Section
        title="Six pillars. One network."
        description="Aigarth is built from six interlocking primitives. Use them independently or together."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <Link
                key={p.title}
                href={p.href}
                className="group flex flex-col rounded-2xl border bg-card p-7 card-hover"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-tight">{p.title}</h3>
                <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
                  {p.body}
                </p>
                <div className="mt-auto pt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Learn more
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </Section>

      <Section
        title="Built on Qubic."
        description="The most performant blockchain in production. Useful Proof of Work. Sub-second finality. Zero fees."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Finality", value: "<1s" },
            { label: "Throughput", value: "15.5M TPS" },
            { label: "Fee", value: "0" },
            { label: "Energy per tx", value: "0.0001 kWh" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border bg-card p-6">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
              <div className="mt-2 text-2xl font-medium">{s.value}</div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
