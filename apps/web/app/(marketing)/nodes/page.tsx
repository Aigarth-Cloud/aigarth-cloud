import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Coins,
  CircleDollarSign,
  Percent,
  Server,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@aigarth/ui";
import { MarketingPageHero, Section, FeatureGrid } from "@/components/marketing/marketing-page";

export const metadata: Metadata = {
  title: "Reserve a Compute Node",
  description:
    "Reserve an Aigarth compute node. $599 total, $30 refundable deposit. Your deposit earns yield while you wait. Pay the balance when mainnet launches. Cancel any time before that for a full refund.",
  openGraph: {
    title: "Reserve a Compute Node",
    description:
      "Reserve an Aigarth compute node. $599 total, $30 refundable deposit. Yield on the held deposit.",
    images: ["/nodes/hero.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Reserve an Aigarth Compute Node",
    description:
      "Reserve an Aigarth compute node. $599 total, $30 refundable deposit. Yield on the held deposit.",
    images: ["/nodes/hero.png"],
  },
  alternates: {
    canonical: "/nodes",
  },
};

// Schema.org Product with PreOrder availability.
// Google reads this and shows the page in preorder searches.
const productJsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Aigarth Compute Node",
  description:
    "A small dedicated compute device for AI workloads. Reserves a tier 1 spot in the Aigarth Cloud when mainnet launches.",
  brand: { "@type": "Brand", name: "Aigarth" },
  image: "https://aigarth.cloud/nodes/hero.png",
  offers: {
    "@type": "Offer",
    sku: "aigarth-node-tier-1",
    name: "Aigarth Node Tier 1",
    price: "599.00",
    priceCurrency: "USD",
    availability: "https://schema.org/PreOrder",
    url: "https://aigarth.cloud/nodes",
  },
};

const faqItems: { q: string; a: string }[] = [
  {
    q: "What is a compute spot?",
    a: "A reserved slot in the Aigarth network. When mainnet goes live, your spot becomes compute capacity you control. The deposit holds the spot, the balance pays for it.",
  },
  {
    q: "What does $599 include?",
    a: "The full commitment for a tier 1 spot, paid in QUBIC at the rate when you confirm. After mainnet, the unit is yours. No subscription, no per-month fees, no hidden charges.",
  },
  {
    q: "What are the total ongoing costs?",
    a: "Zero recurring fees on the node itself. You pay QUBIC for the model usage you run on the network, at cost with a small margin. You can bring your own model API keys for a flat $29 per month if you want to skip the margin.",
  },
  {
    q: "When does my spot activate?",
    a: "When Aigarth mainnet launches. We will email you 14 days before mainnet goes live to confirm your address and balance. You have 14 days to confirm or release.",
  },
  {
    q: "Can I get a refund?",
    a: "Yes. Cancel any time before mainnet for a full refund of the $30 deposit. After mainnet, the refund is partial (5% of the deposit as a release fee, matching the standard reservation release terms).",
  },
  {
    q: "What is yield opt-in?",
    a: "Optional. If you turn it on, your $30 deposit is locked in Qearn and earns yield while you wait. The yield is credited against your balance at confirm time. Default is off. Currently accrues at 5% APY in the marketing stub; the real Qearn rate will replace this at mainnet.",
  },
  {
    q: "How does QUBIC pricing work?",
    a: "The page shows USD. The wallet UI converts to QUBIC at the current rate when you sign. We use a 60-second price oracle that pulls from CoinGecko and CoinMarketCap, takes the median, and refuses to charge if the rate is more than 5 minutes stale.",
  },
  {
    q: "How is this different from Hetzner or AWS?",
    a: "Hetzner and AWS rent you generic compute by the hour, billed in fiat. Aigarth reserves you a node on a Qubic-secured network, paid in QUBIC, with verifiable compute receipts and the same OpenAI-compatible APIs.",
  },
  {
    q: "How is this different from raw Qubic staking?",
    a: "Raw staking earns you a share of network rewards. Aigarth nodes earn you a slot in the compute network. The yield profile is different, the risk profile is different, and the upside depends on whether people use the network you are powering.",
  },
  {
    q: "What happens at the 14-day window?",
    a: "You get an email with a confirm link. Click it, sign the balance transaction in your Qubic wallet, and the node activates. If you do nothing, the system auto-releases your spot with a partial refund after 14 days.",
  },
];

const compareRows: { feature: string; hetzner: string; aws: string; aigarth: string }[] = [
  { feature: "Pricing model", hetzner: "Monthly fiat", aws: "Pay-per-second fiat", aigarth: "Reserved in QUBIC" },
  { feature: "Compute type", hetzner: "Shared CPU + GPU", aws: "Shared + dedicated", aigarth: "Dedicated slot" },
  { feature: "Cancellable", hetzner: "Month to month", aws: "Anytime, prorated", aigarth: "Full refund pre-mainnet" },
  { feature: "Yield on deposit", hetzner: "—", aws: "—", aigarth: "Optional, opt-in" },
  { feature: "Network effects", hetzner: "None", aws: "None", aigarth: "Earns when idle" },
  { feature: "Verifiable compute", hetzner: "No", aws: "No", aigarth: "Signed receipts" },
  { feature: "AI APIs", hetzner: "BYO", aws: "Bedrock + BYO", aigarth: "OpenAI-compatible" },
  { feature: "Onboarding", hetzner: "IaaS, 30 min", aws: "Console, 1 hour", aigarth: "Web, 60 seconds" },
];

export default function NodesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />

      <MarketingPageHero
        badge="Tier 1 presale"
        title="Reserve a compute node."
        highlight="Your deposit earns while you wait."
        description="$599 total. $30 refundable deposit. Yield on the held deposit is opt-in. Pay the balance when mainnet launches. Cancel any time before that for a full refund."
        primaryCta={{ label: "Reserve for $30", href: "/signup?intent=reserve-node" }}
        secondaryCta={{ label: "View the FAQ", href: "#faq" }}
      />

      {/* Hero image */}
      <Section
        title="The hardware."
        description="A small, dedicated compute device. Built to run AI workloads around the clock."
        align="center"
        className="!py-10 md:!py-14"
      >
        <div className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border">
          <Image
            src="/nodes/hero.png"
            alt="Aigarth compute node: small black aluminum device with the Aigarth wordmark on the top surface and a blue status LED on the front."
            width={2688}
            height={1520}
            priority
            className="h-auto w-full"
          />
        </div>
      </Section>

      {/* Tier 1 spec card */}
      <Section
        title="Tier 1: the reference spot."
        description="A reserved slot in the Aigarth network. After mainnet, the unit is yours. No subscription."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-1">
            <CardHeader>
              <Badge variant="glow" className="w-fit">Tier 1</Badge>
              <CardTitle className="mt-3 text-3xl">$599</CardTitle>
              <CardDescription>$30 refundable deposit. Pay the balance when mainnet goes live.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild size="lg" className="w-full">
                <Link href="/signup?intent=reserve-node">
                  Reserve for $30
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <p className="text-xs text-muted-foreground">
                One tier now. Two more later. No subscription. Cancel any time before mainnet for a full refund.
              </p>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>What is included</CardTitle>
              <CardDescription>Everything you need to run AI on a Qubic-secured network.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Allocation</dt>
                  <dd className="mt-1 text-sm font-medium">Reference tier compute slot</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Network</dt>
                  <dd className="mt-1 text-sm font-medium">Aigarth compute network</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">APIs</dt>
                  <dd className="mt-1 text-sm font-medium">OpenAI-compatible endpoints</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Setup</dt>
                  <dd className="mt-1 text-sm font-medium">Wallet link, 60 seconds</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Subscription</dt>
                  <dd className="mt-1 text-sm font-medium">None. Pay model usage at cost.</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Audit</dt>
                  <dd className="mt-1 text-sm font-medium">Signed compute receipts</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* Image gallery: product + lifestyle */}
      <Section
        title="What it looks like."
        description="A small aluminum device, deck-of-cards-sized, with a single status LED. Sits on a desk next to your laptop."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="overflow-hidden rounded-2xl border bg-card">
            <Image
              src="/nodes/product-1.png"
              alt="Aigarth compute node, studio shot, three-quarter angle."
              width={2336}
              height={1744}
              className="h-auto w-full"
            />
          </div>
          <div className="overflow-hidden rounded-2xl border bg-card">
            <Image
              src="/nodes/product-2.png"
              alt="Aigarth compute node, side angle showing the heat-sink fins."
              width={2336}
              height={1744}
              className="h-auto w-full"
            />
          </div>
          <div className="overflow-hidden rounded-2xl border bg-card">
            <Image
              src="/nodes/lifestyle.png"
              alt="Aigarth compute node on a wooden desk next to a MacBook, pen, notebook, and coffee."
              width={2336}
              height={1744}
              className="h-auto w-full"
            />
          </div>
        </div>
      </Section>

      {/* Why it earns */}
      <FeatureGrid
        features={[
          { icon: Percent, title: "Yield on the deposit", body: "Opt in and your $30 deposit earns yield while you wait. Yield is credited against the balance at confirm time." },
          { icon: Coins, title: "USD-anchored pricing", body: "Page shows $599 / $30. The wallet UI converts to QUBIC at the current rate. You never lose to token price moves between reserve and confirm." },
          { icon: ShieldCheck, title: "Refunds, fully", body: "Cancel any time before mainnet for a full refund of the deposit. After mainnet, the standard reservation release terms apply." },
          { icon: TrendingUp, title: "Three tiers", body: "Tier 1 is open now. Tiers 2 and 3 drop later, sequenced. Reservation holders get a 7-day head start on each new tier." },
          { icon: Wallet, title: "Wallet-native", body: "The reserve flow uses your Qubic wallet. No accounts to create, no fiat to convert, no email-to-card dance." },
          { icon: Server, title: "Compute when you want it", body: "After mainnet, the node is yours. Run any model on the network. Bring your own API keys for a flat $29 per month and skip the model-usage margin." },
        ]}
      />

      {/* Compare table */}
      <Section
        title="Three ways to run compute."
        description="We compare on the things that matter for AI workloads. Hetzner and AWS rent you generic compute by the hour. Aigarth reserves you a node on a Qubic-secured network."
      >
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="border-b">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Feature</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Hetzner</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">AWS</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground">Aigarth</th>
              </tr>
            </thead>
            <tbody>
              {compareRows.map((r) => (
                <tr key={r.feature} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{r.feature}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.hetzner}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.aws}</td>
                  <td className="px-4 py-3">{r.aigarth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* FAQ */}
      <div id="faq">
        <Section
          title="Questions, answered."
          description="If you don't see your question here, ask in our community."
        >
          <div className="grid gap-4 md:grid-cols-2">
            {faqItems.map((f) => (
              <Card key={f.q}>
                <CardHeader>
                  <CardTitle className="text-lg">{f.q}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>
      </div>

      {/* Final CTA */}
      <Section
        title="Ready when you are."
        description="Three minutes from this page to a held spot in the Aigarth network."
        align="center"
      >
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <Badge variant="glow" className="w-fit mx-auto">Tier 1 presale</Badge>
            <CardTitle className="mt-3 text-center text-3xl">Reserve your compute node.</CardTitle>
            <CardDescription className="text-center">
              $30 deposit. Yield while you wait. Full refund any time before mainnet.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/signup?intent=reserve-node">
                Reserve for $30
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground">
              One tier now. Two more later. No subscription.
            </p>
          </CardContent>
        </Card>
      </Section>
    </>
  );
}
