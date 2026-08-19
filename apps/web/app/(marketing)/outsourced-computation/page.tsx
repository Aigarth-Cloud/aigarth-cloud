import { Server, Cpu, Shield, Zap, Database, Network } from "lucide-react";
import { MarketingPageHero, Section, FeatureGrid } from "@/components/marketing/marketing-page";
import Link from "next/link";
import { Button } from "@aigarth/ui";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "Outsourced Computation",
  description: "Offload heavy computation to a verified, decentralized network. Cryptographic receipts. No lock-in.",
};

export default function OutsourcedComputationPage() {
  return (
    <>
      <MarketingPageHero
        badge="Outsourced Computation"
        title="Heavy compute, verified and decentralized."
        description="Render farms, scientific simulations, financial modeling, batch ETL  ” run on the Aigarth network. Cryptographic receipts included."
        primaryCta={{ label: "Start a job", href: "/dashboard" }}
        secondaryCta={{ label: "Read docs", href: "/docs" }}
      />

      <FeatureGrid
        features={[
          { icon: Server, title: "Any workload", body: "CPU, GPU, or mixed. Containerized jobs. Long-running or batch. The network handles scheduling and fault tolerance." },
          { icon: Shield, title: "Verifiable", body: "Every job produces a cryptographic receipt. Output hashes are signed and published. Audit any result." },
          { icon: Zap, title: "Burst capacity", body: "Spike to thousands of nodes when you need them. Pay only for what you use. No commitments." },
          { icon: Cpu, title: "GPU support", body: "H100, A100, MI300X. Multi-GPU jobs. Distributed training across nodes." },
          { icon: Database, title: "Petabyte storage", body: "Mount distributed storage to your jobs. Stream inputs and outputs. Pay per GB." },
          { icon: Network, title: "Pay in QUBIC", body: "No credit card. Stake to access compute at a discount. Burn on idle. Earn on usage." },
        ]}
      />

      <Section
        title="Use cases"
        description="If you can containerize it, you can run it on Aigarth."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: "Scientific simulation", body: "Molecular dynamics, climate models, CFD, genomics." },
            { title: "Financial modeling", body: "Monte Carlo, risk sims, backtesting at scale." },
            { title: "Render farms", body: "Animation, VFX, architectural visualization." },
            { title: "Batch ETL", body: "Process terabytes nightly. Cheaper than reserved cloud." },
            { title: "Distributed training", body: "Multi-node model training. Horovod, DeepSpeed, FSDP." },
            { title: "Image & video processing", body: "Transcoding, batch processing, watermark application." },
          ].map((u) => (
            <div key={u.title} className="rounded-2xl border bg-card p-6">
              <h3 className="font-semibold tracking-tight">{u.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{u.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Architecture"
        description="Submit a job. The scheduler finds the lowest-cost, lowest-latency workers. Outputs are signed and replicated."
      >
        <div className="rounded-3xl border bg-card p-6 md:p-10">
          <pre className="overflow-x-auto rounded-xl bg-muted/30 p-6 text-sm leading-relaxed">
            <code className="font-mono">
{`# Submit a job to the network
import aigarth

client = aigarth.Client(api_key="sk-...")

job = client.compute.submit(
    image="docker.io/myorg/sim:latest",
    command=["./run", "--scale", "1000"],
    gpu="H100",
    replicas=64,
    timeout="6h",
)

# Poll for completion
result = job.wait()
print(f"Job complete: {result.output_hash}")`}
            </code>
          </pre>
        </div>
      </Section>

      <section className="py-20 md:py-28">
        <div className="container-narrow text-center">
          <h2 className="text-balance font-display text-4xl font-medium leading-[1.1] tracking-tight md:text-5xl">
            Run heavy work without renting hardware.
          </h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/dashboard">
              <Button size="lg" className="gap-1.5">
                Submit a job
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/docs">
              <Button size="lg" variant="outline">API reference</Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
