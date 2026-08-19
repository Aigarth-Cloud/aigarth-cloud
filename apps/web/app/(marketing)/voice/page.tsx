import { Mic, Globe, Zap, Code2, Sparkles, Volume2 } from "lucide-react";
import { ProductPage } from "@/components/marketing/product-page-template";

export const metadata = { title: "Voice", description: "Natural speech synthesis and recognition. 47 voices, 31 languages." };

export default function VoicePage() {
  return (
    <ProductPage
      badge="Voice"
      title="Voice that sounds human."
      highlight="In 31 languages."
      description="Text-to-speech with emotional nuance. Speech-to-text with speaker diarization. Real-time voice agents. 47 voices, 31 languages, sub-200ms latency."
      features={[
        { icon: Volume2, title: "47 voices", body: "Curated, distinctive voices. Custom voice cloning available on Business+ plans." },
        { icon: Globe, title: "31 languages", body: "Native fluency, not translation. Code-switching across languages mid-sentence." },
        { icon: Zap, title: "180ms latency", body: "Real-time TTS for voice agents. Faster than human reaction time." },
        { icon: Sparkles, title: "Emotion control", body: "Tone, pace, emotion. Direct the delivery, not just the words." },
        { icon: Code2, title: "Streaming API", body: "WebSocket streaming for real-time applications. PCM, MP3, Opus outputs." },
        { icon: Mic, title: "Speech-to-text", body: "Speaker diarization, word timestamps, custom vocabularies. 95%+ accuracy." },
      ]}
      pricing={[
        { label: "TTS standard", price: "0.012", unit: "QUBIC / 1K chars", note: "47 voices, 31 languages" },
        { label: "TTS premium", price: "0.024", unit: "QUBIC / 1K chars", note: "Emotion + style control" },
        { label: "STT", price: "0.006", unit: "QUBIC / minute", note: "Diarization + timestamps" },
        { label: "Realtime API", price: "0.040", unit: "QUBIC / minute", note: "Sub-200ms voice agents" },
      ]}
      benefits={[
        "Custom voice cloning with consent verification",
        "HIPAA-aligned for healthcare voice agents",
        "PCI-compliant for payment use cases",
        "Telephony integration (Twilio, Vonage)",
        "WebRTC and WebSocket SDKs",
        "Brand-safety filters and content moderation",
        "On-prem deployment",
        "24/7 on-call support",
      ]}
      example={{
        title: "voice.py",
        code: `from aigarth import Aigarth

client = Aigarth(api_key="sk-aigarth-...")

audio = client.voice.synthesize(
    text="Welcome to Aigarth. The future of compute grows on participation.",
    voice="atlas",
    language="en-US",
    emotion="warm",
)

audio.save("welcome.mp3")`,
      }}
      stakingRequirements={[
        { tier: "Builder", stake: "50M QUBIC", access: "Voice TTS/STT enabled" },
        { tier: "Startup", stake: "150M QUBIC", access: "Realtime API, custom voices" },
        { tier: "Business", stake: "500M QUBIC", access: "Voice cloning, telephony" },
        { tier: "Enterprise", stake: "Custom", access: "On-prem, custom voices" },
      ]}
    />
  );
}
