"use client";

import Link from "next/link";
import { type FormEvent, useActionState, useState } from "react";
import { createDraftForm, updateDraftForm } from "@/app/actions/sales";
import { FormField, FormMessage } from "@/components/form-field";
import { buttonClass } from "@/components/ui";
import { generateSchedule, MAX_INSTALLMENTS, scheduleProblem } from "@/domain/installments";
import { formatLocalDate } from "@/lib/format";
import type { FormState } from "@/lib/form-state";
import { formatSar, normalizeNumeral, parseSar } from "@/lib/money";

export type ContractFormValues = {
  finalPrice: string;
  downPayment: string;
  installmentCount: string;
  startDate: string;
};

type ContractFormProps =
  | { mode: "create"; reservationId: string; values: ContractFormValues; priceRange: string; cancelHref: string }
  | { mode: "edit"; contractId: string; values: ContractFormValues; priceRange: string; cancelHref: string };

/** What the typed terms would produce, or null while they are incomplete. */
function previewOf(values: ContractFormValues) {
  const finalPrice = parseSar(values.finalPrice);
  const downPayment = parseSar(values.downPayment || "0");
  const count = Number(normalizeNumeral(values.installmentCount));
  if (finalPrice === null || downPayment === null || !Number.isInteger(count)) return null;
  const terms = { finalPrice, downPayment, installmentCount: count, startDate: values.startDate };
  if (scheduleProblem(terms)) return null;
  const rows = generateSchedule(terms).filter((row) => row.seq > 0);
  const first = rows[0];
  const last = rows.at(-1);
  if (!first || !last) return null;
  // The leftover halalas go one each to the first installments.
  const bumped = rows.filter((row) => row.amount !== last.amount).length;
  return { count: rows.length, first, last, bumped };
}

export function ContractForm(props: ContractFormProps) {
  const action = props.mode === "create" ? createDraftForm : updateDraftForm;
  const [state, formAction, isPending] = useActionState(action, { values: props.values } as FormState);
  const values = { ...props.values, ...state.values } as ContractFormValues;
  const errors = state.fieldErrors ?? {};
  const [live, setLive] = useState(values);
  const preview = previewOf(live);

  const onChange = (event: FormEvent<HTMLFormElement>) => {
    const data = new FormData(event.currentTarget);
    setLive({
      finalPrice: String(data.get("finalPrice") ?? ""),
      downPayment: String(data.get("downPayment") ?? ""),
      installmentCount: String(data.get("installmentCount") ?? ""),
      startDate: String(data.get("startDate") ?? ""),
    });
  };

  return (
    <form
      action={formAction}
      onChange={onChange}
      noValidate
      className="space-y-5 rounded-xl border border-slate-200 bg-white p-5"
    >
      <FormMessage message={state.message} />
      {props.mode === "create" ? (
        <input type="hidden" name="reservationId" value={props.reservationId} />
      ) : (
        <input type="hidden" name="id" value={props.contractId} />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="السعر النهائي (ر.س)"
          name="finalPrice"
          inputMode="decimal"
          dir="ltr"
          defaultValue={values.finalPrice}
          required
          hint={props.priceRange}
          errors={errors.finalPrice}
        />
        <FormField
          label="الدفعة الأولى (ر.س)"
          name="downPayment"
          inputMode="decimal"
          dir="ltr"
          defaultValue={values.downPayment}
          required
          hint="تُستحق في تاريخ بداية العقد. اكتب 0 إن لم تكن هناك دفعة أولى."
          errors={errors.downPayment}
        />
        <FormField
          label="عدد الأقساط الشهرية"
          name="installmentCount"
          inputMode="numeric"
          dir="ltr"
          defaultValue={values.installmentCount}
          required
          hint={`من 1 إلى ${MAX_INSTALLMENTS}`}
          errors={errors.installmentCount}
        />
        <FormField
          label="تاريخ بداية العقد"
          name="startDate"
          type="date"
          dir="ltr"
          defaultValue={values.startDate}
          required
          hint="أول قسط شهري بعد شهر من هذا التاريخ"
          errors={errors.startDate}
        />
      </div>

      <div aria-live="polite" className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
        {preview ? (
          <>
            {preview.count} قسطًا شهريًا، من {formatLocalDate(preview.first.dueDate)} إلى{" "}
            {formatLocalDate(preview.last.dueDate)}، قيمة القسط {formatSar(preview.last.amount)}
            {preview.bumped > 0 ? `، وأول ${preview.bumped} منها بزيادة هللة واحدة ليطابق المجموع السعر النهائي` : ""}.
          </>
        ) : (
          "أكمل الحقول لعرض ملخص جدول الأقساط."
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={isPending} className={buttonClass.primary}>
          {isPending ? "جارٍ الحفظ…" : props.mode === "create" ? "حفظ المسودة" : "حفظ التعديلات"}
        </button>
        <Link href={props.cancelHref} className={buttonClass.secondary}>
          إلغاء
        </Link>
      </div>
    </form>
  );
}
