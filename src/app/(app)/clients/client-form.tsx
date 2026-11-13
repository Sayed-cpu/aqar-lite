"use client";

import { Save } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { createClientForm, updateClientForm } from "@/app/actions/clients";
import { FormActions, FormField, FormMessage, SubmitButton, TextareaField } from "@/components/form-field";
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
    <form action={formAction} noValidate className="space-y-5 rounded-xl border border-line bg-surface p-5 shadow-xs sm:p-6">
      <FormMessage message={state.message} />
      {clientId ? <input type="hidden" name="id" value={clientId} /> : null}

      <div className="grid gap-5 sm:grid-cols-2">
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

      <FormActions>
        <SubmitButton pending={isPending} pendingLabel="جارٍ الحفظ…" icon={<Save />}>
          {clientId ? "حفظ التعديلات" : "إضافة العميل"}
        </SubmitButton>
        <Link href={cancelHref} className={buttonClass.secondary}>
          إلغاء
        </Link>
      </FormActions>
    </form>
  );
}
