import { MarketingPageHero, Section } from "@/components/marketing/marketing-page";
import { LogoFull, LogoMark } from "@/components/brand/logo";

export const metadata = { title: "Brand" };

export default function BrandPage() {
  return (
    <>
      <MarketingPageHero
        title="Brand identity"
        description="Aigarth's visual language. A digital garden where compute grows from participation."
      />
      <Section title="Logos">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border bg-card p-8 flex items-center justify-center">
            <LogoFull />
          </div>
          <div className="rounded-2xl border bg-card p-8 flex items-center justify-center">
            <LogoMark size={64} />
          </div>
          <div className="rounded-2xl bg-foreground p-8 flex items-center justify-center">
            <div className="[&_svg_*]:fill-white [&_svg_*]:stroke-white">
              <LogoMark size={64} />
            </div>
          </div>
        </div>
      </Section>
      <Section title="Color">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { name: "Garden Green", hex: "#2E7D32", bg: "bg-garden-500" },
            { name: "Forest", hex: "#41624B", bg: "bg-forest-600" },
            { name: "Sage", hex: "#5e6a4f", bg: "bg-sage-600" },
            { name: "Moss", hex: "#5f6c39", bg: "bg-moss-600" },
            { name: "Mint", hex: "#238662", bg: "bg-mint-600" },
            { name: "Emerald", hex: "#059669", bg: "bg-emerald-600" },
          ].map((c) => (
            <div key={c.name} className="rounded-xl border bg-card overflow-hidden">
              <div className={`h-24 ${c.bg}`} />
              <div className="p-3">
                <div className="text-sm font-medium">{c.name}</div>
                <div className="font-mono text-xs text-muted-foreground">{c.hex}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Typography">
        <div className="rounded-2xl border bg-card p-8 space-y-6">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Display</div>
            <div className="mt-1 text-5xl font-display">Aigarth Cloud</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Sans</div>
            <div className="mt-1 text-2xl">The decentralized AI cloud.</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Mono</div>
            <div className="mt-1 font-mono text-lg">$ aigarth inference --model=aigarth-reason-1</div>
          </div>
        </div>
      </Section>
    </>
  );
}
