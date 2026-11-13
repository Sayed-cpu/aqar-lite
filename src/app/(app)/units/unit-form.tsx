"use client";

import { Save } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { createUnitForm, updateUnitForm } from "@/app/actions/units";
import { FormActions, FormField, FormMessage, SelectField, SubmitButton } from "@/components/form-field";
import { buttonClass } from "@/components/ui";
import type { FormState } from "@/lib/form-state";
import { UNIT_TYPE_LABELS, UNIT_TYPES } from "@/lib/units";

export type UnitFormValues = {
  project: string;
  number: string;
  type: string;
  areaSqm: string;
  rooms: string;
  price: string;
};

type UnitFormProps = {
  /** Present when editing; posted as a hidden field. */
  unitId?: string;
  values: UnitFormValues;
  /** Why the price cannot be changed, when it cannot. The server refuses regardless. */
  priceLocked?: string;
  cancelHref: string;
};

const TYPE_OPTIONS = [
  { value: "", label: "اختر النوع" },
  ...UNIT_TYPES.map((type) => ({ value: type, label: UNIT_TYPE_LABELS[type] })),
];

export function UnitForm({ unitId, values: initial, priceLocked, cancelHref }: UnitFormProps) {
  const initialState: FormState = { values: initial };
  const [state, formAction, isPending] = useActionState(unitId ? updateUnitForm : createUnitForm, initialState);
  const values = { ...initial, ...state.values };
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate className="space-y-5 rounded-xl border border-line bg-surface p-5 shadow-xs sm:p-6">
      <FormMessage message={state.message} />
      {unitId ? <input type="hidden" name="id" value={unitId} /> : null}

      <p className="text-xs text-ink-subtle">
        الحقول المعلّمة بـ <span className="text-danger">*</span> مطلوبة.
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          label="المشروع"
          name="project"
          defaultValue={values.project}
          maxLength={120}
          required
          errors={errors.project}
        />
        <FormField
          label="رقم الوحدة"
          name="number"
          defaultValue={values.number}
          maxLength={30}
          required
          errors={errors.number}
        />
        <SelectField
          key={values.type}
          label="نوع الوحدة"
          name="type"
          defaultValue={values.type}
          options={TYPE_OPTIONS}
          required
          errors={errors.type}
        />
        <FormField
          label="المساحة (م²)"
          name="areaSqm"
          inputMode="decimal"
          dir="ltr"
          defaultValue={values.areaSqm}
          required
          errors={errors.areaSqm}
        />
        <FormField
          label="عدد الغرف"
          name="rooms"
          inputMode="numeric"
          dir="ltr"
          defaultValue={values.rooms}
          required
          errors={errors.rooms}
        />
        <FormField
          label="السعر (ر.س)"
          name="price"
          inputMode="decimal"
          dir="ltr"
          defaultValue={values.price}
          readOnly={priceLocked !== undefined}
          required
          hint={priceLocked ?? "بالريال، بخانتين عشريتين على الأكثر — مثال: 850000.50"}
          errors={errors.price}
        />
      </div>

      <FormActions>
        <SubmitButton pending={isPending} pendingLabel="جارٍ الحفظ…" icon={<Save />}>
          {unitId ? "حفظ التعديلات" : "إضافة الوحدة"}
        </SubmitButton>
        <Link href={cancelHref} className={buttonClass.secondary}>
          إلغاء
        </Link>
      </FormActions>
    </form>
  );
}
