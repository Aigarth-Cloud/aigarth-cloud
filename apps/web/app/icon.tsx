import { ImageResponse } from "next/og";

/**
 * PNG favicon fallback (32x32) for browsers that don't support SVG favicons.
 * Modern browsers use app/icon.svg instead. This one guarantees a fallback.
 *
 * The A is the Aigarth A-mark: a geometric letterform in a forest-to-mint
 * gradient with a small leaf accent above the crossbar. On a soft tinted
 * rounded square.
 */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
            "linear-gradient(180deg, #F0F7F2 0%, #D7E9D8 100%)",
          borderRadius: 7,
        }}
      >
        <svg
          viewBox="0 0 64 64"
          width="28"
          height="28"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="aigarthAFavPng" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5eaaa8" />
              <stop offset="100%" stopColor="#2E7D32" />
            </linearGradient>
          </defs>
          <g fill="url(#aigarthAFavPng)">
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
