/**
 * Re-export the worker entry point from `workers/job-runner.ts`
 * so routes/services that want to manage the worker lifecycle
 * have a stable import path that matches the spec's directory
 * layout (`src/services/worker.ts`).
 */

export { startWorker, stopWorker } from "../workers/job-runner.js";
