import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClass, Detail, PageHeader, SuccessNotice } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireUser, tenantOf } from "@/server/auth/current-user";
import { getClient } from "@/server/clients/clients.service";
import { uuidOrNotFound } from "@/server/route-params";

export const metadata: Metadata = { title: "بيانات العميل — عقار لايت" };

const SAVED_MESSAGES: Record<string, string> = {
  created: "تمت إضافة العميل.",
  updated: "تم حفظ التعديلات.",
};

export default async function ClientPage({ params, searchParams }: PageProps<"/clients/[id]">) {
  const session = await requireUser();
  const id = uuidOrNotFound((await params).id);
  // Another rep's client, or another company's, is answered like a missing one.
  const client = await getClient(tenantOf(session), id);
  if (!client) notFound();

  const { saved } = await searchParams;
  const savedMessage = typeof saved === "string" ? SAVED_MESSAGES[saved] : undefined;
  const canEdit = can(session.role, "clients:update") && client.ownerUserId === session.userId;

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: "/clients", label: session.role === "sales_rep" ? "عملائي" : "العملاء" }}
        title={client.name}
        actions={
          canEdit ? (
            <Link href={`/clients/${client.id}/edit`} className={buttonClass.secondary}>
              تعديل
            </Link>
          ) : null
        }
      />

      {savedMessage ? <SuccessNotice>{savedMessage}</SuccessNotice> : null}

      <dl className="grid gap-5 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-3">
        <Detail label="الجوال">
          <span dir="ltr">{client.phone}</span>
        </Detail>
        <Detail label="المندوب المسؤول">{client.ownerName}</Detail>
        <Detail label="أُضيف في">{formatDateTime(client.createdAt)}</Detail>
      </dl>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-medium text-slate-500">ملاحظات</h2>
        {/* Plain text: React escapes it, and nothing here parses markup. */}
        {client.notes ? (
          <p className="mt-2 whitespace-pre-wrap break-words text-slate-800">{client.notes}</p>
        ) : (
          <p className="mt-2 text-slate-400">لا توجد ملاحظات.</p>
        )}
      </section>
    </div>
  );
}
