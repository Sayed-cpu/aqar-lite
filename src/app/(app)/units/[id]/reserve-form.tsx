"use client";

import { CalendarClock, UserPlus } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { reserveUnitForm } from "@/app/actions/sales";
import { FormMessage, SelectField, SubmitButton } from "@/components/form-field";
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">لحجز الوحدة أضف عميلًا أولًا؛ تُحجز الوحدة باسم أحد عملائك.</p>
        <Link href="/clients/new" className={buttonClass.secondary}>
          <UserPlus />
          إضافة عميل
        </Link>
      </div>
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
      <div className="max-w-md">
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
      </div>
      <SubmitButton pending={isPending} pendingLabel="جارٍ الحجز…" icon={<CalendarClock />}>
        احجز الوحدة
      </SubmitButton>
    </form>
  );
}
