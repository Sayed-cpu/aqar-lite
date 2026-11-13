import {
  BadgeCheck,
  Banknote,
  CalendarDays,
  FileText,
  HandCoins,
  Pencil,
  ReceiptText,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContractStatusBadge, InstallmentStateBadge } from "@/components/badges";
import { InlineCountdown } from "@/components/countdown";
import { DataTable, TBody, Td, Th, THead, Tr } from "@/components/data-table";
import {
  buttonClass,
  Card,
  Detail,
  EmptyState,
  linkClass,
  Money,
  Notice,
  PageHeader,
  ProgressBar,
  StatCard,
  SuccessNotice,
} from "@/components/ui";
import { todayIn } from "@/domain/dates";
import { installmentState, outstandingOf } from "@/domain/payments";
import { formatDateTime, formatLocalDate } from "@/lib/format";
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

const seqLabel = (seq: number) => (seq === 0 ? "الدفعة الأولى" : `القسط ${seq}`);

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

  // Read from the same schedule the table shows, with the domain's own rules.
  const rows = contract.installments.map((row) => ({
    ...row,
    outstanding: outstandingOf(row),
    state: isDraft ? null : installmentState(row, today),
  }));
  const overdue = rows.filter((row) => row.state === "overdue");
  const overdueAmount = overdue.reduce((sum, row) => sum + row.outstanding, 0n);
  const next = rows.find((row) => row.outstanding > 0n && row.state !== "overdue");
  const paidShare = contract.finalPrice > 0n ? Number((contract.paid * 1000n) / contract.finalPrice) / 1000 : 0;
  const renderedAt = new Date().toISOString();

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/contracts", label: "العقود" }}
        title={`عقد الوحدة ${contract.unitLabel}`}
        badge={<ContractStatusBadge status={contract.status} />}
        description={
          <>
            للعميل {contract.clientName} —{" "}
            <span dir="ltr" className="tabular-nums">
              {contract.clientPhone}
            </span>
          </>
        }
        actions={
          canEdit ? (
            <Link href={`/contracts/${contract.id}/edit`} className={buttonClass.secondary}>
              <Pencil />
              تعديل المسودة
            </Link>
          ) : null
        }
      />

      {savedMessage ? <SuccessNotice>{savedMessage}</SuccessNotice> : null}

      {isDraft && !contract.reservationLive ? (
        <Notice tone="warning" role="alert">
          انتهت مدة الحجز قبل اعتماد هذه المسودة فعادت الوحدة متاحة. لا يمكن اعتمادها أو تعديلها؛ يلزم حجز جديد.
        </Notice>
      ) : null}

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="السعر النهائي" icon={FileText}>
          <Money amount={contract.finalPrice} large />
        </StatCard>
        <StatCard
          label="المدفوع"
          icon={Wallet}
          tone="success"
          footer={
            <span className="block space-y-1.5">
              <ProgressBar value={paidShare} label="نسبة المدفوع من السعر النهائي" className="fill-success" />
              <span className="block tabular-nums">{Math.floor(paidShare * 100)}% من السعر النهائي</span>
            </span>
          }
        >
          <Money amount={contract.paid} large />
        </StatCard>
        <StatCard
          label="المتبقي"
          icon={HandCoins}
          tone="accent"
          footer={
            contract.remaining === 0n ? (
              "سُدِّد العقد بالكامل"
            ) : next ? (
              <>
                التالي: {seqLabel(next.seq)} في {formatLocalDate(next.dueDate)}
              </>
            ) : null
          }
        >
          <Money amount={contract.remaining} large className={contract.remaining === 0n ? "text-success" : undefined} />
        </StatCard>
        <StatCard
          label="الأقساط المتأخرة"
          icon={TriangleAlert}
          tone={overdue.length > 0 ? "danger" : "neutral"}
          emphasis={overdue.length > 0}
          footer={
            isDraft ? (
              "تُحسب بعد اعتماد العقد"
            ) : overdue.length > 0 ? (
              <span className="font-medium text-danger">
                متأخر سداده: <Money amount={overdueAmount} />
              </span>
            ) : (
              "لا يوجد قسط متأخر"
            )
          }
        >
          <span className={`tabular-nums ${overdue.length > 0 ? "text-danger" : ""}`}>{isDraft ? "—" : overdue.length}</span>
        </StatCard>
      </dl>

      {canApprove && contract.reservationLive ? (
        <Card title="اعتماد العقد" icon={BadgeCheck}>
          <ApproveForm
            contractId={contract.id}
            revision={contract.revision}
            summary={{
              unitLabel: contract.unitLabel,
              clientName: contract.clientName,
              finalPrice: formatSar(contract.finalPrice),
              downPayment: formatSar(contract.downPayment),
              installmentCount: contract.installmentCount,
            }}
          />
        </Card>
      ) : null}

      {canPay ? (
        <Card title="تسجيل دفعة" icon={Banknote}>
          {/* A fresh key with every render: after a payment, the next form is a new payment. */}
          <PaymentForm
            key={contract.payments.length}
            contractId={contract.id}
            idempotencyKey={crypto.randomUUID()}
            remaining={formatSar(contract.remaining)}
            unitLabel={contract.unitLabel}
          />
        </Card>
      ) : null}

      <Card title="بيانات العقد" icon={ReceiptText}>
        <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="سعر الوحدة">
            <Money amount={contract.listPrice} />
          </Detail>
          <Detail label="الدفعة الأولى">
            <Money amount={contract.downPayment} />
          </Detail>
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
              {contract.reservationLive ? (
                <InlineCountdown expiresAt={contract.reservationExpiresAt.toISOString()} now={renderedAt} />
              ) : (
                "انتهى"
              )}
            </Detail>
          )}
          <Detail label="الوحدة">
            <Link href={`/units/${contract.unitId}`} className={linkClass}>
              {contract.unitLabel}
            </Link>
          </Detail>
        </dl>
      </Card>

      <section aria-labelledby="schedule-title" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="schedule-title" className="flex items-center gap-2 text-lg font-bold text-ink">
            <CalendarDays className="size-5 text-primary-600" />
            جدول الأقساط
          </h2>
          {isDraft ? <p className="text-sm text-ink-subtle">تظهر حالة كل قسط بعد اعتماد العقد.</p> : null}
        </div>
        <DataTable label="جدول الأقساط" className="md:min-w-[40rem]">
          <THead>
            <Th>القسط</Th>
            <Th>تاريخ الاستحقاق</Th>
            <Th>المبلغ</Th>
            <Th>المدفوع</Th>
            <Th>المتبقي</Th>
            <Th>الحالة</Th>
          </THead>
          <TBody>
            {rows.map((row) => (
              <Tr key={row.id} tone={row.state === "overdue" ? "danger" : "default"}>
                <Td primary className="font-bold text-ink">
                  {seqLabel(row.seq)}
                </Td>
                <Td label="تاريخ الاستحقاق" className="whitespace-nowrap text-ink-muted">
                  {formatLocalDate(row.dueDate)}
                </Td>
                <Td label="المبلغ" className="font-medium text-ink">
                  <Money amount={row.amount} />
                </Td>
                <Td label="المدفوع" className="text-ink-muted">
                  <Money amount={row.paid} />
                </Td>
                <Td label="المتبقي" className="text-ink-muted">
                  <Money amount={row.outstanding} />
                </Td>
                <Td label="الحالة">
                  {row.state ? (
                    <InstallmentStateBadge state={row.state} />
                  ) : (
                    <span className="text-xs text-ink-subtle">بعد الاعتماد</span>
                  )}
                </Td>
              </Tr>
            ))}
          </TBody>
        </DataTable>
      </section>

      {contract.status === "approved" ? (
        <Card title="الدفعات المسجّلة" icon={Wallet}>
          {contract.payments.length === 0 ? (
            <EmptyState icon={Wallet} title="لم تُسجَّل أي دفعة بعد">
              {canPay ? "سجّل أول دفعة من نموذج «تسجيل دفعة» أعلاه." : null}
            </EmptyState>
          ) : (
            <ul className="-my-3 divide-y divide-line">
              {contract.payments.map((payment) => (
                <li key={payment.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-sm">
                  <div className="space-y-0.5">
                    <Money amount={payment.amount} className="text-base font-bold text-ink" />
                    <p className="text-ink-subtle">على: {payment.allocations.map((a) => seqLabel(a.seq)).join("، ")}</p>
                  </div>
                  <p className="text-ink-muted">
                    {payment.recorderName} — {formatDateTime(payment.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </div>
  );
}
