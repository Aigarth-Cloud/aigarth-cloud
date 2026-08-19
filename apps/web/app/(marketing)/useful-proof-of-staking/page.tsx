"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Coins,
  Cpu,
  Flame,
  Layers,
  Network,
  Shield,
  TrendingUp,
  Wallet,
  Zap,
  Clock,
  Users,
  Server,
  ChevronRight,
} from "lucide-react";
import { Button } from "@aigarth/ui";
import { Badge } from "@aigarth/ui";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@aigarth/ui";
import { LiveCounter } from "@/components/motion/live-counter";

export default function UsefulProofOfStakingPage() {
  return (
    <>
      <Hero />
      <Mechanism />
      <FlowDiagram />
      <Economics />
      <Timeline />
      <Comparisons />
      <YieldSimulator />
      <NetworkVisualization />
      <Governance />
      <FAQ />
      <CTA />
    </>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b">
      <div className="absolute inset-0 bg-garden-mesh" />
      <div className="container-wide relative py-20 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="glow" className="mb-6">
              <Coins className="h-3 w-3" />
              The flagship economic primitive
            </Badge>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-balance font-display text-5xl font-medium leading-[1.05] tracking-tight md:text-6xl lg:text-7xl"
          >
            Useful{" "}
            <span className="text-gradient-garden italic">Proof of Staking</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground"
          >
            Stake QUBIC to reserve intelligent compute. Use what you need. Earn from
            what you don't. A new economic primitive where capital and infrastructure
            grow together.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <Link href="/pricing">
              <Button size="lg" className="gap-1.5">
                See staking plans
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline">
                Try the simulator
              </Button>
            </Link>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mx-auto mt-20 grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-4"
        >
          {[
            { value: 1.4, suffix: "B QUBIC", label: "Total staked" },
            { value: 8.4, suffix: "%", label: "Avg. annual yield" },
            { value: 47, suffix: "", label: "Compute regions" },
            { value: 99.99, suffix: "%", label: "Settlement uptime" },
          ].map((stat, i) => (
            <div
              key={i}
              className="rounded-2xl border bg-card p-5 text-center"
            >
              <div className="text-2xl font-medium tracking-tight md:text-3xl">
                <LiveCounter
                  value={stat.value}
                  format={(v) =>
                    v.toLocaleString("en-US", {
                      minimumFractionDigits: stat.suffix === "%" || stat.value % 1 !== 0 ? 2 : 0,
                      maximumFractionDigits: 2,
                    })
                  }
                />
                <span className="ml-0.5 text-base font-normal text-muted-foreground md:text-lg">
                  {stat.suffix}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function Mechanism() {
  return (
    <section className="border-b py-20 md:py-28">
      <div className="container-wide">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
            The mechanism
          </p>
          <h2 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
            How capital becomes infrastructure.
          </h2>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
            Useful Proof of Staking aligns three groups: stakers, operators, and users.
            The result is a self-reinforcing loop where value flows back to those who
            contribute capital and capacity.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Wallet,
              title: "1. Stakers",
              body: "Lock QUBIC to reserve compute capacity. Larger stakes unlock more throughput, dedicated clusters, and governance weight.",
              points: ["Reserved capacity", "Burn discounts", "Governance voting"],
            },
            {
              icon: Server,
              title: "2. Operators",
              body: "Run verified hardware. Validate computation. Earn fees from network usage and staking rewards.",
              points: ["Block validation", "Compute rewards", "Quality bonuses"],
            },
            {
              icon: Users,
              title: "3. Users",
              body: "Consume AI services. Pay protocol fees. Drive demand for compute that flows back to stakers and operators.",
              points: ["OpenAI-compatible APIs", "Pay per token", "Volume discounts"],
            },
          ].map((role) => {
            const Icon = role.icon;
            return (
              <div
                key={role.title}
                className="rounded-2xl border bg-card p-7"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-tight">
                  {role.title}
                </h3>
                <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
                  {role.body}
                </p>
                <ul className="mt-5 space-y-2 text-sm">
                  {role.points.map((p) => (
                    <li key={p} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-garden-500" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FlowDiagram() {
  const steps = [
    { label: "Stake", desc: "Lock QUBIC", icon: Wallet },
    { label: "Reserve", desc: "Capacity assigned", icon: Layers },
    { label: "Use", desc: "Run inference", icon: Cpu },
    { label: "Fees", desc: "Pay per call", icon: Coins },
    { label: "Burn", desc: "Tokens removed", icon: Flame },
    { label: "Treasury", desc: "Funds growth", icon: TrendingUp },
  ];

  return (
    <section className="border-b bg-secondary/30 py-20 md:py-28">
      <div className="container-wide">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
            The flow
          </p>
          <h2 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
            Where every QUBIC goes.
          </h2>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
            Aigarth's economic loop is transparent. Every transaction, every fee,
            every reward  ” on a verifiable path.
          </p>
        </div>

        <div className="mt-16">
          <div className="rounded-3xl border bg-card p-6 md:p-10">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              {steps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <React.Fragment key={step.label}>
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: i * 0.1 }}
                      className="relative flex flex-col items-center text-center"
                    >
                      <div className="relative">
                        <div className="absolute inset-0 -m-2 rounded-full bg-primary/10 blur-lg" />
                        <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-garden-500/30 bg-background text-primary">
                          <Icon className="h-7 w-7" />
                        </div>
                      </div>
                      <div className="mt-3 text-sm font-semibold">{step.label}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {step.desc}
                      </div>
                    </motion.div>
                    {i < steps.length - 1 && (
                      <div className="hidden items-center justify-center lg:flex">
                        <ChevronRight className="h-5 w-5 text-garden-500/50" />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            <div className="mt-10 rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground">
              <strong className="font-medium text-foreground">Note:</strong> Burn
              percentages and treasury allocations shown here are conceptual
              examples. Actual values are governed by on-chain votes and may vary.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Economics() {
  const metrics = [
    {
      icon: Coins,
      label: "Reserve ratio",
      value: "1M QUBIC ≈ 8 GPU-hr / day",
      note: "Indicative allocation ratio",
    },
    {
      icon: TrendingUp,
      label: "Staker yield",
      value: "6%  “ 12% APY",
      note: "Range across plan tiers",
    },
    {
      icon: Flame,
      label: "Illustrative burn",
      value: "15% of protocol fees",
      note: "Conceptual example",
    },
    {
      icon: Shield,
      label: "Slashing",
      value: "Up to 5% on downtime",
      note: "Operator-only",
    },
  ];

  return (
    <section className="border-b py-20 md:py-28">
      <div className="container-wide">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
            Economics
          </p>
          <h2 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
            Numbers, transparent and verifiable.
          </h2>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
            These figures illustrate how the model is designed to work. They will be
            replaced with on-chain data once the protocol reaches mainnet parity.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="rounded-2xl border bg-card p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">
                  {m.label}
                </div>
                <div className="mt-1 text-xl font-semibold tracking-tight">
                  {m.value}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">{m.note}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Timeline() {
  const events = [
    { era: "Day 0", title: "Stake", body: "QUBIC locked in the reserve contract." },
    { era: "Day 1", title: "Allocation", body: "Capacity assigned to your account." },
    { era: "Ongoing", title: "Use", body: "Run inference, embeddings, training, agents." },
    { era: "Daily", title: "Settlement", body: "Protocol fees paid, rewards distributed." },
    { era: "Quarterly", title: "Governance", body: "Vote on parameters, burn rate, treasury." },
    { era: "Anytime", title: "Unstake", body: "Cool-down period applies. Capacity returned." },
  ];

  return (
    <section className="border-b bg-secondary/30 py-20 md:py-28">
      <div className="container-wide">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
            Timeline
          </p>
          <h2 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
            A stake is a relationship, not a transaction.
          </h2>
        </div>

        <div className="mt-16">
          <div className="relative">
            <div className="absolute left-4 top-0 h-full w-px bg-gradient-to-b from-garden-500/50 via-garden-500/20 to-transparent md:left-1/2" />
            <div className="space-y-8">
              {events.map((event, i) => (
                <motion.div
                  key={event.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className="relative flex items-start gap-6 md:gap-12"
                >
                  <div className="absolute left-4 -translate-x-1/2 md:left-1/2">
                    <div className="h-3 w-3 rounded-full bg-garden-500 shadow-glow" />
                  </div>
                  <div className="ml-12 md:ml-0 md:w-1/2 md:pr-12 md:text-right">
                    <div className="text-xs uppercase tracking-wider text-garden-600 dark:text-garden-400">
                      {event.era}
                    </div>
                    <div className="mt-1 text-lg font-semibold">{event.title}</div>
                    <p className="mt-1 text-sm text-muted-foreground">{event.body}</p>
                  </div>
                  <div className="hidden md:block md:w-1/2" />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Comparisons() {
  return (
    <section className="border-b py-20 md:py-28">
      <div className="container-wide">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
            Comparison
          </p>
          <h2 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
            How Aigarth compares.
          </h2>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {[
            {
              title: "vs AWS",
              subtitle: "Decentralized cloud",
              points: [
                ["Ownership", "Staked capacity", "Recurring rent"],
                ["Exit", "Unstake anytime", "Migration required"],
                ["Idle cost", "Earn from spare", "Pay regardless"],
                ["Pricing", "Token-efficient", "USD-billed"],
                ["Vendor lock", "Portable APIs", "Proprietary stack"],
              ],
            },
            {
              title: "vs OpenAI",
              subtitle: "Open inference layer",
              points: [
                ["Source", "Distributed network", "Centralized"],
                ["Pricing", "Staking discount", "Pay per token"],
                ["Monetize", "Sell idle capacity", "Not available"],
                ["Governance", "On-chain voting", "Closed"],
                ["Models", "Multiple providers", "Proprietary only"],
              ],
            },
            {
              title: "vs Traditional Staking",
              subtitle: "Productive capital",
              points: [
                ["Yield source", "Real compute usage", "Inflation only"],
                ["Backing", "Reserved infrastructure", "No backing"],
                ["Utility", "Use compute directly", "Passive"],
                ["Risk", "Operator slashing", "Inflation dilution"],
                ["Returns", "Fees + burn", "Inflationary rewards"],
              ],
            },
          ].map((col) => (
            <div key={col.title} className="rounded-2xl border bg-card p-6">
              <div className="flex items-baseline justify-between">
                <h3 className="text-xl font-semibold tracking-tight">{col.title}</h3>
                <span className="text-xs text-muted-foreground">{col.subtitle}</span>
              </div>
              <div className="mt-6 space-y-3">
                {col.points.map(([label, ours, theirs]) => (
                  <div key={label} className="grid grid-cols-[1fr_1fr_1fr] gap-2 text-sm">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      {label}
                    </div>
                    <div className="font-medium text-garden-600 dark:text-garden-400">
                      {ours}
                    </div>
                    <div className="text-muted-foreground">{theirs}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function YieldSimulator() {
  const [stake, setStake] = React.useState(50);
  const [tier, setTier] = React.useState<"builder" | "startup" | "business">("builder");

  // Illustrative: ~8% yield on staked, minus usage discount
  const baseYield = stake * 1_000_000 * 0.08;
  const tiers = {
    builder: { label: "Builder", discount: 0.25 },
    startup: { label: "Startup", discount: 0.4 },
    business: { label: "Business", discount: 0.55 },
  };
  const discountPct = tiers[tier].discount;
  const discounted = baseYield * (1 - discountPct);
  const effective = baseYield - discounted + baseYield;

  return (
    <section className="border-b bg-foreground py-20 text-background md:py-28">
      <div className="container-wide">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-garden-400">
              Interactive simulator
            </p>
            <h2 className="mt-3 text-balance font-display text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
              Estimate your yield.
            </h2>
            <p className="mt-5 text-pretty text-lg leading-relaxed text-background/70">
              Stakers earn from network usage and protocol fees. Higher tiers get
              burn discounts and priority routing. All numbers are illustrative.
            </p>
          </div>

          <div className="rounded-2xl border border-background/10 bg-background/[0.03] p-6 backdrop-blur md:p-8">
            <div>
              <label className="text-xs uppercase tracking-wider text-background/60">
                Stake (M QUBIC): <span className="text-background">{stake}</span>
              </label>
              <input
                type="range"
                min={10}
                max={500}
                step={5}
                value={stake}
                onChange={(e) => setStake(Number(e.target.value))}
                className="mt-3 w-full accent-garden-500"
              />
              <div className="mt-1 flex justify-between text-xs text-background/50">
                <span>10M</span>
                <span>500M</span>
              </div>
            </div>

            <div className="mt-6">
              <label className="text-xs uppercase tracking-wider text-background/60">
                Plan tier
              </label>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {Object.entries(tiers).map(([key, t]) => (
                  <button
                    key={key}
                    onClick={() => setTier(key as keyof typeof tiers)}
                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                      tier === key
                        ? "border-garden-500 bg-garden-500/10 text-garden-300"
                        : "border-background/10 hover:bg-background/5"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 space-y-3 border-t border-background/10 pt-6 text-sm">
              <div className="flex justify-between">
                <span className="text-background/60">Base yield (8%)</span>
                <span className="font-mono">
                  {baseYield.toLocaleString("en-US", { maximumFractionDigits: 0 })} QUBIC
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-background/60">
                  Burn discount ({(discountPct * 100).toFixed(0)}%)
                </span>
                <span className="font-mono text-mint-300">
                  -{discounted.toLocaleString("en-US", { maximumFractionDigits: 0 })} QUBIC
                </span>
              </div>
              <div className="flex justify-between border-t border-background/10 pt-3 text-base font-semibold">
                <span>Annual est.</span>
                <span className="text-garden-300">
                  {effective.toLocaleString("en-US", { maximumFractionDigits: 0 })} QUBIC
                </span>
              </div>
            </div>

            <div className="mt-4 text-xs text-background/50">
              Illustrative only. Actual returns depend on network usage, slashing,
              and governance parameters.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function NetworkVisualization() {
  return (
    <section className="border-b py-20 md:py-28">
      <div className="container-wide">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
            Live network
          </p>
          <h2 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
            A living ecosystem.
          </h2>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
            Thousands of stakers, operators, and users connected. Every node is
            verified. Every flow is settled.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-4">
          {[
            { label: "Active stakers", value: "12,847", icon: Users },
            { label: "Operators online", value: "1,204", icon: Server },
            { label: "Active models", value: "47", icon: Cpu },
            { label: "Settlement latency", value: "1.2s", icon: Clock },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="rounded-2xl border bg-card p-6"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                    <div className="font-mono text-2xl font-medium tracking-tight">
                      {s.value}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Governance() {
  return (
    <section className="border-b bg-secondary/30 py-20 md:py-28">
      <div className="container-wide">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
              Governance
            </p>
            <h2 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
              Stakers steer the network.
            </h2>
            <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
              The longer you stake, the more your voice weighs. Vote on burn rate,
              supported models, treasury grants, and protocol upgrades.
            </p>
            <Link href="/dashboard">
              <Button className="mt-8 gap-1.5">
                Open governance
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="rounded-2xl border bg-card p-6">
            <h3 className="text-sm font-semibold">Active proposals</h3>
            <div className="mt-5 space-y-4">
              {[
                { id: "AIP-042", title: "Lower image generation fees by 12%", votes: "78%", time: "2d left" },
                { id: "AIP-041", title: "Add Grok-2 to the model registry", votes: "92%", time: "5d left" },
                { id: "AIP-040", title: "Increase enterprise SLA compensation", votes: "61%", time: "8d left" },
              ].map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border bg-muted/30 p-4"
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-mono">{p.id}</span>
                    <span>{p.time}</span>
                  </div>
                  <div className="mt-2 text-sm font-medium">{p.title}</div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">For</span>
                    <span className="font-mono text-garden-600 dark:text-garden-400">
                      {p.votes}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-garden-500"
                      style={{ width: p.votes }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const faqs = [
    {
      q: "What's the minimum stake?",
      a: "Explorer tier starts at 10M QUBIC. The network has no absolute minimum  ” smaller stakes share community compute at lower priority.",
    },
    {
      q: "Can I unstake at any time?",
      a: "Yes. There's a cool-down period (typically 7 “14 days) during which capacity is reserved but no new rewards accrue.",
    },
    {
      q: "How is yield generated?",
      a: "From protocol fees paid by users of AI services, oracle jobs, and outsourced computation. Yield is variable, not fixed.",
    },
    {
      q: "What about slashing?",
      a: "Slashing only applies to operators who fail validation. Stakers are not slashed for market movements, though staked tokens are still subject to token price volatility.",
    },
    {
      q: "How does the burn work?",
      a: "A configurable percentage of protocol fees is sent to a burn address, permanently reducing supply. The rate is set by on-chain governance.",
    },
    {
      q: "Is my principal guaranteed?",
      a: "No. Staked QUBIC is not a deposit. It is productive capital whose value tracks both the token and the network's usage.",
    },
    {
      q: "Can I use my stake on multiple products?",
      a: "Yes. Reserved capacity can be split across inference, embeddings, fine-tuning, agents, and other services. Governance and staking rewards are unaffected.",
    },
  ];

  return (
    <section className="border-b py-20 md:py-28">
      <div className="container-narrow">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
            FAQ
          </p>
          <h2 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
            Common questions.
          </h2>
        </div>

        <div className="mt-12">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger>{faq.q}</AccordionTrigger>
                <AccordionContent>{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-20 md:py-28">
      <div className="container-narrow text-center">
        <h2 className="text-balance font-display text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
          Reserve compute. Earn while you build.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
          Pick a plan, stake QUBIC, and start running AI workloads in minutes.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/pricing">
            <Button size="lg" className="gap-1.5">
              See staking plans
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
  );
}
