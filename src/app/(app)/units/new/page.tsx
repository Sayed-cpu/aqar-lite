import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/server/auth/current-user";
import { UnitForm } from "../unit-form";

export const metadata: Metadata = { title: "إضافة وحدة — عقار لايت" };

export default async function NewUnitPage() {
  const session = await requirePermission("units:create");

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader
        back={{ href: "/units", label: "الوحدات" }}
        title="إضافة وحدة"
        description={`تُضاف الوحدة إلى ${session.companyName} بحالة «متاحة».`}
      />
      <UnitForm
        cancelHref="/units"
        values={{ project: "", number: "", type: "", areaSqm: "", rooms: "", price: "" }}
      />
    </div>
  );
}
