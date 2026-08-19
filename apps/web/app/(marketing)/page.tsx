"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Brain,
  Cpu,
  Database,
  Globe,
  Image as ImageIcon,
  Mic,
  Network,
  Server,
  Shield,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Button } from "@aigarth/ui";
import { Badge } from "@aigarth/ui";
import { EcosystemVisualization } from "@/components/motion/ecosystem-visualization";
import { LiveCounter } from "@/components/motion/live-counter";
import { Logo } from "@/components/brand/logo";
import { QubicLogo } from "@/components/brand/qubic-logo";

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustBand />
      <Pillars />
      <Lifecycle />
      <Products />
      <ProofOfStakingTeaser />
      <MarketplaceTeaser />
      <Ecosystem />
      <Stats />
      <Developers />
      <CTA />
    </>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b">
      <div className="absolute inset-0 bg-garden-mesh" />
      <div className="absolute inset-0 bg-dot-pattern opacity-[0.04]" />
      <div className="container-wide relative">
        <div className="grid gap-12 py-20 md:py-28 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-32">
          <div className="flex flex-col justify-center">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Badge variant="glow" className="mb-6 gap-1.5">
                <QubicLogo className="h-4 w-4" />
                Built on Qubic · Powered by Useful Proof of Work
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-balance font-display text-5xl font-medium leading-[1.05] tracking-tight md:text-6xl lg:text-7xl"
            >
              Grow your AI{" "}
              <span className="text-gradient-garden italic">infrastructure</span>.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground"
            >
              Stake QUBIC to reserve intelligent compute. Launch AI products. Monetize
              unused capacity. A decentralized cloud that grows with participation.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Link href="/dashboard">
                <Button size="lg" className="gap-1.5">
                  Open the console
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/useful-proof-of-staking">
                <Button size="lg" variant="outline" className="gap-1.5">
                  How staking works
                </Button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-muted-foreground"
            >
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-garden-500" />
                Cryptographically verified
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-garden-500" />
                47 regions
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-garden-500" />
                Sub-50ms inference
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative flex items-center justify-center"
          >
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-garden-500/10 via-transparent to-emerald-500/5 blur-3xl" />
            <div className="relative w-full">
              <EcosystemVisualization height={520} />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function TrustBand() {
  return (
    <section className="border-b py-14 md:py-16">
      <div className="container-wide">
        <p className="text-center text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
          Built for builders shipping at scale
        </p>
        <p className="mt-5 text-balance text-center font-display text-3xl font-medium leading-[1.1] tracking-tight md:text-4xl lg:text-5xl">
          <span className="text-foreground">This </span>
          <span className="italic text-gradient-brand">could be you</span>
          <span className="text-foreground">.</span>
        </p>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          1,247 ANNs already live. Stake, train, publish, and your name goes
          here next.
        </p>
      </div>
    </section>
  );
}

function Pillars() {
  const pillars = [
    {
      icon: Shield,
      title: "Stake to reserve",
      body: "Lock QUBIC to reserve dedicated AI compute. No recurring bills. The longer you stake, the more capacity you grow.",
      href: "/useful-proof-of-staking",
    },
    {
      icon: Cpu,
      title: "Run any model",
      body: "Inference, embeddings, image, video, voice, reasoning, fine-tuning, agents. One platform, every workload.",
      href: "/inference",
    },
    {
      icon: TrendingUp,
      title: "Earn from idle",
      body: "Monetize unused capacity on the open market. Set your price. The network routes demand to you.",
      href: "/useful-proof-of-staking",
    },
  ];

  return (
    <section className="border-b py-20 md:py-28">
      <div className="container-wide">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
            Three primitives. One platform.
          </p>
          <h2 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
            Cloud compute, redesigned for the age of intelligence.
          </h2>
          <p className="mt-5 text-pretty text-lg text-muted-foreground">
            Aigarth turns staking into infrastructure. You bring capital, the network
            brings capacity. Together, you build products that scale.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <Link
                key={pillar.title}
                href={pillar.href}
                className="group relative rounded-2xl border bg-card p-8 card-hover"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-xl font-semibold tracking-tight">
                  {pillar.title}
                </h3>
                <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
                  {pillar.body}
                </p>
                <div className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Learn more
                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Lifecycle() {
  const stages = [
    { label: "Seed", desc: "Connect wallet" },
    { label: "Stake", desc: "Lock QUBIC" },
    { label: "Growth", desc: "Reserve compute" },
    { label: "Compute", desc: "Run any model" },
    { label: "Products", desc: "Ship to users" },
    { label: "Revenue", desc: "Earn QUBIC" },
    { label: "Expansion", desc: "Scale infinitely" },
  ];

  return (
    <section className="border-b bg-secondary/30 py-20 md:py-28">
      <div className="container-wide">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
            The growth cycle
          </p>
          <h2 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
            From seed to ecosystem.
          </h2>
          <p className="mt-5 text-pretty text-lg text-muted-foreground">
            Every Aigarth user follows the same loop: stake to plant, use to grow,
            ship to harvest, and earn to expand.
          </p>
        </div>

        <div className="mt-16">
          <div className="relative">
            <div className="absolute left-0 right-0 top-1/2 hidden h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-garden-500/40 to-transparent md:block" />
            <div className="grid grid-cols-2 gap-6 md:grid-cols-7">
              {stages.map((stage, i) => (
                <div key={stage.label} className="relative text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-garden-500/30 bg-background text-sm font-semibold text-garden-700 dark:text-garden-300">
                    {i + 1}
                  </div>
                  <div className="mt-3 text-sm font-semibold">{stage.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {stage.desc}
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

function Products() {
  const products = [
    { icon: Brain, title: "AI Inference", href: "/inference" },
    { icon: Database, title: "Embeddings", href: "/embeddings" },
    { icon: ImageIcon, title: "Image Generation", href: "/image" },
    { icon: Mic, title: "Voice", href: "/voice" },
    { icon: Sparkles, title: "Reasoning Models", href: "/reasoning" },
    { icon: Network, title: "Oracles", href: "/oracle" },
  ];

  return (
    <section className="border-b py-20 md:py-28">
      <div className="container-wide">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
              Products
            </p>
            <h2 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
              Every AI primitive, on one network.
            </h2>
          </div>
          <Link href="/products">
            <Button variant="outline" className="gap-1.5">
              View all products
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const Icon = p.icon;
            return (
              <Link
                key={p.title}
                href={p.href}
                className="group relative flex items-center gap-4 rounded-xl border bg-card p-5 card-hover"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">{p.title}</div>
                  <div className="text-xs text-muted-foreground">
                    OpenAI-compatible API
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ProofOfStakingTeaser() {
  return (
    <section className="border-b bg-foreground py-20 text-background md:py-28">
      <div className="container-wide">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-garden-400">
              Useful Proof of Staking
            </p>
            <h2 className="mt-3 text-balance font-display text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
              Stake once. Reserve forever. Earn while you build.
            </h2>
            <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-background/70">
              Aigarth reimagines cloud economics. Instead of renting compute that
              disappears when you stop paying, you stake tokens to reserve capacity
              that belongs to you. Idle capacity earns revenue on the open market.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/useful-proof-of-staking">
                <Button
                  size="lg"
                  variant="secondary"
                  className="gap-1.5 bg-background text-foreground hover:bg-background/90"
                >
                  Explore the model
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button
                  size="lg"
                  variant="ghost"
                  className="gap-1.5 text-background hover:bg-background/10"
                >
                  See staking plans
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Stake", value: "10M+" },
              { label: "QUBIC reserved", value: "1.4B" },
              { label: "Compute regions", value: "47" },
              { label: "Avg. yield", value: "8.4%" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-background/10 bg-background/5 p-6 backdrop-blur"
              >
                <div className="text-3xl font-medium tracking-tight md:text-4xl">
                  {stat.value}
                </div>
                <div className="mt-1 text-xs uppercase tracking-wider text-background/60">
                  {stat.label}
                </div>
              </div>
            ))}
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
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
              ANN Marketplace
            </p>
            <h2 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
              License intelligence. Stake behind what works.
            </h2>
            <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
              Discover, deploy, and stake behind Artificial Neural Networks created
              by the community. From medical imaging to legal reasoning, every ANN
              is auditable, billable, and revenue-shareable.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/marketplace">
                <Button className="gap-1.5">
                  Browse marketplace
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/anns">
                <Button variant="outline" className="gap-1.5">
                  What is an ANN?
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { name: "MediScan Vision", category: "Medical", stake: "45M QUBIC", calls: "1.2M/mo", accuracy: "98.4%" },
              { name: "Lex Reasoner", category: "Legal", stake: "32M QUBIC", calls: "840K/mo", accuracy: "94.2%" },
              { name: "FinCast Predict", category: "Finance", stake: "78M QUBIC", calls: "2.1M/mo", accuracy: "91.8%" },
              { name: "CodeWeave", category: "Coding", stake: "21M QUBIC", calls: "3.4M/mo", accuracy: "96.1%" },
            ].map((ann) => (
              <div
                key={ann.name}
                className="rounded-xl border bg-card p-5 card-hover"
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium">{ann.name}</div>
                  <Badge variant="outline" className="text-[10px]">
                    {ann.category}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">Calls / mo</div>
                    <div className="mt-0.5 font-mono">{ann.calls}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Accuracy</div>
                    <div className="mt-0.5 font-mono text-garden-600 dark:text-garden-400">
                      {ann.accuracy}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Staked</span>
                  <span className="font-mono">{ann.stake}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Ecosystem() {
  const items = [
    { title: "Aigarth Cloud", desc: "The AI cloud platform.", icon: Cpu },
    { title: "Qubic Network", desc: "The base layer with Useful Proof of Work.", icon: Network },
    { title: "ANN Marketplace", desc: "Discover and license intelligence.", icon: Sparkles },
    { title: "Developers", desc: "SDKs, APIs, and tooling.", icon: Server },
    { title: "Hardware", desc: "Edge nodes to data center accelerators.", icon: Server },
    { title: "Enterprise Partners", desc: "Compliance, migration, and SLAs.", icon: Shield },
  ];

  return (
    <section className="border-b bg-secondary/30 py-20 md:py-28">
      <div className="container-wide">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
            Ecosystem
          </p>
          <h2 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
            A living network of compute, capital, and intelligence.
          </h2>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.title}
                href="/ecosystem"
                className="group flex items-start gap-4 rounded-xl border bg-card p-5 card-hover"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium">{item.title}</div>
                  <div className="mt-0.5 text-sm text-muted-foreground">
                    {item.desc}
                  </div>
                </div>
                <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Stats() {
  return (
    <section className="border-b py-20 md:py-28">
      <div className="container-wide">
        <div className="grid gap-8 md:grid-cols-4">
          {[
            { value: 1.4, suffix: "B", label: "QUBIC staked", decimals: 1 },
            { value: 47, suffix: "", label: "Compute regions", decimals: 0 },
            { value: 8.4, suffix: "%", label: "Average staker yield", decimals: 1 },
            { value: 99.99, suffix: "%", label: "Network uptime", decimals: 2 },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-5xl font-medium tracking-tight md:text-6xl">
                <LiveCounter
                  value={stat.value}
                  format={(v) =>
                    v.toLocaleString("en-US", {
                      minimumFractionDigits: stat.decimals,
                      maximumFractionDigits: stat.decimals,
                    })
                  }
                />
                {stat.suffix}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-8 text-xs text-muted-foreground">
          Sample data. Numbers shown are illustrative placeholders unless connected
          to live network feeds.
        </p>
      </div>
    </section>
  );
}

function Developers() {
  return (
    <section className="border-b bg-foreground py-20 text-background md:py-28">
      <div className="container-wide">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-garden-400">
              Developer Experience
            </p>
            <h2 className="mt-3 text-balance font-display text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
              Ship AI in five lines.
            </h2>
            <p className="mt-5 text-pretty text-lg leading-relaxed text-background/70">
              Drop-in replacement for the OpenAI SDK. Same interface, same
              conventions, dramatically better economics.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/docs">
                <Button
                  size="lg"
                  variant="secondary"
                  className="gap-1.5 bg-background text-foreground hover:bg-background/90"
                >
                  Read the docs
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/docs/sdks">
                <Button
                  size="lg"
                  variant="ghost"
                  className="gap-1.5 text-background hover:bg-background/10"
                >
                  SDKs & tools
                </Button>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-background/10 bg-background/[0.03] p-1.5 backdrop-blur">
            <div className="flex items-center gap-2 px-4 py-2 text-xs text-background/60">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-garden-500/70" />
              <span className="ml-2 font-mono">main.py</span>
            </div>
            <pre className="overflow-x-auto rounded-xl bg-background/[0.04] p-6 text-sm leading-relaxed">
              <code className="font-mono text-background/90">
                <span className="text-garden-400">from</span>{" "}
                <span className="text-background">aigarth</span>{" "}
                <span className="text-garden-400">import</span>{" "}
                <span className="text-background">Aigarth</span>
                {"\n\n"}
                <span className="text-background">client</span>{" "}
                <span className="text-garden-400">=</span>{" "}
                <span className="text-background">Aigarth</span>
                <span className="text-background/60">(</span>
                <span className="text-amber-300">api_key</span>
                <span className="text-background/60">=</span>
                <span className="text-mint-300">"sk-aigarth-..."</span>
                <span className="text-background/60">)</span>
                {"\n\n"}
                <span className="text-background">response</span>{" "}
                <span className="text-garden-400">=</span>{" "}
                <span className="text-background">client</span>
                <span className="text-background/60">.</span>
                <span className="text-background">chat</span>
                <span className="text-background/60">.</span>
                <span className="text-background">create</span>
                <span className="text-background/60">(</span>
                {"\n  "}
                <span className="text-amber-300">model</span>
                <span className="text-background/60">=</span>
                <span className="text-mint-300">"aigarth-reason-1"</span>
                <span className="text-background/60">,</span>
                {"\n  "}
                <span className="text-amber-300">messages</span>
                <span className="text-background/60">=</span>
                <span className="text-background/60">[</span>
                <span className="text-background/60">{"{"}</span>
                <span className="text-amber-300">"role"</span>
                <span className="text-background/60">:</span>{" "}
                <span className="text-mint-300">"user"</span>
                <span className="text-background/60">,</span>{" "}
                <span className="text-amber-300">"content"</span>
                <span className="text-background/60">:</span>{" "}
                <span className="text-mint-300">"Explain Useful Proof of Staking in 3 sentences."</span>
                <span className="text-background/60">{"}"}</span>
                <span className="text-background/60">]</span>
                <span className="text-background/60">,</span>
                {"\n"}
                <span className="text-background/60">)</span>
                {"\n\n"}
                <span className="text-garden-400">print</span>
                <span className="text-background/60">(</span>
                <span className="text-background">response</span>
                <span className="text-background/60">.</span>
                <span className="text-background">choices</span>
                <span className="text-background/60">[</span>
                <span className="text-amber-300">0</span>
                <span className="text-background/60">].</span>
                <span className="text-background">message</span>
                <span className="text-background/60">.</span>
                <span className="text-background">content</span>
                <span className="text-background/60">)</span>
              </code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-20 md:py-28">
      <div className="container-narrow text-center">
        <Logo size="lg" showWordmark={false} className="mx-auto mb-8" />
        <h2 className="text-balance font-display text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
          The future of compute grows on participation.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
          Stake QUBIC. Reserve compute. Build products. Earn revenue. Welcome to
          Aigarth Cloud.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/dashboard">
            <Button size="lg" className="gap-1.5">
              Open the console
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/pricing">
            <Button size="lg" variant="outline" className="gap-1.5">
              See staking plans
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

// (motion is imported at the top)

