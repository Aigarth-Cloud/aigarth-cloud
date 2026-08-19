import Link from "next/link";
import { LogoFull } from "@/components/brand/logo";
import { Github, Twitter, Linkedin, MessageCircle } from "lucide-react";

const groups = [
  {
    title: "Platform",
    items: [
      { label: "Useful Proof of Staking", href: "/useful-proof-of-staking" },
      { label: "AI Compute", href: "/ai-compute" },
      { label: "Outsourced Computation", href: "/outsourced-computation" },
      { label: "Oracle Network", href: "/oracle-network" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Participate",
    items: [
      { label: "Genesis Offering", href: "/ipo" },
      { label: "Pioneer", href: "/ipo#participate" },
      { label: "Builder", href: "/ipo#participate" },
      { label: "Infrastructure Partner", href: "/ipo#participate" },
      { label: "Enterprise Partner", href: "/ipo#contact" },
    ],
  },
  {
    title: "Products",
    items: [
      { label: "AI Inference", href: "/inference" },
      { label: "Embeddings", href: "/embeddings" },
      { label: "Image Generation", href: "/image" },
      { label: "Voice", href: "/voice" },
      { label: "Reasoning Models", href: "/reasoning" },
      { label: "Fine-Tuning", href: "/fine-tuning" },
    ],
  },
  {
    title: "Developers",
    items: [
      { label: "Documentation", href: "/docs" },
      { label: "API Reference", href: "/docs/api" },
      { label: "SDKs", href: "/docs/sdks" },
      { label: "CLI", href: "/docs/cli" },
      { label: "Status", href: "/status" },
    ],
  },
  {
    title: "Company",
    items: [
      { label: "About", href: "/about" },
      { label: "Ecosystem", href: "/ecosystem" },
      { label: "Careers", href: "/careers" },
      { label: "Blog", href: "/blog" },
    ],
  },
];

// Legal links render as a horizontal row in the bottom bar so they don't
// have to occupy a 6th column with empty space on either side.
const legal = [
  { label: "Privacy", href: "/legal/privacy" },
  { label: "Terms", href: "/legal/terms" },
  { label: "Security", href: "/security" },
  { label: "Acceptable Use", href: "/legal/aup" },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container-wide py-16">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_4fr] lg:gap-16">
          <div>
            <LogoFull />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground leading-relaxed">
              The decentralized AI cloud. Stake QUBIC, reserve compute, build
              products, and earn revenue.
            </p>
            <div className="mt-6 flex items-center gap-2">
              {[
                { icon: Github, href: "https://github.com/aigarthcloud", label: "GitHub" },
                { icon: Twitter, href: "https://twitter.com/aigarthcloud", label: "Twitter" },
                { icon: Linkedin, href: "https://linkedin.com/company/aigarthcloud", label: "LinkedIn" },
                { icon: MessageCircle, href: "https://discord.gg/aigarth", label: "Discord" },
              ].map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label={label}
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
            <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-mint-500" />
              </span>
              <span className="text-muted-foreground">All systems operational</span>
            </div>
          </div>

          {/* Main 5-column grid (no more empty 6th slot) */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
            {groups.map((group) => (
              <div key={group.title}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  {group.title}
                </h3>
                <ul className="mt-4 space-y-3">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-primary"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar: copyright on the left, legal inline in the centre,
            brand tagline on the right. Legal is horizontal so the empty
            space is collapsed. */}
        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-border pt-8 lg:flex-row lg:items-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Aigarth Cloud. All rights reserved.
          </p>

          {/* Horizontal legal nav */}
          <nav
            aria-label="Legal"
            className="flex flex-wrap items-center gap-x-5 gap-y-2"
          >
            {legal.map((item, i) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-xs text-muted-foreground transition-colors hover:text-primary"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <p className="text-xs text-muted-foreground">
            Built on Qubic. Powered by Useful Proof of Work.
          </p>
        </div>
      </div>
    </footer>
  );
}
