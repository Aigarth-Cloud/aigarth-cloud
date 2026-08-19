"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Brain,
  Check,
  ChevronRight,
  Cpu,
  Database,
  Globe,
  Layers,
  Network,
  Server,
  Shield,
  Sparkles,
  Sprout,
  TrendingUp,
  Users,
  Wrench,
  Building2,
  Code2,
  FileText,
  Lightbulb,
  Lock,
  Activity,
  BarChart3,
  Rocket,
  TreePine,
  Leaf,
} from "lucide-react";
import { Button } from "@aigarth/ui";
import { Badge } from "@aigarth/ui";
import { LogoMark } from "@/components/brand/logo";
import { QubicLogo } from "@/components/brand/qubic-logo";
import { cn } from "@aigarth/utils";

export default function IPOPage() {
  return (
    <>
      <Hero />
      <GenesisExplainer />
      <ParticipationOptions />
      <AllocationDashboard />
      <QubicIntegration />
      <StakingCalculator />
      <FounderStory />
      <Roadmap />
      <Trust />
      <FinalCTA />
    </>
  );
}

/* ------------------------------ HERO ------------------------------ */

function Hero() {
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 600], [1, 0]);
  const heroY = useTransform(scrollY, [0, 600], [0, 80]);

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-garden-mesh" />
      <div className="absolute inset-0 bg-dot-pattern opacity-[0.04]" />

      <motion.div
        style={{ opacity: heroOpacity, y: heroY }}
        className="container-wide relative min-h-[88vh] flex flex-col"
      >
        <div className="pt-12 lg:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="glow" className="gap-1.5">
              <Sparkles className="h-3 w-3" />
              Genesis Offering · Foundation Round
            </Badge>
          </motion.div>
        </div>

        <div className="grid gap-12 py-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-16">
          <div className="flex flex-col justify-center">
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-balance font-display text-5xl font-medium leading-[1.02] tracking-tight md:text-6xl lg:text-7xl"
            >
              The Genesis of{" "}
              <span className="text-gradient-garden italic">Aigarth Cloud</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground"
            >
              Join the foundational network powering the next generation of
              decentralized AI infrastructure  ” where compute, intelligence, and
              ownership converge.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Link href="#participate">
                <Button size="lg" className="gap-1.5">
                  Participate in Genesis Offering
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="#vision">
                <Button size="lg" variant="outline" className="gap-1.5">
                  Explore the Aigarth Vision
                </Button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-12 grid grid-cols-3 gap-6 border-t border-border pt-6"
            >
              {[
                { value: "47", label: "Global regions" },
                { value: "12.8K", label: "Foundational stakers" },
                { value: "$1.4B", label: "Infrastructure committed" },
              ].map((s) => (
                <div key={s.label}>
                  <div className="text-2xl font-medium tracking-tight md:text-3xl">
                    {s.value}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative flex items-center justify-center"
          >
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-garden-500/10 via-transparent to-emerald-500/5 blur-3xl" />
            <GenesisVisualization />
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

/**
 * GenesisVisualization  ” A living digital garden transforming into a global
 * network. Cinematic 2D SVG: seed → sprout → branches → clusters → global mesh.
 * No countdown timers. No price charts. Just the architecture of growth.
 */
function GenesisVisualization() {
  return (
    <div className="relative aspect-square w-full max-w-[640px]" aria-hidden="true">
      <svg viewBox="0 0 600 600" className="h-full w-full">
        <defs>
          <radialGradient id="genCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(160 80% 75%)" />
            <stop offset="60%" stopColor="hsl(134 50% 45%)" />
            <stop offset="100%" stopColor="hsl(134 50% 30%)" />
          </radialGradient>
          <radialGradient id="genGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(134 70% 60%)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(134 50% 35%)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="genBranch" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(134 60% 55%)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="hsl(134 50% 30%)" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="genLink" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(134 50% 45%)" stopOpacity="0.1" />
            <stop offset="50%" stopColor="hsl(134 50% 50%)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="hsl(134 50% 45%)" stopOpacity="0.1" />
          </linearGradient>
          <filter id="genSoft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        {/* Outer glow */}
        <motion.circle
          cx="300"
          cy="300"
          r="220"
          fill="url(#genGlow)"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.5, delay: 0.5 }}
        />

        {/* Concentric rings - the network spread */}
        {[180, 140, 100, 70].map((r, i) => (
          <motion.circle
            key={r}
            cx="300"
            cy="300"
            r={r}
            fill="none"
            stroke="hsl(134 50% 50%)"
            strokeWidth="0.5"
            strokeDasharray="2 6"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.3 - i * 0.05 }}
            transition={{ duration: 1.5, delay: 0.8 + i * 0.2 }}
          />
        ))}

        {/* Branching tree from center */}
        <BranchGroup
          d="M300 300 Q 300 240 300 180"
          delay={1.0}
        />
        <BranchGroup d="M300 180 Q 240 150 200 130" delay={1.2} />
        <BranchGroup d="M300 180 Q 360 150 400 130" delay={1.2} />
        <BranchGroup d="M300 180 L 300 100" delay={1.4} />

        <BranchGroup d="M200 130 Q 170 100 150 90" delay={1.6} />
        <BranchGroup d="M200 130 Q 200 90 210 70" delay={1.6} />
        <BranchGroup d="M400 130 Q 430 100 450 90" delay={1.6} />
        <BranchGroup d="M400 130 Q 400 90 390 70" delay={1.6} />
        <BranchGroup d="M300 100 Q 280 70 270 50" delay={1.7} />
        <BranchGroup d="M300 100 Q 320 70 330 50" delay={1.7} />

        {/* Global mesh - long network links radiating out */}
        {[
          [300, 300, 80, 460],
          [300, 300, 520, 380],
          [300, 300, 100, 540],
          [300, 300, 500, 200],
          [300, 300, 60, 240],
          [300, 300, 540, 480],
        ].map(([x1, y1, x2, y2], i) => (
          <motion.line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="url(#genLink)"
            strokeWidth="0.8"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.6 }}
            transition={{ duration: 1.5, delay: 1.8 + i * 0.1 }}
          />
        ))}

        {/* Global mesh nodes - the "compute clusters" */}
        {[
          [80, 460, "cluster"],
          [520, 380, "cluster"],
          [100, 540, "cluster"],
          [500, 200, "cluster"],
          [60, 240, "cluster"],
          [540, 480, "cluster"],
        ].map(([cx, cy], i) => (
          <g key={i}>
            <motion.circle
              cx={cx}
              cy={cy}
              r="12"
              fill="url(#genGlow)"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 2.4 + i * 0.1 }}
            />
            <motion.circle
              cx={cx}
              cy={cy}
              r="5"
              fill="url(#genCore)"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.4, delay: 2.6 + i * 0.1 }}
            />
          </g>
        ))}

        {/* Inner network nodes */}
        {[
          [200, 130],
          [400, 130],
          [300, 100],
          [150, 90],
          [210, 70],
          [450, 90],
          [390, 70],
          [270, 50],
          [330, 50],
        ].map(([cx, cy], i) => (
          <motion.circle
            key={i}
            cx={cx}
            cy={cy}
            r="4"
            fill="url(#genCore)"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.4, delay: 2.0 + i * 0.05 }}
          />
        ))}

        {/* Pulsing center - the genesis seed */}
        <motion.circle
          cx="300"
          cy="300"
          r="40"
          fill="none"
          stroke="hsl(134 50% 50%)"
          strokeWidth="1"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: [0.8, 1.4, 0.8], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.circle
          cx="300"
          cy="300"
          r="30"
          fill="none"
          stroke="hsl(134 50% 50%)"
          strokeWidth="1"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: [0.8, 1.6, 0.8], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        <motion.circle
          cx="300"
          cy="300"
          r="18"
          fill="url(#genCore)"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2, type: "spring" }}
          filter="url(#genSoft)"
        />
        <circle cx="300" cy="300" r="6" fill="hsl(160 80% 90%)" />

        {/* Floating spore particles */}
        {Array.from({ length: 18 }).map((_, i) => {
          const startX = 200 + Math.random() * 200;
          const startY = 250 + Math.random() * 200;
          return (
            <motion.circle
              key={i}
              cx={startX}
              cy={startY}
              r="1.5"
              fill="hsl(134 60% 60%)"
              initial={{ opacity: 0 }}
              animate={{
                opacity: [0, 0.7, 0],
                y: [startY, startY - 60, startY - 100],
                x: [startX, startX + (Math.random() - 0.5) * 40, startX],
              }}
              transition={{
                duration: 8 + Math.random() * 6,
                delay: 2 + Math.random() * 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}

function BranchGroup({ d, delay }: { d: string; delay: number }) {
  return (
    <motion.path
      d={d}
      stroke="url(#genBranch)"
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 0.8 }}
      transition={{ duration: 1.2, delay, ease: "easeOut" }}
    />
  );
}

/* --------------------- GENESIS EXPLAINER + FLOW --------------------- */

function GenesisExplainer() {
  return (
    <section id="vision" className="relative border-b py-20 md:py-28">
      <div className="container-wide">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
            What is the Aigarth IPO?
          </p>
          <h2 className="mt-3 text-balance font-display text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
            A foundational round for a new kind of AI infrastructure.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            The Aigarth Genesis Offering allows participants to help bootstrap the
            infrastructure, marketplace, developer tools, enterprise solutions, and
            hardware ecosystem that together form the world's first AI cloud owned
            by its participants.
          </p>
        </div>

        <GenesisFlow />
      </div>
    </section>
  );
}

function GenesisFlow() {
  const steps = [
    { label: "Community participation", desc: "Foundational stakers join the network", icon: Users },
    { label: "Genesis pool", desc: "Capital is committed to the reserve", icon: Database },
    { label: "Infrastructure growth", desc: "Compute capacity is added globally", icon: Server },
    { label: "AI compute capacity", desc: "Capacity becomes available to the network", icon: Cpu },
    { label: "ANN marketplace", desc: "Intelligence is created and licensed", icon: Brain },
    { label: "Enterprise adoption", desc: "Organizations build on the network", icon: Building2 },
    { label: "Ecosystem growth", desc: "Value compounds back to participants", icon: Sprout },
  ];

  return (
    <div className="mt-16">
      <div className="rounded-3xl border bg-card p-6 md:p-10">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <React.Fragment key={step.label}>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="relative flex flex-col items-center text-center"
                >
                  <div className="relative">
                    <div className="absolute inset-0 -m-2 rounded-full bg-primary/10 blur-md" />
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-garden-500/30 bg-background text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                  </div>
                  <div className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">
                    Step {i + 1}
                  </div>
                  <div className="mt-1 text-sm font-semibold leading-tight">{step.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground leading-snug">
                    {step.desc}
                  </div>
                </motion.div>
                {i < steps.length - 1 && (
                  <div className="hidden items-center justify-center lg:flex">
                    <ChevronRight className="h-4 w-4 text-garden-500/50" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------------- PARTICIPATION OPTIONS ---------------------- */

function ParticipationOptions() {
  const tiers = [
    {
      name: "Pioneer",
      tag: "Foundational staker",
      icon: Sprout,
      desc: "For early ecosystem participants who want to be part of the founding moment.",
      highlights: [
        "Genesis allocation",
        "Early access to the Aigarth platform",
        "Community membership",
        "Future platform benefits",
        "Recognition as a foundational contributor",
      ],
      visual: "garden",
    },
    {
      name: "Builder",
      tag: "Developer / creator",
      icon: Code2,
      desc: "For developers, AI researchers, and creators who will build on top of Aigarth.",
      highlights: [
        "Compute credits for development",
        "ANN deployment access",
        "Developer tools and SDKs",
        "Marketplace priority placement",
        "Builder community membership",
      ],
      visual: "code",
      featured: true,
    },
    {
      name: "Infrastructure Partner",
      tag: "Node operator",
      icon: Server,
      desc: "For operators who will provide verified compute capacity to the network.",
      highlights: [
        "Compute participation rights",
        "Hardware roadmap access",
        "Capacity marketplace access",
        "Operator tooling and support",
        "Reserved capacity tiers",
      ],
      visual: "infra",
    },
    {
      name: "Enterprise Partner",
      tag: "Organization",
      icon: Building2,
      desc: "For organizations that need private infrastructure, early access, and dedicated support.",
      highlights: [
        "Private infrastructure options",
        "Early platform access",
        "Dedicated customer success",
        "Custom SLAs and procurement",
        "Co-build and integration support",
      ],
      visual: "enterprise",
    },
  ];

  return (
    <section id="participate" className="border-b py-20 md:py-28">
      <div className="container-wide">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
            Participation options
          </p>
          <h2 className="mt-3 text-balance font-display text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
            Choose how you want to participate.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Each path offers different ways to contribute to and benefit from the
            Aigarth network. All allocations, access, and benefits are determined
            by the role you choose.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map((tier, i) => {
            const Icon = tier.icon;
            return (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className={cn(
                  "relative flex flex-col rounded-2xl border bg-card p-6",
                  tier.featured && "border-garden-500 shadow-lg shadow-garden-500/10"
                )}
              >
                {tier.featured && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Most popular
                  </Badge>
                )}

                <div className="mb-4">
                  <TierVisual type={tier.visual as VisualType} />
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold tracking-tight">{tier.name}</h3>
                    <div className="text-xs text-muted-foreground">{tier.tag}</div>
                  </div>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {tier.desc}
                </p>

                <ul className="mt-5 space-y-2 text-sm">
                  {tier.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-garden-500" />
                      <span className="text-muted-foreground">{h}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 pt-4 border-t border-border">
                  <Button
                    variant={tier.featured ? "default" : "outline"}
                    className="w-full gap-1.5"
                    asChild
                  >
                    <Link href="#calculator">
                      Express interest
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          All benefits, allocations, and access tiers shown are illustrative.
          Final terms are governed by on-chain parameters and may vary.
        </p>
      </div>
    </section>
  );
}

type VisualType = "garden" | "code" | "infra" | "enterprise";

function TierVisual({ type }: { type: VisualType }) {
  if (type === "garden") {
    return (
      <svg viewBox="0 0 240 80" className="h-20 w-full">
        <defs>
          <linearGradient id="tierGarden" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(134 60% 55%)" />
            <stop offset="100%" stopColor="hsl(134 50% 30%)" />
          </linearGradient>
        </defs>
        <motion.g
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2 }}
        >
          <line x1="120" y1="80" x2="120" y2="30" stroke="url(#tierGarden)" strokeWidth="1.5" />
          <path d="M120 50 L 90 35" stroke="url(#tierGarden)" strokeWidth="1" />
          <path d="M120 50 L 150 35" stroke="url(#tierGarden)" strokeWidth="1" />
          <path d="M120 35 L 100 20" stroke="url(#tierGarden)" strokeWidth="1" />
          <path d="M120 35 L 140 20" stroke="url(#tierGarden)" strokeWidth="1" />
        </motion.g>
        <g>
          <circle cx="120" cy="30" r="4" fill="hsl(134 60% 50%)" />
          <circle cx="90" cy="35" r="3" fill="hsl(134 60% 50%)" />
          <circle cx="150" cy="35" r="3" fill="hsl(134 60% 50%)" />
          <circle cx="100" cy="20" r="2.5" fill="hsl(134 60% 50%)" />
          <circle cx="140" cy="20" r="2.5" fill="hsl(134 60% 50%)" />
          <circle cx="120" cy="80" r="4" fill="hsl(134 60% 50%)" />
        </g>
      </svg>
    );
  }
  if (type === "code") {
    return (
      <div className="h-20 w-full rounded-lg border bg-stone-50 dark:bg-stone-900/50 p-3 font-mono text-[10px] leading-relaxed">
        <div className="text-muted-foreground">$ aigarth init</div>
        <div className="text-garden-600 dark:text-garden-400">→ scaffolding</div>
        <div className="text-muted-foreground">$ aigarth deploy</div>
        <div className="text-garden-600 dark:text-garden-400">→ published</div>
        <div className="text-muted-foreground">$ aigarth earn</div>
        <div className="text-garden-600 dark:text-garden-400">→ +420 QUBIC</div>
      </div>
    );
  }
  if (type === "infra") {
    return (
      <svg viewBox="0 0 240 80" className="h-20 w-full">
        {Array.from({ length: 5 }).map((_, i) => (
          <motion.rect
            key={i}
            x={20 + i * 42}
            y={20}
            width="32"
            height="40"
            rx="2"
            fill="hsl(134 50% 35%)"
            opacity={0.3 + i * 0.15}
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            style={{ transformOrigin: "bottom" }}
          />
        ))}
        {Array.from({ length: 5 }).map((_, i) => (
          <circle
            key={i}
            cx={36 + i * 42}
            cy={32}
            r="2"
            fill="hsl(134 70% 70%)"
          />
        ))}
      </svg>
    );
  }
  // enterprise
  return (
    <svg viewBox="0 0 240 80" className="h-20 w-full">
      <defs>
        <linearGradient id="tierEnt" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="hsl(134 50% 50%)" />
          <stop offset="100%" stopColor="hsl(170 60% 50%)" />
        </linearGradient>
      </defs>
      <rect x="20" y="30" width="200" height="30" rx="3" fill="hsl(134 50% 35%)" opacity="0.2" />
      <rect x="20" y="30" width="200" height="30" rx="3" fill="url(#tierEnt)" opacity="0.4" />
      <g fill="hsl(134 60% 70%)">
        <circle cx="40" cy="45" r="2" />
        <circle cx="60" cy="45" r="2" />
        <circle cx="80" cy="45" r="2" />
        <circle cx="100" cy="45" r="2" />
        <circle cx="120" cy="45" r="2" />
        <circle cx="140" cy="45" r="2" />
        <circle cx="160" cy="45" r="2" />
        <circle cx="180" cy="45" r="2" />
        <circle cx="200" cy="45" r="2" />
      </g>
      <line x1="20" y1="30" x2="220" y2="30" stroke="hsl(134 60% 60%)" strokeWidth="1" />
      <line x1="20" y1="60" x2="220" y2="60" stroke="hsl(134 60% 60%)" strokeWidth="1" />
    </svg>
  );
}

/* ---------------------- ALLOCATION DASHBOARD ---------------------- */

function AllocationDashboard() {
  const allocations = [
    {
      name: "Infrastructure",
      pct: 40,
      desc: "Direct investment into compute hardware, network capacity, and global expansion.",
      icon: Server,
      color: "garden",
    },
    {
      name: "Research & Development",
      pct: 20,
      desc: "Foundation model research, ANN infrastructure, and platform engineering.",
      icon: Lightbulb,
      color: "mint",
    },
    {
      name: "Ecosystem Growth",
      pct: 15,
      desc: "Developer grants, builder programs, hardware partners, and community.",
      icon: Sprout,
      color: "emerald",
    },
    {
      name: "Treasury",
      pct: 15,
      desc: "Long-term reserves managed by on-chain governance.",
      icon: Lock,
      color: "teal",
    },
    {
      name: "Community Programs",
      pct: 10,
      desc: "Education, certification, training academy, and public goods.",
      icon: Users,
      color: "sage",
    },
  ];

  const total = allocations.reduce((s, a) => s + a.pct, 0);

  return (
    <section className="border-b bg-foreground py-20 text-background md:py-28">
      <div className="container-wide">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-garden-400">
              Genesis allocation
            </p>
            <h2 className="mt-3 text-balance font-display text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
              Transparent allocation.{" "}
              <span className="text-gradient-mint italic">Fully verifiable.</span>
            </h2>
            <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-background/70">
              Every allocation is governed by on-chain parameters. Network
              participants can vote on changes. Disbursement is verifiable.
            </p>

            <div className="mt-8 space-y-3">
              {allocations.map((a, i) => {
                const Icon = a.icon;
                return (
                  <div
                    key={a.name}
                    className="flex items-center gap-3 rounded-lg border border-background/10 bg-background/[0.03] p-3"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-garden-500/20 text-garden-300">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{a.name}</div>
                      <div className="text-xs text-background/60">{a.desc}</div>
                    </div>
                    <div className="font-mono text-sm text-garden-300">{a.pct}%</div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 text-xs text-background/50">
              Total allocation: {total}%. Final parameters are governed on-chain.
            </div>
          </div>

          <div className="flex flex-col items-center justify-center">
            <DonutChart allocations={allocations} />
          </div>
        </div>
      </div>
    </section>
  );
}

function DonutChart({
  allocations,
}: {
  allocations: { name: string; pct: number; color: string }[];
}) {
  const size = 360;
  const strokeWidth = 36;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  const colorMap: Record<string, string> = {
    garden: "hsl(134 50% 50%)",
    mint: "hsl(160 70% 55%)",
    emerald: "hsl(155 60% 50%)",
    teal: "hsl(170 60% 50%)",
    sage: "hsl(110 25% 60%)",
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(0 0% 100% / 0.05)"
          strokeWidth={strokeWidth}
        />
        {allocations.map((a, i) => {
          const dash = (a.pct / 100) * circumference;
          const offset = (cumulative / 100) * circumference;
          cumulative += a.pct;
          return (
            <motion.circle
              key={a.name}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={colorMap[a.color] || colorMap.garden}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              initial={{ opacity: 0, strokeDasharray: `0 ${circumference}` }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: i * 0.15 }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-xs uppercase tracking-wider text-background/50">Total</div>
        <div className="mt-1 text-5xl font-medium tracking-tight text-garden-300">100%</div>
        <div className="mt-1 text-xs text-background/50">Genesis allocation</div>
      </div>
    </div>
  );
}

/* ---------------------- QUBIC INTEGRATION ---------------------- */

function QubicIntegration() {
  const layers = [
    {
      title: "Qubic Network",
      desc: "The base layer. Useful Proof of Work. Sub-second finality. Zero fees.",
      icon: Network,
    },
    {
      title: "Useful Proof of Work",
      desc: "Energy that produces real value. Computation, not waste.",
      icon: Activity,
    },
    {
      title: "Aigarth Cloud",
      desc: "The intelligent infrastructure layer. Staking, compute, models.",
      icon: Cpu,
    },
    {
      title: "ANN Marketplace",
      desc: "Versioned, owned, licensed intelligence. Created by the community.",
      icon: Brain,
    },
    {
      title: "Global AI Applications",
      desc: "What the world builds. Products, services, agents, infrastructure.",
      icon: Globe,
    },
  ];

  return (
    <section className="border-b py-20 md:py-28">
      <div className="container-wide">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <div className="flex items-center gap-2">
              <QubicLogo className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
                Powered by Qubic
              </p>
            </div>
            <h2 className="mt-3 text-balance font-display text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
              Aigarth runs on the world's most performant decentralized compute.
            </h2>
            <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
              Qubic provides the underlying computation network. Aigarth Cloud
              transforms that capability into AI services, developer platforms,
              enterprise solutions, and intelligent applications.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-4">
              {[
                { v: "15.5M", l: "TPS" },
                { v: "<1s", l: "Finality" },
                { v: "0", l: "Tx fees" },
                { v: "100%", l: "Useful work" },
              ].map((s) => (
                <div key={s.l} className="rounded-xl border bg-card p-5">
                  <div className="text-2xl font-medium tracking-tight">{s.v}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-6 md:p-8">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              The stack
            </h3>
            <div className="mt-6 space-y-3">
              {layers.map((layer, i) => {
                const Icon = layer.icon;
                return (
                  <motion.div
                    key={layer.title}
                    initial={{ opacity: 0, x: 16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                    className="relative"
                  >
                    <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold tracking-tight">
                          {layer.title}
                        </div>
                        <div className="text-xs text-muted-foreground">{layer.desc}</div>
                      </div>
                    </div>
                    {i < layers.length - 1 && (
                      <div className="flex justify-center py-1">
                        <ChevronRight className="h-3.5 w-3.5 rotate-90 text-garden-500/50" />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------- STAKING CALCULATOR ---------------------- */

function StakingCalculator() {
  const [stake, setStake] = React.useState(50);
  const [tier, setTier] = React.useState<"pioneer" | "builder" | "infra" | "enterprise">(
    "builder"
  );

  const tierData = {
    pioneer: { label: "Pioneer", mult: 0.6, color: "garden" },
    builder: { label: "Builder", mult: 1.0, color: "mint" },
    infra: { label: "Infrastructure", mult: 1.4, color: "emerald" },
    enterprise: { label: "Enterprise", mult: 2.0, color: "teal" },
  } as const;

  // Illustrative allocation model
  const computeHr = stake * 0.96 * tierData[tier].mult; // GPU-hr per day
  const callsPerDay = computeHr * 2400; // rough illustrative
  const annSlots = Math.floor(stake / 25);
  const priority = tierData[tier].mult >= 1.4 ? "Priority" : "Standard";

  return (
    <section id="calculator" className="border-b bg-secondary/30 py-20 md:py-28">
      <div className="container-wide">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
              Staking & compute rights
            </p>
            <h2 className="mt-3 text-balance font-display text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
              Stake. Reserve. Build. Earn.
            </h2>
            <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
              Stake QUBIC to receive infrastructure access. Deploy AI workloads.
              Create ANNs. Monetize the intelligence you build.
            </p>

            <div className="mt-8 space-y-2">
              {[
                "Stake QUBIC",
                "Receive infrastructure access",
                "Deploy AI workloads",
                "Create ANNs",
                "Monetize intelligence",
              ].map((step, i) => (
                <div
                  key={step}
                  className="flex items-center gap-3 rounded-lg border bg-card p-3"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {i + 1}
                  </div>
                  <span className="text-sm font-medium">{step}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-6 md:p-8">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Estimate your participation
            </h3>

            <div className="mt-6">
              <label className="text-xs font-medium">
                Stake (M QUBIC):{" "}
                <span className="text-foreground">{stake}</span>
              </label>
              <input
                type="range"
                min={1}
                max={500}
                step={1}
                value={stake}
                onChange={(e) => setStake(Number(e.target.value))}
                className="mt-3 w-full accent-garden-500"
              />
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>1M</span>
                <span>500M</span>
              </div>
            </div>

            <div className="mt-6">
              <label className="text-xs font-medium">Participation tier</label>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Object.entries(tierData).map(([key, t]) => (
                  <button
                    key={key}
                    onClick={() => setTier(key as keyof typeof tierData)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-xs transition-colors",
                      tier === key
                        ? "border-garden-500 bg-garden-500/10 text-garden-700 dark:text-garden-300"
                        : "border-border hover:bg-accent"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3">
              <CalcStat
                label="Compute allocation"
                value={`${computeHr.toFixed(0)}`}
                unit="GPU-hr / day"
                color="garden"
              />
              <CalcStat
                label="Marketplace access"
                value={annSlots >= 1 ? `${annSlots}` : "0"}
                unit="ANN slot(s)"
                color="mint"
              />
              <CalcStat
                label="Daily call capacity"
                value={callsPerDay >= 1000 ? `${(callsPerDay / 1000).toFixed(0)}K` : `${callsPerDay}`}
                unit="calls"
                color="emerald"
              />
              <CalcStat
                label="Queue priority"
                value={priority}
                unit=""
                color="teal"
                isText
              />
            </div>

            <div className="mt-6 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              <strong className="font-medium text-foreground">Note:</strong> Values
              are illustrative estimates. Final allocations are determined by
              on-chain parameters and may vary based on network state.
            </div>

            <Button className="mt-6 w-full gap-1.5" size="lg">
              Express interest
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function CalcStat({
  label,
  value,
  unit,
  color,
  isText,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
  isText?: boolean;
}) {
  const colorMap: Record<string, string> = {
    garden: "text-garden-600 dark:text-garden-400",
    mint: "text-mint-600 dark:text-mint-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    teal: "text-teal-600 dark:text-teal-400",
  };
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-2xl font-medium tracking-tight", colorMap[color])}>
        {value}
      </div>
      {unit && <div className="mt-0.5 text-xs text-muted-foreground">{unit}</div>}
    </div>
  );
}

/* ---------------------- FOUNDER STORY ---------------------- */

function FounderStory() {
  return (
    <section className="border-b py-20 md:py-28">
      <div className="container-wide">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
              Our story
            </p>
            <h2 className="mt-3 text-balance font-display text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
              Building the intelligence layer of tomorrow.
            </h2>
            <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
              We started Aigarth because we believe the next era of AI should be
              open, decentralized, and owned by the people who build it.
            </p>
          </div>

          <div className="space-y-5 text-pretty text-base leading-relaxed text-foreground/80">
            <p className="text-lg">
              <span className="font-semibold text-foreground">Today,</span> AI
              capability is concentrated inside a few centralized companies. The
              models, the infrastructure, and the value they create all flow
              upward. Builders, researchers, and users participate as consumers  ”
              not as owners.
            </p>
            <p className="text-lg">
              <span className="font-semibold text-foreground">Tomorrow,</span>{" "}
              individuals, developers, businesses, and communities can participate
              in owning and creating AI infrastructure. Capital builds compute.
              Compute serves intelligence. Intelligence rewards the people who
              contributed.
            </p>
            <p className="text-lg">
              Aigarth is the platform that connects these layers  ” a single
              network where the act of staking becomes the act of building, and
              the act of building becomes the act of earning.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-6 border-t border-border pt-6">
              {[
                { v: "47", l: "Regions" },
                { v: "12.8K", l: "Foundational stakers" },
                { v: "$1.4B", l: "Infrastructure committed" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="text-2xl font-medium tracking-tight md:text-3xl text-gradient-garden">
                    {s.v}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------- ROADMAP ---------------------- */

function Roadmap() {
  const phases = [
    {
      phase: "Phase 1",
      name: "Genesis",
      tag: "Now",
      items: [
        "Platform foundation",
        "Developer APIs",
        "Initial compute marketplace",
        "Genesis allocation distribution",
        "Foundational staker onboarding",
      ],
      icon: Sprout,
      color: "garden",
    },
    {
      phase: "Phase 2",
      name: "Growth",
      tag: "Next 12 months",
      items: [
        "ANN marketplace",
        "Hardware ecosystem",
        "Enterprise adoption",
        "Builder grants program",
        "Research partnerships",
      ],
      icon: TreePine,
      color: "mint",
    },
    {
      phase: "Phase 3",
      name: "Expansion",
      tag: "Year 2+",
      items: [
        "Global compute network",
        "Advanced AI models",
        "Autonomous AI ecosystems",
        "Cross-region federation",
        "On-prem enterprise deployments",
      ],
      icon: Globe,
      color: "emerald",
    },
  ];

  return (
    <section className="border-b bg-secondary/30 py-20 md:py-28">
      <div className="container-wide">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
            Roadmap
          </p>
          <h2 className="mt-3 text-balance font-display text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
            Three phases. One destination.
          </h2>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
            A long-term plan for building the world's first decentralized AI
            cloud. Each phase builds on the previous.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {phases.map((p, i) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={p.phase}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="rounded-2xl border bg-card p-6"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      {p.phase}
                    </div>
                    <div className="text-lg font-semibold tracking-tight">{p.name}</div>
                  </div>
                </div>
                <Badge variant="outline" className="mt-3 text-[10px]">
                  {p.tag}
                </Badge>
                <ul className="mt-5 space-y-2 text-sm">
                  {p.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-garden-500" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------------- TRUST ---------------------- */

function Trust() {
  const pillars = [
    {
      icon: Shield,
      title: "Security",
      desc: "Independent audits. Bug bounty. Cryptographic receipts for every operation.",
    },
    {
      icon: FileText,
      title: "Transparency",
      desc: "On-chain governance. Public treasury. Verifiable allocation disbursement.",
    },
    {
      icon: Network,
      title: "Open infrastructure",
      desc: "Open source SDKs, CLI, and core protocol. Inspect, fork, contribute.",
    },
    {
      icon: Lightbulb,
      title: "Research",
      desc: "Foundation model research, ANN infrastructure, and platform engineering.",
    },
    {
      icon: Lock,
      title: "Governance",
      desc: "Stake-weighted voting on parameters, burn rate, and treasury.",
    },
    {
      icon: Code2,
      title: "Developer ecosystem",
      desc: "SDKs in six languages. Comprehensive docs. Active community.",
    },
    {
      icon: Wrench,
      title: "Audit readiness",
      desc: "SOC 2 and ISO 27001 in progress. HIPAA, GDPR compliant. FedRAMP roadmap.",
    },
    {
      icon: BarChart3,
      title: "Capital discipline",
      desc: "Long-term reserves. Transparent cap table. Aligned incentives.",
    },
  ];

  return (
    <section className="border-b py-20 md:py-28">
      <div className="container-wide">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
            Built on trust
          </p>
          <h2 className="mt-3 text-balance font-display text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
            The foundation underneath the foundation.
          </h2>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="rounded-2xl border bg-card p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold tracking-tight">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------------- FINAL CTA ---------------------- */

function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-foreground py-24 text-background md:py-32">
      <div className="absolute inset-0 opacity-30">
        <svg viewBox="0 0 1200 600" className="h-full w-full" preserveAspectRatio="none">
          <defs>
            <radialGradient id="ctaGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(134 50% 50%)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="hsl(134 50% 35%)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="600" cy="300" rx="500" ry="200" fill="url(#ctaGlow)" />
        </svg>
      </div>

      <div className="container-narrow relative text-center">
        <LogoMark size={56} className="mx-auto [&_svg_*]:stroke-white [&_circle]:fill-white" />
        <h2 className="mt-8 text-balance font-display text-5xl font-medium leading-[1.05] tracking-tight md:text-6xl">
          Grow the future of intelligence.
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-background/70">
          Participate in the creation of a decentralized AI cloud where
          computation, intelligence, and ownership converge.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            size="xl"
            className="gap-1.5 bg-background text-foreground hover:bg-background/90"
            asChild
          >
            <Link href="#participate">
              Join Aigarth Genesis
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            size="xl"
            variant="ghost"
            className="gap-1.5 text-background hover:bg-background/10"
            asChild
          >
            <Link href="/docs">
              <FileText className="h-4 w-4" />
              Read the Technical Vision
            </Link>
          </Button>
        </div>

        <div className="mt-4">
          <Button
            size="lg"
            variant="ghost"
            className="gap-1.5 text-background/80 hover:bg-background/10"
            asChild
          >
            <Link href="/contact">
              Become an Infrastructure Partner
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        <div className="mt-10 rounded-2xl border border-background/10 bg-background/[0.04] p-5 text-left">
          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-background/60">
            <Sparkles className="h-3 w-3" />
            Featured use case · Material Science
          </div>
          <div className="mt-2 text-sm font-medium">8 material science ANNs are live in the marketplace.</div>
          <p className="mt-1.5 text-xs leading-relaxed text-background/70">
            A research plan in. A lab protocol out. Stake to fund the next cathode,
            catalyst, or polymer discovery. ~52 QU per workflow, ~30% revenue share
            to stakers, on-chain attribution when a discovery ships.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-background hover:bg-background/10"
              asChild
            >
              <Link href="/use-cases/material-science/funnel">
                Stake for material discovery
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-background/80 hover:bg-background/10"
              asChild
            >
              <Link href="/use-cases/material-science">
                Read the case study
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-4 border-t border-background/10 pt-10 sm:grid-cols-3">
          {[
            { icon: Lock, label: "Audited" },
            { icon: Users, label: "12,800+ stakers" },
            { icon: Globe, label: "47 regions" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex items-center justify-center gap-2 text-sm text-background/70">
                <Icon className="h-4 w-4" />
                {s.label}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
