import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Pagination } from "@/components/pagination";
import { ContractStatusBadge } from "@/components/sales-badges";
import { EmptyState, PageHeader, TableSkeleton } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { formatSar } from "@/lib/money";
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUSES } from "@/lib/sales";
import { type ContractListQuery, contractListQuerySchema } from "@/lib/schemas/sales";
import { requireUser, tenantOf } from "@/server/auth/current-user";
import { listContracts } from "@/server/contracts/contracts.service";
import type { TenantCtx } from "@/server/db/tenant";

export const metadata: Metadata = { title: "العقود — عقار لايت" };

function contractsHref(query: ContractListQuery, page = query.page): string {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/contracts?${search}` : "/contracts";
}

export default async function ContractsPage({ searchParams }: PageProps<"/contracts">) {
  const session = await requireUser();
  const query = contractListQuerySchema.parse(await searchParams);
  const isRep = session.role === "sales_rep";
  const tabs = [undefined, ...CONTRACT_STATUSES] as const;

  return (
    <div className="space-y-5">
      <PageHeader
        title={isRep ? "عقودي" : "العقود"}
        description={
          session.role === "accountant"
            ? "المسودات بانتظار اعتمادك، والعقود المعتمدة وأقساطها"
            : isRep
              ? "تُنشأ المسودة من صفحة الحجز."
              : `عقود ${session.companyName}`
        }
      />

      <nav aria-label="تصفية العقود" className="flex flex-wrap gap-2 text-sm">
        {tabs.map((status) => {
          const active = query.status === status;
          return (
            <Link
              key={status ?? "all"}
              href={contractsHref({ ...query, status }, 1)}
              aria-current={active ? "page" : undefined}
              className={`rounded-full border px-3 py-1 ${
                active ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              {status ? CONTRACT_STATUS_LABELS[status] : "الكل"}
            </Link>
          );
        })}
      </nav>

      <Suspense key={contractsHref(query)} fallback={<TableSkeleton />}>
        <ContractResults ctx={tenantOf(session)} query={query} isRep={isRep} />
      </Suspense>
    </div>
  );
}

async function ContractResults({ ctx, query, isRep }: { ctx: TenantCtx; query: ContractListQuery; isRep: boolean }) {
  const result = await listContracts(ctx, query);

  if (result.items.length === 0) {
    return <EmptyState title={query.status ? "لا توجد عقود بهذه الحالة" : "لا توجد عقود بعد"} />;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">{result.total} عقد</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-right text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">الوحدة</th>
              <th className="px-4 py-3 font-medium">العميل</th>
              {isRep ? null : <th className="px-4 py-3 font-medium">المندوب</th>}
              <th className="px-4 py-3 font-medium">السعر النهائي</th>
              <th className="px-4 py-3 font-medium">المتبقي</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
              <th className="px-4 py-3 font-medium">أُنشئ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.items.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3">
                  <Link href={`/contracts/${c.id}`} className="font-medium text-slate-900 hover:text-emerald-700">
                    {c.unitLabel}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-700">{c.clientName}</td>
                {isRep ? null : <td className="px-4 py-3 text-slate-700">{c.repName}</td>}
                <td className="whitespace-nowrap px-4 py-3 text-slate-900">{formatSar(c.finalPrice)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatSar(c.finalPrice - c.paid)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1">
                    <ContractStatusBadge status={c.status} />
                    {c.status === "draft" && !c.reservationLive ? (
                      <span className="text-xs text-amber-700">انتهى الحجز</span>
                    ) : null}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDateTime(c.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={result.page} pageCount={result.pageCount} hrefFor={(page) => contractsHref(query, page)} />
    </div>
  );
}
