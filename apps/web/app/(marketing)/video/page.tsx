import { Video, Sparkles, Zap, Code2, Layers, Film } from "lucide-react";
import { ProductPage } from "@/components/marketing/product-page-template";

export const metadata = { title: "Video Generation", description: "Cinematic video from text and image inputs. 4K, character-consistent." };

export default function VideoPage() {
  return (
    <ProductPage
      badge="Video Generation"
      title="Cinematic video,"
      highlight="from a sentence."
      description="Generate 4K video from text or image prompts. Up to 60 seconds. Character and scene consistency. Cinematic camera control."
      features={[
        { icon: Video, title: "Up to 4K, 60s", body: "Generate videos up to 4K resolution and 60 seconds long." },
        { icon: Layers, title: "Character consistency", body: "Maintain characters, settings, and styles across multi-shot sequences." },
        { icon: Film, title: "Camera control", body: "Pan, zoom, dolly, crane. Direct the shot like a cinematographer." },
        { icon: Code2, title: "Standard API", body: "Async submission with /v1/videos/{id} polling or webhook callback." },
        { icon: Sparkles, title: "Image-to-video", body: "Bring a single image to life. Animate characters, add motion, extend scenes." },
        { icon: Zap, title: "Fast at scale", body: "8s P50 for 5s 1080p. Burst capacity for production pipelines." },
      ]}
      pricing={[
        { label: "1080p, 5s", price: "0.12", unit: "QUBIC / video", note: "P50 8s" },
        { label: "1080p, 30s", price: "0.48", unit: "QUBIC / video", note: "P50 32s" },
        { label: "4K, 60s", price: "2.40", unit: "QUBIC / video", note: "P50 2.4min" },
        { label: "Image-to-video", price: "0.08", unit: "QUBIC / video", note: "5s output" },
      ]}
      benefits={[
        "Bulk generation with consistent characters",
        "Custom model fine-tuning for brand style",
        "Content moderation and brand-safety filters",
        "Watermarking and C2PA provenance",
        "Direct S3 / GCS export",
        "Migration from Runway, Pika, Sora",
        "On-prem deployment for IP-sensitive content",
        "Quarterly business reviews and roadmap input",
      ]}
      example={{
        title: "video.py",
        code: `from aigarth import Aigarth

client = Aigarth(api_key="sk-aigarth-...")

job = client.videos.generate(
    model="aigarth-video-1",
    prompt="Aerial shot of a coastal forest at dawn, slow dolly forward, mist in valleys",
    duration=10,
    resolution="1080p",
)

video = job.wait()
video.save("coastal-forest.mp4")`,
      }}
      stakingRequirements={[
        { tier: "Builder", stake: "50M QUBIC", access: "Video generation enabled" },
        { tier: "Startup", stake: "150M QUBIC", access: "Priority queue, longer durations" },
        { tier: "Business", stake: "500M QUBIC", access: "Custom models, brand-safety" },
        { tier: "Enterprise", stake: "Custom", access: "On-prem, dedicated capacity" },
      ]}
    />
  );
}
