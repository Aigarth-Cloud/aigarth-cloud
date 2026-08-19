import { Code2, Database, Sparkles, Shield, Zap, Cpu } from "lucide-react";
import { ProductPage } from "@/components/marketing/product-page-template";

export const metadata = { title: "Fine-Tuning", description: "Customize frontier models on your data. Full isolation, full ownership." };

export default function FineTuningPage() {
  return (
    <ProductPage
      badge="Fine-Tuning"
      title="Make any model yours."
      description="Customize frontier models on your data. Supervised, preference, and RLHF. Full data isolation. The resulting ANN is yours to license or deploy."
      features={[
        { icon: Database, title: "Your data, isolated", body: "Training runs in dedicated clusters. Your data is never used to train other models." },
        { icon: Sparkles, title: "SFT, DPO, RLHF", body: "Supervised fine-tuning, direct preference optimization, reinforcement learning from human feedback." },
        { icon: Code2, title: "Any base model", body: "Fine-tune any model on Aigarth, including your own pre-trained checkpoints." },
        { icon: Cpu, title: "Distributed training", body: "Multi-node, multi-GPU training. Horovod, DeepSpeed, FSDP supported." },
        { icon: Zap, title: "Fast iteration", body: "Train, evaluate, and deploy in hours. Hot-reload checkpoints without service interruption." },
        { icon: Shield, title: "Your weights, your ANN", body: "The resulting model is published as an ANN you own, license, and earn from." },
      ]}
      pricing={[
        { label: "SFT (LoRA)", price: "0.080", unit: "QUBIC / GPU-hr", note: "Low-rank adaptation, fast" },
        { label: "SFT (full)", price: "0.080", unit: "QUBIC / GPU-hr", note: "Full parameter fine-tuning" },
        { label: "DPO", price: "0.080", unit: "QUBIC / GPU-hr", note: "Preference optimization" },
        { label: "RLHF", price: "0.120", unit: "QUBIC / GPU-hr", note: "Includes reward model training" },
      ]}
      benefits={[
        "Dedicated training clusters",
        "Full data isolation, BYO encryption",
        "HIPAA, FedRAMP, PCI compliance",
        "On-prem training for IP-sensitive models",
        "Custom architectures and modalities",
        "Eval suite integration (lm-eval-harness, MT-Bench)",
        "Ongoing maintenance and re-training",
        "Quarterly business reviews",
      ]}
      example={{
        title: "fine-tune.py",
        code: `from aigarth import Aigarth

client = Aigarth(api_key="sk-aigarth-...")

# Submit a fine-tuning job
job = client.fine_tuning.create(
    model="aigarth-reason-1",
    training_file="file-abc123",
    method="lora",
    hyperparameters={
        "epochs": 3,
        "lr": 2e-5,
        "lora_r": 16,
    },
)

# Wait for completion
model = job.wait()
print(f"Model published: {model.id}")`,
      }}
      stakingRequirements={[
        { tier: "Startup", stake: "150M QUBIC", access: "Fine-tuning enabled" },
        { tier: "Business", stake: "500M QUBIC", access: "Distributed, custom architectures" },
        { tier: "Enterprise", stake: "Custom", access: "On-prem, private training" },
      ]}
    />
  );
}
