import { MarketingNav } from "@/components/marketing/marketing-nav";
import { NavModeSwitcher } from "@/components/marketing/nav-mode-switcher";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { AssistantWidget } from "@/components/shared/assistant-widget";
import { ThemeSelector } from "@/components/shared/theme-selector";
import { GoogleAnalytics } from "@/components/shared/google-analytics";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <GoogleAnalytics />
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
      <NavModeSwitcher />
      <AssistantWidget />
      <ThemeSelector />
    </div>
  );
}
