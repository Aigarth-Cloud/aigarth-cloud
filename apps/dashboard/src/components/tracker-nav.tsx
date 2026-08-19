"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ListChecks, FileText, Activity, Sun, Moon, Rocket, Server, Network, Video, Wallet, ShieldCheck, BookOpen, GraduationCap, Newspaper } from "lucide-react";
import { cn } from "@aigarth/utils";

const NAV = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Phases", href: "/phases", icon: ListChecks },
  { label: "Kanban", href: "/kanban", icon: ListChecks },
  { label: "Deliveries", href: "/deliveries", icon: Rocket },
  { label: "Services", href: "/services", icon: Server },
  { label: "Wallet Auth", href: "/wallet-auth", icon: Wallet },
  { label: "Governance", href: "/governance", icon: ShieldCheck },
  { label: "Blog", href: "/blog", icon: Newspaper },
  { label: "Tutorials", href: "/tutorials", icon: BookOpen },
  { label: "Academy", href: "/academy", icon: GraduationCap },
  { label: "Sitemap", href: "/sitemap", icon: Network },
  { label: "Video", href: "/video", icon: Video },
  { label: "Docs", href: "/docs", icon: FileText },
  { label: "Activity", href: "/activity", icon: Activity },
];

function ThemeToggle() {
  const [theme, setTheme] = React.useState<"light" | "dark">("dark");
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("aigarth-tracker-theme") as "light" | "dark" | null;
    const initial = saved || "dark";
    setTheme(initial);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(initial);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(next);
    localStorage.setItem("aigarth-tracker-theme", next);
  };

  if (!mounted) return <div className="h-8 w-8" />;
  return (
    <button
      onClick={toggle}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export function TrackerNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 border-r bg-card/50 lg:flex lg:flex-col">
        <div className="flex h-16 items-center justify-between border-b px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-garden-500 to-emerald-500 text-xs font-bold text-white">
              AC
            </div>
            <div>
              <div className="text-sm font-semibold">Aigarth Tracker</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Build OS · v0.1
              </div>
            </div>
          </Link>
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          {NAV.map((item) => {
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
        </nav>
        <div className="border-t p-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">SQLite · local</div>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card/80 px-6 backdrop-blur-md lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-garden-500 to-emerald-500 text-xs font-bold text-white">
              AC
            </div>
            <span className="text-sm font-semibold">Aigarth Tracker</span>
          </Link>
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto w-full max-w-7xl px-6 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
