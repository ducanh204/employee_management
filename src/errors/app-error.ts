export class AppError extends Error {
  public readonly statusCode: number;

  public readonly code: string;

  public readonly details?: unknown;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: unknown
  ) {
    super(message);

    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    // Preserve the correct prototype chain when extending the built-in Error
    // class in TypeScript/ES2015+.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Invalid request data", details?: unknown) {
    super(400, "bad_request", message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(401, "unauthorized", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(403, "forbidden", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(404, "not_found", message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict", details?: unknown) {
    super(409, "conflict", message, details);
  }
}