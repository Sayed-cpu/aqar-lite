import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type CommonProps = {
  label: string;
  name: string;
  errors?: string[];
  /** Shown under the control when there is no error. */
  hint?: string;
};

type FieldProps = { inputId: string; error?: string; hint?: string; label: string; children: ReactNode };

function Field({ inputId, error, hint, label, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Wires a control to its message, and colours it by whether it has one. */
function controlProps(inputId: string, name: string, error?: string, hint?: string, className?: string) {
  return {
    id: inputId,
    name,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined,
    className: `block w-full rounded-lg border bg-white px-3 py-2 text-slate-900 outline-none transition focus:ring-2 read-only:bg-slate-50 read-only:text-slate-500 ${
      error
        ? "border-red-400 focus:border-red-500 focus:ring-red-200"
        : "border-slate-300 focus:border-emerald-600 focus:ring-emerald-100"
    } ${className ?? ""}`,
  };
}

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & CommonProps;

/** A labelled input with its validation message directly beneath it. */
export function FormField({ label, name, errors, hint, id, className, ...inputProps }: FormFieldProps) {
  const inputId = id ?? `field-${name}`;
  const error = errors?.[0];
  return (
    <Field inputId={inputId} error={error} hint={hint} label={label}>
      <input {...inputProps} {...controlProps(inputId, name, error, hint, className)} />
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
    <Field inputId={inputId} error={error} hint={hint} label={label}>
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
    <Field inputId={inputId} error={error} hint={hint} label={label}>
      <textarea {...textareaProps} {...controlProps(inputId, name, error, hint, className)} />
    </Field>
  );
}

/** The form-wide message above the fields: what went wrong, in one line. */
export function FormMessage({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </div>
  );
}
