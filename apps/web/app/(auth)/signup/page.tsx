"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Mail, User, KeyRound, ArrowRight, Wallet as WalletIcon } from "lucide-react";
import { Button } from "@aigarth/ui";
import { ConnectQubicWallet } from "@/components/marketing/connect-qubic-wallet";

/**
 * Branded 2-panel signup page.
 *
 * Primary path: Connect Qubic wallet. No email, no KYC, no password to forget.
 * Secondary path: email + name + password (for users who prefer it).
 *
 * The 2-panel layout, brand panel, and AuthCarousel are in
 * app/(auth)/layout.tsx: this file only renders the form column.
 */
export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [walletCollapsed, setWalletCollapsed] = React.useState(false);
  const [emailCollapsed, setEmailCollapsed] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: fd.get("email"),
        password: fd.get("password"),
        name: fd.get("name"),
      }),
    });
    setPending(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? `Signup failed (${res.status})`);
      return;
    }
    router.push("/dashboard");
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
          Start growing your ANN.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Connect a Qubic wallet to sign up in five seconds. No email, no KYC,
          no password to forget.
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
          label="Sign up with Qubic wallet"
          emailHref=""
          showEmailLink={false}
          redirectTo="/dashboard"
        />
        {walletCollapsed && null}
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
          or sign up with email
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
        <Field id="name" label="Name" type="text" autoComplete="name" icon={User} />
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          icon={Mail}
        />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          icon={KeyRound}
          hint="At least 8 characters."
        />

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
              Create account
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </Button>
      </motion.form>

      <p className="mt-7 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>

      <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground/80">
        By continuing, you agree to our{" "}
        <Link href="/legal/terms" className="underline hover:text-foreground">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/legal/privacy" className="underline hover:text-foreground">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}

interface FieldProps {
  id: string;
  label: string;
  type: string;
  autoComplete?: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  required?: boolean;
}

function Field({ id, label, type, autoComplete, icon: Icon, hint, required = true }: FieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-medium text-foreground"
      >
        {label}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id={id}
          name={id}
          type={type}
          required={required}
          autoComplete={autoComplete}
          minLength={type === "password" ? 8 : undefined}
          className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
      </div>
      {hint && (
        <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
