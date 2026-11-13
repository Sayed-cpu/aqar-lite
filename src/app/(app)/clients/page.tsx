import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { FormField } from "@/components/form-field";
import { Pagination } from "@/components/pagination";
import { buttonClass, EmptyState, PageHeader, TableSkeleton } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";
import { type ClientListQuery, clientListQuerySchema } from "@/lib/schemas/clients";
import { requireUser, tenantOf } from "@/server/auth/current-user";
import { listClients } from "@/server/clients/clients.service";
import type { TenantCtx } from "@/server/db/tenant";

export const metadata: Metadata = { title: "العملاء — عقار لايت" };

function clientsHref(query: ClientListQuery, page = query.page): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (page > 1) params.set("page", String(page));
  if (query.pageSize !== 20) params.set("pageSize", String(query.pageSize));
  const search = params.toString();
  return search ? `/clients?${search}` : "/clients";
}

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  const session = await requireUser();
  const query = clientListQuerySchema.parse(await searchParams);
  const isRep = session.role === "sales_rep";
  const canCreate = can(session.role, "clients:create");
  const key = clientsHref(query);

  return (
    <div className="space-y-5">
      <PageHeader
        title={isRep ? "عملائي" : "العملاء"}
        description={isRep ? "العملاء الذين أضفتهم أنت فقط." : `كل عملاء ${session.companyName}، مع المندوب المسؤول.`}
        actions={
          canCreate ? (
            <Link href="/clients/new" className={buttonClass.primary}>
              إضافة عميل
            </Link>
          ) : null
        }
      />

      <Form
        key={key}
        action="/clients"
        role="search"
        aria-label="البحث في العملاء"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <div className="min-w-56 flex-1">
          <FormField
            label="بحث بالاسم أو الجوال"
            name="q"
            id="filter-q"
            type="search"
            maxLength={100}
            defaultValue={query.q ?? ""}
          />
        </div>
        <button type="submit" className={buttonClass.primary}>
          بحث
        </button>
        {query.q ? (
          <Link href="/clients" className={buttonClass.secondary}>
            مسح
          </Link>
        ) : null}
      </Form>

      <Suspense key={key} fallback={<TableSkeleton />}>
        <ClientResults ctx={tenantOf(session)} query={query} showOwner={!isRep} canCreate={canCreate} />
      </Suspense>
    </div>
  );
}

type ClientResultsProps = { ctx: TenantCtx; query: ClientListQuery; showOwner: boolean; canCreate: boolean };

async function ClientResults({ ctx, query, showOwner, canCreate }: ClientResultsProps) {
  const result = await listClients(ctx, query);

  if (result.items.length === 0) {
    if (result.total > 0) {
      return (
        <EmptyState title="لا يوجد عملاء في هذه الصفحة">
          <Link href={clientsHref(query, 1)} className="text-emerald-700 hover:underline">
            العودة إلى الصفحة الأولى
          </Link>
        </EmptyState>
      );
    }
    return query.q ? (
      <EmptyState title="لا يوجد عملاء يطابقون البحث">
        <Link href="/clients" className="text-emerald-700 hover:underline">
          عرض كل العملاء
        </Link>
      </EmptyState>
    ) : (
      <EmptyState title="لا يوجد عملاء بعد">{canCreate ? "أضف أول عميل من زر «إضافة عميل»." : null}</EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">{result.total} عميل</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[560px] text-right text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">العميل</th>
              <th className="px-4 py-3 font-medium">الجوال</th>
              {showOwner ? <th className="px-4 py-3 font-medium">المندوب</th> : null}
              <th className="px-4 py-3 font-medium">أُضيف في</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.items.map((client) => (
              <tr key={client.id}>
                <td className="px-4 py-3">
                  <Link href={`/clients/${client.id}`} className="font-medium text-slate-900 hover:text-emerald-700">
                    {client.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-700" dir="ltr">
                  {client.phone}
                </td>
                {showOwner ? <td className="px-4 py-3 text-slate-700">{client.ownerName}</td> : null}
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDateTime(client.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={result.page} pageCount={result.pageCount} hrefFor={(page) => clientsHref(query, page)} />
    </div>
  );
}
