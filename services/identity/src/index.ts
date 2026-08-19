/**
 * Entry point. Loads config, starts the server.
 *
 *   pnpm dev   — tsx watch (reloads on file change)
 *   pnpm start — node dist/index.js (after pnpm build)
 */

import { start } from "./server.js";

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("failed to start identity service:", err);
  process.exit(1);
});
