import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClass, Detail, PageHeader, SuccessNotice } from "@/components/ui";
import { UnitStatusBadge } from "@/components/unit-status-badge";
import { formatDateTime, formatTimeLeft } from "@/lib/format";
import { formatSar } from "@/lib/money";
import { can } from "@/lib/permissions";
import { formatArea, UNIT_STATUS_LABELS, UNIT_TYPE_LABELS } from "@/lib/units";
import { requireUser, tenantOf } from "@/server/auth/current-user";
import { listOwnClientOptions } from "@/server/clients/clients.service";
import { activeReservationOf } from "@/server/reservations/reservations.service";
import { uuidOrNotFound } from "@/server/route-params";
import { getUnit } from "@/server/units/units.service";
import { ReserveForm } from "./reserve-form";

export const metadata: Metadata = { title: "تفاصيل الوحدة — عقار لايت" };

const SAVED_MESSAGES: Record<string, string> = {
  created: "تمت إضافة الوحدة.",
  updated: "تم حفظ التعديلات.",
};

export default async function UnitPage({ params, searchParams }: PageProps<"/units/[id]">) {
  const session = await requireUser();
  const id = uuidOrNotFound((await params).id);
  // Another company's unit is answered exactly like one that does not exist.
  const unit = await getUnit(tenantOf(session), id);
  if (!unit) notFound();

  const ctx = tenantOf(session);
  const canReserve = can(session.role, "reservations:create");
  // The reservation the viewer may see: a rep sees only their own.
  const reservation = unit.status === "reserved" ? await activeReservationOf(ctx, unit.id) : null;
  const ownClients = canReserve && unit.status === "available" ? await listOwnClientOptions(ctx) : [];

  const { saved } = await searchParams;
  const savedMessage = typeof saved === "string" ? SAVED_MESSAGES[saved] : undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: "/units", label: "الوحدات" }}
        title={`الوحدة ${unit.number}`}
        description={unit.project}
        actions={
          can(session.role, "units:update") ? (
            <Link href={`/units/${unit.id}/edit`} className={buttonClass.secondary}>
              تعديل
            </Link>
          ) : null
        }
      />

      {savedMessage ? <SuccessNotice>{savedMessage}</SuccessNotice> : null}

      <dl className="grid gap-5 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="الحالة">
          <UnitStatusBadge status={unit.status} />
        </Detail>
        <Detail label="السعر">{formatSar(unit.priceHalalas)}</Detail>
        <Detail label="النوع">{UNIT_TYPE_LABELS[unit.type]}</Detail>
        <Detail label="المساحة">{formatArea(unit.areaSqm)}</Detail>
        <Detail label="عدد الغرف">{unit.rooms}</Detail>
        <Detail label="آخر تحديث">{formatDateTime(unit.updatedAt)}</Detail>
      </dl>

      {canReserve && unit.status === "available" ? (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">حجز الوحدة</h2>
          <ReserveForm unitId={unit.id} clients={ownClients} />
        </section>
      ) : null}

      {reservation ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          محجوزة — يتبقى {formatTimeLeft(reservation.expiresAt)}.{" "}
          <Link href={`/reservations/${reservation.id}`} className="font-medium underline">
            تفاصيل الحجز
          </Link>
        </section>
      ) : null}

      {unit.status !== "available" ? (
        <p className="text-sm text-slate-500">
          الوحدة {UNIT_STATUS_LABELS[unit.status]}، لذلك لا يمكن تعديل سعرها.
        </p>
      ) : null}
    </div>
  );
}
