import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContractStatusBadge, InstallmentStateBadge } from "@/components/sales-badges";
import { buttonClass, Detail, EmptyState, PageHeader, SuccessNotice } from "@/components/ui";
import { todayIn } from "@/domain/dates";
import { installmentState, outstandingOf } from "@/domain/payments";
import { formatDateTime, formatLocalDate, formatTimeLeft } from "@/lib/format";
import { formatSar } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireUser, tenantOf } from "@/server/auth/current-user";
import { getContract } from "@/server/contracts/contracts.service";
import { uuidOrNotFound } from "@/server/route-params";
import { ApproveForm } from "./approve-form";
import { PaymentForm } from "./payment-form";

export const metadata: Metadata = { title: "تفاصيل العقد — عقار لايت" };

const SAVED_MESSAGES: Record<string, string> = {
  drafted: "تم حفظ مسودة العقد. يعتمدها المحاسب قبل انتهاء الحجز.",
  updated: "تم حفظ تعديلات المسودة وإعادة بناء جدول الأقساط.",
  approved: "تم اعتماد العقد، وأصبحت الوحدة مباعة.",
  paid: "تم تسجيل الدفعة.",
  "paid-once": "هذه الدفعة سُجِّلت من قبل، ولم تُسجَّل مرة ثانية.",
};

export default async function ContractPage({ params, searchParams }: PageProps<"/contracts/[id]">) {
  const session = await requireUser();
  const id = uuidOrNotFound((await params).id);
  const contract = await getContract(tenantOf(session), id);
  if (!contract) notFound();

  const { saved } = await searchParams;
  const savedMessage = typeof saved === "string" ? SAVED_MESSAGES[saved] : undefined;
  const today = todayIn();
  const isDraft = contract.status === "draft";
  const canEdit = isDraft && contract.reservationLive && contract.salesRepId === session.userId;
  const canApprove = isDraft && can(session.role, "contracts:approve");
  const canPay = contract.status === "approved" && contract.remaining > 0n && can(session.role, "payments:create");

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: "/contracts", label: "العقود" }}
        title={`عقد الوحدة ${contract.unitLabel}`}
        description={`للعميل ${contract.clientName} — ${contract.clientPhone}`}
        actions={
          canEdit ? (
            <Link href={`/contracts/${contract.id}/edit`} className={buttonClass.secondary}>
              تعديل المسودة
            </Link>
          ) : null
        }
      />

      {savedMessage ? <SuccessNotice>{savedMessage}</SuccessNotice> : null}

      <dl className="grid gap-5 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Detail label="الحالة">
          <ContractStatusBadge status={contract.status} />
        </Detail>
        <Detail label="السعر النهائي">{formatSar(contract.finalPrice)}</Detail>
        <Detail label="المدفوع">{formatSar(contract.paid)}</Detail>
        <Detail label="المتبقي">
          <span className={contract.remaining > 0n ? "text-slate-900" : "text-emerald-700"}>
            {formatSar(contract.remaining)}
          </span>
        </Detail>
        <Detail label="سعر الوحدة">{formatSar(contract.listPrice)}</Detail>
        <Detail label="الدفعة الأولى">{formatSar(contract.downPayment)}</Detail>
        <Detail label="عدد الأقساط">{contract.installmentCount} قسطًا شهريًا</Detail>
        <Detail label="بداية العقد">{formatLocalDate(contract.startDate)}</Detail>
        <Detail label="المندوب">{contract.repName}</Detail>
        <Detail label="أُنشئ في">{formatDateTime(contract.createdAt)}</Detail>
        {contract.approvedAt ? (
          <Detail label="اعتمده">
            {contract.approverName} — {formatDateTime(contract.approvedAt)}
          </Detail>
        ) : (
          <Detail label="الحجز">
            {contract.reservationLive ? `يتبقى ${formatTimeLeft(contract.reservationExpiresAt)}` : "انتهى"}
          </Detail>
        )}
      </dl>

      {isDraft && !contract.reservationLive ? (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          انتهت مدة الحجز قبل اعتماد هذه المسودة فعادت الوحدة متاحة. لا يمكن اعتمادها أو تعديلها؛ يلزم حجز جديد.
        </div>
      ) : null}

      {canApprove && contract.reservationLive ? (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">اعتماد العقد</h2>
          <ApproveForm contractId={contract.id} revision={contract.revision} />
        </section>
      ) : null}

      {canPay ? (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">تسجيل دفعة</h2>
          {/* A fresh key with every render: after a payment, the next form is a new payment. */}
          <PaymentForm
            key={contract.payments.length}
            contractId={contract.id}
            idempotencyKey={crypto.randomUUID()}
            remaining={formatSar(contract.remaining)}
          />
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-semibold text-slate-900">جدول الأقساط</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-right text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">القسط</th>
                <th className="px-4 py-3 font-medium">تاريخ الاستحقاق</th>
                <th className="px-4 py-3 font-medium">المبلغ</th>
                <th className="px-4 py-3 font-medium">المدفوع</th>
                <th className="px-4 py-3 font-medium">المتبقي</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contract.installments.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-slate-900">{row.seq === 0 ? "الدفعة الأولى" : `القسط ${row.seq}`}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatLocalDate(row.dueDate)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-900">{formatSar(row.amount)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatSar(row.paid)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatSar(outstandingOf(row))}</td>
                  <td className="px-4 py-3">
                    {isDraft ? <span className="text-xs text-slate-500">بعد الاعتماد</span> : <InstallmentStateBadge state={installmentState(row, today)} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {contract.status === "approved" ? (
        <section className="space-y-3">
          <h2 className="font-semibold text-slate-900">الدفعات المسجّلة</h2>
          {contract.payments.length === 0 ? (
            <EmptyState title="لم تُسجَّل أي دفعة بعد" />
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {contract.payments.map((payment) => (
                <li key={payment.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
                  <div>
                    <span className="font-medium text-slate-900">{formatSar(payment.amount)}</span>
                    <span className="text-slate-500">
                      {" "}
                      — {payment.allocations.map((a) => (a.seq === 0 ? "الدفعة الأولى" : `القسط ${a.seq}`)).join("، ")}
                    </span>
                  </div>
                  <div className="text-slate-500">
                    {payment.recorderName} — {formatDateTime(payment.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
