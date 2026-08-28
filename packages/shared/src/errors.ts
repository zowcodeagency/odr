export class DomainError extends Error {
  constructor(public readonly code: string, message: string, public readonly meta?: Record<string, unknown>) {
    super(message);
    this.name = "DomainError";
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super("NOT_FOUND", `${entity} ${id} not found`, { entity, id });
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, meta?: Record<string, unknown>) {
    super("CONFLICT", message, meta);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = "Unauthorized") {
    super("UNAUTHORIZED", message);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "Forbidden") {
    super("FORBIDDEN", message);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, meta?: Record<string, unknown>) {
    super("VALIDATION", message, meta);
  }
}
