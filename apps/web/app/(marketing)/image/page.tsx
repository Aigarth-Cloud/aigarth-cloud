import { ImageIcon, Zap, Sparkles, Code2, Palette, Layers } from "lucide-react";
import { ProductPage } from "@/components/marketing/product-page-template";

export const metadata = { title: "Image Generation", description: "Photorealistic and artistic image synthesis with consistent identity." };

export default function ImagePage() {
  return (
    <ProductPage
      badge="Image Generation"
      title="Photorealistic images,"
      highlight="with consistent identity."
      description="Generate, edit, and refine images with state-of-the-art models. Character consistency across requests. Style transfer. Inpainting and outpainting."
      features={[
        { icon: ImageIcon, title: "Up to 4K resolution", body: "Generate images up to 4096×4096 with photorealistic detail." },
        { icon: Layers, title: "Consistent identity", body: "Maintain character, scene, and product identity across multiple generations." },
        { icon: Palette, title: "Style control", body: "Reference images, style transfer, color palette, and lighting control." },
        { icon: Code2, title: "Standard API", body: "OpenAI-compatible /v1/images/generations endpoint." },
        { icon: Sparkles, title: "Edit & refine", body: "Inpainting, outpainting, and instruction-based editing." },
        { icon: Zap, title: "Fast at scale", body: "1.4s P50 for 1024×1024. Burst capacity for product launches." },
      ]}
      pricing={[
        { label: "1024×1024", price: "0.008", unit: "QUBIC / image", note: "P50 1.4s" },
        { label: "2048×2048", price: "0.024", unit: "QUBIC / image", note: "P50 4.2s" },
        { label: "4096×4096", price: "0.084", unit: "QUBIC / image", note: "P50 12s" },
        { label: "Edit / inpaint", price: "0.012", unit: "QUBIC / image", note: "Preserves original regions" },
      ]}
      benefits={[
        "Brand-safety filters and content moderation",
        "Custom model fine-tuning for brand identity",
        "Watermarking and provenance tracking",
        "On-prem deployment for IP-sensitive content",
        "Bulk generation with consistent characters",
        "Compliance with content policies",
        "Migration from DALL·E, Midjourney, Stable Diffusion",
        "Dedicated CSM and quarterly reviews",
      ]}
      example={{
        title: "image.py",
        code: `from aigarth import Aigarth

client = Aigarth(api_key="sk-aigarth-...")

response = client.images.generate(
    model="aigarth-image-1",
    prompt="A botanist in a glass greenhouse, soft morning light, 35mm photograph",
    size="1024x1024",
    n=4,
)

for i, image in enumerate(response.data):
    image.save(f"greenhouse-{i}.png")`,
      }}
      stakingRequirements={[
        { tier: "Builder", stake: "50M QUBIC", access: "Image generation enabled" },
        { tier: "Startup", stake: "150M QUBIC", access: "Priority queue, fine-tuning" },
        { tier: "Business", stake: "500M QUBIC", access: "Custom models, brand-safety" },
        { tier: "Enterprise", stake: "Custom", access: "On-prem, dedicated capacity" },
      ]}
    />
  );
}
