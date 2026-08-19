"use client";

import * as React from "react";
import { motion } from "framer-motion";

/**
 * Ecosystem Visualization
 *
 * A cinematic network showing how compute "grows" from staking.
 * Nodes branch like trees, links run like roots, particles drift like spores.
 *
 * Pure SVG + Framer Motion. No external assets. Honors prefers-reduced-motion.
 */
export function EcosystemVisualization({
  className,
  height = 560,
}: {
  className?: string;
  height?: number;
}) {
  return (
    <div className={className} style={{ height }} aria-hidden="true">
      <svg
        viewBox="0 0 800 560"
        width="100%"
        height="100%"
        className="overflow-visible"
      >
        <defs>
          <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(134 70% 60%)" stopOpacity="0.9" />
            <stop offset="40%" stopColor="hsl(134 50% 45%)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(134 50% 35%)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nodeCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(160 80% 75%)" />
            <stop offset="100%" stopColor="hsl(134 60% 40%)" />
          </radialGradient>
          <linearGradient id="linkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(134 50% 40%)" stopOpacity="0.1" />
            <stop offset="50%" stopColor="hsl(134 50% 50%)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="hsl(134 50% 40%)" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="rootGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(134 50% 35%)" stopOpacity="0" />
            <stop offset="100%" stopColor="hsl(134 50% 40%)" stopOpacity="0.4" />
          </linearGradient>
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ground line - subtle horizon */}
        <line
          x1="0"
          y1="500"
          x2="800"
          y2="500"
          stroke="hsl(var(--border))"
          strokeWidth="0.5"
          strokeDasharray="2 4"
          opacity="0.5"
        />

        {/* Underground root system - foundation */}
        <RootSystem />

        {/* Network connections - growing tendrils */}
        <NetworkLinks />

        {/* Floating particles - spores/seeds */}
        <SporeParticles />

        {/* Main tree structure - the core ecosystem */}
        <TreeStructure />

        {/* Cluster nodes - the "forests" */}
        <ClusterNodes />

        {/* Central stake pool - the glowing garden */}
        <CentralPool />
      </svg>
    </div>
  );
}

function RootSystem() {
  const roots = [
    { d: "M400 500 Q400 480 380 460 T 320 420", delay: 0 },
    { d: "M400 500 Q400 480 420 460 T 480 420", delay: 0.2 },
    { d: "M400 500 Q400 490 390 470 T 360 440", delay: 0.4 },
    { d: "M400 500 Q400 490 410 470 T 440 440", delay: 0.6 },
    { d: "M400 500 Q395 510 380 525 T 340 545", delay: 0.8 },
    { d: "M400 500 Q405 510 420 525 T 460 545", delay: 1.0 },
  ];

  return (
    <g>
      {roots.map((root, i) => (
        <motion.path
          key={i}
          d={root.d}
          stroke="url(#rootGrad)"
          strokeWidth="1.5"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 2, delay: root.delay, ease: "easeInOut" }}
        />
      ))}
    </g>
  );
}

function NetworkLinks() {
  // Tendril connections between nodes - like a network "growing"
  const links: { from: [number, number]; to: [number, number]; delay: number }[] = [
    { from: [400, 300], to: [240, 200], delay: 1.0 },
    { from: [400, 300], to: [560, 200], delay: 1.1 },
    { from: [400, 300], to: [180, 360], delay: 1.2 },
    { from: [400, 300], to: [620, 360], delay: 1.3 },
    { from: [240, 200], to: [140, 140], delay: 1.5 },
    { from: [240, 200], to: [300, 100], delay: 1.6 },
    { from: [560, 200], to: [660, 140], delay: 1.5 },
    { from: [560, 200], to: [500, 100], delay: 1.6 },
    { from: [180, 360], to: [100, 420], delay: 1.8 },
    { from: [620, 360], to: [700, 420], delay: 1.8 },
  ];

  return (
    <g>
      {links.map((link, i) => (
        <motion.line
          key={i}
          x1={link.from[0]}
          y1={link.from[1]}
          x2={link.to[0]}
          y2={link.to[1]}
          stroke="url(#linkGrad)"
          strokeWidth="1"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.6 }}
          transition={{ duration: 1.5, delay: link.delay, ease: "easeOut" }}
        />
      ))}
    </g>
  );
}

function TreeStructure() {
  // The branching tree from the central pool upward
  const branches = [
    { d: "M400 300 L400 220", delay: 0.5 },
    { d: "M400 220 L330 180", delay: 0.7 },
    { d: "M400 220 L470 180", delay: 0.8 },
    { d: "M330 180 L280 150", delay: 0.9 },
    { d: "M330 180 L360 140", delay: 1.0 },
    { d: "M470 180 L520 150", delay: 1.1 },
    { d: "M470 180 L440 140", delay: 1.2 },
    { d: "M280 150 L255 130", delay: 1.3 },
    { d: "M280 150 L295 115", delay: 1.4 },
    { d: "M520 150 L545 130", delay: 1.3 },
    { d: "M520 150 L505 115", delay: 1.4 },
  ];

  return (
    <g>
      {branches.map((branch, i) => (
        <motion.path
          key={i}
          d={branch.d}
          stroke="hsl(134 50% 45%)"
          strokeWidth={i < 3 ? 2 : 1.2}
          fill="none"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.7 }}
          transition={{ duration: 1.2, delay: branch.delay, ease: "easeOut" }}
        />
      ))}
    </g>
  );
}

function ClusterNodes() {
  // Forest clusters - smaller trees around the perimeter
  const clusters = [
    { x: 140, y: 420, size: 0.7, delay: 1.5 },
    { x: 660, y: 420, size: 0.7, delay: 1.6 },
    { x: 100, y: 460, size: 0.5, delay: 1.7 },
    { x: 700, y: 460, size: 0.5, delay: 1.8 },
  ];

  return (
    <g>
      {clusters.map((cluster, i) => (
        <g key={i} transform={`translate(${cluster.x}, ${cluster.y}) scale(${cluster.size})`}>
          {/* Mini tree */}
          <motion.g
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: cluster.delay }}
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="-30"
              stroke="hsl(134 50% 45%)"
              strokeWidth="1.5"
              opacity="0.6"
            />
            <line x1="0" y1="-20" x2="-12" y2="-30" stroke="hsl(134 50% 45%)" strokeWidth="1" opacity="0.6" />
            <line x1="0" y1="-20" x2="12" y2="-30" stroke="hsl(134 50% 45%)" strokeWidth="1" opacity="0.6" />
            <circle cx="0" cy="-32" r="2.5" fill="url(#nodeCore)" />
            <circle cx="-12" cy="-30" r="2" fill="url(#nodeCore)" />
            <circle cx="12" cy="-30" r="2" fill="url(#nodeCore)" />
            <circle cx="0" cy="0" r="3" fill="url(#nodeCore)" filter="url(#softGlow)" />
          </motion.g>
        </g>
      ))}
    </g>
  );
}

function CentralPool() {
  return (
    <g>
      {/* Outer glow - the "stake pool" */}
      <motion.circle
        cx="400"
        cy="300"
        r="60"
        fill="url(#nodeGlow)"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.5, delay: 0.3, ease: "easeOut" }}
      />
      {/* Pulsing ring */}
      <motion.circle
        cx="400"
        cy="300"
        r="45"
        fill="none"
        stroke="hsl(134 50% 50%)"
        strokeWidth="1"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: [0.8, 1.4, 0.8], opacity: [0.6, 0, 0.6] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.circle
        cx="400"
        cy="300"
        r="35"
        fill="none"
        stroke="hsl(134 50% 50%)"
        strokeWidth="1"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: [0.8, 1.6, 0.8], opacity: [0.4, 0, 0.4] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      {/* Core node */}
      <motion.circle
        cx="400"
        cy="300"
        r="12"
        fill="url(#nodeCore)"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.8, delay: 0.2, type: "spring" }}
        filter="url(#softGlow)"
      />
      <circle cx="400" cy="300" r="4" fill="hsl(160 80% 90%)" />
    </g>
  );
}

function SporeParticles() {
  // Floating particles - like spores drifting through the ecosystem
  const particles = React.useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        x: 100 + Math.random() * 600,
        y: 200 + Math.random() * 280,
        size: 1 + Math.random() * 2,
        duration: 8 + Math.random() * 8,
        delay: Math.random() * 4,
        drift: 30 + Math.random() * 40,
      })),
    []
  );

  return (
    <g>
      {particles.map((p) => (
        <motion.circle
          key={p.id}
          cx={p.x}
          cy={p.y}
          r={p.size}
          fill="hsl(134 60% 60%)"
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 0.7, 0],
            y: [p.y, p.y - p.drift, p.y - p.drift * 1.5],
            x: [p.x, p.x + (Math.random() - 0.5) * 30, p.x],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </g>
  );
}
