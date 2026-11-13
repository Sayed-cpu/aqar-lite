import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/server/auth/current-user";
import { ClientForm } from "../client-form";

export const metadata: Metadata = { title: "إضافة عميل — عقار لايت" };

export default async function NewClientPage() {
  await requirePermission("clients:create");

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader
        back={{ href: "/clients", label: "عملائي" }}
        title="إضافة عميل"
        description="يُسجَّل العميل باسمك، ولا يراه غيرك من المندوبين."
      />
      <ClientForm cancelHref="/clients" values={{ name: "", phone: "", notes: "" }} />
    </div>
  );
}
