import { Brain, Zap, Cpu, Shield, Sparkles, Globe, Code2 } from "lucide-react";
import { ProductPage } from "@/components/marketing/product-page-template";

export const metadata = {
  title: "AI Inference",
  description: "OpenAI-compatible APIs at the speed of thought. Drop-in replacement with better economics.",
};

export default function InferencePage() {
  return (
    <ProductPage
      badge="AI Inference"
      title="OpenAI-compatible APIs."
      highlight="A fraction of the cost."
      description="Drop-in replacement for the OpenAI SDK. Same endpoints, same shapes, dramatically better economics. Run any model: from frontier open models to your own fine-tunes."
      features={[
        { icon: Brain, title: "Any model", body: "Frontier open models, fine-tunes, custom weights. If it can run, we serve it." },
        { icon: Zap, title: "Sub-50ms P50", body: "Edge routing, regional clusters, and tiered capacity keep latency low at any scale." },
        { icon: Code2, title: "OpenAI-compatible", body: "Same endpoints. Same request and response shape. Switch by changing the base URL." },
        { icon: Cpu, title: "Streaming first", body: "Server-sent events, tool use, function calling, structured outputs. All first-class." },
        { icon: Shield, title: "Verifiable", body: "Every call produces a signed receipt. Output hashes recorded on-chain." },
        { icon: Globe, title: "47 regions", body: "Compute where your users are. Sub-50ms anywhere with a network connection." },
      ]}
      pricing={[
        { label: "Chat", price: "0.0004", unit: "QUBIC / 1K tokens", note: "Input tokens. Output at 3× input." },
        { label: "Reasoning", price: "0.0024", unit: "QUBIC / 1K tokens", note: "Chain-of-thought, longer context." },
        { label: "Vision", price: "0.0080", unit: "QUBIC / image", note: "Up to 1024×1024 resolution." },
        { label: "Embeddings", price: "0.0001", unit: "QUBIC / 1K tokens", note: "Batched at 256 texts/request." },
        { label: "Voice TTS", price: "0.012", unit: "QUBIC / 1K characters", note: "47 voices, 31 languages." },
        { label: "Voice STT", price: "0.006", unit: "QUBIC / minute", note: "Speaker diarization included." },
      ]}
      benefits={[
        "Dedicated clusters with predictable performance",
        "On-prem and air-gapped deployment",
        "SOC 2, ISO 27001, HIPAA compliance",
        "Private networking and BYO encryption",
        "24/7 on-call with 15-minute P1 response",
        "Custom SLAs with financial compensation",
        "Migration assistance from your current provider",
        "Quarterly business reviews with a named CSM",
      ]}
      example={{
        title: "inference.py",
        code: `from aigarth import Aigarth

client = Aigarth(api_key="sk-aigarth-...")

response = client.chat.create(
    model="aigarth-reason-1",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "What's the capital of France?"},
    ],
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")`,
      }}
      stakingRequirements={[
        { tier: "Explorer", stake: "10M QUBIC", access: "Best-effort, shared pool" },
        { tier: "Builder", stake: "50M QUBIC", access: "Reserved throughput, 25% burn discount" },
        { tier: "Startup", stake: "150M QUBIC", access: "Dedicated cluster, 40% burn discount" },
        { tier: "Business", stake: "500M QUBIC", access: "Enterprise SLA, 55% burn discount" },
        { tier: "Enterprise", stake: "Custom", access: "Custom infrastructure and SLAs" },
      ]}
    />
  );
}
