/**
 * Domain error classes for the training service.
 *
 * Routes catch these and map to HTTP status codes. Tests can use
 * `instanceof` to assert failure modes.
 */

export class TrainingNotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found.`);
    this.name = "TrainingNotFoundError";
  }
}

export class TrainingConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrainingConflictError";
  }
}

export class TrainingForbiddenError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "TrainingForbiddenError";
  }
}

/**
 * Thrown when a user submits overrides that aren't part of the
 * recipe's hyperparam schema, or when the recipe is paired with
 * a dataset whose kind isn't in the supported list.
 */
export class TrainingInvalidRecipeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrainingInvalidRecipeError";
  }
}

/**
 * Thrown when the compute bridge cannot be reached or returns a
 * non-recoverable error. The job is marked failed by the worker.
 */
export class ComputeBridgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComputeBridgeError";
  }
}

/**
 * Thrown when the ANN publisher (Phase 19C.6) cannot be reached
 * after a successful training run. Auto-publish failures are
 * non-fatal: the job stays succeeded, the version is just not
 * created. Use this error for the HTTP client's surface; the
 * publisher service swallows it on auto_publish=true.
 */
export class AnnPublishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnnPublishError";
  }
}
