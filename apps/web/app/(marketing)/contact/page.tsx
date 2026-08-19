import { MarketingPageHero, Section } from "@/components/marketing/marketing-page";
import { Button } from "@aigarth/ui";
import { Input } from "@aigarth/ui";
import { Textarea } from "@aigarth/ui";
import { Mail, MessageCircle, Building2, Sparkles } from "lucide-react";

export const metadata = { title: "Contact", description: "Get in touch with the Aigarth team." };

export default function ContactPage() {
  return (
    <>
      <MarketingPageHero
        badge="Contact"
        title="Get in touch."
        description="Sales, support, partnerships, or just curious. We read every message."
      />

      <Section
        title="How can we help?"
        description="Pick the channel that fits."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Building2, title: "Sales", desc: "Enterprise plans, custom SLAs, dedicated infrastructure." },
            { icon: MessageCircle, title: "Support", desc: "Existing customer? Get help from the team." },
            { icon: Sparkles, title: "Partnerships", desc: "Resellers, integrators, and ecosystem partners." },
            { icon: Mail, title: "Press", desc: "Media inquiries and brand assets." },
          ].map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.title} className="rounded-2xl border bg-card p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold tracking-tight">{c.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{c.desc}</p>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Send a message" align="center">
        <form className="mx-auto max-w-xl space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium">Name</label>
              <Input className="mt-1.5" placeholder="Your name" />
            </div>
            <div>
              <label className="text-xs font-medium">Email</label>
              <Input className="mt-1.5" type="email" placeholder="you@company.com" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Company</label>
            <Input className="mt-1.5" placeholder="Your company (optional)" />
          </div>
          <div>
            <label className="text-xs font-medium">Message</label>
            <Textarea className="mt-1.5" rows={5} placeholder="Tell us what you're working on..." />
          </div>
          <Button size="lg" className="w-full sm:w-auto">Send message</Button>
        </form>
      </Section>
    </>
  );
}
