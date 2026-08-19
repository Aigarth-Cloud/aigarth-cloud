import { MarketingPageHero, Section, FeatureGrid } from "@/components/marketing/marketing-page";
import { ArrowRight, BookOpen, Code2, Terminal, Sparkles, Cpu, FileText, Github } from "lucide-react";
import Link from "next/link";
import { Button } from "@aigarth/ui";
import { Input } from "@aigarth/ui";
import { Search } from "lucide-react";

export const metadata = {
  title: "Documentation",
  description: "Everything you need to build on Aigarth.",
};

const SECTIONS = [
  {
    title: "Getting started",
    items: [
      { name: "Quickstart", href: "/docs", desc: "Ship your first call in 5 minutes." },
      { name: "Authentication", href: "/docs", desc: "API keys, scopes, and security." },
      { name: "OpenAI compatibility", href: "/docs", desc: "Migrate in an afternoon." },
    ],
  },
  {
    title: "SDKs",
    items: [
      { name: "Python", href: "/docs", desc: "pip install aigarth" },
      { name: "TypeScript", href: "/docs", desc: "npm install aigarth" },
      { name: "Go", href: "/docs", desc: "go get aigarth.cloud/sdk" },
      { name: "Rust", href: "/docs", desc: "cargo add aigarth" },
      { name: "Java", href: "/docs", desc: "Maven, Gradle" },
      { name: "C#", href: "/docs", desc: "NuGet" },
    ],
  },
  {
    title: "API reference",
    items: [
      { name: "Chat completions", href: "/docs", desc: "OpenAI-compatible" },
      { name: "Embeddings", href: "/docs", desc: "Vector representations" },
      { name: "Image generation", href: "/docs", desc: "Photorealistic and artistic" },
      { name: "Voice", href: "/docs", desc: "TTS and STT" },
      { name: "Fine-tuning", href: "/docs", desc: "Custom models" },
      { name: "Agents", href: "/docs", desc: "Multi-step workflows" },
    ],
  },
  {
    title: "Guides",
    items: [
      { name: "ANN lifecycle", href: "/anns", desc: "Train, version, license, earn." },
      { name: "Staking strategies", href: "/useful-proof-of-staking", desc: "Maximize yield." },
      { name: "Production patterns", href: "/docs", desc: "Scaling, retries, observability." },
      { name: "Cost optimization", href: "/docs", desc: "Smart routing, batching." },
    ],
  },
];

export default function DocsPage() {
  return (
    <>
      <MarketingPageHero
        badge="Documentation"
        title="Build on Aigarth."
        description="Searchable, versioned, complete. Everything you need to ship production AI."
      />

      <section className="border-b py-12">
        <div className="container-wide">
          <div className="relative mx-auto max-w-2xl">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search the docs..."
              className="h-12 pl-11 text-base"
            />
            <kbd className="absolute right-4 top-1/2 -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              ⌘K
            </kbd>
          </div>
        </div>
      </section>

      <Section
        title="Browse by section"
        description="Find what you need, fast."
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SECTIONS.map((section) => (
            <div key={section.title} className="rounded-2xl border bg-card p-6">
              <h3 className="font-semibold tracking-tight">{section.title}</h3>
              <ul className="mt-4 space-y-3">
                {section.items.map((item) => (
                  <li key={item.name}>
                    <Link href={item.href} className="group block">
                      <div className="text-sm font-medium group-hover:text-primary">
                        {item.name}
                      </div>
                      <div className="text-xs text-muted-foreground">{item.desc}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <FeatureGrid
        features={[
          { icon: BookOpen, title: "Searchable", body: "Full-text search across docs, API reference, and guides." },
          { icon: Code2, title: "Runnable examples", body: "Copy-pasteable code in every major language, with live results." },
          { icon: Terminal, title: "CLI reference", body: "Every command documented, with examples and flags." },
          { icon: Sparkles, title: "Versioned", body: "Docs follow releases. Pin to a version or follow main." },
          { icon: Cpu, title: "API playground", body: "Try any endpoint from the browser, with your own API key." },
          { icon: Github, title: "Open source", body: "Docs site, examples, and snippets are all on GitHub." },
        ]}
      />

      <section className="py-20 md:py-28">
        <div className="container-narrow text-center">
          <h2 className="text-balance font-display text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
            Can't find what you need?
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
            Ask the developer community on Discord, or open an issue on GitHub.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/contact">
              <Button size="lg" className="gap-1.5">
                Join Discord
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline">Try the playground</Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
