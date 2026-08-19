import { start } from "./server.js";

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("failed to start marketplace service:", err);
  process.exit(1);
});
