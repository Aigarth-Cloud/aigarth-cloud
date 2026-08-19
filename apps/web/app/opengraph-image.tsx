import { ImageResponse } from "next/og";

/**
 * OpenGraph / Twitter card image (1200x630).
 * Used when the site is shared on social media, Slack, Discord, etc.
 *
 * Composition: deep forest background, A-mark on the left in a soft
 * green gradient, "Aigarth" wordmark + "Cloud" subtitle + tagline on the
 * right, a small "BUILT ON QUBIC" badge, and the domain at the bottom.
 */
export const alt = "Aigarth Cloud: Adaptive Intelligence. Own the Future of Compute.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 30% 40%, #1f3d2a 0%, #0e1f15 60%)",
          position: "relative",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Subtle grid overlay (dots) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            backgroundImage:
              "radial-gradient(circle, rgba(94,170,168,0.07) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Soft green halo behind the A */}
        <div
          style={{
            position: "absolute",
            left: 110,
            top: 165,
            width: 300,
            height: 300,
            borderRadius: 9999,
            background:
              "radial-gradient(circle, rgba(94,170,168,0.22) 0%, transparent 65%)",
            display: "flex",
          }}
        />

        {/* Card body */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 80,
            width: "100%",
            height: "100%",
            position: "relative",
          }}
        >
          {/* A-mark */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 280,
              height: 280,
              marginRight: 70,
              flexShrink: 0,
            }}
          >
            <svg
              viewBox="0 0 64 64"
              width="240"
              height="240"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient
                  id="ogA"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#5eaaa8" />
                  <stop offset="100%" stopColor="#2E7D32" />
                </linearGradient>
              </defs>
              <g fill="url(#ogA)">
                <polygon points="11,58 19,58 35,8 30,8" />
                <polygon points="45,58 53,58 34,8 29,8" />
                <ellipse cx="32" cy="40" rx="14" ry="3.2" />
                <path
                  d="M32 18 C 36 20 36 26 32 28 C 28 26 28 20 32 18 Z"
                  opacity="0.85"
                />
              </g>
            </svg>
          </div>

          {/* Wordmark + tagline */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
            }}
          >
            {/* Eyebrow badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                color: "#5eaaa8",
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 9999,
                  background: "#5eaaa8",
                  boxShadow: "0 0 12px #5eaaa8",
                  display: "flex",
                }}
              />
              BUILT ON QUBIC
            </div>

            {/* Wordmark (two lines: Aigarth on top, Cloud below) */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                lineHeight: 1,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 92,
                  fontWeight: 700,
                  color: "#FFFFFF",
                  letterSpacing: -2,
                  lineHeight: 1,
                }}
              >
                Aigarth
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 26,
                  fontWeight: 600,
                  color: "#5eaaa8",
                  letterSpacing: 8,
                  textTransform: "uppercase",
                  marginTop: 8,
                }}
              >
                Cloud
              </div>
            </div>

            {/* Tagline */}
            <div
              style={{
                display: "flex",
                fontSize: 28,
                color: "#FFFFFF",
                opacity: 0.78,
                lineHeight: 1.3,
                maxWidth: 540,
              }}
            >
              Adaptive intelligences that grow, fork, and improve: on the open market.
            </div>
          </div>
        </div>

        {/* Bottom strip: domain */}
        <div
          style={{
            position: "absolute",
            bottom: 36,
            right: 60,
            display: "flex",
            fontSize: 20,
            color: "#FFFFFF",
            opacity: 0.45,
            fontFamily: "ui-monospace, monospace",
            letterSpacing: 1,
          }}
        >
          aigarth.cloud
        </div>
      </div>
    ),
    { ...size }
  );
}
