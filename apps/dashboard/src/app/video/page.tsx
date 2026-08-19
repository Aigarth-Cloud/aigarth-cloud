import { VideoView } from "@/components/pages/video";

export const dynamic = "force-dynamic";

/**
 * /video — Video Synthesis ANN use case dashboard.
 *
 * Static manifest view of the proposal, the architecture
 * compatibility verdicts, the development roadmap, the cost
 * model, and the risk register. Source of truth lives in:
 *   - docs/use-cases/video-synthesis-eval.md
 *   - docs/use-cases/video-synthesis.md
 */
export default function Page() {
  return <VideoView />;
}
