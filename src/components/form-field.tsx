import { CircleAlert, LoaderCircle } from "lucide-react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { buttonClass, Notice } from "@/components/ui";

type CommonProps = {
  label: string;
  name: string;
  errors?: string[];
  /** Shown under the control, and kept there when an error appears. */
  hint?: string;
};

type FieldProps = { inputId: string; error?: string; hint?: string; label: string; required?: boolean; children: ReactNode };

function Field({ inputId, error, hint, label, required, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="flex items-center gap-1 text-sm font-medium text-ink">
        {label}
        {/* The control itself carries `required`; the star is for the eye. */}
        {required ? (
          <span aria-hidden="true" className="text-danger">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${inputId}-error`} className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-ink-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Wires a control to its messages, and colours it by whether it has an error. */
function controlProps(inputId: string, name: string, error?: string, hint?: string, className?: string) {
  const describedBy = [error ? `${inputId}-error` : null, hint ? `${inputId}-hint` : null].filter(Boolean).join(" ");
  return {
    id: inputId,
    name,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy || undefined,
    className: `block min-h-10 w-full rounded-lg border bg-surface px-3 py-2 text-ink shadow-xs transition-colors placeholder:text-ink-subtle focus-visible:outline-offset-1 read-only:cursor-default read-only:bg-subtle read-only:text-ink-muted ${
      error ? "border-danger" : "border-field hover:border-ink-subtle"
    } ${className ?? ""}`,
  };
}

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & CommonProps;

/** A labelled input with its validation message directly beneath it. */
export function FormField({ label, name, errors, hint, id, className, ...inputProps }: FormFieldProps) {
  const inputId = id ?? `field-${name}`;
  const error = errors?.[0];
  // Numbers typed left to right line up like the tables do.
  const numeric = inputProps.inputMode === "decimal" || inputProps.inputMode === "numeric";
  return (
    <Field inputId={inputId} error={error} hint={hint} label={label} required={inputProps.required}>
      <input
        {...inputProps}
        {...controlProps(inputId, name, error, hint, `${numeric ? "tabular-nums" : ""} ${className ?? ""}`)}
      />
    </Field>
  );
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> &
  CommonProps & { options: readonly { value: string; label: string }[] };

/**
 * React applies a select's defaultValue only when it mounts, so a caller that
 * re-renders it with a different one should key it by that value.
 */
export function SelectField({ label, name, errors, hint, id, className, options, ...selectProps }: SelectFieldProps) {
  const inputId = id ?? `field-${name}`;
  const error = errors?.[0];
  return (
    <Field inputId={inputId} error={error} hint={hint} label={label} required={selectProps.required}>
      <select {...selectProps} {...controlProps(inputId, name, error, hint, className)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

type TextareaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & CommonProps;

export function TextareaField({ label, name, errors, hint, id, className, ...textareaProps }: TextareaFieldProps) {
  const inputId = id ?? `field-${name}`;
  const error = errors?.[0];
  return (
    <Field inputId={inputId} error={error} hint={hint} label={label} required={textareaProps.required}>
      <textarea {...textareaProps} {...controlProps(inputId, name, error, hint, className)} />
    </Field>
  );
}

/** The form-wide message above the fields: what went wrong, in one line. */
export function FormMessage({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Notice tone="danger" role="alert">
      {message}
    </Notice>
  );
}

type SubmitButtonProps = {
  pending: boolean;
  /** What the button says while the request is in flight, e.g. "جارٍ الحفظ…". */
  pendingLabel: string;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
};

/** Disabled with a spinner while its form is being sent, so it cannot be sent twice by hand. */
export function SubmitButton({ pending, pendingLabel, children, className = buttonClass.primary, icon }: SubmitButtonProps) {
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? <LoaderCircle className="animate-spin" /> : icon}
      {pending ? pendingLabel : children}
    </button>
  );
}

/** The row of buttons at the foot of a form. */
export function FormActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">{children}</div>;
}
