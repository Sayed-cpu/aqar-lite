export type ActionErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_STATE"
  | "RATE_LIMITED"
  | "INTERNAL";

/** Keyed by form field name; rendered next to that field. */
export type FieldErrors = Record<string, string[]>;

export type ActionError = {
  code: ActionErrorCode;
  /** Always safe to show: never an exception message or a stack. */
  message: string;
  fieldErrors?: FieldErrors;
};

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };
