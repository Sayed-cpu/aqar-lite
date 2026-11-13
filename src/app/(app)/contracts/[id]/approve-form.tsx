"use client";

import { useActionState } from "react";
import { approveContractForm } from "@/app/actions/sales";
import { FormMessage } from "@/components/form-field";
import { buttonClass } from "@/components/ui";
import type { FormState } from "@/lib/form-state";

/** Posts the revision on screen, so an edit made since is not approved unseen. */
export function ApproveForm({ contractId, revision }: { contractId: string; revision: number }) {
  const [state, formAction, isPending] = useActionState(approveContractForm, {} as FormState);
  return (
    <form action={formAction} className="space-y-3">
      <FormMessage message={state.message} />
      <input type="hidden" name="id" value={contractId} />
      <input type="hidden" name="revision" value={revision} />
      <p className="text-sm text-slate-600">
        الاعتماد نهائي: يُثبَّت العقد وجدول أقساطه، وتصبح الوحدة مباعة، ولا يمكن تعديل العقد بعده.
      </p>
      <button type="submit" disabled={isPending} className={buttonClass.primary}>
        {isPending ? "جارٍ الاعتماد…" : "اعتماد العقد"}
      </button>
    </form>
  );
}
