import { MarketingPageHero, Section, FeatureGrid } from "@/components/marketing/marketing-page";
import { Cpu, Network, Sparkles, Code2, Server, Building2, Users, GraduationCap, Shield, Briefcase, ArrowRight, Award, BookOpen } from "lucide-react";
import Link from "next/link";
import { Button } from "@aigarth/ui";

export const metadata = {
  title: "Ecosystem",
  description: "Aigarth Cloud, Qubic Network, ANNs, hardware, and the people who build on top.",
};

const SECTIONS = [
  { icon: Cpu, title: "Aigarth Cloud", href: "/", body: "The AI cloud platform. The product users touch." },
  { icon: Network, title: "Qubic Network", href: "/useful-proof-of-staking", body: "The base layer. Useful Proof of Work. Sub-second finality." },
  { icon: Sparkles, title: "ANN Marketplace", href: "/marketplace", body: "Discover, license, and stake behind community ANNs." },
  { icon: Code2, title: "Developers", href: "/developers", body: "SDKs, APIs, docs, and tooling. Open source core." },
  { icon: Server, title: "Hardware", href: "/products", body: "Edge nodes to data-center accelerators. Purpose-built silicon." },
  { icon: Building2, title: "Enterprise Partners", href: "/enterprise", body: "System integrators, consultancies, and managed service providers." },
  { icon: Users, title: "Node Operators", href: "/useful-proof-of-staking", body: "Run verified hardware. Validate. Earn." },
  { icon: Award, title: "Grant Programs", href: "/contact", body: "Funding for builders, researchers, and educators." },
  { icon: GraduationCap, title: "Training Academy", href: "/docs", body: "Certification for developers, operators, and architects." },
  { icon: BookOpen, title: "Universities & Research", href: "/contact", body: "Academic partnerships and free compute for research." },
  { icon: Shield, title: "Governments", href: "/enterprise", body: "Compliance, sovereign cloud, and audit-friendly deployment." },
  { icon: Briefcase, title: "Open Source", href: "/developers", body: "Public repos, contribution guide, and license terms." },
];

export default function EcosystemPage() {
  return (
    <>
      <MarketingPageHero
        badge="Ecosystem"
        title="A network of networks."
        description="Aigarth isn't a single product. It's a living ecosystem of infrastructure, intelligence, and the people who build on top."
        primaryCta={{ label: "Join the ecosystem", href: "/contact" }}
        secondaryCta={{ label: "Explore", href: "/marketplace" }}
      />

      <Section
        title="The full ecosystem"
        description="Every piece of the Aigarth universe, in one place."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.title}
                href={s.href}
                className="group flex items-start gap-4 rounded-2xl border bg-card p-5 card-hover"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      </Section>

      <Section
        title="Grant programs"
        description="Funding for builders pushing the ecosystem forward."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "Builder grants", amount: "Up to 5M QUBIC", body: "For new apps, ANNs, and integrations on Aigarth." },
            { title: "Research grants", amount: "Up to 25M QUBIC", body: "For academic and independent research using Aigarth." },
            { title: "Public goods", amount: "Custom", body: "For open-source tools, education, and ecosystem infrastructure." },
          ].map((g) => (
            <div key={g.title} className="rounded-2xl border bg-card p-6">
              <h3 className="font-semibold tracking-tight">{g.title}</h3>
              <div className="mt-3 text-2xl font-medium text-garden-600 dark:text-garden-400">{g.amount}</div>
              <p className="mt-3 text-sm text-muted-foreground">{g.body}</p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
