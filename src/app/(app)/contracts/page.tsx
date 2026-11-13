import { FileText, Timer, TimerOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ContractStatusBadge } from "@/components/badges";
import { DataTable, TBody, Td, Th, THead, Tr } from "@/components/data-table";
import { Pagination } from "@/components/pagination";
import {
  buttonClass,
  EmptyState,
  FilterTabs,
  Money,
  PageHeader,
  ResultCount,
  TableSkeleton,
} from "@/components/ui";
import { formatDateTime } from "@/lib/format";
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
    <div className="space-y-6">
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

      <FilterTabs
        label="تصفية العقود"
        tabs={tabs.map((status) => ({
          href: contractsHref({ ...query, status }, 1),
          label: status ? CONTRACT_STATUS_LABELS[status] : "الكل",
          current: query.status === status,
        }))}
      />

      <Suspense key={contractsHref(query)} fallback={<TableSkeleton label="جارٍ تحميل العقود…" />}>
        <ContractResults ctx={tenantOf(session)} query={query} isRep={isRep} />
      </Suspense>
    </div>
  );
}

async function ContractResults({ ctx, query, isRep }: { ctx: TenantCtx; query: ContractListQuery; isRep: boolean }) {
  const result = await listContracts(ctx, query);

  if (result.items.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title={query.status ? "لا توجد عقود بهذه الحالة" : "لا توجد عقود بعد"}
        action={
          isRep ? (
            <Link href="/reservations?status=active" className={buttonClass.primary}>
              <Timer />
              حجوزاتي النشطة
            </Link>
          ) : query.status ? (
            <Link href="/contracts" className={buttonClass.secondary}>
              عرض كل العقود
            </Link>
          ) : null
        }
      >
        {isRep
          ? "المسودة تُنشأ من صفحة حجز نشط، ثم يعتمدها المحاسب."
          : "تظهر هنا مسودات المندوبين فور إنشائها، والعقود بعد اعتمادها."}
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      <ResultCount>{result.total} عقد</ResultCount>
      <DataTable label="جدول العقود" className="md:min-w-[48rem]">
        <THead>
          <Th>الوحدة</Th>
          <Th>العميل</Th>
          {isRep ? null : <Th>المندوب</Th>}
          <Th>السعر النهائي</Th>
          <Th>المتبقي</Th>
          <Th>الحالة</Th>
          <Th>أُنشئ</Th>
        </THead>
        <TBody>
          {result.items.map((c) => (
            <Tr key={c.id}>
              <Td primary>
                <Link href={`/contracts/${c.id}`} className="font-bold text-ink hover:text-primary-700 hover:underline">
                  {c.unitLabel}
                </Link>
              </Td>
              <Td label="العميل" className="text-ink-muted">
                {c.clientName}
              </Td>
              {isRep ? null : (
                <Td label="المندوب" className="text-ink-muted">
                  {c.repName}
                </Td>
              )}
              <Td label="السعر النهائي" className="font-medium text-ink">
                <Money amount={c.finalPrice} />
              </Td>
              <Td label="المتبقي" className="text-ink-muted">
                <Money amount={c.finalPrice - c.paid} />
              </Td>
              <Td label="الحالة">
                <div className="flex flex-wrap items-center gap-1.5 max-md:justify-end">
                  <ContractStatusBadge status={c.status} />
                  {c.status === "draft" && !c.reservationLive ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
                      <TimerOff className="size-3.5" aria-hidden="true" />
                      انتهى الحجز
                    </span>
                  ) : null}
                </div>
              </Td>
              <Td label="أُنشئ" className="whitespace-nowrap text-ink-subtle">
                {formatDateTime(c.createdAt)}
              </Td>
            </Tr>
          ))}
        </TBody>
      </DataTable>
      <Pagination page={result.page} pageCount={result.pageCount} hrefFor={(page) => contractsHref(query, page)} />
    </div>
  );
}
