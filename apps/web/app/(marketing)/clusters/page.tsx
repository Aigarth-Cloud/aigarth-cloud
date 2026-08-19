import { Server, Cpu, Network, Shield, Layers, Globe } from "lucide-react";
import { ProductPage } from "@/components/marketing/product-page-template";

export const metadata = { title: "Compute Clusters", description: "Dedicated GPU clusters for sustained workloads. Single-tenant, multi-region." };

export default function ClustersPage() {
  return (
    <ProductPage
      badge="Compute Clusters"
      title="Dedicated GPU clusters,"
      highlight="ready in minutes."
      description="Reserve specific GPU types with guaranteed availability. Multi-region replication. Sustained performance for production workloads."
      features={[
        { icon: Server, title: "Specific GPU types", body: "H100, A100, MI300X, and emerging accelerators. Pin your model to a hardware family." },
        { icon: Cpu, title: "Multi-GPU, multi-node", body: "Up to 1,024 GPUs in a single cluster. NVLink, InfiniBand, RoCE." },
        { icon: Globe, title: "Multi-region", body: "Replicate clusters across 47 regions. Sub-50ms anywhere." },
        { icon: Network, title: "Predictable network", body: "Up to 400GbE between nodes. Tuned for distributed training and inference." },
        { icon: Layers, title: "Hot-swap", body: "Add or remove nodes without downtime. Auto-scale to demand." },
        { icon: Shield, title: "Single-tenant", body: "Your cluster. Your data. No noisy neighbors. No cross-tenant access." },
      ]}
      pricing={[
        { label: "H100 cluster", price: "2.40", unit: "QUBIC / GPU-hr", note: "On-demand, single-tenant" },
        { label: "A100 cluster", price: "0.84", unit: "QUBIC / GPU-hr", note: "On-demand, single-tenant" },
        { label: "MI300X cluster", price: "1.80", unit: "QUBIC / GPU-hr", note: "On-demand, single-tenant" },
        { label: "Reserved (1yr)", price: "1.20", unit: "QUBIC / GPU-hr", note: "H100, 50% discount" },
      ]}
      benefits={[
        "Single-tenant, dedicated infrastructure",
        "Predictable performance, no noisy neighbors",
        "Multi-region replication for global apps",
        "On-prem deployment option",
        "Custom hardware configurations",
        "24/7 on-call with 15-minute P1 response",
        "Migration assistance from AWS, GCP, Azure",
        "Quarterly business reviews",
      ]}
      example={{
        title: "cluster.py",
        code: `from aigarth import Aigarth

client = Aigarth(api_key="sk-aigarth-...")

# Provision a dedicated cluster
cluster = client.clusters.create(
    name="heli-prod",
    hardware="8x H100",
    region="us-east-1",
    replicas=3,
)

print(f"Cluster ready: {cluster.id}")

# Submit inference jobs
job = client.inference.submit(
    cluster=cluster.id,
    model="aigarth-reason-1",
    prompt="Hello, world!",
)`,
      }}
      stakingRequirements={[
        { tier: "Startup", stake: "150M QUBIC", access: "Dedicated cluster, single region" },
        { tier: "Business", stake: "500M QUBIC", access: "Multi-region, custom hardware" },
        { tier: "Enterprise", stake: "Custom", access: "On-prem, private infrastructure" },
      ]}
    />
  );
}
