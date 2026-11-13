import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Pagination } from "@/components/pagination";
import { ReservationStatusBadge } from "@/components/sales-badges";
import { EmptyState, PageHeader, TableSkeleton } from "@/components/ui";
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

export default async function ReservationsPage({ searchParams }: PageProps<"/reservations">) {
  const session = await requireUser();
  const query = reservationListQuerySchema.parse(await searchParams);
  const isRep = session.role === "sales_rep";
  const tabs = [undefined, ...RESERVATION_STATUSES] as const;

  return (
    <div className="space-y-5">
      <PageHeader
        title={isRep ? "حجوزاتي" : "الحجوزات"}
        description={isRep ? "لحجز وحدة افتح صفحتها من قائمة الوحدات." : `حجوزات ${session.companyName}`}
      />

      <nav aria-label="تصفية الحجوزات" className="flex flex-wrap gap-2 text-sm">
        {tabs.map((status) => {
          const active = query.status === status;
          return (
            <Link
              key={status ?? "all"}
              href={reservationsHref({ ...query, status }, 1)}
              aria-current={active ? "page" : undefined}
              className={`rounded-full border px-3 py-1 ${
                active ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              {status ? RESERVATION_STATUS_LABELS[status] : "الكل"}
            </Link>
          );
        })}
      </nav>

      <Suspense key={reservationsHref(query)} fallback={<TableSkeleton />}>
        <ReservationResults ctx={tenantOf(session)} query={query} isRep={isRep} />
      </Suspense>
    </div>
  );
}

async function ReservationResults({ ctx, query, isRep }: { ctx: TenantCtx; query: ReservationListQuery; isRep: boolean }) {
  const result = await listReservations(ctx, query);

  if (result.items.length === 0) {
    return (
      <EmptyState title={query.status ? "لا توجد حجوزات بهذه الحالة" : "لا توجد حجوزات بعد"}>
        {isRep ? (
          <Link href="/units?status=available" className="text-emerald-700 hover:underline">
            تصفّح الوحدات المتاحة
          </Link>
        ) : null}
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">{result.total} حجز</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-right text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">الوحدة</th>
              <th className="px-4 py-3 font-medium">العميل</th>
              {isRep ? null : <th className="px-4 py-3 font-medium">المندوب</th>}
              <th className="px-4 py-3 font-medium">بدأ</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
              <th className="px-4 py-3 font-medium">المتبقي</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.items.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3">
                  <Link href={`/reservations/${r.id}`} className="font-medium text-slate-900 hover:text-emerald-700">
                    {r.unitLabel}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-700">{r.clientName}</td>
                {isRep ? null : <td className="px-4 py-3 text-slate-700">{r.repName}</td>}
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDateTime(r.createdAt)}</td>
                <td className="px-4 py-3">
                  <ReservationStatusBadge status={r.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                  {r.status === "active" ? formatTimeLeft(r.expiresAt) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={result.page} pageCount={result.pageCount} hrefFor={(page) => reservationsHref(query, page)} />
    </div>
  );
}
