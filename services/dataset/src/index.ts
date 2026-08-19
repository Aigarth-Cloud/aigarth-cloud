/**
 * Entry point.
 */

import { start } from "./server.js";

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[dataset] fatal startup error:", err);
  process.exit(1);
});
