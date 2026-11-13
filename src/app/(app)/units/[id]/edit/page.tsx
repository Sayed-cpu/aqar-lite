import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { toSarString } from "@/lib/money";
import { UNIT_STATUS_LABELS } from "@/lib/units";
import { requirePermission, tenantOf } from "@/server/auth/current-user";
import { uuidOrNotFound } from "@/server/route-params";
import { getUnit } from "@/server/units/units.service";
import { UnitForm } from "../../unit-form";

export const metadata: Metadata = { title: "تعديل وحدة — عقار لايت" };

export default async function EditUnitPage({ params }: PageProps<"/units/[id]/edit">) {
  const session = await requirePermission("units:update");
  const id = uuidOrNotFound((await params).id);
  const unit = await getUnit(tenantOf(session), id);
  if (!unit) notFound();

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader
        back={{ href: `/units/${unit.id}`, label: `الوحدة ${unit.number}` }}
        title="تعديل الوحدة"
        description={unit.project}
      />
      <UnitForm
        unitId={unit.id}
        cancelHref={`/units/${unit.id}`}
        values={{
          project: unit.project,
          number: unit.number,
          type: unit.type,
          areaSqm: unit.areaSqm,
          rooms: String(unit.rooms),
          price: toSarString(unit.priceHalalas),
        }}
        priceLocked={
          unit.status === "available"
            ? undefined
            : `لا يمكن تعديل السعر لأن الوحدة ${UNIT_STATUS_LABELS[unit.status]}`
        }
      />
    </div>
  );
}
