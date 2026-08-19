"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Menu,
  X,
  ArrowUpRight,
  Sparkles,
  Sun,
  Moon,
  Cpu,
  Brain,
  Server,
  Globe,
  Shield,
  Code2,
  Image as ImageIcon,
  Mic,
  Video,
  Database,
  Network,
  Zap,
  Terminal,
  Building2,
  ArrowRight,
  FlaskConical,
  Film,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@aigarth/ui";
import { cn } from "@aigarth/utils";
import { useTheme } from "next-themes";
import { useNavMode } from "./use-nav-mode";

const PLATFORM = [
  {
    title: "Useful Proof of Staking",
    href: "/useful-proof-of-staking",
    description: "How staking powers the network and earns revenue.",
    icon: Shield,
  },
  {
    title: "Stake to Access",
    href: "/stake-access",
    description: "Lock QUBIC, unlock ANNs. Earn yield while you work.",
    icon: Sparkles,
  },
  {
    title: "AI Compute",
    href: "/ai-compute",
    description: "Reserve and run inference at global scale.",
    icon: Cpu,
  },
  {
    title: "Outsourced Computation",
    href: "/outsourced-computation",
    description: "Offload heavy work to a verified compute layer.",
    icon: Server,
  },
  {
    title: "Oracle Network",
    href: "/oracle-network",
    description: "Trust-minimized data feeds for any application.",
    icon: Network,
  },
];

const PRODUCTS = [
  {
    title: "AI Inference",
    href: "/inference",
    description: "OpenAI-compatible APIs at fraction of the cost.",
    icon: Brain,
  },
  {
    title: "Embeddings",
    href: "/embeddings",
    description: "High-dimensional vector representations.",
    icon: Database,
  },
  {
    title: "Image Generation",
    href: "/image",
    description: "Photorealistic and artistic image synthesis.",
    icon: ImageIcon,
  },
  {
    title: "Video Generation",
    href: "/video",
    description: "Cinematic video from text and image inputs.",
    icon: Video,
  },
  {
    title: "Voice",
    href: "/voice",
    description: "Natural speech synthesis and recognition.",
    icon: Mic,
  },
  {
    title: "Reasoning Models",
    href: "/reasoning",
    description: "Chain-of-thought models for complex tasks.",
    icon: Sparkles,
  },
  {
    title: "Fine-Tuning",
    href: "/fine-tuning",
    description: "Customize models on your own data.",
    icon: Code2,
  },
  {
    title: "Agents",
    href: "/agents",
    description: "Autonomous multi-step AI workflows.",
    icon: Zap,
  },
  {
    title: "Batch Processing",
    href: "/batch",
    description: "Run large jobs asynchronously at low cost.",
    icon: Server,
  },
  {
    title: "Compute Clusters",
    href: "/clusters",
    description: "Dedicated clusters for sustained workloads.",
    icon: Globe,
  },
  {
    title: "GPU Marketplace",
    href: "/gpu-marketplace",
    description: "Lease, buy, sell and auction compute.",
    icon: Cpu,
  },
  {
    title: "Dataset Catalog",
    href: "/datasets",
    description: "Public datasets for training your ANNs.",
    icon: Database,
  },
  {
    title: "Oracle Services",
    href: "/oracle",
    description: "Real-world data for smart contracts.",
    icon: Network,
  },
];

const COMPANY = [
  { title: "About", href: "/about", description: "Our mission and team." },
  { title: "Customers", href: "/customers", description: "Who builds on Aigarth." },
  { title: "Case Studies", href: "/case-studies", description: "Real outcomes from real teams." },
  { title: "Ecosystem", href: "/ecosystem", description: "The broader Aigarth network." },
  { title: "Careers", href: "/careers", description: "Build the future with us." },
  { title: "Blog", href: "/blog", description: "Product updates and engineering." },
  { title: "Roadmap", href: "/roadmap", description: "What we're shipping next." },
];

// "For X / For Y": the funnel pages, surfaced as the "For" submenu
// in simple mode. Kept richer than the standard menu because they are
// the most important conversion routes on the site.
const FOR = [
  {
    title: "For Developers",
    href: "/developers",
    eyebrow: "Build",
    description:
      "APIs, SDKs, keys, and docs. Start with the first request in under five minutes.",
    bullets: ["OpenAI-compatible REST", "TypeScript + Python SDKs", "Free dev tier"],
    icon: Terminal,
    accent: "from-sky-500/15 to-sky-500/0",
    iconClass: "text-sky-600 dark:text-sky-400 bg-sky-500/10",
  },
  {
    title: "For Enterprise",
    href: "/enterprise",
    eyebrow: "Scale",
    description:
      "Dedicated compute, SLAs, compliance, and a single point of contact for your team.",
    bullets: ["Dedicated clusters", "SOC 2 + ISO 27001", "24/7 support"],
    icon: Building2,
    accent: "from-violet-500/15 to-violet-500/0",
    iconClass: "text-violet-600 dark:text-violet-400 bg-violet-500/10",
  },
  {
    title: "For Material Science",
    href: "/use-cases/material-science/funnel",
    eyebrow: "Discover",
    description:
      "Stake QUBIC to fund the next cathode, catalyst, or polymer. Research plan in, lab protocol out.",
    bullets: [
      "8 specialized material ANNs",
      "Stake-funded discovery",
      "Open + commercial licenses",
    ],
    icon: FlaskConical,
    accent: "from-amber-500/15 to-amber-500/0",
    iconClass: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
  },
  {
    title: "For Video",
    href: "/use-cases/video-synthesis/funnel",
    eyebrow: "Create",
    description:
      "A swarm of small, specialized AIs, including Director, Camera, Motion, Depth, FX, all collaborating to produce useful video.",
    bullets: [
      "8-role video crew",
      "Re-evaluation gate built in",
      "Pay per call, stake to back",
    ],
    icon: Film,
    accent: "from-rose-500/15 to-rose-500/0",
    iconClass: "text-rose-600 dark:text-rose-400 bg-rose-500/10",
  },
];

type NavItem = {
  title: string;
  href: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
};

function NavMenu({
  trigger,
  items,
  columns = 2,
  width = 480,
}: {
  trigger: React.ReactNode;
  items: NavItem[];
  columns?: 2 | 3;
  width?: number;
}) {
  const [open, setOpen] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const onEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };
  const onLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <div onMouseEnter={onEnter} onMouseLeave={onLeave} className="relative">
      <button
        className="inline-flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-primary transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            style={{ width }}
            className="absolute left-1/2 top-full -translate-x-1/2 pt-3 z-50"
          >
            <div className="rounded-xl border bg-popover/95 backdrop-blur-xl p-2 shadow-2xl">
              <div
                className={cn(
                  "grid gap-1",
                  columns === 3 ? "grid-cols-2" : "grid-cols-1"
                )}
              >
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="group flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-accent"
                    >
                      {Icon && (
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                          <Icon className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          {item.title}
                        </div>
                        <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {item.description}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * "For" submenu: only 2 items but they're the two funnel pages, so
 * they get a richer 2-card layout with eyebrow + bullets + arrow.
 */
function ForMenu() {
  const [open, setOpen] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const onEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };
  const onLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <div onMouseEnter={onEnter} onMouseLeave={onLeave} className="relative">
      <button
        className="inline-flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-primary transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        For
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute left-1/2 top-full -translate-x-1/2 pt-3 z-50 w-[520px]"
          >
            <div className="grid grid-cols-2 gap-2 rounded-xl border bg-popover/95 backdrop-blur-xl p-2 shadow-2xl">
              {FOR.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="group relative flex flex-col gap-2 overflow-hidden rounded-lg p-3 transition-colors hover:bg-accent"
                  >
                    <div
                      className={cn(
                        "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60",
                        item.accent
                      )}
                    />
                    <div className="relative flex items-center gap-2">
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-md",
                          item.iconClass
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {item.eyebrow}
                        </div>
                        <div className="text-sm font-medium leading-tight">
                          {item.title}
                        </div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </div>
                    <p className="relative text-xs text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                    <ul className="relative space-y-1">
                      {item.bullets.map((b) => (
                        <li
                          key={b}
                          className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                        >
                          <span className="h-1 w-1 rounded-full bg-foreground/40" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavLink({
  href,
  children,
  highlight,
}: {
  href: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "px-3 py-2 text-sm transition-colors",
        highlight
          ? "font-medium text-foreground hover:text-primary"
          : "text-muted-foreground hover:text-primary"
      )}
    >
      {children}
    </Link>
  );
}

function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-8 w-8" />;
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export function MarketingNav() {
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { mode, mounted } = useNavMode();
  const pathname = usePathname();

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // SSR / pre-hydration: render the simple nav so the initial paint is
  // light. The hook will swap to "advanced" on mount if the user picked it.
  const isAdvanced = mounted && mode === "advanced";

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "border-b border-border/60 bg-background/80 backdrop-blur-xl"
          : "bg-transparent"
      )}
    >
      <div className="container-wide grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="flex items-center">
          <Link href="/" className="flex items-center">
            <Logo showSubtitle />
          </Link>
        </div>

        <nav className="hidden lg:flex items-center justify-self-center">
          {isAdvanced ? (
            <AdvancedNav />
          ) : (
            <SimpleNav />
          )}
        </nav>

        <div className="flex items-center justify-end gap-2">
          <ThemeToggle />
          <Link href="/signup" className="hidden sm:inline-flex">
            <Button size="sm" className="gap-1">
              Get started
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex lg:hidden h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-accent"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden border-t border-border overflow-hidden bg-background"
          >
            <div className="container-wide py-4 space-y-1">
              <MobileSection label="Platform" items={PLATFORM} />
              <MobileSection label="Products" items={PRODUCTS} />
              <Link href="/anns" className="block py-2 text-base font-medium">
                ANNs
              </Link>
              <Link href="/marketplace" className="block py-2 text-base font-medium">
                Marketplace
              </Link>
              <Link href="/pricing" className="block py-2 text-base font-medium">
                Pricing
              </Link>
              <div>
                <div className="py-2 text-base font-semibold text-foreground">For</div>
                <div className="pl-2 pb-2 space-y-1">
                  {FOR.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center justify-between py-1.5 text-sm text-muted-foreground"
                    >
                      <span>{item.title}</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                        {item.eyebrow}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
              <Link href="/docs" className="block py-2 text-base font-medium">
                Documentation
              </Link>
              <MobileSection label="Company" items={COMPANY} />
              <Link href="/ipo" className="block py-2 text-base font-semibold text-foreground">
                IPO
              </Link>
              <div className="pt-4 flex flex-col gap-2">
                <Link href="/signup">
                  <Button className="w-full">Get started</Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/** OpenAI-style nav: 6 top-level items, with the 2 funnels in a "For" submenu. */
function SimpleNav() {
  return (
    <>
      <NavMenu trigger="Platform" items={PLATFORM} />
      <NavMenu trigger="Products" items={PRODUCTS} columns={3} width={640} />
      <NavLink href="/anns">ANNs</NavLink>
      <NavLink href="/marketplace">Marketplace</NavLink>
      <NavLink href="/pricing">Pricing</NavLink>
      <ForMenu />
      <NavMenu trigger="Company" items={COMPANY} />
    </>
  );
}

/** The original mega-nav: every link visible. */
function AdvancedNav() {
  return (
    <>
      <NavMenu trigger="Platform" items={PLATFORM} />
      <NavMenu trigger="Products" items={PRODUCTS} columns={3} width={640} />
      <NavLink href="/anns">ANNs</NavLink>
      <NavLink href="/marketplace">Marketplace</NavLink>
      <NavLink href="/pricing">Pricing</NavLink>
      <NavLink href="/developers">Developers</NavLink>
      <NavLink href="/enterprise">Enterprise</NavLink>
      <NavLink href="/ipo" highlight>IPO</NavLink>
      <NavMenu trigger="Company" items={COMPANY} />
      <NavLink href="/docs">Docs</NavLink>
    </>
  );
}

function MobileSection({
  label,
  items,
}: {
  label: string;
  items: NavItem[];
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-2 text-base font-medium"
      >
        {label}
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="pl-2 pb-2 space-y-1">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block py-1.5 text-sm text-muted-foreground"
            >
              {item.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// Unused but re-exported so a future caller (e.g. a footer CTA) can
// surface the same 2-card ForMenu treatment elsewhere.
export { ForMenu, FOR };
