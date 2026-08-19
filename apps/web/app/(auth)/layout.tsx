import { LogoFull } from "@/components/brand/logo";
import { AuthCarousel, AuthBrandDecoration } from "@/components/shared/auth-carousel";
import { PrewarmQubic } from "./prewarm-qubic";

/**
 * Branded 2-panel auth layout.
 *
 * Used by /login and /signup. Both pages render their form in the
 * right panel; the left panel is the brand panel: same on both pages
 * so the experience feels consistent.
 *
 *   ┌─────────────────────────┬──────────────────────────┐
 *   │  Brand panel (50%)      │  Form panel              │
 *   │  - LogoFull             │  - the page content      │
 *   │  - AuthCarousel         │                          │
 *   │  - dot indicators       │                          │
 *   │  - "Skip to form" link  │                          │
 *   └─────────────────────────┴──────────────────────────┘
 *
 * On mobile the brand panel collapses to a slim header strip; the
 * carousel becomes a 1-line tagline.
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <PrewarmQubic />
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Brand panel: hidden on mobile, full-height on desktop */}
        <aside className="relative hidden overflow-hidden border-r border-white/5 bg-[#0D121C] lg:block">
          <div className="absolute inset-0">
            <AuthCarousel />
            <AuthBrandDecoration />
          </div>

          {/* Top: logo + tagline stacked */}
          <div className="absolute left-8 top-8 z-10 flex flex-col gap-2 sm:left-10 sm:top-10">
            <LogoFull className="[&_span]:!text-[#FEF8E8] [&_.uppercase]:!text-[#FEF8E8]/60" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#FEF8E8]/40">
              Built on Qubic · Useful Proof of Work
            </span>
          </div>
        </aside>

        {/* Mobile-only brand header */}
        <div className="flex items-center justify-between border-b border-border bg-[#0D121C] px-6 py-4 lg:hidden">
          <LogoFull className="[&_span]:!text-[#FEF8E8] [&_.uppercase]:!text-[#FEF8E8]/60" />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#25CAD9]">
            Built on Qubic
          </span>
        </div>

        {/* Form panel: the page content */}
        <main className="flex items-center justify-center bg-background px-6 py-10 sm:px-10 lg:px-16 lg:py-0">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}
