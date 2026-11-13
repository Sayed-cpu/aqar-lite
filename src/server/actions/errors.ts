import "server-only";
import type { ActionErrorCode, FieldErrors } from "@/lib/action-result";

type DomainErrorCode = Exclude<ActionErrorCode, "UNAUTHENTICATED" | "INTERNAL">;

/**
 * A business rule said no. Its message is written for the user and shown as
 * is; any other error is logged and replaced with a generic one.
 */
export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
    readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

/** The summary above a form whose fields were refused; each field says why. */
export const CHECK_INPUT = "تحقق من البيانات المدخلة";

/** A refusal about one field, shown beside it like a schema error. */
export function fieldError(field: string, message: string): DomainError {
  return new DomainError("VALIDATION", CHECK_INPUT, { [field]: [message] });
}
