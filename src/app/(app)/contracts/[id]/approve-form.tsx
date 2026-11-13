"use client";

import { BadgeCheck } from "lucide-react";
import { type FormEvent, useActionState, useState } from "react";
import { approveContractForm } from "@/app/actions/sales";
import { ConfirmDialog, ConfirmFact } from "@/components/confirm-dialog";
import { FormMessage } from "@/components/form-field";
import { buttonClass } from "@/components/ui";
import type { FormState } from "@/lib/form-state";

type ApproveFormProps = {
  contractId: string;
  revision: number;
  /** What the dialog repeats back before the approval is sent; already formatted. */
  summary: { unitLabel: string; clientName: string; finalPrice: string; downPayment: string; installmentCount: number };
};

/**
 * Posts the revision on screen, so an edit made since is not approved unseen.
 * Approval cannot be undone, so the button asks first: the form is sent only
 * from the dialog's confirm button.
 */
export function ApproveForm({ contractId, revision, summary }: ApproveFormProps) {
  const [state, formAction, isPending] = useActionState(approveContractForm, {} as FormState);
  // Open for the result it was opened on: when the server answers with a new
  // state (an error), the dialog closes and the message shows on the page.
  const [openedOn, setOpenedOn] = useState<FormState | null>(null);
  const open = openedOn === state;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (open) return;
    event.preventDefault();
    setOpenedOn(state);
  };

  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-4">
      <FormMessage message={state.message} />
      <input type="hidden" name="id" value={contractId} />
      <input type="hidden" name="revision" value={revision} />
      <p className="text-sm text-ink-muted">
        الاعتماد نهائي: يُثبَّت العقد وجدول أقساطه، وتصبح الوحدة مباعة، ولا يمكن تعديل العقد بعده.
      </p>
      <button type="button" onClick={() => setOpenedOn(state)} className={buttonClass.primary}>
        <BadgeCheck />
        اعتماد العقد
      </button>

      <ConfirmDialog
        open={open}
        onClose={() => setOpenedOn(null)}
        title="تأكيد اعتماد العقد"
        icon={BadgeCheck}
        confirmLabel="تأكيد الاعتماد"
        pendingLabel="جارٍ الاعتماد…"
        pending={isPending}
      >
        <p>بعد الاعتماد تصبح الوحدة مباعة ويُثبَّت جدول الأقساط. لا يمكن التراجع عن هذه الخطوة.</p>
        <dl className="rounded-lg border border-line bg-subtle px-3">
          <ConfirmFact label="الوحدة">{summary.unitLabel}</ConfirmFact>
          <ConfirmFact label="العميل">{summary.clientName}</ConfirmFact>
          <ConfirmFact label="السعر النهائي">{summary.finalPrice}</ConfirmFact>
          <ConfirmFact label="الدفعة الأولى">{summary.downPayment}</ConfirmFact>
          <ConfirmFact label="الأقساط الشهرية">{summary.installmentCount}</ConfirmFact>
        </dl>
      </ConfirmDialog>
    </form>
  );
}
