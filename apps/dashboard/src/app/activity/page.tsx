import { listActivity } from "@/lib/repo";
import { ActivityView } from "@/components/pages/activity";

export const dynamic = "force-dynamic";

export default function Page() {
  const items = listActivity(200);
  return <ActivityView items={items} />;
}
