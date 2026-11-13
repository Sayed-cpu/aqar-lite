"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createClientForm, updateClientForm } from "@/app/actions/clients";
import { FormField, FormMessage, TextareaField } from "@/components/form-field";
import { buttonClass } from "@/components/ui";
import type { FormState } from "@/lib/form-state";
import { CLIENT_NOTES_MAX } from "@/lib/schemas/clients";

export type ClientFormValues = { name: string; phone: string; notes: string };

type ClientFormProps = {
  /** Present when editing; posted as a hidden field. */
  clientId?: string;
  values: ClientFormValues;
  cancelHref: string;
};

export function ClientForm({ clientId, values: initial, cancelHref }: ClientFormProps) {
  const initialState: FormState = { values: initial };
  const [state, formAction, isPending] = useActionState(clientId ? updateClientForm : createClientForm, initialState);
  const values = { ...initial, ...state.values };
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
      <FormMessage message={state.message} />
      {clientId ? <input type="hidden" name="id" value={clientId} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="اسم العميل"
          name="name"
          autoComplete="off"
          defaultValue={values.name}
          maxLength={120}
          required
          errors={errors.name}
        />
        <FormField
          label="رقم الجوال"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          dir="ltr"
          defaultValue={values.phone}
          required
          hint="مثال: 0551234567"
          errors={errors.phone}
        />
      </div>
      <TextareaField
        label="ملاحظات"
        name="notes"
        rows={5}
        maxLength={CLIENT_NOTES_MAX}
        defaultValue={values.notes}
        hint={`اختيارية، حتى ${CLIENT_NOTES_MAX} حرف`}
        errors={errors.notes}
      />

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={isPending} className={buttonClass.primary}>
          {isPending ? "جارٍ الحفظ…" : clientId ? "حفظ التعديلات" : "إضافة العميل"}
        </button>
        <Link href={cancelHref} className={buttonClass.secondary}>
          إلغاء
        </Link>
      </div>
    </form>
  );
}
