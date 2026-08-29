import { MarketingPageHero, Section } from "@/components/marketing/marketing-page";
import { ArrowRight, Clock } from "lucide-react";
import Link from "next/link";
import { Button } from "@aigarth/ui";
import { Badge } from "@aigarth/ui";

export const metadata = {
  title: "Blog",
  description: "Product updates, engineering deep-dives, and ecosystem news from the Aigarth team.",
};

const POSTS = [
  {
    title: "From registry to execution: shipping the Execution Router",
    excerpt:
      "A registered ANN can now run locally or through Qubic OC, with the same manifest hash, the same input, and a deterministic result hash. Here is what we built and why it is the bridge to a real decentralized compute economy.",
    category: "Engineering",
    author: "Aigarth Cloud Team",
    date: "Aug 28, 2026",
    readTime: "8 min",
    href: "/blog/execution-router-ann-to-qubic-oc",
  },
  {
    title: "Epoch 227: a Qubic halving, and a marker for Aigarth Cloud",
    excerpt:
      "On August 19, 2026, Qubic enters its second halving. We have spent the last eight months building Aigarth Cloud. This is the moment we mark it in public.",
    category: "Vision",
    author: "Aigarth Cloud Team",
    date: "Aug 19, 2026",
    readTime: "6 min",
    href: "/blog/qubic-halving-epoch-227",
  },
  {
    title: "How we test a 12-service platform with 600+ tests and a 4-minute CI loop",
    excerpt:
      "Post 03 in the build-in-public series. The test architecture, the no-dev-server rule, and the dual-mode pg-mem harness that lets us ship a real-DB schema test in 4 minutes.",
    category: "Build in public",
    author: "Aigarth Cloud Team",
    date: "Aug 16, 2026",
    readTime: "6 min",
    href: "/blog/how-we-test-the-platform",
  },
  {
    title: "The 7 primitives and why each one is its own service",
    excerpt:
      "Post 02 in the build-in-public series. How we split Aigarth into 12 services, and why the 7 primitives are the right level to think at.",
    category: "Build in public",
    author: "Aigarth Cloud Team",
    date: "Aug 16, 2026",
    readTime: "6 min",
    href: "/blog/the-seven-primitives",
  },
  {
    title: "How Aigarth is built: the 90/10 split",
    excerpt:
      "The first post in our build-in-public series. The honest number, the pattern, and what it means if you are thinking about doing the same.",
    category: "Build in public",
    author: "Aigarth Cloud Team",
    date: "Aug 15, 2026",
    readTime: "5 min",
    href: "/blog/how-aigarth-is-built",
  },
  {
    title: "Why we built Aigarth: adaptive intelligence in everyone's hands",
    excerpt:
      "The vision behind the platform, the seven primitives that turn it into a product, and the roadmap to the first self-improving Organism.",
    category: "Vision",
    author: "Aigarth Cloud Team",
    date: "Aug 13, 2026",
    readTime: "7 min",
    href: "/blog/why-we-built-aigarth",
  },
  {
    title: "Eight months of Aigarth: from a single ANN to a 12-service platform",
    excerpt:
      "A look at the work between January and the August 12 checkpoint. Twenty-four phases, twelve services, and the team that made it real.",
    category: "Engineering",
    author: "Aigarth Cloud Team",
    date: "Aug 13, 2026",
    readTime: "9 min",
    href: "/blog/eight-months-of-aigarth",
  },
  {
    title: "The Aigarth evolution: what the Organism and Work Runtime just unlocked",
    excerpt:
      "Three weeks after the PEP was approved, the Organism primitive and the Work Runtime are live. Here is what that means, and what is next.",
    category: "Product",
    author: "Aigarth Cloud Team",
    date: "Aug 13, 2026",
    readTime: "8 min",
    href: "/blog/the-aigarth-evolution",
  },
  {
    title: "Use case: Aigarth Cloud as a collaborative ANN lab for material science",
    excerpt:
      "Eight small, specialized AIs, including Research Director, Literature, Simulation, Physics, Design, Optimization, Experiment, Validation, all collaborating to accelerate material discovery. The architecture compatibility assessment, the per-stage cost model (DFT dominates at 87%), and the Phase 1 re-evaluation gate.",
    category: "Use case",
    author: "Aigarth Cloud Team",
    date: "Aug 2, 2026",
    readTime: "24 min",
    href: "/use-cases/material-science",
  },
  {
    title: "Use case: Aigarth Cloud as a coordinator for AI video production",
    excerpt:
      "A swarm of small, specialized AIs, including Director, Camera, Motion, Depth, FX, Audio, Quality, all collaborating to produce useful video. The architecture compatibility assessment, the cost model, and the Phase 1 re-evaluation gate.",
    category: "Use case",
    author: "Aigarth Cloud Team",
    date: "Aug 1, 2026",
    readTime: "22 min",
    href: "/use-cases/video-synthesis",
  },
  {
    title: "Why we chose Useful Proof of Work for AI infrastructure",
    excerpt: "How Qubic's energy-as-payment model turns compute into a productive asset, not a recurring bill.",
    category: "Engineering",
    author: "Aigarth Cloud Team",
    date: "Jul 24, 2026",
    readTime: "8 min",
  },
  {
    title: "Designing the ANN marketplace",
    excerpt: "A look inside the decisions behind versioning, licensing, and revenue share.",
    category: "Design",
    author: "Aigarth Cloud Team",
    date: "Jul 18, 2026",
    readTime: "12 min",
  },
  {
    title: "Sub-50ms inference at 47 regions",
    excerpt: "How Aigarth's edge-to-cluster architecture keeps latency low while sustaining throughput.",
    category: "Engineering",
    author: "Aigarth Cloud Team",
    date: "Jul 12, 2026",
    readTime: "15 min",
  },
  {
    title: "The economics of staking",
    excerpt: "Why productive capital beats inflationary rewards for sustainable network growth.",
    category: "Research",
    author: "Aigarth Cloud Team",
    date: "Jul 5, 2026",
    readTime: "10 min",
  },
  {
    title: "Introducing Aigarth Seed",
    excerpt: "Our first edge device. Pre-orders open in Q3.",
    category: "Product",
    author: "Aigarth Cloud Team",
    date: "Jun 28, 2026",
    readTime: "4 min",
  },
  {
    title: "How we ship 200 deploys a day",
    excerpt: "Inside the Aigarth platform team: trunk-based development, canary deploys, and the people who run it.",
    category: "Engineering",
    author: "Aigarth Cloud Team",
    date: "Jun 22, 2026",
    readTime: "7 min",
  },
];

export default function BlogPage() {
  return (
    <>
      <MarketingPageHero
        badge="Blog"
        title="Notes from the Aigarth team."
        description="Product updates, engineering deep-dives, and the thinking behind the platform."
        primaryCta={{ label: "Subscribe to updates", href: "/contact" }}
      />

      <Section
        title="Latest"
        description="The newest posts from the team."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          {POSTS.map((post) => (
            <Link
              key={post.title}
              href={post.href ?? "/blog"}
              className="group block"
            >
            <article
              className="rounded-2xl border bg-card p-6 card-hover"
            >
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">{post.category}</Badge>
                <span>{post.date}</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {post.readTime}
                </span>
              </div>
              <h3 className="mt-3 text-lg font-semibold tracking-tight group-hover:text-primary">
                {post.title}
              </h3>
              <p className="mt-2 text-sm text-pretty text-muted-foreground">{post.excerpt}</p>
              <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
                <span>By {post.author}</span>
                <span className="inline-flex items-center gap-1 font-medium text-primary">
                  Read more
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </article>
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}
