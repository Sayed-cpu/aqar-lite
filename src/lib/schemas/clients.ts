import { z } from "zod";
import { normalizeNumeral } from "../money";
import { blankAsUndefined, paginationFields, requiredText } from "./fields";

export const CLIENTS_MAX_PAGE_SIZE = 50;
export const CLIENT_NOTES_MAX = 2000;

/**
 * What a sales rep may set on a client. There is no owner field: the owner is
 * whoever is signed in, and a client never changes hands.
 */
export const clientInputSchema = z.strictObject({
  name: requiredText("اسم العميل", 2, 120),
  phone: z
    .string({ error: "رقم الهاتف مطلوب" })
    .transform((value) => normalizeNumeral(value).replace(/[-()]/g, ""))
    .pipe(z.string().regex(/^\+?\d{8,15}$/, { error: "رقم الهاتف غير صحيح" })),
  // Free text, stored as typed and only ever rendered as text.
  notes: z
    .string()
    .trim()
    .max(CLIENT_NOTES_MAX, { error: `الملاحظات أطول من ${CLIENT_NOTES_MAX} حرف` })
    .default(""),
});

export const clientUpdateSchema = clientInputSchema.extend({
  id: z.uuid({ error: "عميل غير صالح" }),
});

export type ClientInput = z.output<typeof clientInputSchema>;
export type ClientUpdate = z.output<typeof clientUpdateSchema>;

export const clientListQuerySchema = z.object({
  q: z.preprocess(blankAsUndefined, z.string().trim().max(100).optional()).catch(undefined),
  ...paginationFields(CLIENTS_MAX_PAGE_SIZE),
});

export type ClientListQuery = z.output<typeof clientListQuerySchema>;
