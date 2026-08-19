import { Server, Database, Zap, Clock, Code2, Layers } from "lucide-react";
import { ProductPage } from "@/components/marketing/product-page-template";

export const metadata = { title: "Batch Processing", description: "Run large jobs asynchronously at 50% of the cost. 24-hour SLA." };

export default function BatchPage() {
  return (
    <ProductPage
      badge="Batch Processing"
      title="Large jobs,"
      highlight="at half the price."
      description="Submit a million requests. Get results within 24 hours. Same models, same APIs, half the cost. Perfect for evals, bulk classification, dataset processing."
      features={[
        { icon: Server, title: "Async by default", body: "Submit a job, get a webhook, download results. No need to hold a connection." },
        { icon: Clock, title: "24-hour SLA", body: "Most jobs complete in 2-4 hours. Hard guarantee: 24 hours or the job is free." },
        { icon: Zap, title: "50% of sync pricing", body: "Same quality, same reliability, half the cost. The trade is time, not quality." },
        { icon: Layers, title: "Up to 100K per job", body: "Submit up to 100,000 requests per batch. Larger jobs queued automatically." },
        { icon: Code2, title: "Standard format", body: "JSONL input, JSONL output. Drop-in compatible with the OpenAI Batch API." },
        { icon: Database, title: "Persistent storage", body: "Results stored for 30 days. Download via signed URL." },
      ]}
      pricing={[
        { label: "Chat batch", price: "0.0002", unit: "QUBIC / 1K tokens", note: "50% of sync rate" },
        { label: "Embedding batch", price: "0.00006", unit: "QUBIC / 1K tokens", note: "60% of sync rate" },
        { label: "Image batch", price: "0.0040", unit: "QUBIC / image", note: "50% of sync rate" },
        { label: "Reasoning batch", price: "0.0012", unit: "QUBIC / 1K tokens", note: "50% of sync rate" },
      ]}
      benefits={[
        "Same accuracy, half the cost",
        "Webhook callbacks for job completion",
        "24-hour SLA or the job is free",
        "Results downloadable for 30 days",
        "Re-billable to internal cost centers",
        "Bulk processing at petabyte scale",
        "Migration from OpenAI Batch API in days",
        "Quarterly business reviews and volume discounts",
      ]}
      example={{
        title: "batch.py",
        code: `from aigarth import Aigarth

client = Aigarth(api_key="sk-aigarth-...")

# Submit a batch of classification requests
with open("requests.jsonl") as f:
    job = client.batches.create(
        input_file="file-abc123",
        endpoint="/v1/chat/completions",
        completion_window="24h",
    )

# Wait for completion (or use webhook)
result = job.wait()
print(f"Processed {result.request_counts.completed} requests")`,
      }}
      stakingRequirements={[
        { tier: "Builder", stake: "50M QUBIC", access: "Batch API enabled" },
        { tier: "Startup", stake: "150M QUBIC", access: "Larger jobs, priority queue" },
        { tier: "Business", stake: "500M QUBIC", access: "Custom windows, dedicated capacity" },
        { tier: "Enterprise", stake: "Custom", access: "On-prem, custom SLA" },
      ]}
    />
  );
}
