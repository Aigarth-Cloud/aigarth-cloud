import { MarketingPageHero, Section } from "@/components/marketing/marketing-page";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <>
      <MarketingPageHero
        title="Terms of Service"
        description="The terms that govern your use of Aigarth Cloud."
      />
      <Section title="Last updated: Jul 26, 2026">
        <div className="prose prose-stone max-w-none dark:prose-invert">
          <h3>1. Acceptance</h3>
          <p>By using Aigarth Cloud, you agree to these terms.</p>
          <h3>2. Service</h3>
          <p>Aigarth provides AI compute, models, and related services. Service availability is subject to plan and stake requirements.</p>
          <h3>3. Acceptable use</h3>
          <p>You agree not to use Aigarth for illegal purposes, to harm others, or to violate intellectual property rights.</p>
          <h3>4. Liability</h3>
          <p>Aigarth's liability is limited to the fees paid in the preceding 12 months. Staking risks remain with the staker.</p>
        </div>
      </Section>
    </>
  );
}
