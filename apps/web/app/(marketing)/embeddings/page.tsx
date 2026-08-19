import { Database, Zap, Cpu, Shield, Globe, Code2 } from "lucide-react";
import { ProductPage } from "@/components/marketing/product-page-template";

export const metadata = {
  title: "Embeddings",
  description: "High-dimensional vector representations. Fast, accurate, and cheap.",
};

export default function EmbeddingsPage() {
  return (
    <ProductPage
      badge="Embeddings"
      title="Vector representations,"
      highlight="at the speed of memory."
      description="Embed 1M tokens in 1.2 seconds. Multi-lingual, multi-modal, batched by default. The same API as OpenAI, with sub-millisecond P50 at scale."
      features={[
        { icon: Database, title: "1536 / 3072 dimensions", body: "Two tiers. Small for retrieval at scale, large for nuanced semantic search." },
        { icon: Zap, title: "Sub-millisecond P50", body: "Batched inference and a custom kernel keep latency low at 10K vectors per second." },
        { icon: Code2, title: "OpenAI-compatible", body: "Same /v1/embeddings endpoint. Same request shape. Switch by changing the base URL." },
        { icon: Cpu, title: "Multi-modal", body: "Text, image, audio: same vector space. Cross-modal search out of the box." },
        { icon: Globe, title: "100+ languages", body: "Multilingual by design. No separate model per language." },
        { icon: Shield, title: "Batched privacy", body: "Embeddings are not stored unless you opt in. We compute, return, and forget." },
      ]}
      pricing={[
        { label: "Small (1536d)", price: "0.0001", unit: "QUBIC / 1K tokens", note: "Best for retrieval at scale" },
        { label: "Large (3072d)", price: "0.0002", unit: "QUBIC / 1K tokens", note: "Best for nuanced semantics" },
        { label: "Multi-modal", price: "0.0004", unit: "QUBIC / 1K tokens", note: "Text + image + audio" },
        { label: "Batched (>1M)", price: "0.00006", unit: "QUBIC / 1K tokens", note: "Async batch API" },
      ]}
      benefits={[
        "Dedicated vector index capacity",
        "Co-located with managed Pinecone, Weaviate, Qdrant",
        "Migration from OpenAI, Cohere, Voyage in days",
        "HIPAA-aligned data handling",
        "PII redaction in pre-processing pipeline",
        "Multi-region replication for global apps",
        "SOC 2 and ISO 27001 (in progress)",
        "24/7 on-call for production incidents",
      ]}
      example={{
        title: "embeddings.py",
        code: `from aigarth import Aigarth

client = Aigarth(api_key="sk-aigarth-...")

texts = [
    "What is Useful Proof of Staking?",
    "How does Aigarth work?",
    "Best pizza in New York",
]

response = client.embeddings.create(
    model="aigarth-embed-1-large",
    input=texts,
)

vectors = [item.embedding for item in response.data]
print(f"Embedded {len(vectors)} texts at {len(vectors[0])} dimensions")`,
      }}
      stakingRequirements={[
        { tier: "Explorer", stake: "10M QUBIC", access: "Best-effort, 60 RPS" },
        { tier: "Builder", stake: "50M QUBIC", access: "Reserved, 600 RPS" },
        { tier: "Startup", stake: "150M QUBIC", access: "Dedicated, 6K RPS" },
        { tier: "Business", stake: "500M QUBIC", access: "Burst to 60K RPS" },
        { tier: "Enterprise", stake: "Custom", access: "Unlimited" },
      ]}
    />
  );
}
