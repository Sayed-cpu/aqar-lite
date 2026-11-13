import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ContractForm } from "@/app/(app)/contracts/contract-form";
import { PageHeader } from "@/components/ui";
import { minimumFinalPrice } from "@/domain/contracts";
import { todayIn } from "@/domain/dates";
import { formatTimeLeft } from "@/lib/format";
import { formatSar, toSarString } from "@/lib/money";
import { requirePermission, tenantOf } from "@/server/auth/current-user";
import { getReservation } from "@/server/reservations/reservations.service";
import { uuidOrNotFound } from "@/server/route-params";
import { getUnit } from "@/server/units/units.service";

export const metadata: Metadata = { title: "مسودة عقد — عقار لايت" };

export default async function NewContractPage({ params }: PageProps<"/reservations/[id]/contract/new">) {
  const session = await requirePermission("contracts:create_draft");
  const ctx = tenantOf(session);
  const id = uuidOrNotFound((await params).id);
  const reservation = await getReservation(ctx, id);
  if (!reservation || reservation.reservedBy !== session.userId) notFound();
  // Already drafted, or no longer active: the reservation page says which.
  if (reservation.contractId || reservation.status !== "active" || reservation.expiresAt <= new Date()) {
    redirect(`/reservations/${reservation.id}`);
  }
  const unit = await getUnit(ctx, reservation.unitId);
  if (!unit) notFound();

  const listPrice = unit.priceHalalas;
  const priceRange = `بين ${formatSar(minimumFinalPrice(listPrice))} و${formatSar(listPrice)} (خصم 5% على الأكثر)`;

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: `/reservations/${reservation.id}`, label: "الحجز" }}
        title={`مسودة عقد الوحدة ${reservation.unitLabel}`}
        description={`للعميل ${reservation.clientName} — سعر الوحدة ${formatSar(listPrice)} — يتبقى على الحجز ${formatTimeLeft(reservation.expiresAt)}`}
      />
      <ContractForm
        mode="create"
        reservationId={reservation.id}
        priceRange={priceRange}
        cancelHref={`/reservations/${reservation.id}`}
        values={{ finalPrice: toSarString(listPrice), downPayment: "0", installmentCount: "12", startDate: todayIn() }}
      />
    </div>
  );
}
