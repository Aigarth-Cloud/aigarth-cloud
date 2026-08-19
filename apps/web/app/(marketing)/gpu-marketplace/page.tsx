import { Cpu, ShoppingBag, TrendingUp, Globe, Network, DollarSign } from "lucide-react";
import { ProductPage } from "@/components/marketing/product-page-template";

export const metadata = { title: "GPU Marketplace", description: "Lease, buy, sell, and auction compute. Live market depth. Historical pricing." };

export default function GPUMarketplacePage() {
  return (
    <ProductPage
      badge="GPU Marketplace"
      title="The compute market."
      description="Lease compute from operators. Sell your idle capacity. Reserve future capacity. Auction workloads. The most liquid GPU market in crypto."
      features={[
        { icon: ShoppingBag, title: "Buy & lease", body: "Spot pricing, reserved capacity, futures. Pick the model that fits your workload." },
        { icon: TrendingUp, title: "Live market depth", body: "Real-time order book. Price discovery across regions and hardware types." },
        { icon: DollarSign, title: "Sell your idle", body: "Staked but unused capacity auto-listed. Earn while you're not training." },
        { icon: Globe, title: "47 regions", body: "Markets by region. Buy in Frankfurt, sell in Tokyo. Arbitrage the spread." },
        { icon: Network, title: "Auction workloads", body: "Big jobs? Auction to the lowest-bid provider. Save 30-60% on burst workloads." },
        { icon: Cpu, title: "Any hardware", body: "H100, A100, MI300X, emerging accelerators. Future-proof your infrastructure." },
      ]}
      pricing={[
        { label: "Spot H100", price: "1.80", unit: "QUBIC / GPU-hr", note: "Best-effort, interruptible" },
        { label: "Reserved H100", price: "1.20", unit: "QUBIC / GPU-hr", note: "1-year commitment" },
        { label: "Spot A100", price: "0.64", unit: "QUBIC / GPU-hr", note: "Best-effort, interruptible" },
        { label: "Reserved A100", price: "0.42", unit: "QUBIC / GPU-hr", note: "1-year commitment" },
      ]}
      benefits={[
        "Lower prices than hyperscalers on burst workloads",
        "Earn yield on idle capacity automatically",
        "Future markets for predictable capacity planning",
        "Arbitrage opportunities across regions",
        "Programmatic trading API",
        "Migration from AWS Spot, GCP Preemptible",
        "Used by Helix Labs, Atlas Robotics, Aurora Audio",
        "Dedicated account management for large traders",
      ]}
      example={{
        title: "marketplace.py",
        code: `from aigarth import Aigarth

client = Aigarth(api_key="sk-aigarth-...")

# Buy spot capacity
order = client.marketplace.buy(
    hardware="H100",
    quantity=8,
    duration="24h",
    max_price="1.80",
)

# Sell your idle capacity
listing = client.marketplace.sell(
    hardware="A100",
    quantity=4,
    min_price="0.64",
    duration="unlimited",
)`,
      }}
      stakingRequirements={[
        { tier: "Builder", stake: "50M QUBIC", access: "Marketplace access, buy only" },
        { tier: "Startup", stake: "150M QUBIC", access: "Buy + sell, futures markets" },
        { tier: "Business", stake: "500M QUBIC", access: "Auction workloads, large orders" },
        { tier: "Enterprise", stake: "Custom", access: "Programmatic trading, custom markets" },
      ]}
    />
  );
}
