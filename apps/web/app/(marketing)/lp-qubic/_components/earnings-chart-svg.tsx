"use client";

import * as React from "react";
import { motion } from "framer-motion";

/**
 * Earnings chart: pure SVG line chart with two scenarios.
 *
 *   1. Stake & train: compound growth at 8.4% APY (cyan line + area fill)
 *   2. Just rent    : no yield, flat at 0% (muted dashed line)
 *
 * The two lines use distinct colours and styles so the contrast is
 * obvious in both light and dark mode. The pulse ring around the
 * trailing dot is brand cyan (not cream) so it stays visible against
 * either base.
 *
 * All chart elements read their colour from the document's CSS
 * variables, so the axis labels, grid lines, and rent line all adapt
 * to the active theme without any prop plumbing.
 */
export function EarningsChartSVG({
  className,
  height = 240,
}: {
  className?: string;
  height?: number;
}) {
  const w = 600;
  const h = height;
  const padL = 48; // room for Y-axis labels
  const padR = 24;
  const padT = 28; // small top inset (no internal legend, that's outside)
  const padB = 32; // room for X-axis labels

  // ---------------------------------------------------------------------
  // Theme detection: used only for the cream/amber accent (the
  // "+50.2%" callout). All other colours come from CSS variables.
  // ---------------------------------------------------------------------
  const [isDark, setIsDark] = React.useState(false);
  React.useEffect(() => {
    const root = document.documentElement;
    const check = () => setIsDark(root.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  // Accent colours that need to be theme-aware. Cyan (#25CAD9) is the
  // Qubic brand primary and reads well in both modes, so we hard-code
  // it everywhere. The cream callout is the one exception.
  const accentColor = isDark ? "#FFDEA1" : "#B45309"; // amber-700
  const accentFill = isDark ? "#FFDEA1" : "#B45309";

  // ---------------------------------------------------------------------
  // Data: 5-year compound growth vs. flat no-yield.
  // ---------------------------------------------------------------------
  const months = 60;
  const apy = 0.084;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const yMax = 0.6; // 60% headroom above the 50.2% year-5 value

  const points = React.useMemo(() => {
    const stakeLine: { x: number; y: number }[] = [];
    const flatLine: { x: number; y: number }[] = [];
    for (let i = 0; i <= months; i++) {
      const x = padL + (i / months) * plotW;
      const stake = Math.pow(1 + apy / 12, i) - 1;
      const flat = 0;
      const yStake = padT + plotH - (stake / yMax) * plotH;
      const yFlat = padT + plotH;
      stakeLine.push({ x, y: yStake });
      flatLine.push({ x, y: yFlat });
    }
    return { stakeLine, flatLine };
  }, [padL, padT, plotH, plotW]);

  const stakePath = React.useMemo(
    () =>
      points.stakeLine
        .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
        .join(" "),
    [points]
  );

  const lastPoint = points.stakeLine[points.stakeLine.length - 1];
  const firstPoint = points.stakeLine[0];
  const areaPath =
    lastPoint && firstPoint
      ? `${stakePath} L ${lastPoint.x} ${padT + plotH} L ${firstPoint.x} ${padT + plotH} Z`
      : "";

  // ---------------------------------------------------------------------
  // Axis labels
  // ---------------------------------------------------------------------
  const yTicks = [0, 0.15, 0.3, 0.45, 0.6];
  const xTicks = [
    { label: "Y0", monthIndex: 0 },
    { label: "Y1", monthIndex: 12 },
    { label: "Y2", monthIndex: 24 },
    { label: "Y3", monthIndex: 36 },
    { label: "Y4", monthIndex: 48 },
    { label: "Y5", monthIndex: 60 },
  ];

  return (
    <div className={className} style={{ height }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height="100%"
        className="overflow-visible"
      >
        <defs>
          <linearGradient id="stakeArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#25CAD9" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#25CAD9" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="stakeLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#25CAD9" />
            <stop offset="100%" stopColor="#25CAD9" />
          </linearGradient>
          <filter id="chartGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.4" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="dotGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* ----------------- Y-axis grid + labels ----------------- */}
        {yTicks.map((p) => {
          const y = padT + plotH - (p / yMax) * plotH;
          return (
            <g key={p}>
              <line
                x1={padL}
                y1={y}
                x2={w - padR}
                y2={y}
                stroke="var(--border)"
                strokeOpacity={p === 0 ? 0.9 : 0.5}
                strokeDasharray={p === 0 ? undefined : "2 4"}
              />
              <text
                x={padL - 8}
                y={y + 3}
                textAnchor="end"
                fontSize="9"
                fontFamily="ui-monospace, monospace"
                fill="var(--muted-foreground)"
                fillOpacity="0.8"
              >
                {Math.round(p * 100)}%
              </text>
            </g>
          );
        })}

        {/* ----------------- X-axis labels ----------------- */}
        {xTicks.map((m) => {
          const x = padL + (m.monthIndex / months) * plotW;
          return (
            <text
              key={m.label}
              x={x}
              y={h - 8}
              textAnchor="middle"
              fontSize="9"
              fontFamily="ui-monospace, monospace"
              fill="var(--muted-foreground)"
              fillOpacity="0.8"
            >
              {m.label}
            </text>
          );
        })}

        {/* ----------------- Just rent: flat dashed line ----------------- */}
        <motion.line
          x1={padL}
          y1={padT + plotH}
          x2={w - padR}
          y2={padT + plotH}
          stroke="var(--muted-foreground)"
          strokeOpacity="0.45"
          strokeWidth="1.4"
          strokeDasharray="4 4"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.2 }}
        />

        {/* ----------------- Stake & train: area fill ----------------- */}
        <motion.path
          d={areaPath}
          fill="url(#stakeArea)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.6 }}
        />

        {/* ----------------- Stake & train: line ----------------- */}
        <motion.path
          d={stakePath}
          fill="none"
          stroke="#25CAD9"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2.4, ease: "easeOut" }}
          filter="url(#chartGlow)"
        />

        {/* ----------------- Y5 endpoint dot + pulse ----------------- */}
        {lastPoint && (
          <>
            {/* Soft halo behind the dot: makes the endpoint pop */}
            <motion.circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r="9"
              fill="#25CAD9"
              opacity="0.25"
              filter="url(#dotGlow)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.25 }}
              transition={{ duration: 0.4, delay: 2.2 }}
            />
            {/* Solid dot */}
            <motion.circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r="4.5"
              fill="#25CAD9"
              stroke="var(--card)"
              strokeWidth="2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 2.2 }}
            />
            {/* Pulse ring: cyan so it pops in BOTH light and dark mode */}
            <motion.circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r="5"
              fill="none"
              stroke="#25CAD9"
              strokeWidth="1.5"
              initial={{ opacity: 0, scale: 1 }}
              animate={{
                opacity: [0, 0.7, 0],
                scale: [1, 2.6],
              }}
              transition={{
                duration: 2,
                delay: 2.4,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />

            {/* "+50.2%" callout: anchored above the endpoint */}
            <motion.g
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 2.6 }}
            >
              {/* Pill background: uses the card bg so it reads on either theme */}
              <rect
                x={lastPoint.x - 38}
                y={lastPoint.y - 28}
                width="76"
                height="20"
                rx="10"
                fill="var(--card)"
                stroke={accentColor}
                strokeOpacity="0.5"
                strokeWidth="1"
              />
              <text
                x={lastPoint.x}
                y={lastPoint.y - 14}
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                fontFamily="ui-monospace, monospace"
                fill={accentFill}
              >
                +50.2%
              </text>
            </motion.g>
          </>
        )}
      </svg>
    </div>
  );
}
