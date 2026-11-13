import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReservationStatusBadge } from "@/components/sales-badges";
import { buttonClass, Detail, PageHeader, SuccessNotice } from "@/components/ui";
import { formatDateTime, formatTimeLeft } from "@/lib/format";
import { can } from "@/lib/permissions";
import { RESERVATION_HOURS } from "@/lib/sales";
import { requireUser, tenantOf } from "@/server/auth/current-user";
import { getReservation } from "@/server/reservations/reservations.service";
import { uuidOrNotFound } from "@/server/route-params";

export const metadata: Metadata = { title: "تفاصيل الحجز — عقار لايت" };

export default async function ReservationPage({ params, searchParams }: PageProps<"/reservations/[id]">) {
  const session = await requireUser();
  const id = uuidOrNotFound((await params).id);
  const reservation = await getReservation(tenantOf(session), id);
  if (!reservation) notFound();

  const { saved } = await searchParams;
  const live = reservation.status === "active" && reservation.expiresAt > new Date();
  const canDraft = can(session.role, "contracts:create_draft") && reservation.reservedBy === session.userId;

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: "/reservations", label: "الحجوزات" }}
        title={`حجز الوحدة ${reservation.unitLabel}`}
        description={`للعميل ${reservation.clientName}`}
        actions={
          reservation.contractId ? (
            <Link href={`/contracts/${reservation.contractId}`} className={buttonClass.secondary}>
              عرض العقد
            </Link>
          ) : canDraft && live ? (
            <Link href={`/reservations/${reservation.id}/contract/new`} className={buttonClass.primary}>
              إنشاء مسودة عقد
            </Link>
          ) : null
        }
      />

      {saved === "reserved" ? (
        <SuccessNotice>
          تم حجز الوحدة لمدة {RESERVATION_HOURS} ساعة. أنشئ مسودة العقد ليعتمدها المحاسب قبل انتهاء الحجز.
        </SuccessNotice>
      ) : null}

      <dl className="grid gap-5 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="الحالة">
          <ReservationStatusBadge status={reservation.status} />
        </Detail>
        <Detail label="الوقت المتبقي">{live ? formatTimeLeft(reservation.expiresAt) : "—"}</Detail>
        <Detail label="المندوب">{reservation.repName}</Detail>
        <Detail label="بدأ في">{formatDateTime(reservation.createdAt)}</Detail>
        <Detail label="ينتهي في">{formatDateTime(reservation.expiresAt)}</Detail>
        <Detail label="الوحدة">
          <Link href={`/units/${reservation.unitId}`} className="text-emerald-700 hover:underline">
            {reservation.unitLabel}
          </Link>
        </Detail>
      </dl>

      {reservation.status === "expired" ? (
        <p className="text-sm text-slate-500">انتهت مدة الحجز فعادت الوحدة متاحة. يلزم حجز جديد لإنشاء عقد.</p>
      ) : reservation.contractId && live ? (
        <p className="text-sm text-slate-500">مسودة العقد بانتظار اعتماد المحاسب قبل انتهاء الحجز.</p>
      ) : null}
    </div>
  );
}
