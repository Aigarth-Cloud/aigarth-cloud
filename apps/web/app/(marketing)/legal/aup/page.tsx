import { MarketingPageHero, Section } from "@/components/marketing/marketing-page";

export const metadata = { title: "Acceptable Use Policy" };

export default function AUPPage() {
  return (
    <>
      <MarketingPageHero
        title="Acceptable Use Policy"
        description="What you can and can't do with Aigarth Cloud."
      />
      <Section title="Prohibited uses">
        <div className="prose prose-stone max-w-none dark:prose-invert">
          <h3>1. Illegal content</h3>
          <p>You may not use Aigarth to generate, store, or distribute illegal content.</p>
          <h3>2. Harm</h3>
          <p>You may not use Aigarth to harm, harass, or defraud others.</p>
          <h3>3. Spam and abuse</h3>
          <p>You may not use Aigarth for spam, scraping without permission, or denial-of-service attacks.</p>
          <h3>4. Security</h3>
          <p>You may not attempt to circumvent rate limits, security measures, or access controls.</p>
        </div>
      </Section>
    </>
  );
}
