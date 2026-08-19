import { Zap, Brain, Code2, GitBranch, Wrench, Sparkles } from "lucide-react";
import { ProductPage } from "@/components/marketing/product-page-template";

export const metadata = { title: "Agents", description: "Multi-step AI workflows. Plan, tool use, self-correction." };

export default function AgentsPage() {
  return (
    <ProductPage
      badge="Agents"
      title="Autonomous AI workflows,"
      highlight="that finish the job."
      description="Multi-step agents with planning, tool use, memory, and self-correction. Drop-in SDK. Composable with the rest of the Aigarth platform."
      features={[
        { icon: Brain, title: "Plan and execute", body: "Agents break down goals, plan steps, and execute. Self-correct on failure." },
        { icon: Wrench, title: "Tool use", body: "Function calling, code execution, web browsing, file system, your custom tools." },
        { icon: GitBranch, title: "Branching workflows", body: "Parallel execution, conditional logic, error recovery. Complex agentic flows." },
        { icon: Code2, title: "Drop-in SDK", body: "Define an agent in 20 lines. Deploy to the network. Scale automatically." },
        { icon: Sparkles, title: "Memory", body: "Short-term conversation, long-term vector memory, structured state." },
        { icon: Zap, title: "Observable", body: "Trace every step, tool call, and decision. Debug visually." },
      ]}
      pricing={[
        { label: "Standard", price: "0.004", unit: "QUBIC / step", note: "Plus token cost" },
        { label: "Tool calls", price: "0.0001", unit: "QUBIC / call", note: "Plus underlying token cost" },
        { label: "Code exec", price: "0.012", unit: "QUBIC / minute", note: "Sandboxed, isolated" },
        { label: "Memory storage", price: "0.0002", unit: "QUBIC / MB / day", note: "Long-term persistence" },
      ]}
      benefits={[
        "Deploy agents to production in hours",
        "Built-in rate limiting and cost controls",
        "Human-in-the-loop checkpoints",
        "A/B testing across agent versions",
        "Compliance with audit trail for every step",
        "Migration from LangChain, CrewAI, AutoGen",
        "On-prem deployment for sensitive workflows",
        "Quarterly business reviews and roadmap input",
      ]}
      example={{
        title: "agent.py",
        code: `from aigarth import Agent, tool

@tool
def search_docs(query: str) -> list[dict]:
    return aigarth_client.search(query, limit=5)

agent = Agent(
    model="aigarth-reason-1",
    tools=[search_docs],
    system="You are a research assistant. Be thorough.",
)

result = agent.run("What's the latest on useful proof of staking?")
print(result.answer)`,
      }}
      stakingRequirements={[
        { tier: "Builder", stake: "50M QUBIC", access: "Agent SDK, basic workflows" },
        { tier: "Startup", stake: "150M QUBIC", access: "Persistent memory, code exec" },
        { tier: "Business", stake: "500M QUBIC", access: "Custom tools, A/B testing" },
        { tier: "Enterprise", stake: "Custom", access: "On-prem, dedicated capacity" },
      ]}
    />
  );
}
