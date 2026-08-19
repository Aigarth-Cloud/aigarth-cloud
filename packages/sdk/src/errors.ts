/**
 * SDK error hierarchy. Mirrors OpenAI's JS SDK error classes so callers
 * can `try/catch` and switch on `error.status` / `error.type`.
 */

export class AigarthError extends Error {
  readonly status: number;
  readonly type: string;
  readonly code: string | null;
  readonly param: string | null;
  readonly requestId: string | null;
  override readonly cause?: unknown;

  constructor(
    message: string,
    options: {
      status?: number;
      type?: string;
      code?: string | null;
      param?: string | null;
      requestId?: string | null;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = "AigarthError";
    this.status = options.status ?? 0;
    this.type = options.type ?? "unknown_error";
    this.code = options.code ?? null;
    this.param = options.param ?? null;
    this.requestId = options.requestId ?? null;
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

export class APIError extends AigarthError {
  constructor(message: string, options: ConstructorParameters<typeof AigarthError>[1] = {}) {
    super(message, { type: "api_error", ...options });
    this.name = "APIError";
  }
}

export class APIConnectionError extends AigarthError {
  constructor(message: string, options: ConstructorParameters<typeof AigarthError>[1] = {}) {
    super(message, { type: "api_connection_error", ...options });
    this.name = "APIConnectionError";
  }
}

export class APIUserAbortError extends AigarthError {
  constructor(message = "Request was aborted.", options: ConstructorParameters<typeof AigarthError>[1] = {}) {
    super(message, { type: "api_user_abort_error", ...options });
    this.name = "APIUserAbortError";
  }
}

export class BadRequestError extends APIError {
  constructor(message: string, options: ConstructorParameters<typeof AigarthError>[1] = {}) {
    super(message, { status: 400, type: "invalid_request_error", ...options });
    this.name = "BadRequestError";
  }
}

export class AuthenticationError extends APIError {
  constructor(message: string, options: ConstructorParameters<typeof AigarthError>[1] = {}) {
    super(message, { status: 401, type: "authentication_error", ...options });
    this.name = "AuthenticationError";
  }
}

export class PermissionDeniedError extends APIError {
  constructor(message: string, options: ConstructorParameters<typeof AigarthError>[1] = {}) {
    super(message, { status: 403, type: "permission_denied_error", ...options });
    this.name = "PermissionDeniedError";
  }
}

export class NotFoundError extends APIError {
  constructor(message: string, options: ConstructorParameters<typeof AigarthError>[1] = {}) {
    super(message, { status: 404, type: "not_found_error", ...options });
    this.name = "NotFoundError";
  }
}

export class UnprocessableEntityError extends APIError {
  constructor(message: string, options: ConstructorParameters<typeof AigarthError>[1] = {}) {
    super(message, { status: 422, type: "unprocessable_entity_error", ...options });
    this.name = "UnProcessableEntityError";
  }
}

export class RateLimitError extends APIError {
  constructor(message: string, options: ConstructorParameters<typeof AigarthError>[1] = {}) {
    super(message, { status: 429, type: "rate_limit_error", ...options });
    this.name = "RateLimitError";
  }
}

export class InternalServerError extends APIError {
  constructor(message: string, options: ConstructorParameters<typeof AigarthError>[1] = {}) {
    super(message, { status: 500, type: "internal_server_error", ...options });
    this.name = "InternalServerError";
  }
}

/**
 * Map HTTP status + error type to the most specific error class.
 * Falls back to generic APIError / AigarthError.
 */
export function makeError(
  status: number,
  body: { error?: { message?: string; type?: string; code?: string; param?: string } } | string | null,
  requestId: string | null,
  message: string,
): AigarthError {
  const err =
    typeof body === "object" && body !== null && "error" in body && body.error
      ? body.error
      : undefined;
  const opts = {
    status,
    type: err?.type,
    code: err?.code,
    param: err?.param,
    requestId,
  };
  const msg = err?.message ?? message ?? "Unknown error";

  switch (status) {
    case 400:
      return new BadRequestError(msg, opts);
    case 401:
      return new AuthenticationError(msg, opts);
    case 403:
      return new PermissionDeniedError(msg, opts);
    case 404:
      return new NotFoundError(msg, opts);
    case 422:
      return new UnprocessableEntityError(msg, opts);
    case 429:
      return new RateLimitError(msg, opts);
    case 500:
    case 502:
    case 503:
    case 504:
      return new InternalServerError(msg, opts);
    default:
      return status >= 500 ? new InternalServerError(msg, opts) : new APIError(msg, opts);
  }
}
