import { Network, Database, Shield, Zap, Code2, Globe } from "lucide-react";
import { ProductPage } from "@/components/marketing/product-page-template";

export const metadata = { title: "Oracle Services", description: "Real-world data feeds for smart contracts and applications. Cryptographically verified." };

export default function OraclePage() {
  return (
    <ProductPage
      badge="Oracle Services"
      title="Real-world data,"
      highlight="verified by cryptography."
      description="Sub-second price feeds, weather, sports, and any verifiable off-chain data. Stake-secured, multi-source aggregated. For DeFi, agents, and traditional apps."
      features={[
        { icon: Network, title: "Multi-source aggregation", body: "Every feed pulls from multiple independent sources. Outliers filtered, signed, republished." },
        { icon: Shield, title: "Stake-secured", body: "Oracles stake QUBIC. Wrong data = slashing. Honest data = yield." },
        { icon: Zap, title: "Sub-second updates", body: "Median latency 84ms. Pushed to you the moment consensus is reached." },
        { icon: Database, title: "Any data", body: "Standard feeds pre-built. Custom feeds programmable. Deploy your own in 30 lines." },
        { icon: Globe, title: "Global coverage", body: "47 regions, 28 exchanges, 60+ crypto venues. Wherever data exists, we have an oracle." },
        { icon: Code2, title: "Standard interface", body: "JSON-RPC, REST, WebSocket. Pull or push. On-chain or off. Use it however you build." },
      ]}
      pricing={[
        { label: "Standard feed", price: "0.0001", unit: "QUBIC / update", note: "Equities, FX, crypto" },
        { label: "Premium feed", price: "0.0004", unit: "QUBIC / update", note: "Weather, sports, shipping" },
        { label: "Custom feed", price: "0.0008", unit: "QUBIC / update", note: "Bring your own data" },
        { label: "On-chain delivery", price: "0.004", unit: "QUBIC / update", note: "Posted to a smart contract" },
      ]}
      benefits={[
        "Stake-secured, slashable honesty",
        "Multi-source aggregation for accuracy",
        "Sub-second updates for fast markets",
        "On-chain and off-chain delivery",
        "Custom feeds deployable in hours",
        "Used by Vector Capital, Lumen Health, Quanta Systems",
        "Migration from Chainlink, Pyth, Redstone",
        "On-prem oracle for sensitive data",
      ]}
      example={{
        title: "oracle.py",
        code: `from aigarth import Aigarth

client = Aigarth(api_key="sk-aigarth-...")

# Subscribe to a feed
def on_update(price):
    print(f"ETH: \${price.value}")

sub = client.oracle.subscribe(
    feed="eth-usd",
    callback=on_update,
)

# Pull latest
latest = client.oracle.get("eth-usd")
print(f"Current: \${latest.value}")`,
      }}
      stakingRequirements={[
        { tier: "Builder", stake: "50M QUBIC", access: "Standard feeds" },
        { tier: "Startup", stake: "150M QUBIC", access: "Premium + custom feeds" },
        { tier: "Business", stake: "500M QUBIC", access: "On-chain delivery, dedicated" },
        { tier: "Enterprise", stake: "Custom", access: "On-prem, custom feeds" },
      ]}
    />
  );
}
