import { MaterialScienceView } from "@/components/pages/material-science";

export const dynamic = "force-dynamic";

/**
 * /material-science — Material Science Intelligence ANN use case dashboard.
 *
 * Static manifest view of the proposal, the architecture
 * compatibility verdicts, the development roadmap, the cost
 * model, and the risk register. Source of truth lives in:
 *   - docs/use-cases/material-science-eval.md
 *   - docs/use-cases/material-science.md
 */
export default function Page() {
  return <MaterialScienceView />;
}
