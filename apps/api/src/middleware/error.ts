import type { ErrorHandler } from "hono";
import { DomainError } from "@odr/shared";

export const errorHandler: ErrorHandler = (err, c) => {
  // Frozen client contract — clients switch on this flat shape to show the
  // "subscription ended" screen.
  if (err instanceof DomainError && err.code === "SUBSCRIPTION_EXPIRED") {
    return c.json({ error: "SUBSCRIPTION_EXPIRED" }, 403);
  }
  if (err instanceof DomainError) {
    const status = err.code === "NOT_FOUND" ? 404
      : err.code === "UNAUTHORIZED" ? 401
      : err.code === "FORBIDDEN" ? 403
      : err.code === "CONFLICT" ? 409
      : err.code === "VALIDATION" ? 400
      : 400;
    return c.json({ error: { code: err.code, message: err.message, meta: err.meta } }, status);
  }
  console.error("unhandled", err);
  return c.json({ error: { code: "INTERNAL", message: "internal error" } }, 500);
};
