import { MarketingPageHero, Section } from "@/components/marketing/marketing-page";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@aigarth/ui";

export const metadata = {
  title: "About",
  description: "Aigarth is the AI cloud built on Qubic. Our mission: make intelligent infrastructure a public good.",
};

const VALUES = [
  { title: "Compute is a public good", body: "Intelligent infrastructure should be accessible to everyone, not locked behind hyperscalers." },
  { title: "Capital should be productive", body: "Staking shouldn't just dilute supply. It should build real, useful infrastructure." },
  { title: "Trust through proof", body: "Not promises. Not certifications. Cryptographic receipts anyone can verify." },
  { title: "Open wins", body: "Open source, open standards, open markets. Closed systems get outgrown." },
];

const TEAM = [
  { name: "Elena Voss", role: "CEO & Co-founder", prev: "Previously: VP Engineering, Stripe" },
  { name: "Marcus Tao", role: "CTO & Co-founder", prev: "Previously: Principal Engineer, Anthropic" },
  { name: "Sana Okonkwo", role: "Chief Design Officer", prev: "Previously: Head of Design, Linear" },
  { name: "Daniel Reyes", role: "VP Product", prev: "Previously: Group PM, OpenAI" },
  { name: "Yuki Tanaka", role: "VP Research", prev: "Previously: Research Lead, DeepMind" },
  { name: "Liam O'Brien", role: "VP Engineering", prev: "Previously: Director of Engineering, Vercel" },
];

export default function AboutPage() {
  return (
    <>
      <MarketingPageHero
        badge="About"
        title="The AI cloud, owned by everyone."
        description="Aigarth exists to make intelligent infrastructure a public good. We're building it on Qubic because staking aligns incentives in a way no cloud provider can."
        primaryCta={{ label: "Join the team", href: "/careers" }}
        secondaryCta={{ label: "Read the manifesto", href: "/blog" }}
      />

      <Section
        title="Our values"
        description="Four principles guide every decision we make."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {VALUES.map((v, i) => (
            <div key={v.title} className="rounded-2xl border bg-card p-7">
              <div className="text-xs uppercase tracking-wider text-garden-600 dark:text-garden-400">
                Principle 0{i + 1}
              </div>
              <h3 className="mt-2 text-xl font-semibold tracking-tight">{v.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{v.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Team"
        description="Engineers, designers, and researchers from the companies that defined modern AI."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TEAM.map((m) => (
            <div key={m.name} className="rounded-2xl border bg-card p-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-garden-500 to-emerald-500 text-lg font-medium text-white">
                {m.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <h3 className="mt-4 font-semibold tracking-tight">{m.name}</h3>
              <div className="text-xs text-garden-600 dark:text-garden-400">{m.role}</div>
              <p className="mt-2 text-xs text-muted-foreground">{m.prev}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Backed by"
        description="Investors who share the long-term vision."
      >
        <div className="grid grid-cols-2 items-center gap-x-12 gap-y-6 sm:grid-cols-4">
          {["Sequoia", "Andreessen Horowitz", "Paradigm", "Coatue", "Founders Fund", "Greylock", "Index", "Lightspeed"].map((name) => (
            <div key={name} className="text-center text-sm font-medium text-muted-foreground/80">
              {name}
            </div>
          ))}
        </div>
      </Section>

      <section className="py-20 md:py-28">
        <div className="container-narrow text-center">
          <h2 className="text-balance font-display text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
            Come build the future with us.
          </h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/careers">
              <Button size="lg" className="gap-1.5">
                See open roles
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline">Get in touch</Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
