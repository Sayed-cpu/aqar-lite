import { z } from "zod";
import { normalizeNumeral } from "../money";
import { UNIT_SORTS, UNIT_STATUSES, UNIT_TYPES } from "../units";
import { blankAsUndefined, paginationFields, requiredText, sarAmount } from "./fields";

export const UNITS_MAX_PAGE_SIZE = 50;

/**
 * What a manager may set on a unit. Strict, and with no status and no
 * company: status only moves through reservations and contracts, and the
 * company is the session's.
 */
export const unitInputSchema = z.strictObject({
  project: requiredText("اسم المشروع", 2, 120),
  number: requiredText("رقم الوحدة", 1, 30),
  type: z.enum(UNIT_TYPES, { error: "اختر نوع الوحدة" }),
  areaSqm: z
    .string({ error: "المساحة مطلوبة" })
    .transform(normalizeNumeral)
    .pipe(z.string().regex(/^\d{1,5}(\.\d{1,2})?$/, { error: "المساحة رقم بخانتين عشريتين على الأكثر" }))
    .refine((value) => !/^0+(\.0+)?$/.test(value), { error: "المساحة يجب أن تكون أكبر من صفر" }),
  rooms: z
    .string({ error: "عدد الغرف مطلوب" })
    .transform(normalizeNumeral)
    .pipe(z.string().regex(/^\d{1,2}$/, { error: "عدد الغرف رقم صحيح" }))
    .transform(Number)
    .pipe(z.number().max(50, { error: "عدد الغرف 50 على الأكثر" })),
  price: sarAmount("السعر").refine((amount) => amount > 0n, { error: "السعر يجب أن يكون أكبر من صفر" }),
});

export const unitUpdateSchema = unitInputSchema.extend({
  id: z.uuid({ error: "وحدة غير صالحة" }),
});

export type UnitInput = z.output<typeof unitInputSchema>;
export type UnitUpdate = z.output<typeof unitUpdateSchema>;

/**
 * The units list's URL: filters, sort and page. Every key is validated; a
 * value that does not parse is dropped (or falls back) instead of failing the
 * page, and unknown keys never reach the query.
 */
export const unitListQuerySchema = z.object({
  status: z.preprocess(blankAsUndefined, z.enum(UNIT_STATUSES).optional()).catch(undefined),
  minPrice: z.preprocess(blankAsUndefined, sarAmount("أقل سعر").optional()).catch(undefined),
  maxPrice: z.preprocess(blankAsUndefined, sarAmount("أعلى سعر").optional()).catch(undefined),
  sort: z.enum(UNIT_SORTS).catch("newest"),
  ...paginationFields(UNITS_MAX_PAGE_SIZE),
});

export type UnitListQuery = z.output<typeof unitListQuerySchema>;

type PriceFilterErrors = { minPrice?: string[]; maxPrice?: string[] };

/**
 * The list ignores a price filter it cannot read, and says so next to the
 * field, so a typo is never mistaken for "no matching units".
 */
export function unitFilterErrors(raw: Record<string, unknown>, query: UnitListQuery): PriceFilterErrors {
  const typed = (value: unknown) => typeof value === "string" && value.trim() !== "";
  const unreadable = ["أدخل مبلغًا صحيحًا، مثل 500000 — تم تجاهل هذا الفلتر"];

  const errors: PriceFilterErrors = {};
  if (typed(raw.minPrice) && query.minPrice === undefined) errors.minPrice = unreadable;
  if (typed(raw.maxPrice) && query.maxPrice === undefined) errors.maxPrice = unreadable;
  if (query.minPrice !== undefined && query.maxPrice !== undefined && query.minPrice > query.maxPrice) {
    errors.maxPrice = ["أعلى سعر أقل من أقل سعر"];
  }
  return errors;
}
