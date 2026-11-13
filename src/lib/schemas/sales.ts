import { z } from "zod";
import { addDays, isLocalDate, todayIn } from "@/domain/dates";
import { MAX_INSTALLMENTS } from "@/domain/installments";
import { normalizeNumeral, toLatinDigits } from "../money";
import { CONTRACT_STATUSES, RESERVATION_STATUSES } from "../sales";
import { blankAsUndefined, paginationFields, sarAmount } from "./fields";

export const SALES_MAX_PAGE_SIZE = 50;

/** How far a start date may sit from today: a typo in the year is caught, a contract signed last week is not refused. */
export const START_DATE_DAYS_BACK = 30;
export const START_DATE_DAYS_AHEAD = 365;

/**
 * A rep reserves a unit for one of their clients. That is the whole input:
 * the rep, the company and the expiry come from the session and the clock.
 */
export const reserveUnitSchema = z.strictObject({
  unitId: z.uuid({ error: "وحدة غير صالحة" }),
  clientId: z.uuid({ error: "اختر العميل" }),
});

export type ReserveUnitInput = z.output<typeof reserveUnitSchema>;

const startDate = z
  .string({ error: "تاريخ البداية مطلوب" })
  .transform((value) => toLatinDigits(value.trim()))
  .refine(isLocalDate, { error: "تاريخ غير صحيح" })
  .refine(
    (value) => {
      const today = todayIn();
      return value >= addDays(today, -START_DATE_DAYS_BACK) && value <= addDays(today, START_DATE_DAYS_AHEAD);
    },
    { error: `تاريخ البداية بين ${START_DATE_DAYS_BACK} يومًا مضت وسنة من اليوم` },
  );

/**
 * The terms a rep sets on a draft. The list price, unit, client and rep come
 * from the reservation; whether the final price is within the 5% discount is
 * checked by the service, which knows the list price.
 */
const contractTerms = {
  finalPrice: sarAmount("السعر النهائي").refine((amount) => amount > 0n, {
    error: "السعر النهائي يجب أن يكون أكبر من صفر",
  }),
  downPayment: sarAmount("الدفعة الأولى"),
  installmentCount: z
    .string({ error: "عدد الأقساط مطلوب" })
    .transform(normalizeNumeral)
    .pipe(z.string().regex(/^\d{1,3}$/, { error: "عدد الأقساط رقم صحيح" }))
    .transform(Number)
    .pipe(
      z
        .number()
        .min(1, { error: "قسط واحد على الأقل" })
        .max(MAX_INSTALLMENTS, { error: `${MAX_INSTALLMENTS} قسطًا على الأكثر` }),
    ),
  startDate,
};

function downPaymentBelowPrice(terms: { finalPrice: bigint; downPayment: bigint }, ctx: z.RefinementCtx) {
  if (terms.downPayment >= terms.finalPrice) {
    ctx.addIssue({ code: "custom", path: ["downPayment"], message: "الدفعة الأولى يجب أن تكون أقل من السعر النهائي" });
  }
}

export const contractDraftSchema = z
  .strictObject({ reservationId: z.uuid({ error: "حجز غير صالح" }), ...contractTerms })
  .superRefine(downPaymentBelowPrice);

export const contractUpdateSchema = z
  .strictObject({ id: z.uuid({ error: "عقد غير صالح" }), ...contractTerms })
  .superRefine(downPaymentBelowPrice);

export type ContractDraftInput = z.output<typeof contractDraftSchema>;
export type ContractUpdateInput = z.output<typeof contractUpdateSchema>;
export type ContractTerms = Omit<ContractUpdateInput, "id">;

/**
 * The revision is the draft the accountant was looking at: if the rep edits
 * it in the meantime, the approval is refused rather than applied to terms
 * nobody reviewed.
 */
export const approveContractSchema = z.strictObject({
  id: z.uuid({ error: "عقد غير صالح" }),
  revision: z.coerce.number().int().min(1),
});

export type ApproveContractInput = z.output<typeof approveContractSchema>;

/**
 * The idempotency key is generated with the form, so the same form sent twice
 * (a double click, a retried request) is one payment.
 */
export const recordPaymentSchema = z.strictObject({
  contractId: z.uuid({ error: "عقد غير صالح" }),
  amount: sarAmount("المبلغ").refine((amount) => amount > 0n, { error: "المبلغ يجب أن يكون أكبر من صفر" }),
  idempotencyKey: z.uuid({ error: "أعد تحميل الصفحة وحاول مرة أخرى" }),
});

export type RecordPaymentInput = z.output<typeof recordPaymentSchema>;

export const reservationListQuerySchema = z.object({
  status: z.preprocess(blankAsUndefined, z.enum(RESERVATION_STATUSES).optional()).catch(undefined),
  ...paginationFields(SALES_MAX_PAGE_SIZE),
});

export type ReservationListQuery = z.output<typeof reservationListQuerySchema>;

export const contractListQuerySchema = z.object({
  status: z.preprocess(blankAsUndefined, z.enum(CONTRACT_STATUSES).optional()).catch(undefined),
  ...paginationFields(SALES_MAX_PAGE_SIZE),
});

export type ContractListQuery = z.output<typeof contractListQuerySchema>;
