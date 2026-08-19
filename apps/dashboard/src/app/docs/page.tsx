import { listDocs } from "@/lib/repo";
import { DocsView } from "@/components/pages/docs";

export const dynamic = "force-dynamic";

export default function Page() {
  const docs = listDocs();
  return <DocsView docs={docs} />;
}
