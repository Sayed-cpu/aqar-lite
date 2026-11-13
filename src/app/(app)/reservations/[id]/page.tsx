import { FilePen, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReservationStatusBadge } from "@/components/badges";
import { ReservationCountdown } from "@/components/countdown";
import { buttonClass, Card, Detail, linkClass, Notice, PageHeader, SuccessNotice } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
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
  const now = new Date();
  const live = reservation.status === "active" && reservation.expiresAt > now;
  const canDraft = can(session.role, "contracts:create_draft") && reservation.reservedBy === session.userId;

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/reservations", label: "الحجوزات" }}
        title={`حجز الوحدة ${reservation.unitLabel}`}
        badge={<ReservationStatusBadge status={reservation.status} />}
        description={`للعميل ${reservation.clientName}`}
        actions={
          reservation.contractId ? (
            <Link href={`/contracts/${reservation.contractId}`} className={buttonClass.secondary}>
              <FileText />
              عرض العقد
            </Link>
          ) : canDraft && live ? (
            <Link href={`/reservations/${reservation.id}/contract/new`} className={buttonClass.primary}>
              <FilePen />
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

      {live ? (
        <ReservationCountdown
          expiresAt={reservation.expiresAt.toISOString()}
          now={now.toISOString()}
          totalHours={RESERVATION_HOURS}
        />
      ) : null}

      <Card>
        <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="الوحدة">
            <Link href={`/units/${reservation.unitId}`} className={linkClass}>
              {reservation.unitLabel}
            </Link>
          </Detail>
          <Detail label="العميل">{reservation.clientName}</Detail>
          <Detail label="المندوب">{reservation.repName}</Detail>
          <Detail label="بدأ في">{formatDateTime(reservation.createdAt)}</Detail>
          <Detail label="ينتهي في">{formatDateTime(reservation.expiresAt)}</Detail>
          <Detail label="المدة">{RESERVATION_HOURS} ساعة</Detail>
        </dl>
      </Card>

      {reservation.status === "expired" ? (
        <Notice tone="info">انتهت مدة الحجز فعادت الوحدة متاحة. يلزم حجز جديد لإنشاء عقد.</Notice>
      ) : reservation.contractId && live ? (
        <Notice tone="info">مسودة العقد بانتظار اعتماد المحاسب قبل انتهاء الحجز.</Notice>
      ) : null}
    </div>
  );
}
