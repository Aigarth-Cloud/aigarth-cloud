import { ImageResponse } from "next/og";

/**
 * Apple touch icon (180x180): solid background, no rounded corners.
 * iOS adds its own corner mask so the icon should fill the canvas.
 *
 * The A is the Aigarth A-mark: a geometric letterform in a forest-to-mint
 * gradient with a small leaf accent above the crossbar. On a deep
 * forest background so the mark reads on iOS home screens.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
            "linear-gradient(135deg, #1f3d2a 0%, #0e1f15 100%)",
        }}
      >
        <svg
          viewBox="0 0 64 64"
          width="150"
          height="150"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="aigarthAApple" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5eaaa8" />
              <stop offset="100%" stopColor="#2E7D32" />
            </linearGradient>
          </defs>
          <g fill="url(#aigarthAApple)">
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
    ),
    { ...size }
  );
}
