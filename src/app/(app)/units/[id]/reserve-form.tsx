"use client";

import Link from "next/link";
import { useActionState } from "react";
import { reserveUnitForm } from "@/app/actions/sales";
import { FormMessage, SelectField } from "@/components/form-field";
import { buttonClass } from "@/components/ui";
import type { FormState } from "@/lib/form-state";
import { RESERVATION_HOURS } from "@/lib/sales";

type ReserveFormProps = {
  unitId: string;
  clients: readonly { id: string; name: string; phone: string }[];
};

export function ReserveForm({ unitId, clients }: ReserveFormProps) {
  const [state, formAction, isPending] = useActionState(reserveUnitForm, {} as FormState);
  const errors = state.fieldErrors ?? {};
  const selected = state.values?.clientId ?? "";

  if (clients.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        لحجز الوحدة أضف عميلًا أولًا من{" "}
        <Link href="/clients/new" className="text-emerald-700 hover:underline">
          صفحة إضافة عميل
        </Link>
        .
      </p>
    );
  }

  const options = [
    { value: "", label: "اختر العميل" },
    ...clients.map((client) => ({ value: client.id, label: `${client.name} — ${client.phone}` })),
  ];

  return (
    <form action={formAction} noValidate className="space-y-4">
      <FormMessage message={state.message} />
      <input type="hidden" name="unitId" value={unitId} />
      <SelectField
        key={selected}
        label="العميل"
        name="clientId"
        defaultValue={selected}
        options={options}
        required
        hint={`تُحجز الوحدة لهذا العميل ${RESERVATION_HOURS} ساعة، ثم تعود متاحة تلقائيًا إن لم يُعتمد عقدها.`}
        errors={errors.clientId}
      />
      <button type="submit" disabled={isPending} className={buttonClass.primary}>
        {isPending ? "جارٍ الحجز…" : "احجز الوحدة"}
      </button>
    </form>
  );
}
