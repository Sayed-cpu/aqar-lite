import { CalendarClock, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UnitStatusBadge } from "@/components/badges";
import { InlineCountdown } from "@/components/countdown";
import { buttonClass, Card, Detail, Money, Notice, PageHeader, SuccessNotice } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
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
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/units", label: "الوحدات" }}
        title={`الوحدة ${unit.number}`}
        badge={<UnitStatusBadge status={unit.status} />}
        description={unit.project}
        actions={
          can(session.role, "units:update") ? (
            <Link href={`/units/${unit.id}/edit`} className={buttonClass.secondary}>
              <Pencil />
              تعديل
            </Link>
          ) : null
        }
      />

      {savedMessage ? <SuccessNotice>{savedMessage}</SuccessNotice> : null}

      <Card>
        <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="السعر">
            <Money amount={unit.priceHalalas} large className="text-xl font-bold text-primary-800" />
          </Detail>
          <Detail label="النوع">{UNIT_TYPE_LABELS[unit.type]}</Detail>
          <Detail label="المساحة">{formatArea(unit.areaSqm)}</Detail>
          <Detail label="عدد الغرف">
            <span className="tabular-nums">{unit.rooms}</span>
          </Detail>
          <Detail label="آخر تحديث">{formatDateTime(unit.updatedAt)}</Detail>
        </dl>
      </Card>

      {canReserve && unit.status === "available" ? (
        <Card title="حجز الوحدة" icon={CalendarClock}>
          <ReserveForm unitId={unit.id} clients={ownClients} />
        </Card>
      ) : null}

      {reservation ? (
        <Notice tone="warning">
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              الوحدة محجوزة —{" "}
              <InlineCountdown expiresAt={reservation.expiresAt.toISOString()} now={new Date().toISOString()} />.
            </span>
            <Link href={`/reservations/${reservation.id}`} className="font-bold underline underline-offset-4">
              تفاصيل الحجز
            </Link>
          </span>
        </Notice>
      ) : null}

      {unit.status !== "available" ? (
        <p className="text-sm text-ink-subtle">
          الوحدة {UNIT_STATUS_LABELS[unit.status]}، لذلك لا يمكن تعديل سعرها.
        </p>
      ) : null}
    </div>
  );
}
