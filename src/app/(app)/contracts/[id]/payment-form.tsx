"use client";

import { useActionState } from "react";
import { recordPaymentForm } from "@/app/actions/sales";
import { FormField, FormMessage } from "@/components/form-field";
import { buttonClass } from "@/components/ui";
import type { FormState } from "@/lib/form-state";

type PaymentFormProps = {
  contractId: string;
  /** Minted with the page: the same form sent twice is one payment. */
  idempotencyKey: string;
  remaining: string;
};

export function PaymentForm({ contractId, idempotencyKey, remaining }: PaymentFormProps) {
  const [state, formAction, isPending] = useActionState(recordPaymentForm, {} as FormState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate className="space-y-3">
      <FormMessage message={state.message} />
      <input type="hidden" name="contractId" value={contractId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <FormField
        label="المبلغ المستلم (ر.س)"
        name="amount"
        inputMode="decimal"
        dir="ltr"
        defaultValue={state.values?.amount ?? ""}
        required
        hint={`يُوزَّع على أقدم الأقساط غير المدفوعة أولًا. المتبقي على العقد ${remaining}.`}
        errors={errors.amount}
      />
      <button type="submit" disabled={isPending} className={buttonClass.primary}>
        {isPending ? "جارٍ التسجيل…" : "تسجيل الدفعة"}
      </button>
    </form>
  );
}
