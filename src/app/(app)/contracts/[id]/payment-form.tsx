"use client";

import { Banknote } from "lucide-react";
import { type FormEvent, startTransition, useActionState, useRef, useState } from "react";
import { recordPaymentForm } from "@/app/actions/sales";
import { ConfirmDialog, ConfirmFact } from "@/components/confirm-dialog";
import { FormField, FormMessage } from "@/components/form-field";
import { buttonClass } from "@/components/ui";
import type { FormState } from "@/lib/form-state";
import { formatSar, parseSar } from "@/lib/money";

type PaymentFormProps = {
  contractId: string;
  /** Minted with the page: the same form sent twice is one payment. */
  idempotencyKey: string;
  remaining: string;
  unitLabel: string;
};

/**
 * A recorded payment is never edited or deleted, so the amount is read back
 * in a dialog before it is sent. Enter in the field opens the dialog too,
 * rather than sending the form behind it.
 */
export function PaymentForm({ contractId, idempotencyKey, remaining, unitLabel }: PaymentFormProps) {
  const [state, formAction, isPending] = useActionState(recordPaymentForm, {} as FormState);
  const errors = state.fieldErrors ?? {};
  const formRef = useRef<HTMLFormElement>(null);
  // The amount being confirmed, and the result it was opened on (see ApproveForm).
  const [confirming, setConfirming] = useState<{ on: FormState; amount: string } | null>(null);
  const open = confirming?.on === state;

  const review = () => {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const amount = parseSar(String(data.get("amount") ?? ""));
    if (amount === null || amount <= 0n) {
      // Nothing to confirm: let the server say what is wrong, beside the field.
      startTransition(() => formAction(data));
      return;
    }
    setConfirming({ on: state, amount: formatSar(amount) });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (open) return;
    event.preventDefault();
    review();
  };

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} noValidate className="space-y-4">
      <FormMessage message={state.message} />
      <input type="hidden" name="contractId" value={contractId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <div className="max-w-sm">
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
      </div>
      <button type="button" onClick={review} disabled={isPending} className={buttonClass.primary}>
        <Banknote />
        تسجيل الدفعة
      </button>

      <ConfirmDialog
        open={open}
        onClose={() => setConfirming(null)}
        title="تأكيد تسجيل دفعة"
        icon={Banknote}
        confirmLabel="تأكيد التسجيل"
        pendingLabel="جارٍ التسجيل…"
        pending={isPending}
      >
        <p>تأكد من المبلغ قبل التسجيل: الدفعة لا تُعدَّل ولا تُحذف بعد تسجيلها.</p>
        <dl className="rounded-lg border border-line bg-subtle px-3">
          <ConfirmFact label="العقد">{unitLabel}</ConfirmFact>
          <ConfirmFact label="المبلغ">{confirming?.amount}</ConfirmFact>
          <ConfirmFact label="المتبقي قبل الدفعة">{remaining}</ConfirmFact>
        </dl>
      </ConfirmDialog>
    </form>
  );
}
