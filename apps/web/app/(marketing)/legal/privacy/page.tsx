import { MarketingPageHero, Section } from "@/components/marketing/marketing-page";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <>
      <MarketingPageHero
        title="Privacy Policy"
        description="How Aigarth Cloud collects, uses, and protects your information."
      />
      <Section title="Last updated: Jul 26, 2026">
        <div className="prose prose-stone max-w-none dark:prose-invert">
          <h3>1. Information we collect</h3>
          <p>We collect information you provide directly, including account details, billing information, and content you submit to our services.</p>
          <h3>2. How we use information</h3>
          <p>We use your information to provide, maintain, and improve our services, process transactions, and communicate with you.</p>
          <h3>3. Information sharing</h3>
          <p>We do not sell your information. We share with service providers, for legal reasons, and with your consent.</p>
          <h3>4. Your rights</h3>
          <p>You have the right to access, correct, delete, and export your personal information. Contact privacy@aigarth.cloud.</p>
        </div>
      </Section>
    </>
  );
}
