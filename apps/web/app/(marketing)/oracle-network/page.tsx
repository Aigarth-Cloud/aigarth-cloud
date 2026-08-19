import { Network, Database, Shield, Zap, Globe, Code2 } from "lucide-react";
import { MarketingPageHero, Section, FeatureGrid } from "@/components/marketing/marketing-page";
import Link from "next/link";
import { Button } from "@aigarth/ui";
import { ArrowRight } from "lucide-react";
import { Badge } from "@aigarth/ui";

export const metadata = {
  title: "Oracle Network",
  description: "Real-world data feeds for any application. Cryptographically verified. Sub-second settlement.",
};

const FEEDS = [
  { name: "Equities", desc: "Real-time and historical prices for 47K tickers across 28 exchanges.", latency: "82ms" },
  { name: "FX", desc: "Major and exotic currency pairs. Central bank and interbank rates.", latency: "94ms" },
  { name: "Crypto", desc: "Spot, perpetuals, and DeFi rates across 60+ venues.", latency: "24ms" },
  { name: "Weather", desc: "Forecast, current conditions, alerts. 12km grid resolution.", latency: "180ms" },
  { name: "Sports", desc: "Live scores, stats, and outcomes for 18 leagues.", latency: "120ms" },
  { name: "Shipping", desc: "AIS positions, port congestion, route ETAs.", latency: "240ms" },
];

export default function OracleNetworkPage() {
  return (
    <>
      <MarketingPageHero
        badge="Oracle Network"
        title="Real-world data, cryptographically verified."
        description="Sub-second price feeds, weather, sports, and any verifiable off-chain data. Stake-secured, multi-source aggregated."
        primaryCta={{ label: "Subscribe to a feed", href: "/dashboard" }}
        secondaryCta={{ label: "Browse feeds", href: "/docs" }}
      />

      <FeatureGrid
        features={[
          { icon: Network, title: "Multi-source aggregation", body: "Every feed pulls from multiple independent sources. Outliers are filtered, signed, and republished." },
          { icon: Shield, title: "Stake-secured", body: "Oracles stake QUBIC. Wrong data = slashing. Honest data = yield. Cryptographic accountability." },
          { icon: Zap, title: "Sub-second updates", body: "Median latency 84ms. Pushed to you the moment the network reaches consensus." },
          { icon: Database, title: "Any data", body: "Standard feeds are pre-built. Custom feeds are programmable. Deploy your own in 30 lines of code." },
          { icon: Globe, title: "Global coverage", body: "47 regions, 28 exchanges, 60+ crypto venues. Wherever the data is, we have an oracle." },
          { icon: Code2, title: "Standard interface", body: "JSON-RPC, REST, WebSocket. Pull or push. On-chain or off. Use it however you build." },
        ]}
      />

      <Section
        title="Featured feeds"
        description="Production-ready. Subscribed by 1,200+ apps across the network."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEEDS.map((feed) => (
            <div key={feed.name} className="rounded-2xl border bg-card p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold tracking-tight">{feed.name}</h3>
                <Badge variant="glow">Live</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{feed.desc}</p>
              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Median latency</span>
                <span className="font-mono text-mint-600 dark:text-mint-400">{feed.latency}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Build a custom feed"
        description="Bring your own data source. Define a settlement rule. Deploy."
      >
        <div className="rounded-3xl border bg-card p-6 md:p-10">
          <pre className="overflow-x-auto rounded-xl bg-muted/30 p-6 text-sm leading-relaxed">
            <code className="font-mono">
{`from aigarth import Oracle

oracle = Oracle(stake="10M QUBIC")

@oracle.feed("custom-tide-data")
def tide_level(station_id: str) -> float:
    # Pull from NOAA
    return noaa.get_tide(station_id)

# Subscribe
client.subscribe("custom-tide-data", callback=on_update)`}
            </code>
          </pre>
        </div>
      </Section>

      <section className="py-20 md:py-28">
        <div className="container-narrow text-center">
          <h2 className="text-balance font-display text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
            Stop trusting data. Verify it.
          </h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/dashboard">
              <Button size="lg" className="gap-1.5">
                Subscribe now
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/docs">
              <Button size="lg" variant="outline">Oracle docs</Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
