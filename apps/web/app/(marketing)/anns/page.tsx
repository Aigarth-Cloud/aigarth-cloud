"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Brain,
  Cpu,
  GitBranch,
  GitMerge,
  Layers,
  LineChart,
  Lock,
  Network,
  Sparkles,
  TrendingUp,
  Users,
  Wrench,
  Check,
} from "lucide-react";
import { Button } from "@aigarth/ui";
import { Badge } from "@aigarth/ui";
import { LogoMark } from "@/components/brand/logo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@aigarth/ui";

export default function ANNsPage() {
  return (
    <>
      <Hero />
      <WhatIs />
      <Lifecycle />
      <Architecture />
      <Earnings />
      <MarketplaceTeaser />
      <Governance />
      <Security />
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
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <Badge variant="glow" className="mb-6">
              <Brain className="h-3 w-3" />
              Artificial Neural Networks
            </Badge>
            <h1 className="text-balance font-display text-5xl font-medium leading-[1.05] tracking-tight md:text-6xl">
              ANNs. Intelligence you can own.
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
              Train, version, license, and monetize neural networks on Aigarth.
              Every ANN is auditable, billable, and revenue-shareable. Owned by
              the people who build it.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/marketplace">
                <Button size="lg" className="gap-1.5">
                  Browse the marketplace
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button size="lg" variant="outline">
                  Open the studio
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-garden-500/10 via-transparent to-emerald-500/5 blur-3xl" />
            <div className="relative rounded-2xl border bg-card p-8">
              <ANNDiagram />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ANNDiagram() {
  return (
    <svg viewBox="0 0 400 320" className="w-full">
      <defs>
        <linearGradient id="annGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="hsl(134 50% 40%)" />
          <stop offset="100%" stopColor="hsl(170 60% 50%)" />
        </linearGradient>
        <radialGradient id="annNode">
          <stop offset="0%" stopColor="hsl(160 80% 70%)" />
          <stop offset="100%" stopColor="hsl(134 50% 40%)" />
        </radialGradient>
      </defs>

      {/* Layers */}
      {[
        { x: 50, label: "Input" },
        { x: 150, label: "Hidden 1" },
        { x: 250, label: "Hidden 2" },
        { x: 350, label: "Output" },
      ].map((layer, li) => (
        <g key={layer.label}>
          {Array.from({ length: li === 0 || li === 3 ? 3 : 4 }).map((_, ni) => {
            const yCount = li === 0 || li === 3 ? 3 : 4;
            const y = 80 + (ni + 0.5) * (160 / yCount);
            return (
              <motion.circle
                key={ni}
                cx={layer.x}
                cy={y}
                r="8"
                fill="url(#annNode)"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.4, delay: 0.1 * ni + 0.2 * li }}
              />
            );
          })}
          <text
            x={layer.x}
            y="280"
            textAnchor="middle"
            className="fill-muted-foreground text-[10px] font-medium uppercase tracking-wider"
          >
            {layer.label}
          </text>
        </g>
      ))}

      {/* Connections */}
      {[0, 1, 2, 3].map((li) =>
        Array.from({ length: li === 0 || li === 3 ? 3 : 4 }).map((_, ni) => {
          const yCount = li === 0 || li === 3 ? 3 : 4;
          const nextY = li === 3 ? 3 : li === 2 ? 3 : li === 0 ? 4 : 4;
          return Array.from({ length: nextY }).map((_, nj) => {
            const y1 = 80 + (ni + 0.5) * (160 / yCount);
            const y2 = 80 + (nj + 0.5) * (160 / nextY);
            return (
              <motion.line
                key={`${li}-${ni}-${nj}`}
                x1={50 + li * 100}
                y1={y1}
                x2={50 + (li + 1) * 100}
                y2={y2}
                stroke="url(#annGrad)"
                strokeWidth="0.5"
                opacity="0.4"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, delay: 0.1 * ni + 0.2 * li }}
              />
            );
          });
        })
      )}

      {/* Data flow indicators */}
      <motion.circle
        r="3"
        fill="hsl(170 80% 60%)"
        initial={{ cx: 50, cy: 130, opacity: 0 }}
        animate={{
          cx: [50, 150, 250, 350],
          cy: [130, 130, 130, 130],
          opacity: [0, 1, 1, 0],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.circle
        r="3"
        fill="hsl(170 80% 60%)"
        initial={{ cx: 50, cy: 180, opacity: 0 }}
        animate={{
          cx: [50, 150, 250, 350],
          cy: [180, 180, 180, 180],
          opacity: [0, 1, 1, 0],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      />
    </svg>
  );
}

function WhatIs() {
  return (
    <section className="border-b py-20 md:py-28">
      <div className="container-wide">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
            What is an ANN?
          </p>
          <h2 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
            A trained network with an identity.
          </h2>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
            An Aigarth ANN is more than a model. It's a versioned, owned, and
            billable network with a creator, license, accuracy benchmark, and
            revenue history. You can deploy it, stake behind it, license it,
            subscribe to it, or fork it (if allowed).
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Layers,
              title: "Versioned",
              body: "Every revision is a separate ANN with its own benchmarks. Roll back, branch, or compare versions.",
            },
            {
              icon: Lock,
              title: "Owned",
              body: "Creators retain ownership. Use a wallet-bound license to enforce access on every call.",
            },
            {
              icon: LineChart,
              title: "Billable",
              body: "Set your price per call. Track revenue in real time. Distribute to co-creators automatically.",
            },
          ].map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="rounded-2xl border bg-card p-7">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-tight">{p.title}</h3>
                <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
                  {p.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Lifecycle() {
  const stages = [
    { icon: GitBranch, label: "Train", desc: "Build on a base model. Use your data. Run distributed training." },
    { icon: Layers, label: "Version", desc: "Tag a release. Bake in benchmarks, license, and pricing." },
    { icon: GitMerge, label: "Publish", desc: "List on the marketplace. Set stake requirements and revenue splits." },
    { icon: Users, label: "Stake", desc: "Community stakes behind you. Higher stake = more visibility." },
    { icon: TrendingUp, label: "Earn", desc: "Earn on every call. Watch your network grow with usage." },
  ];

  return (
    <section className="border-b bg-secondary/30 py-20 md:py-28">
      <div className="container-wide">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
            Lifecycle
          </p>
          <h2 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
            From training to revenue.
          </h2>
        </div>

        <div className="mt-16">
          <div className="grid gap-4 md:grid-cols-5">
            {stages.map((stage, i) => {
              const Icon = stage.icon;
              return (
                <motion.div
                  key={stage.label}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="relative rounded-2xl border bg-card p-6"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">
                    Stage {i + 1}
                  </div>
                  <div className="mt-1 text-lg font-semibold">{stage.label}</div>
                  <p className="mt-2 text-sm text-muted-foreground">{stage.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function Architecture() {
  return (
    <section className="border-b py-20 md:py-28">
      <div className="container-wide">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
            Architecture
          </p>
          <h2 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
            Built on a verifiable foundation.
          </h2>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {[
            {
              title: "Cryptographic lineage",
              body: "Every ANN carries a signed manifest: base model, training data hashes, hyperparameters, and benchmarks. Anyone can verify provenance.",
            },
            {
              title: "Deterministic inference",
              body: "Each call is reproducible. Output hashes are recorded on-chain, enabling audit trails for regulated industries.",
            },
            {
              title: "Composable licensing",
              body: "Combine Open, Commercial, and Restricted licenses. Set per-region rules, per-tenant rules, and per-call pricing.",
            },
            {
              title: "Multi-modal by default",
              body: "Vision, text, audio, embeddings, agents. Mix modalities in a single ANN or compose them with the orchestration SDK.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border bg-card p-7">
              <h3 className="text-lg font-semibold tracking-tight">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Earnings() {
  return (
    <section className="border-b bg-foreground py-20 text-background md:py-28">
      <div className="container-wide">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-garden-400">
              Revenue
            </p>
            <h2 className="mt-3 text-balance font-display text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
              Earn on every call, forever.
            </h2>
            <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-background/70">
              Set your price. Aigarth takes a small protocol fee. The rest flows
              to you, your co-creators, and your stakers. Revenue splits are
              enforced by the network, not a contract.
            </p>

            <div className="mt-8 space-y-4">
              {[
                { label: "Creator share", value: "75%" },
                { label: "Staker share", value: "15%" },
                { label: "Protocol fee", value: "10%" },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between border-b border-background/10 pb-3"
                >
                  <span className="text-background/70">{row.label}</span>
                  <span className="font-mono text-lg text-garden-300">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-background/10 bg-background/[0.03] p-6 backdrop-blur">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-background/60">
              Live earnings · MediScan Vision
            </h3>
            <div className="mt-6 space-y-4">
              {[
                { period: "Today", value: "1,420", trend: "+12%" },
                { period: "This week", value: "9,840", trend: "+8%" },
                { period: "This month", value: "38.2K", trend: "+24%" },
                { period: "All time", value: "420K", trend: "QUBIC" },
              ].map((row) => (
                <div
                  key={row.period}
                  className="flex items-center justify-between rounded-xl border border-background/10 bg-background/[0.04] px-4 py-3"
                >
                  <div className="text-sm text-background/70">{row.period}</div>
                  <div className="flex items-center gap-3">
                    <div className="font-mono text-base">{row.value}</div>
                    <div className="text-xs text-mint-300">{row.trend}</div>
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

function MarketplaceTeaser() {
  return (
    <section className="border-b py-20 md:py-28">
      <div className="container-wide">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
              Marketplace
            </p>
            <h2 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
              Featured ANNs.
            </h2>
          </div>
          <Link href="/marketplace">
            <Button variant="outline" className="gap-1.5">
              View all
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { name: "MediScan Vision", cat: "Medical", acc: 98.4, calls: "1.2M", rev: "420K", stake: "45M" },
            { name: "Lex Reasoner", cat: "Legal", acc: 94.2, calls: "840K", rev: "280K", stake: "32M" },
            { name: "CodeWeave", cat: "Coding", acc: 96.1, calls: "3.4M", rev: "180K", stake: "21M" },
            { name: "Oracle Prime", cat: "Oracles", acc: 99.7, calls: "8.9M", rev: "920K", stake: "120M" },
            { name: "Voice Canon", cat: "Language", acc: 95.3, calls: "680K", rev: "210K", stake: "18M" },
            { name: "Agent Frame", cat: "Agents", acc: 89.4, calls: "1.8M", rev: "340K", stake: "42M" },
          ].map((ann) => (
            <Link
              key={ann.name}
              href="/marketplace"
              className="group rounded-2xl border bg-card p-6 card-hover"
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold">{ann.name}</div>
                <Badge variant="outline" className="text-[10px]">{ann.cat}</Badge>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="text-muted-foreground">Accuracy</div>
                  <div className="mt-0.5 font-mono text-garden-600 dark:text-garden-400">
                    {acc(ann.acc)}%
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Calls / mo</div>
                  <div className="mt-0.5 font-mono">{ann.calls}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Stake</div>
                  <div className="mt-0.5 font-mono">{ann.stake}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function acc(a: number) {
  return a.toFixed(1);
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
              Stakers vote on quality.
            </h2>
            <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
              Community staking is a quality signal. The network weights ANNs by
              stake and accuracy, surfacing the best. Creators compete on
              benchmarks, not marketing.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Stake-weighted discovery",
                "On-chain accuracy benchmarks",
                "Reputation scoring",
                "Slash for false benchmarks",
              ].map((p) => (
                <li key={p} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-garden-500" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border bg-card p-6">
            <h3 className="text-sm font-semibold">Top ANNs by stake</h3>
            <div className="mt-5 space-y-3">
              {[
                { name: "Oracle Prime", stake: 120, pct: 100 },
                { name: "Govt Sentinel", stake: 90, pct: 75 },
                { name: "FinCast Predict", stake: 78, pct: 65 },
                { name: "Quanta Research", stake: 55, pct: 46 },
                { name: "MediScan Vision", stake: 45, pct: 38 },
              ].map((ann) => (
                <div key={ann.name} className="flex items-center gap-3">
                  <div className="w-32 truncate text-sm">{ann.name}</div>
                  <div className="flex-1">
                    <div className="h-1.5 rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-garden-500"
                        style={{ width: `${ann.pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {ann.stake}M
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

function Security() {
  return (
    <section className="border-b py-20 md:py-28">
      <div className="container-wide">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
            Security
          </p>
          <h2 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
            Verifiable, end-to-end.
          </h2>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: "Provenance", desc: "Signed training manifests. Reproducible data hashes." },
            { title: "Audit trail", desc: "Every call recorded. Output hashes on-chain." },
            { title: "License enforcement", desc: "Wallet-bound keys. Per-call settlement." },
            { title: "Isolation", desc: "Run on dedicated clusters. No cross-tenant leakage." },
          ].map((s) => (
            <div key={s.title} className="rounded-2xl border bg-card p-6">
              <h3 className="font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const faqs = [
    {
      q: "Who owns an ANN?",
      a: "The creator does. Ownership is recorded on-chain and tied to a wallet. The creator can transfer ownership, license it commercially, or release it open.",
    },
    {
      q: "How do I get paid?",
      a: "Revenue is settled continuously. Earnings are denominated in QUBIC and can be auto-compounded, staked, or withdrawn to a wallet.",
    },
    {
      q: "Can I fork someone else's ANN?",
      a: "Only if the license allows forking. Open and some Commercial licenses permit forking; Restricted licenses do not.",
    },
    {
      q: "What are the compute requirements?",
      a: "Each ANN has a published compute profile. You stake enough to cover expected usage. Stakers share the cost of idle capacity automatically.",
    },
    {
      q: "How are benchmarks verified?",
      a: "Benchmarks are computed by a decentralized set of evaluators. False benchmarks are slashable.",
    },
  ];

  return (
    <section className="border-b py-20 md:py-28">
      <div className="container-narrow">
        <h2 className="text-balance font-display text-3xl font-medium tracking-tight md:text-4xl">
          ANN questions.
        </h2>
        <div className="mt-8">
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
        <LogoMark size={48} className="mx-auto mb-8" />
        <h2 className="text-balance font-display text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
          Train one. License one. Stake behind one.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
          ANNs are the units of intelligence on Aigarth. The marketplace is open.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/marketplace">
            <Button size="lg" className="gap-1.5">
              Browse marketplace
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="lg" variant="outline">
              Open the studio
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
