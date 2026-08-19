import { Sparkles, Brain, Zap, Code2, GitBranch, FileText } from "lucide-react";
import { ProductPage } from "@/components/marketing/product-page-template";

export const metadata = { title: "Reasoning Models", description: "Chain-of-thought models for complex tasks. Math, science, code, logic." };

export default function ReasoningPage() {
  return (
    <ProductPage
      badge="Reasoning Models"
      title="Models that think"
      highlight="before they answer."
      description="Chain-of-thought models for tasks that require planning, math, science, code, and multi-step logic. Same API as chat, smarter results."
      features={[
        { icon: Brain, title: "Chain-of-thought", body: "Models think through problems step by step. Higher accuracy on math, logic, and code." },
        { icon: GitBranch, title: "Tool use", body: "Reasoning models can call functions, browse, and execute code. Multi-step agent loops out of the box." },
        { icon: FileText, title: "128K context", body: "Reason over entire codebases, papers, or books. Citations to source material." },
        { icon: Sparkles, title: "Self-verification", body: "Models check their own work. Higher accuracy on high-stakes outputs." },
        { icon: Code2, title: "Same API", body: "Drop-in replacement. Reasoning is just another model parameter." },
        { icon: Zap, title: "Streaming tokens", body: "Watch the model think in real time. Inspect intermediate steps for debugging." },
      ]}
      pricing={[
        { label: "Reason-1 (fast)", price: "0.0024", unit: "QUBIC / 1K tokens", note: "P50 1.8s, 32K context" },
        { label: "Reason-1 (deep)", price: "0.0080", unit: "QUBIC / 1K tokens", note: "P50 6s, 128K context" },
        { label: "Reason-1 (max)", price: "0.024", unit: "QUBIC / 1K tokens", note: "P50 24s, 256K context" },
        { label: "Tool calls", price: "0.0001", unit: "QUBIC / call", note: "Plus underlying token cost" },
      ]}
      benefits={[
        "Best-in-class accuracy on math and reasoning benchmarks",
        "Self-verification reduces hallucinations in production",
        "Citations and source attribution for every answer",
        "Tool use without separate orchestration SDK",
        "Streaming tokens let users see the model think",
        "Used by Helix Labs, Vector Capital, Lumen Legal",
        "Migration from o1, o3-mini, Claude with extended thinking",
        "On-prem deployment for sensitive workloads",
      ]}
      example={{
        title: "reasoning.py",
        code: `from aigarth import Aigarth

client = Aigarth(api_key="sk-aigarth-...")

response = client.chat.create(
    model="aigarth-reason-1-deep",
    messages=[
        {"role": "user", "content": "A train leaves Boston at 9am at 60mph. Another leaves NYC at 10am at 80mph. When do they meet?"},
    ],
)

# Inspect the reasoning
for step in response.choices[0].message.reasoning_steps:
    print(step)
print("Answer:", response.choices[0].message.content)`,
      }}
      stakingRequirements={[
        { tier: "Builder", stake: "50M QUBIC", access: "All reasoning models, best-effort" },
        { tier: "Startup", stake: "150M QUBIC", access: "Reserved throughput, deep + max" },
        { tier: "Business", stake: "500M QUBIC", access: "Custom reasoning models" },
        { tier: "Enterprise", stake: "Custom", access: "On-prem, private models" },
      ]}
    />
  );
}
