/**
 * /dashboard — redirects to /dashboard/garden.
 *
 *   Phase 19A.3 — the Intelligence Garden is the new home view.
 *   The old operator "Overview" page content still lives at
 *   /dashboard/overview (a follow-up may consolidate or retire it).
 *   This file is intentionally minimal: it just sends the user to
 *   the new home.
 */

import { redirect } from "next/navigation";

export default function DashboardIndex() {
  redirect("/dashboard/garden");
}
