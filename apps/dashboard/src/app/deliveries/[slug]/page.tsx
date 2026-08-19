import { notFound } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import { getDoc, listPhases } from "@/lib/repo";
import { DeliveryDetailView } from "@/components/pages/delivery-detail";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { slug: string };
}

export default function Page({ params }: PageProps) {
  // Slug is `phase-N-delivery`. Find the matching doc by path.
  const match = params.slug.match(/^phase-(\d+)-delivery$/);
  if (!match) notFound();
  const phaseNumber = Number(match[1]);
  const phases = listPhases();
  const phase = phases.find((p) => p.number === phaseNumber) ?? null;

  const docPath = `../../docs/deliveries/phase-${phaseNumber}-delivery.md`;
  const doc = getDoc(docPath);
  if (!doc) notFound();

  // Resolve the file from the project root. The dashboard is in apps/dashboard.
  const projectRoot = path.resolve(process.cwd(), "..", "..");
  const absPath = path.resolve(projectRoot, "docs", "deliveries", `phase-${phaseNumber}-delivery.md`);
  let content = "";
  try {
    content = fs.readFileSync(absPath, "utf-8");
  } catch {
    notFound();
  }

  return <DeliveryDetailView doc={doc} phase={phase} content={content} />;
}
