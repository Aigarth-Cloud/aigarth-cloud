"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Wallet,
  Cpu,
  Layers,
  Key,
  Folder,
  CreditCard,
  FileText,
  BarChart3,
  Brain,
  Server,
  ShoppingBag,
  Vote,
  Gift,
  Flame,
  Users,
  Bell,
  Settings,
  Shield,
  Building,
  ScrollText,
  Menu,
  X,
  Sparkles,
  Search,
  Plus,
  ChevronRight,
  LogOut,
  User,
  Sprout,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@aigarth/utils";

const NAV = [
  { label: "Garden", href: "/dashboard/garden", icon: Sprout },
  {
    label: "Intelligence",
    items: [
      { label: "Models", href: "/dashboard/models", icon: Brain },
      { label: "Tissues", href: "/dashboard/tissues", icon: Layers },
      { label: "Datasets", href: "/dashboard/datasets", icon: Folder },
      { label: "Marketplace", href: "/dashboard/marketplace", icon: ShoppingBag },
    ],
  },
  {
    label: "Compute",
    items: [
      { label: "Compute usage", href: "/dashboard/compute", icon: Cpu },
      { label: "Reserved capacity", href: "/dashboard/capacity", icon: Layers },
      { label: "Clusters", href: "/dashboard/clusters", icon: Server },
    ],
  },
  {
    label: "Wallet",
    items: [
      { label: "Portfolio", href: "/dashboard/portfolio", icon: Wallet },
      { label: "Rewards", href: "/dashboard/rewards", icon: Gift },
      { label: "Burn history", href: "/dashboard/burn", icon: Flame },
    ],
  },
  {
    label: "Developers",
    items: [
      { label: "API keys", href: "/dashboard/api-keys", icon: Key },
      { label: "Projects", href: "/dashboard/projects", icon: Folder },
      { label: "Governance", href: "/dashboard/governance", icon: Vote },
      { label: "Referrals", href: "/dashboard/referrals", icon: Users },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Billing", href: "/dashboard/billing", icon: CreditCard },
      { label: "Invoices", href: "/dashboard/invoices", icon: FileText },
      { label: "Usage analytics", href: "/dashboard/usage", icon: BarChart3 },
      { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
      { label: "Settings", href: "/dashboard/settings", icon: Settings },
      { label: "Organizations", href: "/dashboard/organizations", icon: Building },
      { label: "Audit logs", href: "/dashboard/audit", icon: ScrollText },
      { label: "Security", href: "/dashboard/security", icon: Shield },
    ],
  },
];

export function DashboardNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-card/80 px-4 backdrop-blur-md lg:hidden">
        <Link href="/dashboard/garden">
          <Logo />
        </Link>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 border-r bg-card transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center border-b px-5">
            <Link href="/" className="flex items-center">
              <Logo />
            </Link>
          </div>

          <div className="px-3 pt-4">
            <button className="flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-garden-500/30 bg-garden-500/5 px-3 py-2 text-sm transition-colors hover:bg-garden-500/10">
              <span className="flex items-center gap-2 truncate">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-garden-500 to-emerald-500 text-xs font-medium text-white">
                  H
                </span>
                <span className="truncate">Helix Labs</span>
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {NAV.map((section) => {
              const directLink = "href" in section ? section as { label: string; href: string; icon: React.ComponentType<{ className?: string }> } : null;
              if (directLink) {
                const Icon = directLink.icon;
                const active = pathname === directLink.href;
                return (
                  <Link
                    key={directLink.href}
                    href={directLink.href}
                    className={cn(
                      "mt-1 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {directLink.label}
                  </Link>
                );
              }
              return (
                <div key={section.label} className="mt-6 first:mt-0">
                  <div className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {section.label}
                  </div>
                  <div className="mt-2 space-y-0.5">
                    {section.items?.map((item) => {
                      const Icon = item.icon;
                      const active = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                            active
                              ? "bg-accent text-foreground"
                              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="border-t p-3">
            <div className="rounded-lg bg-gradient-to-br from-garden-500/10 to-emerald-500/5 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-garden-500" />
                Earn more
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Stake idle capacity to earn 8.4% APY.
              </p>
              <Link
                href="/useful-proof-of-staking"
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-garden-600 hover:text-garden-700 dark:text-garden-400"
              >
                Learn more
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          <div className="border-t p-3">
            <div className="flex items-center gap-3 px-2 py-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-garden-500 to-emerald-500 text-xs font-medium text-white">
                JL
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">Jordan Lee</div>
                <div className="truncate text-xs text-muted-foreground">
                  jordan@helixlabs.ai
                </div>
              </div>
              <button className="text-muted-foreground hover:text-foreground">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}
