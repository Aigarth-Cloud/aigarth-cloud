"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Cpu, Server, Home, Briefcase, Building2, CircuitBoard, MapPin } from "lucide-react";
import { Button } from "@aigarth/ui";
import { Badge } from "@aigarth/ui";

const PRODUCTS = [
  {
    id: "seed",
    name: "Aigarth Seed",
    tagline: "Developer edge node.",
    desc: "A pocket-sized inference device for individual developers. Run small models, test prompts, build locally.",
    icon: Cpu,
    specs: {
      compute: "8 TOPS",
      power: "15W",
      network: "Wi-Fi 6 / Ethernet",
      launch: "Q3 2026",
    },
  },
  {
    id: "grove",
    name: "Aigarth Grove",
    tagline: "Professional workstation node.",
    desc: "A workstation-class box for studios and small teams. Multi-model inference, local fine-tuning, fast iteration.",
    icon: Briefcase,
    specs: {
      compute: "200 TOPS",
      power: "350W",
      network: "2.5GbE / Wi-Fi 6E",
      launch: "Q4 2026",
    },
  },
  {
    id: "forest",
    name: "Aigarth Forest",
    tagline: "Rack-scale inference appliance.",
    desc: "A 4U rack unit for high-throughput inference. Run production workloads with dedicated capacity.",
    icon: Server,
    specs: {
      compute: "8 PFLOPS",
      power: "4 kW",
      network: "100GbE",
      launch: "Q1 2027",
    },
  },
  {
    id: "canopy",
    name: "Aigarth Canopy",
    tagline: "Enterprise AI cluster.",
    desc: "Multi-rack enterprise cluster with full redundancy, dedicated operators, and bespoke SLAs.",
    icon: Building2,
    specs: {
      compute: "Petascale",
      power: "Custom",
      network: "Custom",
      launch: "Q2 2027",
    },
  },
  {
    id: "root",
    name: "Aigarth Root",
    tagline: "Home AI gateway.",
    desc: "A home device that routes your AI traffic through a private, low-latency edge node.",
    icon: Home,
    specs: {
      compute: "16 TOPS",
      power: "20W",
      network: "Wi-Fi 7",
      launch: "Q4 2026",
    },
  },
  {
    id: "atlas",
    name: "Aigarth Atlas",
    tagline: "Portable inference device.",
    desc: "A battery-powered portable device for on-the-go professionals. Voice, vision, text  ” fully offline.",
    icon: MapPin,
    specs: {
      compute: "32 TOPS",
      power: "12W (battery)",
      network: "5G / Wi-Fi 6E",
      launch: "Q1 2027",
    },
  },
  {
    id: "core",
    name: "Aigarth Core",
    tagline: "Data-center accelerator.",
    desc: "A custom accelerator card for data centers. Native Qubic integration, deterministic inference.",
    icon: CircuitBoard,
    specs: {
      compute: "1.4 PFLOPS",
      power: "700W",
      network: "PCIe 5.0",
      launch: "Q3 2027",
    },
  },
];

export default function ProductsPage() {
  return (
    <>
      <Hero />
      <ProductGrid />
      <SpecsDeepDive />
      <ReserveInterest />
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
            Hardware · Coming soon
          </Badge>
          <h1 className="text-balance font-display text-5xl font-medium leading-[1.05] tracking-tight md:text-6xl">
            The Aigarth hardware ecosystem.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            A full stack of devices  ” from pocket-sized edge nodes to enterprise
            clusters  ” purpose-built for the Aigarth network.
          </p>
        </div>
      </div>
    </section>
  );
}

function ProductGrid() {
  return (
    <section className="border-b py-20 md:py-28">
      <div className="container-wide">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.map((p, i) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="group relative overflow-hidden rounded-2xl border bg-card"
              >
                <div className="relative h-48 overflow-hidden bg-gradient-to-br from-garden-500/10 via-emerald-500/5 to-transparent">
                  <ProductRender productId={p.id} />
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold tracking-tight">{p.name}</h3>
                      <p className="text-xs text-muted-foreground">{p.tagline}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {p.desc}
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-xs">
                    <div>
                      <div className="text-muted-foreground">Compute</div>
                      <div className="mt-0.5 font-mono">{p.specs.compute}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Power</div>
                      <div className="mt-0.5 font-mono">{p.specs.power}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Network</div>
                      <div className="mt-0.5 font-mono">{p.specs.network}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Expected</div>
                      <div className="mt-0.5 font-mono">{p.specs.launch}</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          All hardware products are in development. Specifications are preliminary
          and subject to change.
        </p>
      </div>
    </section>
  );
}

function ProductRender({ productId }: { productId: string }) {
  // Placeholder "industrial render" - stylized SVG mockups
  return (
    <svg viewBox="0 0 240 160" className="h-full w-full">
      <defs>
        <linearGradient id={`bg-${productId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(134 50% 30%)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="hsl(170 60% 40%)" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <rect width="240" height="160" fill={`url(#bg-${productId})`} />
      {/* Render different shapes for different products */}
      {productId === "seed" && (
        <g>
          <rect x="100" y="60" width="40" height="40" rx="6" fill="hsl(134 50% 35%)" opacity="0.7" />
          <rect x="105" y="65" width="30" height="30" rx="3" fill="hsl(134 70% 50%)" opacity="0.9" />
          <circle cx="120" cy="80" r="3" fill="hsl(160 80% 70%)" />
        </g>
      )}
      {productId === "grove" && (
        <g>
          <rect x="60" y="40" width="120" height="80" rx="4" fill="hsl(134 50% 30%)" opacity="0.5" />
          <rect x="65" y="45" width="110" height="14" rx="2" fill="hsl(134 70% 50%)" opacity="0.8" />
          <rect x="65" y="63" width="110" height="14" rx="2" fill="hsl(134 70% 50%)" opacity="0.8" />
          <rect x="65" y="81" width="110" height="14" rx="2" fill="hsl(134 70% 50%)" opacity="0.8" />
          <rect x="65" y="99" width="110" height="14" rx="2" fill="hsl(134 70% 50%)" opacity="0.8" />
        </g>
      )}
      {productId === "forest" && (
        <g>
          <rect x="40" y="30" width="160" height="100" rx="2" fill="hsl(134 50% 30%)" opacity="0.5" />
          {Array.from({ length: 5 }).map((_, i) => (
            <rect
              key={i}
              x={50 + i * 30}
              y={40}
              width="20"
              height="80"
              rx="1"
              fill="hsl(134 70% 50%)"
              opacity={0.6 + i * 0.08}
            />
          ))}
        </g>
      )}
      {productId === "canopy" && (
        <g>
          <rect x="30" y="20" width="180" height="120" rx="3" fill="hsl(134 50% 30%)" opacity="0.5" />
          {Array.from({ length: 3 }).map((_, r) =>
            Array.from({ length: 6 }).map((_, c) => (
              <rect
                key={`${r}-${c}`}
                x={40 + c * 28}
                y={30 + r * 35}
                width="20"
                height="25"
                rx="1"
                fill="hsl(134 70% 50%)"
                opacity={0.5 + (r + c) * 0.04}
              />
            ))
          )}
        </g>
      )}
      {productId === "root" && (
        <g>
          <rect x="80" y="50" width="80" height="60" rx="20" fill="hsl(134 50% 35%)" opacity="0.7" />
          <circle cx="120" cy="80" r="12" fill="hsl(134 70% 60%)" opacity="0.9" />
          <circle cx="120" cy="80" r="4" fill="hsl(160 80% 80%)" />
        </g>
      )}
      {productId === "atlas" && (
        <g>
          <rect x="60" y="60" width="120" height="50" rx="8" fill="hsl(134 50% 30%)" opacity="0.7" />
          <rect x="70" y="68" width="100" height="34" rx="4" fill="hsl(134 70% 50%)" opacity="0.7" />
          <circle cx="120" cy="85" r="6" fill="hsl(160 80% 70%)" />
        </g>
      )}
      {productId === "core" && (
        <g>
          <rect x="60" y="40" width="120" height="80" rx="2" fill="hsl(134 50% 30%)" opacity="0.6" />
          <rect x="70" y="50" width="100" height="60" rx="1" fill="hsl(134 70% 50%)" opacity="0.8" />
          {Array.from({ length: 4 }).map((_, i) => (
            <line
              key={i}
              x1={70 + i * 25}
              y1="50"
              x2={70 + i * 25}
              y2="110"
              stroke="hsl(160 80% 60%)"
              strokeWidth="0.5"
              opacity="0.5"
            />
          ))}
        </g>
      )}
    </svg>
  );
}

function SpecsDeepDive() {
  return (
    <section className="border-b bg-secondary/30 py-20 md:py-28">
      <div className="container-wide">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-garden-600 dark:text-garden-400">
            Why hardware
          </p>
          <h2 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
            Compute you can touch.
          </h2>
          <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
            Aigarth hardware is purpose-built for the network. Native Qubic
            integration, deterministic inference, and verifiable operation. The
            same primitives, scaled from your desk to a data center.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: "Native Qubic", desc: "Direct settlement and stake enforcement at the silicon level." },
            { title: "Verifiable compute", desc: "Hardware roots of trust. Attestable inference outputs." },
            { title: "Edge to cluster", desc: "Same SDK, same APIs, from 15W to multi-megawatt." },
            { title: "Open firmware", desc: "Reproducible builds. Auditable supply chain." },
            { title: "Energy aware", desc: "Telemetry published. Efficiency benchmarks public." },
            { title: "Long lifecycle", desc: "10-year service horizon. Modular upgrade paths." },
          ].map((p) => (
            <div key={p.title} className="rounded-2xl border bg-card p-6">
              <h3 className="font-semibold tracking-tight">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReserveInterest() {
  return (
    <section className="py-20 md:py-28">
      <div className="container-narrow">
        <div className="rounded-3xl border bg-card p-8 md:p-12">
          <div className="text-center">
            <h2 className="text-balance font-display text-3xl font-medium leading-[1.1] tracking-tight md:text-4xl">
              Reserve your interest.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-muted-foreground">
              Be notified when each product opens for reservation. No payment now  ”
              just early access and a priority slot.
            </p>
          </div>
          <form className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
            <input
              type="email"
              placeholder="you@company.com"
              className="flex h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button type="submit" className="gap-1.5">
              Notify me
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
