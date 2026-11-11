import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requirePermission, tenantOf } from "@/server/auth/current-user";
import { getClient } from "@/server/clients/clients.service";
import { uuidOrNotFound } from "@/server/route-params";
import { ClientForm } from "../../client-form";

export const metadata: Metadata = { title: "تعديل عميل — عقار لايت" };

export default async function EditClientPage({ params }: PageProps<"/clients/[id]/edit">) {
  const session = await requirePermission("clients:update");
  const id = uuidOrNotFound((await params).id);
  const client = await getClient(tenantOf(session), id);
  // Only the owning rep edits; a rep only ever sees their own clients anyway.
  if (!client || client.ownerUserId !== session.userId) notFound();

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader back={{ href: `/clients/${client.id}`, label: client.name }} title="تعديل العميل" />
      <ClientForm
        clientId={client.id}
        cancelHref={`/clients/${client.id}`}
        values={{ name: client.name, phone: client.phone, notes: client.notes }}
      />
    </div>
  );
}
