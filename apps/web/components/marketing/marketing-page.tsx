import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@aigarth/ui";
import { Badge } from "@aigarth/ui";

export function MarketingPageHero({
  badge,
  title,
  highlight,
  description,
  primaryCta,
  secondaryCta,
}: {
  badge?: string;
  title: string;
  highlight?: string;
  description: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
}) {
  return (
    <section className="relative overflow-hidden border-b">
      <div className="absolute inset-0 bg-garden-mesh" />
      <div className="container-wide relative py-20 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          {badge && (
            <Badge variant="glow" className="mb-6">
              {badge}
            </Badge>
          )}
          <h1 className="text-balance font-display text-5xl font-medium leading-[1.05] tracking-tight md:text-6xl">
            {title}
            {highlight && (
              <>
                {" "}
                <span className="text-gradient-garden italic">{highlight}</span>
              </>
            )}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            {description}
          </p>
          {(primaryCta || secondaryCta) && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {primaryCta && (
                <Link href={primaryCta.href}>
                  <Button size="lg" className="gap-1.5">
                    {primaryCta.label}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
              {secondaryCta && (
                <Link href={secondaryCta.href}>
                  <Button size="lg" variant="outline">
                    {secondaryCta.label}
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function FeatureGrid({
  features,
}: {
  features: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    body: string;
  }[];
}) {
  return (
    <section className="border-b py-20 md:py-28">
      <div className="container-wide">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="rounded-2xl border bg-card p-7">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function Section({
  title,
  highlight,
  description,
  children,
  align = "left",
  className,
}: {
  title: string;
  highlight?: string;
  description?: string;
  children?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <section className={`border-b py-20 md:py-28 ${className || ""}`}>
      <div className="container-wide">
        <div className={`mb-12 max-w-2xl ${align === "center" ? "mx-auto text-center" : ""}`}>
          <h2 className="text-balance font-display text-4xl font-medium tracking-tight md:text-5xl">
            {title}
            {highlight && (
              <>
                {" "}
                <span className="text-gradient-garden italic">{highlight}</span>
              </>
            )}
          </h2>
          {description && (
            <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}
