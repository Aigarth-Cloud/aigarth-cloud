/**
 * /stake-access: the public landing page for the Stake-to-Access flow.
 *
 * Per ADR 002: the user locks QUBIC in the Qearn contract; the
 * off-chain Qearn watcher (services/economy) observes the lock and
 * grants compute access via the Aigarth off-chain economy.
 *
 * Marketing copy: plain English, no abstract nouns. The user
 * shouldn't need to know what a "smart contract" or a "Qearn
 * contract address" is to use this page.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Coins,
  Lock,
  Shield,
  TrendingUp,
  Wallet,
  Zap,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@aigarth/ui";
import { Badge } from "@aigarth/ui";
import { ANN_CATEGORIES, FEATURED_ANNS, type ANN } from "@/lib/anns-data";
import { cn } from "@aigarth/utils";

export const metadata: Metadata = {
  title: "Stake to Access ANNs · Aigarth Cloud",
  description:
    "Lock QUBIC to unlock specialized intelligence. Six ANNs across Caribbean agriculture, finance, legal, language, science, and coding. Real yield, real access, real economy.",
};

const ICONS: Record<string, LucideIcon> = {
  leaf: Sparkles,
  shield: Shield,
  languages: Sparkles,
  scale: Shield,
  sun: Sparkles,
  code: Sparkles,
};

function parseQu(qu: string): number {
  // "8M QUBIC" → 8_000_000
  const m = qu.match(/^([\d.]+)\s*([KMB])?/);
  if (!m) return 0;
  const n = parseFloat(m[1] ?? "0");
  const mult = m[2] === "K" ? 1_000 : m[2] === "M" ? 1_000_000 : m[2] === "B" ? 1_000_000_000 : 1;
  return n * mult;
}

function fmtQu(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B QUBIC`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M QUBIC`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K QUBIC`;
  return `${n} QUBIC`;
}

export default function StakeAccessPage() {
  const totalStake = FEATURED_ANNS.reduce((s, a) => s + parseQu(a.stakeRequired), 0);
  const freeCount = FEATURED_ANNS.filter((a) => a.pricePerCall === "Free").length;
  const avgYield = 12.5; // Qearn APY at typical locked pool size

  return (
    <main className="min-h-screen bg-background">
      <Hero
        totalStake={totalStake}
        avgYield={avgYield}
        annCount={FEATURED_ANNS.length}
        freeCount={freeCount}
      />
      <HowItWorks />
      <AnnGrid />
      <Economics avgYield={avgYield} />
      <Cta />
    </main>
  );
}

function Hero({
  totalStake,
  avgYield,
  annCount,
  freeCount,
}: {
  totalStake: number;
  avgYield: number;
  annCount: number;
  freeCount: number;
}) {
  return (
    <section className="border-b bg-gradient-to-b from-garden-500/5 to-transparent">
      <div className="container-wide py-20 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="glow" className="mb-6">
            <Lock className="mr-1.5 inline h-3 w-3" /> STAKE TO ACCESS
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight lg:text-5xl">
            Lock QUBIC. Unlock Intelligence.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Six specialized ANNs across Caribbean agriculture, finance, legal, language, science, and coding.
            Lock QUBIC in the Qearn contract to unlock access: earn yield while you work.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Minimum to unlock all" value={fmtQu(totalStake)} icon={Coins} />
            <StatTile label="Avg. APY on your lock" value={`${avgYield.toFixed(1)}%`} icon={TrendingUp} />
            <StatTile label="ANNs in catalog" value={String(annCount)} icon={Sparkles} />
            <StatTile label="Free under Open license" value={String(freeCount)} icon={Zap} />
          </div>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg">
              <Link href="/signup">
                Get started <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/marketplace">Browse the marketplace</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-xl border bg-card/50 p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function HowItWorks() {
  const steps: Array<{ icon: LucideIcon; title: string; body: string }> = [
    {
      icon: Wallet,
      title: "1. Connect your Qubic wallet",
      body:
        "Link a Qubic address to your Aigarth account in two clicks. No KYC, no signup forms. Your wallet stays yours: Aigarth only reads the lock state.",
    },
    {
      icon: Lock,
      title: "2. Lock QUBIC in Qearn",
      body:
        "Pick an ANN, set a lock duration (1–52 weeks), and sign a Qearn lock transaction. The Qearn contract holds your principal: Aigarth can't touch it. You earn QUBIC yield on the lock.",
    },
    {
      icon: Sparkles,
      title: "3. Get ANN access + yield",
      body:
        "The moment your lock confirms, the Aigarth off-chain economy grants you the ANN's compute credit. Use the ANN as much as you want for the lock duration. When you unlock, you keep your principal and the yield: minus any early-unlock penalty.",
    },
  ];
  return (
    <section className="border-b">
      <div className="container-wide py-16 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-garden-600 dark:text-garden-400">
            How it works
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Three steps, one transaction</h2>
          <p className="mt-3 text-muted-foreground">
            Lock QUBIC. Earn yield. Get access. No separate subscription, no separate billing: your stake IS your access.
          </p>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {steps.map((s) => (
            <div key={s.title} className="rounded-2xl border bg-card p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-garden-500/10 text-garden-600">
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-medium">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AnnGrid() {
  // Group by category for the section view, but show a flat grid for
  // the demo (6 ANNs is too few to merit a category split).
  return (
    <section className="border-b">
      <div className="container-wide py-16 lg:py-20">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-garden-600 dark:text-garden-400">
              The catalog
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Six ANNs. One lock.</h2>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Every ANN in the starter catalog. Lock QUBIC and unlock the whole row, or just the
              ones you need.
            </p>
          </div>
          <div className="hidden text-xs text-muted-foreground lg:block">
            {ANN_CATEGORIES.length - 1} categories available
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURED_ANNS.map((ann) => (
            <AnnCard key={ann.id} ann={ann} />
          ))}
        </div>
      </div>
    </section>
  );
}

function AnnCard({ ann }: { ann: ANN }) {
  const Icon = ICONS[ann.icon] ?? Sparkles;
  return (
    <div className="group relative flex flex-col rounded-2xl border bg-card p-6 transition-colors hover:border-garden-500/50">
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-garden-500/10 text-garden-600">
          <Icon className="h-5 w-5" />
        </div>
        <Badge variant={ann.licenseType === "Open" ? "success" : ann.licenseType === "Commercial" ? "secondary" : "warning"}>
          {ann.licenseType}
        </Badge>
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight">{ann.name}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{ann.creator} · {ann.category}</p>
      <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{ann.description}</p>

      <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-md border bg-muted/30 p-2">
          <div className="text-muted-foreground">Accuracy</div>
          <div className="mt-0.5 font-mono font-medium">{ann.accuracy.toFixed(1)}%</div>
        </div>
        <div className="rounded-md border bg-muted/30 p-2">
          <div className="text-muted-foreground">Latency p50</div>
          <div className="mt-0.5 font-mono font-medium">{ann.latencyMs}ms</div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t pt-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Stake to unlock</div>
          <div className="mt-0.5 font-mono text-sm font-medium">{ann.stakeRequired}</div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={`/marketplace/${ann.id}`}>
            View <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function Economics({ avgYield }: { avgYield: number }) {
  return (
    <section className="border-b">
      <div className="container-wide py-16 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-garden-600 dark:text-garden-400">
              The economics
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Real yield, real access</h2>
            <p className="mt-3 text-muted-foreground">
              Your locked QUBIC earns QUBIC yield the whole time it's locked. The yield comes from
              the Qearn reward pool: about 10% of weekly network emissions, paid pro-rata to
              locked positions. The longer you lock, the more you earn.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-garden-500" />
                <span>
                  <strong>No separate subscription.</strong> Your stake is your access. No
                  tiered plans, no per-seat fees.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-garden-500" />
                <span>
                  <strong>Principal is always returned.</strong> Even on early unlock, you get
                  100% of your QUBIC back. The penalty is on the yield, not the stake.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-garden-500" />
                <span>
                  <strong>On the Qearn contract, not on Aigarth.</strong> Aigarth never holds
                  your QUBIC. The Qearn contract does. Aigarth reads the lock and grants
                  access; the principal is between you and the network.
                </span>
              </li>
            </ul>
          </div>
          <div className="rounded-2xl border bg-card p-8">
            <h3 className="text-lg font-medium">Worked example</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Lock <strong>10M QUBIC for 52 weeks</strong> in the Qearn contract.
            </p>
            <div className="mt-6 space-y-3 text-sm">
              <Row label="Principal" value="10,000,000 QUBIC" />
              <Row label="APY (current pool)" value={`${avgYield.toFixed(1)}%`} />
              <Row label="Estimated yield (52w, full term)" value="6,500,000 QUBIC" accent="positive" />
              <Row label="Your QUBIC at unlock" value="16,500,000 QUBIC" />
              <hr className="border-border" />
              <Row label="ANN access for the full 52 weeks" value="Unlocked" accent="positive" />
              <Row label="Access ends at unlock" value="Yes" />
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              Example illustrative only. Actual yield depends on the total Qearn pool at the time of
              your lock; the formula is 100B QUBIC per week × 52 ÷ total locked.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: "positive" | "negative" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono font-medium",
          accent === "positive" && "text-mint-600 dark:text-mint-400",
          accent === "negative" && "text-red-500",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Cta() {
  return (
    <section className="border-b">
      <div className="container-wide py-20 text-center">
        <h2 className="text-3xl font-semibold tracking-tight">Lock once. Earn twice.</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Get ANN access and QUBIC yield from the same lock. No separate subscription. No
          gating on top of the Qearn contract. Real economy, real access.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg">
            <Link href="/signup">
              Create your account <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/docs/architecture-decisions/002-staking-contract-strategy">
              Read ADR 002
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
