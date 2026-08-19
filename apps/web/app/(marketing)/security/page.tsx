import { MarketingPageHero, Section, FeatureGrid } from "@/components/marketing/marketing-page";
import { Shield, Lock, Network, Code2, FileText, Key, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@aigarth/ui";
import { Badge } from "@aigarth/ui";

export const metadata = {
  title: "Security",
  description: "Cryptographic verifiability, transparent operations, and independent audits.",
};

const AUDITS = [
  { firm: "Trail of Bits", scope: "Core protocol", date: "Q2 2026", status: "Scheduled" },
  { firm: "OpenZeppelin", scope: "Smart contracts", date: "Q2 2026", status: "Scheduled" },
  { firm: "NCC Group", scope: "Infrastructure", date: "Q3 2026", status: "Scheduled" },
];

export default function SecurityPage() {
  return (
    <>
      <MarketingPageHero
        badge="Security"
        title="Verifiable by design."
        description="Cryptographic receipts, transparent operations, and independent audits. Trust through proof, not promises."
        primaryCta={{ label: "Read the whitepaper", href: "/docs" }}
        secondaryCta={{ label: "Report a vulnerability", href: "/contact" }}
      />

      <FeatureGrid
        features={[
          { icon: Shield, title: "Cryptographic verifiability", body: "Every inference, every stake, every transaction  ” verifiable on-chain by anyone." },
          { icon: Lock, title: "End-to-end encryption", body: "BYO encryption keys. Per-tenant data isolation. No cross-tenant leakage." },
          { icon: Network, title: "Stake-secured honesty", body: "Operators and oracles stake QUBIC. Wrong data = slashing. Honest data = yield." },
          { icon: Code2, title: "Open source core", body: "Protocol and SDKs are open. Inspect, audit, fork. No security through obscurity." },
          { icon: Key, title: "Scoped access", body: "Per-project keys. IP allowlists. Hardware-backed 2FA. Granular permissions." },
          { icon: FileText, title: "Transparent ops", body: "Public status page. Incident postmortems. Real-time network telemetry." },
        ]}
      />

      <Section
        title="Independent audits"
        description="Engaging the most reputable firms in the industry."
      >
        <div className="overflow-hidden rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 text-left">Firm</th>
                <th className="px-6 py-3 text-left">Scope</th>
                <th className="px-6 py-3 text-left">Window</th>
                <th className="px-6 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {AUDITS.map((a) => (
                <tr key={a.firm} className="border-b border-border/50 last:border-0">
                  <td className="px-6 py-4 font-medium">{a.firm}</td>
                  <td className="px-6 py-4 text-muted-foreground">{a.scope}</td>
                  <td className="px-6 py-4 text-muted-foreground">{a.date}</td>
                  <td className="px-6 py-4">
                    <Badge variant="warning">{a.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Bug bounty"
        description="We pay for critical findings. Generous rewards for responsible disclosure."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { tier: "Critical", amount: "$100K", desc: "Loss of funds, consensus break" },
            { tier: "High", amount: "$25K", desc: "Service disruption, data exposure" },
            { tier: "Medium", amount: "$5K", desc: "Logic errors, edge cases" },
            { tier: "Low", amount: "$500", desc: "Best-practice violations" },
          ].map((b) => (
            <div key={b.tier} className="rounded-2xl border bg-card p-6">
              <Badge variant="glow" className="mb-3">{b.tier}</Badge>
              <div className="text-3xl font-medium tracking-tight">{b.amount}</div>
              <p className="mt-2 text-xs text-muted-foreground">{b.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <section className="py-20 md:py-28">
        <div className="container-narrow text-center">
          <h2 className="text-balance font-display text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
            Security is a process, not a product.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
            Read the security whitepaper, audit our open-source code, or join the
            bug bounty.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/docs">
              <Button size="lg" className="gap-1.5">
                Whitepaper
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline">Report a vulnerability</Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
