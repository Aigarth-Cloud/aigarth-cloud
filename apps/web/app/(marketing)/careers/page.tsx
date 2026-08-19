import { MarketingPageHero, Section } from "@/components/marketing/marketing-page";
import { ArrowRight, MapPin } from "lucide-react";
import Link from "next/link";
import { Button } from "@aigarth/ui";
import { Badge } from "@aigarth/ui";

export const metadata = {
  title: "Careers",
  description: "Build the future of AI infrastructure with us.",
};

const ROLES = [
  { title: "Senior Distributed Systems Engineer", team: "Core", location: "Remote / SF", type: "Full-time" },
  { title: "Staff Product Designer", team: "Design", location: "Remote / NYC", type: "Full-time" },
  { title: "ML Infrastructure Engineer", team: "AI", location: "Remote", type: "Full-time" },
  { title: "Developer Advocate", team: "Developer Relations", location: "Remote / EU", type: "Full-time" },
  { title: "Security Engineer", team: "Security", location: "Remote / US", type: "Full-time" },
  { title: "Solutions Architect", team: "Enterprise", location: "NYC", type: "Full-time" },
  { title: "ANN Researcher", team: "Research", location: "Remote", type: "Full-time" },
  { title: "Technical Writer", team: "Documentation", location: "Remote", type: "Full-time" },
];

const PERKS = [
  "Top-of-market compensation",
  "Meaningful equity in Aigarth",
  "Health, dental, vision for you and family",
  "Unlimited PTO with 4-week minimum",
  "$5K annual learning budget",
  "Home office stipend",
  "Quarterly offsites",
  "Sabbatical every 4 years",
];

export default function CareersPage() {
  return (
    <>
      <MarketingPageHero
        badge="Careers"
        title="Build the future of AI infrastructure."
        description="We're a small team of builders shipping a generational product. If that excites you, we want to hear from you."
        primaryCta={{ label: "See open roles", href: "#roles" }}
        secondaryCta={{ label: "Read our culture", href: "/blog" }}
      />

      <Section title="Why Aigarth" align="center">
        <p className="mx-auto max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
          We're not building a feature. We're building a new kind of cloud. That
          means real ownership, real impact, and a team of people who care about
          doing great work together.
        </p>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PERKS.map((p) => (
            <div key={p} className="rounded-xl border bg-card p-4 text-sm">
              {p}
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Open roles"
        description="We're hiring across all teams. Remote-friendly worldwide."
      >
        <div id="roles" className="space-y-2">
          {ROLES.map((role) => (
            <Link
              key={role.title}
              href="/contact"
              className="group flex items-center gap-4 rounded-xl border bg-card p-5 transition-colors hover:bg-accent"
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold tracking-tight">{role.title}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">{role.team}</Badge>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {role.location}
                  </span>
                  <span>{role.type}</span>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </Section>

      <section className="py-20 md:py-28">
        <div className="container-narrow text-center">
          <h2 className="text-balance font-display text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
            Don't see your role?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
            We hire exceptional people regardless of the job description. If you
            think you'd be a great addition, tell us why.
          </p>
          <div className="mt-8">
            <Link href="/contact">
              <Button size="lg" className="gap-1.5">
                Send a general application
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
