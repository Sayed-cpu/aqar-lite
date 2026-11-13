import { Search, SearchX, UserPlus, Users } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { DataTable, TBody, Td, Th, THead, Tr } from "@/components/data-table";
import { FormField } from "@/components/form-field";
import { Pagination } from "@/components/pagination";
import { buttonClass, EmptyState, PageHeader, ResultCount, TableSkeleton } from "@/components/ui";
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
    <div className="space-y-6">
      <PageHeader
        title={isRep ? "عملائي" : "العملاء"}
        description={isRep ? "العملاء الذين أضفتهم أنت فقط." : `كل عملاء ${session.companyName}، مع المندوب المسؤول.`}
        actions={
          canCreate ? (
            <Link href="/clients/new" className={buttonClass.primary}>
              <UserPlus />
              إضافة عميل
            </Link>
          ) : null
        }
      />

      <Form
        key={`filters:${key}`}
        action="/clients"
        role="search"
        aria-label="البحث في العملاء"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-4 shadow-xs sm:p-5"
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
          <Search />
          بحث
        </button>
        {query.q ? (
          <Link href="/clients" className={buttonClass.secondary}>
            مسح
          </Link>
        ) : null}
      </Form>

      <Suspense key={`results:${key}`} fallback={<TableSkeleton label="جارٍ تحميل العملاء…" />}>
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
        <EmptyState
          icon={SearchX}
          title="لا يوجد عملاء في هذه الصفحة"
          action={
            <Link href={clientsHref(query, 1)} className={buttonClass.secondary}>
              العودة إلى الصفحة الأولى
            </Link>
          }
        />
      );
    }
    return query.q ? (
      <EmptyState
        icon={SearchX}
        title="لا يوجد عملاء يطابقون البحث"
        action={
          <Link href="/clients" className={buttonClass.secondary}>
            عرض كل العملاء
          </Link>
        }
      >
        ابحث بجزء من الاسم، أو بأرقام الجوال كما كُتبت.
      </EmptyState>
    ) : (
      <EmptyState
        icon={Users}
        title="لا يوجد عملاء بعد"
        action={
          canCreate ? (
            <Link href="/clients/new" className={buttonClass.primary}>
              <UserPlus />
              أضف أول عميل
            </Link>
          ) : null
        }
      >
        {canCreate
          ? "العميل الذي تضيفه يُسجَّل باسمك، وتحجز له الوحدات من صفحاتها."
          : "يضيف المندوبون عملاءهم، ويظهرون هنا مع اسم المندوب."}
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      <ResultCount>{result.total} عميل</ResultCount>
      <DataTable label="جدول العملاء" className="md:min-w-[36rem]">
        <THead>
          <Th>العميل</Th>
          <Th>الجوال</Th>
          {showOwner ? <Th>المندوب</Th> : null}
          <Th>أُضيف في</Th>
        </THead>
        <TBody>
          {result.items.map((client) => (
            <Tr key={client.id}>
              <Td primary>
                <Link href={`/clients/${client.id}`} className="font-bold text-ink hover:text-primary-700 hover:underline">
                  {client.name}
                </Link>
              </Td>
              <Td label="الجوال" className="text-ink-muted tabular-nums">
                <span dir="ltr">{client.phone}</span>
              </Td>
              {showOwner ? (
                <Td label="المندوب" className="text-ink-muted">
                  {client.ownerName}
                </Td>
              ) : null}
              <Td label="أُضيف في" className="whitespace-nowrap text-ink-subtle">
                {formatDateTime(client.createdAt)}
              </Td>
            </Tr>
          ))}
        </TBody>
      </DataTable>
      <Pagination page={result.page} pageCount={result.pageCount} hrefFor={(page) => clientsHref(query, page)} />
    </div>
  );
}
