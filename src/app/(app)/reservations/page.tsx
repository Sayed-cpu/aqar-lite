import { Building, Timer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ReservationStatusBadge } from "@/components/badges";
import { DataTable, TBody, Td, Th, THead, Tr } from "@/components/data-table";
import { Pagination } from "@/components/pagination";
import { buttonClass, EmptyState, FilterTabs, PageHeader, ResultCount, TableSkeleton } from "@/components/ui";
import { formatDateTime, formatTimeLeft } from "@/lib/format";
import { RESERVATION_STATUS_LABELS, RESERVATION_STATUSES } from "@/lib/sales";
import { type ReservationListQuery, reservationListQuerySchema } from "@/lib/schemas/sales";
import { requireUser, tenantOf } from "@/server/auth/current-user";
import type { TenantCtx } from "@/server/db/tenant";
import { listReservations } from "@/server/reservations/reservations.service";

export const metadata: Metadata = { title: "الحجوزات — عقار لايت" };

function reservationsHref(query: ReservationListQuery, page = query.page): string {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/reservations?${search}` : "/reservations";
}

const HOUR = 3_600_000;

export default async function ReservationsPage({ searchParams }: PageProps<"/reservations">) {
  const session = await requireUser();
  const query = reservationListQuerySchema.parse(await searchParams);
  const isRep = session.role === "sales_rep";
  const tabs = [undefined, ...RESERVATION_STATUSES] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        title={isRep ? "حجوزاتي" : "الحجوزات"}
        description={isRep ? "لحجز وحدة افتح صفحتها من قائمة الوحدات." : `حجوزات ${session.companyName}`}
      />

      <FilterTabs
        label="تصفية الحجوزات"
        tabs={tabs.map((status) => ({
          href: reservationsHref({ ...query, status }, 1),
          label: status ? RESERVATION_STATUS_LABELS[status] : "الكل",
          current: query.status === status,
        }))}
      />

      <Suspense key={reservationsHref(query)} fallback={<TableSkeleton label="جارٍ تحميل الحجوزات…" />}>
        <ReservationResults ctx={tenantOf(session)} query={query} isRep={isRep} />
      </Suspense>
    </div>
  );
}

async function ReservationResults({ ctx, query, isRep }: { ctx: TenantCtx; query: ReservationListQuery; isRep: boolean }) {
  const result = await listReservations(ctx, query);
  const now = new Date().getTime();

  if (result.items.length === 0) {
    return (
      <EmptyState
        icon={Timer}
        title={query.status ? "لا توجد حجوزات بهذه الحالة" : "لا توجد حجوزات بعد"}
        action={
          isRep ? (
            <Link href="/units?status=available" className={buttonClass.primary}>
              <Building />
              تصفّح الوحدات المتاحة
            </Link>
          ) : query.status ? (
            <Link href="/reservations" className={buttonClass.secondary}>
              عرض كل الحجوزات
            </Link>
          ) : null
        }
      >
        {isRep ? "احجز وحدة متاحة لأحد عملائك، ثم أنشئ مسودة عقدها قبل انتهاء الحجز." : null}
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      <ResultCount>{result.total} حجز</ResultCount>
      <DataTable label="جدول الحجوزات" className="md:min-w-[44rem]">
        <THead>
          <Th>الوحدة</Th>
          <Th>العميل</Th>
          {isRep ? null : <Th>المندوب</Th>}
          <Th>بدأ</Th>
          <Th>الحالة</Th>
          <Th>المتبقي</Th>
        </THead>
        <TBody>
          {result.items.map((r) => {
            const left = r.expiresAt.getTime() - now;
            const urgent = r.status === "active" && left > 0 && left < 6 * HOUR;
            return (
              <Tr key={r.id}>
                <Td primary>
                  <Link href={`/reservations/${r.id}`} className="font-bold text-ink hover:text-primary-700 hover:underline">
                    {r.unitLabel}
                  </Link>
                </Td>
                <Td label="العميل" className="text-ink-muted">
                  {r.clientName}
                </Td>
                {isRep ? null : (
                  <Td label="المندوب" className="text-ink-muted">
                    {r.repName}
                  </Td>
                )}
                <Td label="بدأ" className="whitespace-nowrap text-ink-subtle">
                  {formatDateTime(r.createdAt)}
                </Td>
                <Td label="الحالة">
                  <ReservationStatusBadge status={r.status} />
                </Td>
                <Td label="المتبقي" className={`whitespace-nowrap ${urgent ? "font-bold text-danger" : "text-ink-muted"}`}>
                  {r.status === "active" ? formatTimeLeft(r.expiresAt) : "—"}
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </DataTable>
      <Pagination page={result.page} pageCount={result.pageCount} hrefFor={(page) => reservationsHref(query, page)} />
    </div>
  );
}
