import { MarketingPageHero, Section, FeatureGrid } from "@/components/marketing/marketing-page";
import { Code2, Terminal, Cpu, Sparkles, Key, BookOpen, ArrowRight, Github, Boxes } from "lucide-react";
import Link from "next/link";
import { Button } from "@aigarth/ui";
import { Badge } from "@aigarth/ui";

export const metadata = {
  title: "Developers",
  description: "Ship AI in five lines. SDKs in every major language. Drop-in OpenAI replacement.",
};

const SDKS = [
  { lang: "Python", pkg: "pip install aigarth", icon: "py" },
  { lang: "TypeScript", pkg: "npm install aigarth", icon: "ts" },
  { lang: "Go", pkg: "go get aigarth.cloud/sdk", icon: "go" },
  { lang: "Rust", pkg: "cargo add aigarth", icon: "rs" },
  { lang: "Java", pkg: "implementation 'cloud.aigarth:sdk'", icon: "java" },
  { lang: "C#", pkg: "dotnet add package Aigarth", icon: "cs" },
];

export default function DevelopersPage() {
  return (
    <>
      <MarketingPageHero
        badge="Developers"
        title="Ship AI in five lines."
        description="OpenAI-compatible APIs. SDKs in every major language. Drop-in replacement. Better economics."
        primaryCta={{ label: "Read the docs", href: "/docs" }}
        secondaryCta={{ label: "Open the console", href: "/dashboard" }}
      />

      <Section
        title="Quickstart"
        description="If you've used OpenAI, you've used Aigarth."
      >
        <div className="rounded-3xl border bg-card p-6 md:p-10">
          <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-garden-500/70" />
            <span className="ml-2 font-mono">main.py</span>
          </div>
          <pre className="overflow-x-auto rounded-xl bg-muted/30 p-6 text-sm leading-relaxed">
            <code className="font-mono">
{`from aigarth import Aigarth

client = Aigarth(api_key="sk-aigarth-...")

response = client.chat.create(
    model="aigarth-reason-1",
    messages=[
        {"role": "user", "content": "Explain Useful Proof of Staking in 3 sentences."}
    ],
)

print(response.choices[0].message.content)`}
            </code>
          </pre>
        </div>
      </Section>

      <Section
        title="SDKs for every stack"
        description="Idiomatic libraries in the languages your team already uses."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SDKS.map((sdk) => (
            <div key={sdk.lang} className="rounded-2xl border bg-card p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-medium text-primary">
                  {sdk.icon}
                </div>
                <div>
                  <h3 className="font-semibold tracking-tight">{sdk.lang}</h3>
                  <code className="text-xs text-muted-foreground">{sdk.pkg}</code>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <FeatureGrid
        features={[
          { icon: Code2, title: "OpenAI-compatible", body: "Same endpoints, same request shape, same response format. Switch by changing the base URL." },
          { icon: Terminal, title: "Powerful CLI", body: "Auth, run, deploy, monitor, and govern from your terminal. Scriptable for CI/CD." },
          { icon: Cpu, title: "Streaming & async", body: "First-class streaming, async/await, and tool use. Built for production applications." },
          { icon: Key, title: "Scoped keys", body: "Per-project keys, environment separation, IP allowlists, and per-key spend caps." },
          { icon: Sparkles, title: "Live playground", body: "Try any model from your browser. Inspect latency, tokens, and cost in real time." },
          { icon: BookOpen, title: "Comprehensive docs", body: "API reference, guides, recipes, examples. Searchable, versioned, complete." },
        ]}
      />

      <Section
        title="Open source"
        description="SDKs, CLI, and core protocol are open source. Inspect, fork, contribute."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { name: "aigarth/sdk-python", stars: "2.4K", desc: "Python SDK with sync/async, streaming, and full type hints." },
            { name: "aigarth/sdk-typescript", stars: "1.8K", desc: "TypeScript SDK. Works in Node, Bun, Deno, and the browser." },
            { name: "aigarth/cli", stars: "892", desc: "Command-line interface for auth, deploy, monitor, and govern." },
            { name: "aigarth/protocol", stars: "4.1K", desc: "Core protocol implementation. Reference for network operators." },
          ].map((repo) => (
            <div key={repo.name} className="rounded-2xl border bg-card p-6">
              <div className="flex items-center gap-2 font-mono text-sm">
                <Github className="h-4 w-4" />
                {repo.name}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{repo.desc}</p>
              <div className="mt-3 text-xs text-muted-foreground">★ {repo.stars}</div>
            </div>
          ))}
        </div>
      </Section>

      <section className="py-20 md:py-28">
        <div className="container-narrow text-center">
          <h2 className="text-balance font-display text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
            Start building in 60 seconds.
          </h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/docs">
              <Button size="lg" className="gap-1.5">
                Read the docs
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline">Generate an API key</Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
