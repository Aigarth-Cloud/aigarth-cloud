"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Minus, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@aigarth/ui";
import { Badge } from "@aigarth/ui";
import { cn } from "@aigarth/utils";

const PLANS = [
  {
    id: "explorer",
    name: "Explorer",
    stake: "10M",
    monthly: "$120",
    tagline: "Try the network. Ship side projects.",
    cta: "Start staking",
    href: "/dashboard",
    features: [
      { label: "Shared compute pool", included: true },
      { label: "Chat API access", included: true },
      { label: "Embeddings API access", included: true },
      { label: "Image generation", included: false },
      { label: "Priority queue", included: false },
      { label: "Reserved throughput", included: false },
      { label: "Dedicated capacity", included: false },
      { label: "Fine-tuning", included: false },
      { label: "Team access", included: false },
      { label: "Governance voting", included: true, note: "1x" },
    ],
    metrics: {
      compute: "8 GPU-hr / day",
      throughput: "Best-effort",
      burnDiscount: "0%",
    },
  },
  {
    id: "builder",
    name: "Builder",
    stake: "50M",
    monthly: "$580",
    tagline: "For production workloads and small teams.",
    cta: "Stake 50M",
    href: "/dashboard",
    popular: true,
    features: [
      { label: "Shared compute pool", included: true },
      { label: "Chat API access", included: true },
      { label: "Embeddings API access", included: true },
      { label: "Image generation", included: true },
      { label: "Priority queue", included: true },
      { label: "Reserved throughput", included: true },
      { label: "Dedicated capacity", included: false },
      { label: "Fine-tuning", included: false },
      { label: "Team access", included: true, note: "Up to 5" },
      { label: "Governance voting", included: true, note: "2.5x" },
    ],
    metrics: {
      compute: "48 GPU-hr / day",
      throughput: "Reserved",
      burnDiscount: "25%",
    },
  },
  {
    id: "startup",
    name: "Startup",
    stake: "150M",
    monthly: "$1,750",
    tagline: "Dedicated cluster. Room to grow.",
    cta: "Stake 150M",
    href: "/dashboard",
    features: [
      { label: "Shared compute pool", included: true },
      { label: "Chat API access", included: true },
      { label: "Embeddings API access", included: true },
      { label: "Image generation", included: true },
      { label: "Priority queue", included: true },
      { label: "Reserved throughput", included: true },
      { label: "Dedicated capacity", included: true, note: "Shared cluster" },
      { label: "Fine-tuning", included: true },
      { label: "Team access", included: true, note: "Up to 20" },
      { label: "Governance voting", included: true, note: "5x" },
    ],
    metrics: {
      compute: "180 GPU-hr / day",
      throughput: "Guaranteed",
      burnDiscount: "40%",
    },
  },
  {
    id: "business",
    name: "Business",
    stake: "500M",
    monthly: "$5,800",
    tagline: "Enterprise SLA. Oracle access. Scale.",
    cta: "Stake 500M",
    href: "/dashboard",
    features: [
      { label: "Shared compute pool", included: true },
      { label: "Chat API access", included: true },
      { label: "Embeddings API access", included: true },
      { label: "Image generation", included: true },
      { label: "Priority queue", included: true },
      { label: "Reserved throughput", included: true },
      { label: "Dedicated capacity", included: true, note: "Dedicated GPUs" },
      { label: "Fine-tuning", included: true, note: "Custom datasets" },
      { label: "Team access", included: true, note: "Unlimited" },
      { label: "Governance voting", included: true, note: "12x" },
    ],
    metrics: {
      compute: "720 GPU-hr / day",
      throughput: "Burstable",
      burnDiscount: "55%",
    },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    stake: "Custom",
    monthly: "Custom",
    tagline: "Custom infrastructure, dedicated support, and bespoke SLAs.",
    cta: "Contact sales",
    href: "/enterprise",
    features: [
      { label: "Shared compute pool", included: true },
      { label: "Chat API access", included: true },
      { label: "Embeddings API access", included: true },
      { label: "Image generation", included: true },
      { label: "Priority queue", included: true },
      { label: "Reserved throughput", included: true, note: "Multi-region" },
      { label: "Dedicated capacity", included: true, note: "Private cluster" },
      { label: "Fine-tuning", included: true, note: "On-prem option" },
      { label: "Team access", included: true, note: "SSO + SCIM" },
      { label: "Governance voting", included: true, note: "Council seat" },
    ],
    metrics: {
      compute: "Unlimited",
      throughput: "Custom",
      burnDiscount: "Custom",
    },
  },
];

export default function PricingPage() {
  return (
    <>
      <Hero />
      <Plans />
      <Comparison />
      <AddOns />
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
          <Badge variant="glow" className="mb-6">
            <Sparkles className="h-3 w-3" />
            Staking Plans
          </Badge>
          <h1 className="text-balance font-display text-5xl font-medium leading-[1.05] tracking-tight md:text-6xl">
            Pay with stake, not rent.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Lock QUBIC to reserve compute that belongs to you. Higher stakes unlock
            dedicated capacity, better pricing, and governance weight. No recurring
            bills, no surprise overages.
          </p>
        </div>
      </div>
    </section>
  );
}

function Plans() {
  return (
    <section className="border-b py-20 md:py-28">
      <div className="container-wide">
        <div className="grid gap-6 lg:grid-cols-5">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-card p-6",
                plan.popular && "border-garden-500 shadow-lg shadow-garden-500/10"
              )}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Most popular
                </Badge>
              )}
              <div>
                <h3 className="text-lg font-semibold tracking-tight">{plan.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{plan.tagline}</p>
              </div>

              <div className="mt-6 border-y border-border py-5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-medium tracking-tight">
                    {plan.stake}
                  </span>
                  {plan.stake !== "Custom" && (
                    <span className="text-sm text-muted-foreground">
                      M QUBIC
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Required stake
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Compute</div>
                    <div className="mt-0.5 font-mono">{plan.metrics.compute}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Throughput</div>
                    <div className="mt-0.5 font-mono">{plan.metrics.throughput}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Burn off</div>
                    <div className="mt-0.5 font-mono text-garden-600 dark:text-garden-400">
                      {plan.metrics.burnDiscount}
                    </div>
                  </div>
                </div>
              </div>

              <ul className="mt-5 space-y-2.5 text-sm">
                {plan.features.map((f) => (
                  <li key={f.label} className="flex items-start gap-2">
                    {f.included ? (
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-garden-500" />
                    ) : (
                      <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                    )}
                    <span className={cn(!f.included && "text-muted-foreground/60")}>
                      {f.label}
                      {f.note && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          ({f.note})
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-6">
                <Link href={plan.href} className="block">
                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                  >
                    {plan.cta}
                  </Button>
                </Link>
                {plan.stake !== "Custom" && (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Equivalent ~{plan.monthly}/mo
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Stake amounts and equivalent values are illustrative placeholders. Actual
          allocations depend on network state and plan availability.
        </p>
      </div>
    </section>
  );
}

function Comparison() {
  const rows = [
    { feature: "Required stake", plans: ["10M QUBIC", "50M QUBIC", "150M QUBIC", "500M QUBIC", "Custom"] },
    { feature: "Compute allocation", plans: ["8 GPU-hr/d", "48 GPU-hr/d", "180 GPU-hr/d", "720 GPU-hr/d", "Unlimited"] },
    { feature: "Chat API", plans: [true, true, true, true, true] },
    { feature: "Embeddings", plans: [true, true, true, true, true] },
    { feature: "Image generation", plans: [false, true, true, true, true] },
    { feature: "Voice", plans: [false, true, true, true, true] },
    { feature: "Reasoning models", plans: [true, true, true, true, true] },
    { feature: "Fine-tuning", plans: [false, false, true, true, true] },
    { feature: "Priority queue", plans: [false, true, true, true, true] },
    { feature: "Reserved throughput", plans: [false, true, true, true, true] },
    { feature: "Dedicated capacity", plans: [false, false, true, true, true] },
    { feature: "Oracle access", plans: [false, false, false, true, true] },
    { feature: "Team members", plans: ["1", "5", "20", "Unlimited", "Unlimited"] },
    { feature: "Governance weight", plans: ["1x", "2.5x", "5x", "12x", "Council"] },
    { feature: "SLA", plans: ["None", "99.5%", "99.9%", "99.95%", "Custom"] },
    { feature: "Support", plans: ["Community", "Email", "Priority", "Dedicated CSM", "On-call"] },
  ];

  return (
    <section className="border-b py-20 md:py-28">
      <div className="container-wide">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
            Compare
          </p>
          <h2 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
            Every feature, side by side.
          </h2>
        </div>

        <div className="mt-12 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Feature
                </th>
                {PLANS.map((p) => (
                  <th key={p.id} className="px-2 py-3 text-center text-xs font-semibold">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-3 text-muted-foreground">{row.feature}</td>
                  {row.plans.map((cell, j) => (
                    <td key={j} className="px-2 py-3 text-center">
                      {typeof cell === "boolean" ? (
                        cell ? (
                          <Check className="mx-auto h-4 w-4 text-garden-500" />
                        ) : (
                          <Minus className="mx-auto h-4 w-4 text-muted-foreground/30" />
                        )
                      ) : (
                        <span className="font-mono text-xs">{cell}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function AddOns() {
  const addons = [
    {
      title: "Dedicated GPU cluster",
      desc: "Reserve specific GPU types (H100, A100, MI300X) with guaranteed availability.",
      price: "From 250M QUBIC",
    },
    {
      title: "Custom model fine-tuning",
      desc: "We train and serve custom models on your proprietary data with full isolation.",
      price: "From 75M QUBIC + compute",
    },
    {
      title: "Multi-region replication",
      desc: "Replicate inference across 3+ regions for sub-50ms global latency.",
      price: "From 100M QUBIC",
    },
    {
      title: "Compliance & on-prem",
      desc: "HIPAA, FedRAMP, on-prem deployment with air-gapped operations.",
      price: "Custom",
    },
  ];

  return (
    <section className="border-b bg-secondary/30 py-20 md:py-28">
      <div className="container-wide">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
            Add-ons
          </p>
          <h2 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
            Extend any plan.
          </h2>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {addons.map((addon) => (
            <div key={addon.title} className="rounded-2xl border bg-card p-6">
              <h3 className="font-semibold tracking-tight">{addon.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{addon.desc}</p>
              <div className="mt-4 text-xs font-mono text-garden-600 dark:text-garden-400">
                {addon.price}
              </div>
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
      q: "What happens to my stake?",
      a: "Your QUBIC stays locked for the duration of your stake. You retain ownership  ” only the ability to transfer is restricted. Unstaking initiates a cool-down period.",
    },
    {
      q: "Can I upgrade or downgrade?",
      a: "Yes. You can move between tiers at any time. Upgrades take effect immediately; downgrades take effect at the end of the current cycle.",
    },
    {
      q: "Is the monthly equivalent value a price?",
      a: "No. It's a reference estimate to help compare plans to traditional cloud pricing. You don't pay a monthly bill  ” you stake once and reserve capacity.",
    },
    {
      q: "What if I don't use all my compute?",
      a: "Idle capacity is automatically offered on the GPU marketplace, where other users can lease it. You earn a share of those fees.",
    },
  ];

  return (
    <section className="border-b py-20 md:py-28">
      <div className="container-narrow">
        <h2 className="text-balance font-display text-3xl font-medium tracking-tight md:text-4xl">
          Frequently asked.
        </h2>
        <div className="mt-8 space-y-1">
          {faqs.map((faq, i) => (
            <details
              key={i}
              className="group border-b border-border py-5"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between text-base font-medium">
                {faq.q}
                <span className="ml-4 text-garden-500 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {faq.a}
              </p>
            </details>
          ))}
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
          Pick a plan and start building.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
          The smallest stake unlocks the entire platform. The biggest stake unlocks
          dedicated infrastructure.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/dashboard">
            <Button size="lg" className="gap-1.5">
              Open the console
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/enterprise">
            <Button size="lg" variant="outline">
              Talk to enterprise
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
