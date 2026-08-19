"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Bell, Plus, Sun, Moon, LogOut, User as UserIcon, Wallet } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@aigarth/ui";
import { cn } from "@aigarth/utils";
import { useRouter } from "next/navigation";
import { WalletsDialog } from "./wallets-dialog";

interface User {
  id: string;
  name: string;
  email: string;
}

export function DashboardTopbarClient({
  user,
  activeAddressPrefix,
}: {
  user: User | null;
  /**
   * 12-char prefix of the wallet address that was used to sign the
   * current session. Derived from the user's email (which is
   * `qubic-<first12chars-of-address>@wallet.local`).
   */
  activeAddressPrefix?: string | null;
}) {
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [walletsOpen, setWalletsOpen] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const initials = user
    ? user.name
        .split(/\s+/)
        .map((s) => s[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase() || user.email[0]?.toUpperCase()
    : "?";

  return (
    <header className="sticky top-0 z-30 hidden h-16 items-center justify-between border-b bg-card/80 px-6 backdrop-blur-md lg:flex">
      <button
        onClick={() => setPaletteOpen(true)}
        className="inline-flex h-9 w-[28rem] max-w-[60vw] items-center gap-2.5 rounded-lg border bg-background/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-accent"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">Search resources, docs, ANNs…</span>
        <kbd className="ml-auto shrink-0 rounded border bg-muted px-1.5 py-0.5 text-xs">⌘K</kbd>
      </button>

      <div className="flex items-center gap-2">
        <Link href="/dashboard/api-keys">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Create key
          </Button>
        </Link>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Toggle theme"
        >
          {mounted && theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button
          aria-label="Notifications"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
        </button>

        {user ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-9 items-center gap-2 rounded-md px-2 text-sm hover:bg-accent"
              aria-label="User menu"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {initials}
              </span>
              <span className="hidden max-w-[120px] truncate text-sm md:inline">
                {user.name}
              </span>
            </button>
            {menuOpen && (
              <>
                <button
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden
                />
                <div className="absolute right-0 z-50 mt-1 w-56 overflow-hidden rounded-lg border bg-card shadow-lg">
                  <div className="border-b px-3 py-2.5">
                    <div className="text-sm font-medium">{user.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setWalletsOpen(true);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <Wallet className="h-3.5 w-3.5" /> Wallets
                  </button>
                  <Link
                    href="/dashboard/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                  >
                    <UserIcon className="h-3.5 w-3.5" /> Settings
                  </Link>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setMenuOpen(false);
                      await fetch("/api/auth/logout", { method: "POST" });
                      router.push("/");
                      router.refresh();
                    }}
                  >
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <LogOut className="h-3.5 w-3.5" /> Sign out
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Sign in
          </Link>
        )}
      </div>

      <WalletsDialog
        open={walletsOpen}
        onOpenChange={setWalletsOpen}
        activeAddressPrefix={activeAddressPrefix ?? null}
      />
    </header>
  );
}
