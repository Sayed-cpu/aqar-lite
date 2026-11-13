import { z } from "zod";
import { type Halalas, parseSar } from "../money";

/**
 * Building blocks for the schemas that read forms and URLs. Form fields arrive
 * as strings, so these take strings and say what is wrong in Arabic, next to
 * the field it belongs to.
 */

export function requiredText(label: string, min: number, max: number) {
  return z
    .string({ error: `${label} مطلوب` })
    .trim()
    .min(min, { error: min <= 1 ? `${label} مطلوب` : `${label} قصير جدًا` })
    .max(max, { error: `${label} أطول من ${max} حرفًا` });
}

/** A SAR amount typed by a person, as exact halalas. */
export function sarAmount(label: string) {
  return z.string({ error: `${label} مطلوب` }).transform((value, ctx): Halalas => {
    const amount = parseSar(value);
    if (amount === null) {
      ctx.addIssue({ code: "custom", message: `${label} يجب أن يكون رقمًا بخانتين عشريتين على الأكثر` });
      return z.NEVER;
    }
    return amount;
  });
}

/** A URL parameter left blank by a GET form means "no filter", not an error. */
export function blankAsUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

/** Page and page size from a URL; anything that does not parse falls back. */
export function paginationFields(maxPageSize: number, defaultPageSize = 20) {
  return {
    page: z.coerce.number().int().min(1).max(100_000).catch(1),
    pageSize: z.coerce.number().int().min(1).max(maxPageSize).catch(defaultPageSize),
  };
}
