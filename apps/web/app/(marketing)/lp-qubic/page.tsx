"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Brain,
  Check,
  Cpu,
  GitBranch,
  Globe,
  Layers,
  LineChart,
  Lock,
  Network,
  Rocket,
  Shield,
  Sprout,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Button } from "@aigarth/ui";
import { QubicLogo } from "@/components/brand/qubic-logo";
import { ANNGrowthSVG } from "./_components/ann-growth-svg";
import { EarningsChartSVG } from "./_components/earnings-chart-svg";

// =============================================================================
//  Qubic-themed landing page.
//
//  Single conversion target: /marketplace
//  Single primary CTA: "Explore Marketplace"
//
//  All colors use theme tokens (text-foreground, bg-card, border-border, …)
//  so the page reads cleanly in BOTH light and dark mode. Brand accents
//  (cyan, cream) use dark: overrides so they stay legible on either base.
// =============================================================================

const CTA = { href: "/marketplace", label: "Explore Marketplace" };

// Theme-aware gradient text: deep cyan in light, cyan→cream in dark.
const GRAD_TEXT =
  "bg-gradient-to-br from-cyan-800 via-cyan-500 to-cyan-900 dark:from-[#25CAD9] dark:via-[#6FE7F2] dark:to-[#FFDEA1] bg-clip-text text-transparent";

/**
 * Small Qubic mark: uses the official Bit2Me Qubic icon set.
 * Inherits its size from `className` and exposes a friendly
 * alt text for assistive tech.
 */

export default function QubicLandingPage() {
  return (
    <>
      <Hero />
      <LiveNetworkBar />
      <WhatIs />
      <CoreFeatures />
      <GrowFlow />
      <Earning />
      <FeaturedANNs />
      <FinalCTA />
    </>
  );
}

// -----------------------------------------------------------------------------
//  Hero
// -----------------------------------------------------------------------------
function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 bg-brand-mesh opacity-90" />
      <div className="absolute inset-0 opacity-[0.04] bg-dot-pattern" />

      <div className="container-wide relative">
        <div className="grid items-center gap-12 py-20 md:py-24 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-28">
          {/* Copy */}
          <div className="flex flex-col">
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1 }}
              className="text-balance font-display text-5xl font-medium leading-[1.02] tracking-tight md:text-6xl lg:text-[4.5rem]"
            >
              <span className="text-foreground">Grow your own</span>
              <br />
              <span className={`italic ${GRAD_TEXT}`}>
                Artificial Neural Networks
              </span>
              <span className="text-foreground">.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.2 }}
              className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground"
            >
              Stake QUBIC. Train an ANN. Publish it on the open market. Earn on
              every call: forever. The first cloud where the network grows with
              you, not against you.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.3 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Link href={CTA.href}>
                <Button
                  size="lg"
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 btn-glow font-medium"
                >
                  {CTA.label}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/anns">
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-1.5 border-border bg-transparent text-foreground hover:bg-muted"
                >
                  What is an ANN?
                </Button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground"
            >
              <div className="flex items-center gap-2">
                <QubicLogo className="h-4 w-4" />
                Built on Qubic · Useful Proof of Work
              </div>
              <div className="hidden h-3 w-px bg-border sm:block" />
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                47 regions
              </div>
              <div className="hidden h-3 w-px bg-border sm:block" />
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Sub-50ms inference
              </div>
            </motion.div>
          </div>

          {/* Hero visualization */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.2 }}
            className="relative flex items-center justify-center"
          >
            <div className="absolute inset-0 rounded-3xl bg-primary/10 blur-3xl dark:bg-primary/20" />
            <div className="relative w-full">
              <ANNGrowthSVG height={520} />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
//  Live network bar
// -----------------------------------------------------------------------------
function LiveNetworkBar() {
  const stats = [
    { label: "Live ANNs", value: 1247, suffix: "", color: "text-primary" },
    {
      label: "Calls today",
      value: 8_400_000,
      suffix: "+",
      color: "text-cyan-600 dark:text-[#6FE7F2]",
    },
    {
      label: "Qubic staked",
      value: 1_400_000_000,
      suffix: "",
      color: "text-amber-600 dark:text-[#FFDEA1]",
    },
    {
      label: "Avg. creator yield",
      value: 8.4,
      suffix: "%",
      color: "text-primary",
      decimals: 1,
    },
  ];
  return (
    <section className="relative border-b border-border bg-card/60 backdrop-blur-sm">
      <div className="container-wide py-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col">
              <div
                className={`font-mono text-2xl font-medium tracking-tight md:text-3xl ${s.color}`}
              >
                <Counter
                  to={s.value}
                  decimals={s.decimals ?? 0}
                  suffix={s.suffix}
                />
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Counter({
  to,
  decimals = 0,
  suffix = "",
}: {
  to: number;
  decimals?: number;
  suffix?: string;
}) {
  const [val, setVal] = React.useState(0);
  React.useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 1800;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setVal(ease(p) * to);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);

  let display: string;
  if (to >= 1_000_000_000) display = (val / 1_000_000_000).toFixed(1) + "B";
  else if (to >= 1_000_000) display = (val / 1_000_000).toFixed(1) + "M";
  else if (to >= 1_000) display = (val / 1_000).toFixed(1) + "K";
  else display = val.toFixed(decimals);

  return <span>{display}{suffix}</span>;
}

// -----------------------------------------------------------------------------
//  What is an ANN
// -----------------------------------------------------------------------------
function WhatIs() {
  const items = [
    {
      icon: Brain,
      label: "Network",
      title: "A trained network on Qubic.",
      body: "An ANN is a versioned neural network: weights, training data, benchmarks: all signed and published on Qubic.",
    },
    {
      icon: Lock,
      label: "Owned",
      title: "Your wallet. Your revenue.",
      body: "License terms are enforced by the chain. Every call pays you, your co-creators, and your stakers automatically.",
    },
    {
      icon: LineChart,
      label: "Billable",
      title: "Earn on every call.",
      body: "Set your price. Stake QUBIC to be discoverable. The network routes demand to the most accurate, most staked ANNs.",
    },
  ];
  return (
    <section className="py-20 md:py-28">
      <div className="container-wide">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-primary">
            The basics
          </div>
          <h2 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight text-foreground md:text-5xl">
            An ANN is intelligence you own.
          </h2>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
            Three things make an Aigarth ANN different from any model you can
            download. It is <em>owned</em>, it is <em>billable</em>, and it
            is <em>discoverable</em> by the network.
          </p>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-3">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <div
                key={it.title}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-7 transition-colors hover:border-primary/40 hover:bg-muted/50"
              >
                <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary opacity-0 blur-3xl transition-opacity group-hover:opacity-20" />
                <div className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="relative mt-5">
                  <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-600 dark:text-[#FFDEA1]/80">
                    {it.label}
                  </div>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                    {it.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {it.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
//  Core features
// -----------------------------------------------------------------------------
function CoreFeatures() {
  const features = [
    {
      icon: Layers,
      title: "Train anything",
      body: "Start from any base model. Vision, text, audio, embeddings, agents. Run distributed training on the same network that serves inference.",
    },
    {
      icon: GitBranch,
      title: "Version forever",
      body: "Every revision is a separate ANN with its own benchmarks. Roll back, branch, compare. The lineage is signed and public.",
    },
    {
      icon: Network,
      title: "Publish in one click",
      body: "List on the marketplace. Set a price, set a stake requirement, set a license. The studio handles signing, benchmarks, revenue splits.",
    },
    {
      icon: Shield,
      title: "License you control",
      body: "Open, commercial, or restricted. Per-region, per-tenant, per-call. Composable licenses enforced by the network, not a PDF.",
    },
    {
      icon: Cpu,
      title: "Serve at scale",
      body: "OpenAI-compatible API. Sub-50ms latency across 47 regions. The same network serves your ANN and routes traffic to the best nodes.",
    },
    {
      icon: Banknote,
      title: "Earn on every call",
      body: "75% to creator, 15% to stakers, 10% protocol. Revenue is distributed in real time. No invoices, no intermediaries.",
    },
  ];
  return (
    <section className="relative bg-secondary/50 py-20 md:py-28">
      <div className="container-wide relative">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-primary">
              Core features
            </div>
            <h2 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight text-foreground md:text-5xl">
              Everything you need to ship an ANN.
            </h2>
            <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
              No third-party tooling. No rented GPUs. The studio, the
              marketplace, the network: one stack, one chain, one revenue
              line.
            </p>
          </div>
          <Link href={CTA.href}>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-primary/50 bg-transparent text-primary hover:bg-primary/10"
            >
              {CTA.label}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-base font-semibold tracking-tight text-foreground">
                    {f.title}
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
//  Grow flow
// -----------------------------------------------------------------------------
function GrowFlow() {
  const steps = [
    {
      icon: Sprout,
      label: "Seed",
      title: "Connect your wallet",
      body: "Qubic wallet only. No KYC, no email. Five seconds.",
    },
    {
      icon: Layers,
      label: "Stake",
      title: "Lock QUBIC",
      body: "Your stake = your compute budget. Longer stake, lower fee.",
    },
    {
      icon: Brain,
      label: "Train",
      title: "Grow an ANN",
      body: "Pick a base. Add your data. Train on the network. Publish when ready.",
    },
    {
      icon: Rocket,
      label: "Publish",
      title: "List on the market",
      body: "Set price, license, stake requirement. Live in 60 seconds.",
    },
    {
      icon: Banknote,
      label: "Earn",
      title: "Compound forever",
      body: "Every call pays you + your stakers. Idle capacity earns too.",
    },
  ];

  return (
    <section className="relative border-t border-border bg-background py-20 md:py-28">
      <div className="container-wide">
        <div className="mx-auto max-w-2xl">
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-primary">
            The growth cycle
          </div>
          <h2 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight text-foreground md:text-5xl">
            From seed to network.
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            Every creator on Aigarth follows the same loop. No exceptions, no
            shortcuts. Stake, train, publish, earn, expand.
          </p>
        </div>

        <div className="relative mt-16">
          <div
            className="absolute left-0 right-0 top-[44px] hidden h-px md:block"
            style={{
              background:
                "linear-gradient(to right, transparent, rgba(37,202,217,0.4) 20%, rgba(255,222,161,0.4) 80%, transparent)",
            }}
          />

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-5">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="relative"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-[44px] w-[44px] items-center justify-center">
                      <motion.div
                        className="absolute inset-0 rounded-full bg-primary/20"
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{
                          duration: 2.4,
                          delay: i * 0.3,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                      <div className="relative flex h-11 w-11 items-center justify-center rounded-full border-2 border-primary/40 bg-card text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-600 dark:text-[#FFDEA1]/70">
                      Step {String(i + 1).padStart(2, "0")}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="text-base font-semibold tracking-tight text-foreground">
                      {s.label}
                    </div>
                    <div className="mt-1 text-sm font-medium text-foreground/90">
                      {s.title}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {s.body}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
//  Earning
// -----------------------------------------------------------------------------
function Earning() {
  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      <div className="absolute inset-0 bg-brand-mesh opacity-40" />

      <div className="container-wide relative">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          {/* Left: copy + revenue split */}
          <div>
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-primary">
              Earning
            </div>
            <h2 className="mt-3 text-balance font-display text-4xl font-medium leading-[1.05] tracking-tight text-foreground md:text-5xl">
              Stake once. Earn while you build. Compound forever.
            </h2>
            <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
              Your stake reserves compute. Your compute trains an ANN. Your ANN
              earns on every call. Idle capacity earns on the open market. The
              cycle never stops.
            </p>

            <div className="mt-10 space-y-3">
              {[
                {
                  label: "Creator share",
                  value: "75%",
                  note: "Direct to your wallet, every call",
                  color: "text-primary",
                },
                {
                  label: "Staker yield",
                  value: "8.4%",
                  note: "Avg. annual yield, paid in QUBIC",
                  color: "text-cyan-600 dark:text-[#6FE7F2]",
                },
                {
                  label: "Protocol fee",
                  value: "10%",
                  note: "Funds compute + R&D",
                  color: "text-amber-600 dark:text-[#FFDEA1]",
                },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4"
                >
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {row.label}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {row.note}
                    </div>
                  </div>
                  <div
                    className={`font-mono text-2xl font-medium ${row.color}`}
                  >
                    {row.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: chart card */}
          <div className="rounded-2xl border border-primary/20 bg-card p-6 shadow-lg shadow-primary/5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                  5-year projection
                </div>
                <div className="mt-1 text-lg font-semibold text-foreground">
                  Stake & train vs. just rent
                </div>
              </div>
              {/* Legend: both lines, so the comparison is obvious */}
              <div className="flex shrink-0 flex-col items-end gap-1.5 text-[11px]">
                <div className="flex items-center gap-1.5 text-primary">
                  <span className="inline-block h-1.5 w-3 rounded-full bg-primary" />
                  Stake & train
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span
                    className="inline-block h-1.5 w-3 rounded-full bg-muted-foreground/60"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(90deg, currentColor 0 3px, transparent 3px 6px)",
                    }}
                  />
                  Just rent
                </div>
              </div>
            </div>

            <div className="mt-6">
              <EarningsChartSVG height={240} />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4">
              {[
                { l: "Year 1", v: "+8.4%", c: "text-primary" },
                { l: "Year 2", v: "+17.6%", c: "text-cyan-600 dark:text-[#6FE7F2]" },
                { l: "Year 5", v: "+50.2%", c: "text-amber-600 dark:text-[#FFDEA1]" },
              ].map((m) => (
                <div key={m.l}>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {m.l}
                  </div>
                  <div className={`mt-1 font-mono text-base ${m.c}`}>
                    {m.v}
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

// -----------------------------------------------------------------------------
//  Featured ANNs
// -----------------------------------------------------------------------------
function FeaturedANNs() {
  const anns = [
    {
      name: "MediScan Vision",
      category: "Medical",
      acc: 98.4,
      calls: "1.2M",
      rev: "420K",
      stake: "45M",
      hot: true,
    },
    {
      name: "Oracle Prime",
      category: "Oracles",
      acc: 99.7,
      calls: "8.9M",
      rev: "920K",
      stake: "120M",
      hot: true,
    },
    {
      name: "CodeWeave",
      category: "Coding",
      acc: 96.1,
      calls: "3.4M",
      rev: "180K",
      stake: "21M",
    },
    {
      name: "Lex Reasoner",
      category: "Legal",
      acc: 94.2,
      calls: "840K",
      rev: "280K",
      stake: "32M",
    },
    {
      name: "FinCast Predict",
      category: "Finance",
      acc: 91.8,
      calls: "2.1M",
      rev: "610K",
      stake: "78M",
      hot: true,
    },
    {
      name: "Agent Frame",
      category: "Agents",
      acc: 89.4,
      calls: "1.8M",
      rev: "340K",
      stake: "42M",
    },
  ];
  return (
    <section className="relative bg-secondary/50 py-20 md:py-28">
      <div className="container-wide">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Marketplace · live
            </div>
            <h2 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight text-foreground md:text-5xl">
              Discover what the network is building.
            </h2>
            <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
              1,247 ANNs live. These are the ones earning the most this week.
              Browse, stake, license, or fork.
            </p>
          </div>
          <Link href={CTA.href}>
            <Button
              size="lg"
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-medium btn-glow"
            >
              {CTA.label}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {anns.map((ann) => (
            <Link
              key={ann.name}
              href={CTA.href}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
            >
              {ann.hot && (
                <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/5 px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.18em] text-amber-600 dark:border-[#FFDEA1]/40 dark:bg-[#FFDEA1]/5 dark:text-[#FFDEA1]">
                  <TrendingUp className="h-2.5 w-2.5" />
                  Hot
                </div>
              )}

              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                  <Brain className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold tracking-tight text-foreground">
                    {ann.name}
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                    {ann.category}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Accuracy
                  </div>
                  <div className="mt-1 font-mono text-sm text-primary">
                    {ann.acc.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Calls / mo
                  </div>
                  <div className="mt-1 font-mono text-sm text-foreground/80">
                    {ann.calls}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Staked
                  </div>
                  <div className="mt-1 font-mono text-sm text-foreground/80">
                    {ann.stake}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
                <span className="text-muted-foreground">Monthly revenue</span>
                <span className="font-mono text-amber-600 dark:text-[#FFDEA1]">
                  {ann.rev} QUBIC
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
//  Final CTA
// -----------------------------------------------------------------------------
function FinalCTA() {
  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      <div className="absolute inset-0 bg-brand-mesh opacity-60" />
      <div className="absolute inset-0 opacity-[0.05] bg-grid" />

      <div className="container-narrow relative text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-primary">
            The only CTA on this page
          </div>
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-primary">
            Start earning
          </div>
          <h2 className="mt-4 text-balance font-display text-4xl font-medium leading-[1.05] tracking-tight md:text-6xl">
            <span className={GRAD_TEXT}>1,247 ANNs.</span>
            <br />
            <span className="text-foreground">1 marketplace.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Everything on this page leads here. Browse, stake, license, fork.
            Start in under a minute.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-10"
        >
          <Link href={CTA.href}>
            <Button
              size="lg"
              className="group gap-2 bg-primary px-8 text-base text-primary-foreground hover:bg-primary/90 font-medium btn-glow"
            >
              {CTA.label}
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </Link>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <span>No card required</span>
            <span className="hidden h-2 w-px bg-border sm:inline-block" />
            <span>Connect Qubic wallet</span>
            <span className="hidden h-2 w-px bg-border sm:inline-block" />
            <span>Start earning today</span>
          </div>
        </motion.div>

        {/* Mini-trust strip */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-muted-foreground">
          {[
            "Qubic chain verified",
            "Open-source SDK",
            "SOC 2 in progress",
            "47 regions",
            "Sub-50ms p99",
          ].map((t) => (
            <div key={t} className="flex items-center gap-1.5">
              <Check className="h-3 w-3 text-primary" />
              {t}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
