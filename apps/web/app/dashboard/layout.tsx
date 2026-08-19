import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { ThemeSelector } from "@/components/shared/theme-selector";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <DashboardNav />
      <div className="flex-1 lg:ml-0">
        <DashboardTopbar />
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
      <ThemeSelector />
    </div>
  );
}
