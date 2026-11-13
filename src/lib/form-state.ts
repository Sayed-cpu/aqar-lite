import type { FieldErrors } from "./action-result";

/** What a form gets back from a failed submission; a success redirects. */
export type FormState = {
  message?: string;
  fieldErrors?: FieldErrors;
  /** The submitted text, so the form shows what was typed rather than resetting. */
  values?: Record<string, string>;
};
