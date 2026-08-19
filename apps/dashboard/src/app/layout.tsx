import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { TrackerNav } from "@/components/tracker-nav";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Aigarth Tracker",
  description: "Project tracker for building Aigarth Cloud. Local-first, SQLite-backed.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-brand="garden"
      className={`dark ${inter.variable} ${space.variable} ${jetbrains.variable}`}
    >
      <body className="font-sans antialiased">
        <TrackerNav>{children}</TrackerNav>
      </body>
    </html>
  );
}
