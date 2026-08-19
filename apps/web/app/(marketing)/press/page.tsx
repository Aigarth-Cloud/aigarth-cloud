import { MarketingPageHero, Section } from "@/components/marketing/marketing-page";
import { Button } from "@aigarth/ui";
import { Download } from "lucide-react";

export const metadata = { title: "Press" };

export default function PressPage() {
  return (
    <>
      <MarketingPageHero
        title="Press & brand"
        description="Brand assets, logos, and the Aigarth story for press coverage."
        primaryCta={{ label: "Download brand kit", href: "/contact" }}
        secondaryCta={{ label: "Press inquiries", href: "/contact" }}
      />
      <Section title="Brand assets">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { name: "Logo · Dark", desc: "SVG, PNG, 1024px" },
            { name: "Logo · Light", desc: "SVG, PNG, 1024px" },
            { name: "Wordmark", desc: "SVG, PNG" },
            { name: "Brand guidelines", desc: "PDF, 12 pages" },
            { name: "Screenshots", desc: "PNG, 4K" },
            { name: "Press release template", desc: "DOCX" },
          ].map((a) => (
            <div key={a.name} className="rounded-2xl border bg-card p-6">
              <h3 className="font-semibold tracking-tight">{a.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{a.desc}</p>
              <Button size="sm" variant="outline" className="mt-4 gap-1.5">
                <Download className="h-3.5 w-3.5" />
                Download
              </Button>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
