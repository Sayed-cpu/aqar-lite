import "server-only";
import type { ActionResult } from "@/lib/action-result";
import type { FormState } from "@/lib/form-state";

const MALFORMED: FormState = { message: "تعذّر قراءة النموذج، أعد تحميل الصفحة وحاول مرة أخرى" };

/**
 * Adapts a createAction action to a form. Every posted field is passed on
 * except React's own `$ACTION_*` bookkeeping, so a field the schema does not
 * define (a companyId, an ownerUserId, a status) is refused, not dropped.
 * A field posted twice arrives as an array and fails its schema.
 */
export async function submitForm<T>(
  formData: unknown,
  action: (input: unknown) => Promise<ActionResult<T>>,
  onSuccess: (data: T) => never,
): Promise<FormState> {
  // The endpoint is public: what arrives is whatever the caller sent.
  if (!(formData instanceof FormData)) return MALFORMED;

  const entries = new Map<string, FormDataEntryValue | FormDataEntryValue[]>();
  for (const [key, value] of formData) {
    if (key.startsWith("$ACTION")) continue;
    const previous = entries.get(key);
    entries.set(key, previous === undefined ? value : [previous, value].flat());
  }
  // fromEntries defines own properties, so a "__proto__" field is just a key.
  const input = Object.fromEntries(entries);

  const result = await action(input);
  if (result.ok) onSuccess(result.data);

  const values: Record<string, string> = {};
  for (const [key, value] of entries) if (typeof value === "string") values[key] = value;
  return { message: result.error.message, fieldErrors: result.error.fieldErrors, values };
}
