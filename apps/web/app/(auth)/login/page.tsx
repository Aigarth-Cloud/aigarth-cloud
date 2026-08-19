"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Mail, KeyRound, ArrowRight, Wallet as WalletIcon } from "lucide-react";
import { Button } from "@aigarth/ui";
import { ConnectQubicWallet } from "@/components/marketing/connect-qubic-wallet";

/**
 * Branded 2-panel login page. Mirrors the signup layout: same brand
 * panel, same AuthCarousel, same divider pattern. The form is shorter
 * (email + password only); the wallet path is identical.
 */
export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: fd.get("email"),
        password: fd.get("password"),
      }),
    });
    setPending(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? `Login failed (${res.status})`);
      return;
    }
    router.push(search.get("next") ?? "/dashboard");
    router.refresh();
  }

  return (
    <div className="w-full">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-balance font-display text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
          Welcome back.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Connect a Qubic wallet to sign in instantly, or use your email below.
        </p>
      </motion.div>

      {/* Wallet section: primary path */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="mt-8"
      >
        <div className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-primary">
          <WalletIcon className="h-3.5 w-3.5" />
          Recommended · wallet
        </div>
        <ConnectQubicWallet
          theme="default"
          variant="hero"
          label="Sign in with Qubic wallet"
          emailHref=""
          showEmailLink={false}
          redirectTo={search.get("next") ?? "/dashboard"}
        />
      </motion.div>

      {/* Divider */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="my-7 flex items-center gap-3"
      >
        <div className="h-px flex-1 bg-border" />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          or sign in with email
        </span>
        <div className="h-px flex-1 bg-border" />
      </motion.div>

      {/* Email form: secondary path */}
      <motion.form
        onSubmit={onSubmit}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="space-y-4"
      >
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-xs font-medium text-foreground"
          >
            Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-xs font-medium text-foreground"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-[11px] text-muted-foreground hover:text-primary"
            >
              Forgot?
            </Link>
          </div>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <Button
          type="submit"
          className="group w-full gap-2"
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Sign in
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </Button>
      </motion.form>

      <p className="mt-7 text-center text-sm text-muted-foreground">
        New to Aigarth?{" "}
        <Link
          href="/signup"
          className="font-medium text-primary hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
