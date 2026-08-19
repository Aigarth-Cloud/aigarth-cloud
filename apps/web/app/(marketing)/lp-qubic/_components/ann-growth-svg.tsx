"use client";

import * as React from "react";
import { motion } from "framer-motion";

/**
 * QubicVariant ANN Growth Visualization.
 *
 * A cinematic SVG of a neural network "growing" in real time.
 * Three.js would have been nice, but the workspace ships without it  
 * pure SVG + Framer Motion gives us full control and zero load cost.
 *
 * Layers, from back to front:
 *   1. Soft cosmic glow + concentric ripples emanating from a central core
 *   2. Hex grid backdrop (Qubic is built on hexagons)
 *   3. Network graph: input → hidden → output layers with weighted edges
 *   4. Signal pulses travelling along edges (the "compute" flowing)
 *   5. Particle drift (Qubic / Useful Proof-of-Work motif)
 *
 * Color palette is locked to the Qubic theme (cyan + warm cream + indigo).
 */
export function ANNGrowthSVG({
  className,
  height = 520,
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
          {/* Qubic cyan → cream → indigo gradient for nodes */}
          <radialGradient id="qubicNode" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFDEA1" stopOpacity="1" />
            <stop offset="55%" stopColor="#25CAD9" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#25CAD9" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="qubicNodeSolid" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FEF8E8" />
            <stop offset="60%" stopColor="#25CAD9" />
            <stop offset="100%" stopColor="#1892A0" />
          </radialGradient>
          <radialGradient id="qubicCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FEF8E8" stopOpacity="1" />
            <stop offset="40%" stopColor="#25CAD9" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0D121C" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="qubicEdge" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#25CAD9" stopOpacity="0.05" />
            <stop offset="50%" stopColor="#25CAD9" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#25CAD9" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="qubicEdgeWarm" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#25CAD9" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#FFDEA1" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#25CAD9" stopOpacity="0.1" />
          </linearGradient>
          <filter id="qubicGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="qubicSoftGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          {/* Hex pattern backdrop */}
          <pattern
            id="qubicHex"
            x="0"
            y="0"
            width="60"
            height="52"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M30 0 L60 17 L60 35 L30 52 L0 35 L0 17 Z"
              fill="none"
              stroke="#25CAD9"
              strokeOpacity="0.06"
              strokeWidth="0.6"
            />
          </pattern>
        </defs>

        {/* Background hex grid */}
        <rect x="0" y="0" width="800" height="560" fill="url(#qubicHex)" />

        {/* Soft cosmic glow blob */}
        <motion.circle
          cx="400"
          cy="280"
          r="220"
          fill="url(#qubicCore)"
          opacity="0.55"
          filter="url(#qubicSoftGlow)"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: [0.6, 1.05, 0.95, 1], opacity: [0, 0.55, 0.45, 0.55] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Concentric ripples: like a stake pool expanding */}
        <Ripples />

        {/* Network edges with traveling signal pulses */}
        <Network />

        {/* Particle drift: the "Useful Proof-of-Work" particles */}
        <Particles />

        {/* Floating mini-clusters (orbit around the core) */}
        <OrbitingClusters />
      </svg>
    </div>
  );
}

function Ripples() {
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <motion.circle
          key={i}
          cx="400"
          cy="280"
          r="40"
          fill="none"
          stroke="#25CAD9"
          strokeWidth="1"
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: [0.4, 3.2], opacity: [0, 0.55, 0] }}
          transition={{
            duration: 4.5,
            delay: i * 1.5,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      ))}
    </g>
  );
}

/**
 * The neural network graph.
 * Four columns of nodes: input (3) → hidden1 (5) → hidden2 (5) → output (3).
 * Edges are drawn first (so nodes paint on top), with traveling pulses
 * that give the impression of compute flowing through the network.
 */
function Network() {
  // 4 layers with positions
  const layers: { x: number; count: number; ySpread: number }[] = [
    { x: 130, count: 3, ySpread: 200 },
    { x: 320, count: 5, ySpread: 280 },
    { x: 510, count: 5, ySpread: 280 },
    { x: 700, count: 3, ySpread: 200 },
  ];

  const nodes: { x: number; y: number; layer: number; i: number }[] = [];
  layers.forEach((layer, li) => {
    const startY = 280 - layer.ySpread / 2;
    const step = layer.ySpread / (layer.count - 1);
    for (let i = 0; i < layer.count; i++) {
      nodes.push({
        x: layer.x,
        y: startY + i * step,
        layer: li,
        i,
      });
    }
  });

  // All edges between adjacent layers
  const edges: {
    from: { x: number; y: number };
    to: { x: number; y: number };
    li: number;
    pulseDelay: number;
  }[] = [];
  for (let li = 0; li < layers.length - 1; li++) {
    const fromNodes = nodes.filter((n) => n.layer === li);
    const toNodes = nodes.filter((n) => n.layer === li + 1);
    fromNodes.forEach((f, fi) => {
      toNodes.forEach((t, ti) => {
        // Skip ~30% of edges to keep it visually clean
        if ((fi * 3 + ti) % 10 === 0) return;
        edges.push({
          from: { x: f.x, y: f.y },
          to: { x: t.x, y: t.y },
          li,
          pulseDelay: (fi + ti) * 0.18 + li * 0.6,
        });
      });
    });
  }

  return (
    <g>
      {/* Edges: line by line with growing-in animation */}
      {edges.map((e, i) => (
        <g key={`edge-${i}`}>
          <motion.line
            x1={e.from.x}
            y1={e.from.y}
            x2={e.to.x}
            y2={e.to.y}
            stroke="url(#qubicEdge)"
            strokeWidth="0.7"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.7 }}
            transition={{ duration: 1.2, delay: 0.3 + e.li * 0.3, ease: "easeOut" }}
          />
          {/* Traveling signal pulse: small bright dot animating from `from` to `to` */}
          <SignalPulse
            from={e.from}
            to={e.to}
            delay={e.pulseDelay}
            color={e.li % 2 === 0 ? "#25CAD9" : "#FFDEA1"}
          />
        </g>
      ))}

      {/* Nodes: fade in, then a continuous gentle pulse */}
      {nodes.map((n, i) => (
        <motion.g
          key={`node-${i}`}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            duration: 0.6,
            delay: 0.2 + n.layer * 0.25 + n.i * 0.05,
            type: "spring",
            stiffness: 200,
          }}
        >
          {/* Outer halo */}
          <motion.circle
            cx={n.x}
            cy={n.y}
            r="14"
            fill="url(#qubicNode)"
            opacity="0.5"
            animate={{ opacity: [0.35, 0.65, 0.35] }}
            transition={{
              duration: 2.4 + (i % 3) * 0.4,
              delay: i * 0.1,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          {/* Solid core */}
          <circle
            cx={n.x}
            cy={n.y}
            r="5"
            fill="url(#qubicNodeSolid)"
            filter="url(#qubicGlow)"
          />
          {/* Hot center */}
          <circle cx={n.x} cy={n.y} r="1.5" fill="#FEF8E8" />
        </motion.g>
      ))}
    </g>
  );
}

function SignalPulse({
  from,
  to,
  delay,
  color,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  delay: number;
  color: string;
}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return (
    <motion.circle
      r="2.2"
      fill={color}
      filter="url(#qubicGlow)"
      initial={{ opacity: 0 }}
      animate={{
        opacity: [0, 1, 1, 0],
        cx: [from.x, from.x + dx * 0.5, to.x, to.x],
        cy: [from.y, from.y + dy * 0.5, to.y, to.y],
      }}
      transition={{
        duration: 1.8,
        delay: 1.4 + delay,
        repeat: Infinity,
        ease: "easeInOut",
        repeatDelay: 1.5,
      }}
    />
  );
}

function Particles() {
  const particles = React.useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        x: 60 + Math.random() * 680,
        y: 60 + Math.random() * 440,
        size: 0.8 + Math.random() * 1.8,
        duration: 7 + Math.random() * 9,
        delay: Math.random() * 5,
        drift: 25 + Math.random() * 45,
        warm: i % 4 === 0,
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
          fill={p.warm ? "#FFDEA1" : "#25CAD9"}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 0.85, 0],
            y: [p.y, p.y - p.drift, p.y - p.drift * 1.4],
            x: [p.x, p.x + (Math.random() - 0.5) * 25, p.x],
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

/**
 * Small ANN clusters orbiting the central core: represents
 * "your ANN growing alongside the rest of the network".
 */
function OrbitingClusters() {
  const orbit = (i: number) => ({
    angle: (i * 2 * Math.PI) / 3 + Math.PI / 4,
    distance: 200 + (i % 2) * 30,
  });

  return (
    <g>
      {[0, 1, 2].map((i) => {
        const { angle, distance } = orbit(i);
        const cx = 400 + Math.cos(angle) * distance;
        const cy = 280 + Math.sin(angle) * distance;
        return (
          <motion.g
            key={i}
            animate={{
              x: [0, Math.cos(angle) * 8, 0],
              y: [0, Math.sin(angle) * 8, 0],
            }}
            transition={{
              duration: 6 + i * 0.7,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <motion.g
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 1.5 + i * 0.2, duration: 0.6 }}
            >
              <circle cx={cx} cy={cy} r="9" fill="url(#qubicNode)" opacity="0.6" />
              <circle
                cx={cx}
                cy={cy}
                r="3.5"
                fill="url(#qubicNodeSolid)"
                filter="url(#qubicGlow)"
              />
              {/* Mini-link to center */}
              <motion.line
                x1="400"
                y1="280"
                x2={cx}
                y2={cy}
                stroke="url(#qubicEdgeWarm)"
                strokeWidth="0.6"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.5 }}
                transition={{ delay: 2 + i * 0.2, duration: 1.5 }}
              />
            </motion.g>
          </motion.g>
        );
      })}
    </g>
  );
}
