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
