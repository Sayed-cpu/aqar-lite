import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { FormField, SelectField } from "@/components/form-field";
import { Pagination } from "@/components/pagination";
import { buttonClass, EmptyState, PageHeader, TableSkeleton } from "@/components/ui";
import { UnitStatusBadge } from "@/components/unit-status-badge";
import { formatSar, toSarString } from "@/lib/money";
import { can } from "@/lib/permissions";
import { type UnitListQuery, unitFilterErrors, unitListQuerySchema } from "@/lib/schemas/units";
import { formatArea, UNIT_SORT_LABELS, UNIT_SORTS, UNIT_STATUS_LABELS, UNIT_STATUSES, UNIT_TYPE_LABELS } from "@/lib/units";
import { requireUser, tenantOf } from "@/server/auth/current-user";
import type { TenantCtx } from "@/server/db/tenant";
import { listUnits } from "@/server/units/units.service";

export const metadata: Metadata = { title: "الوحدات — عقار لايت" };

const STATUS_OPTIONS = [
  { value: "", label: "كل الحالات" },
  ...UNIT_STATUSES.map((status) => ({ value: status, label: UNIT_STATUS_LABELS[status] })),
];
const SORT_OPTIONS = UNIT_SORTS.map((sort) => ({ value: sort, label: UNIT_SORT_LABELS[sort] }));

/** The list's URL for a query: only what differs from the defaults. */
function unitsHref(query: UnitListQuery, page = query.page): string {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.minPrice !== undefined) params.set("minPrice", toSarString(query.minPrice));
  if (query.maxPrice !== undefined) params.set("maxPrice", toSarString(query.maxPrice));
  if (query.sort !== "newest") params.set("sort", query.sort);
  if (page > 1) params.set("page", String(page));
  if (query.pageSize !== 20) params.set("pageSize", String(query.pageSize));
  const search = params.toString();
  return search ? `/units?${search}` : "/units";
}

const asText = (value: unknown) => (typeof value === "string" ? value : "");

export default async function UnitsPage({ searchParams }: PageProps<"/units">) {
  const session = await requireUser();
  const raw = await searchParams;
  const query = unitListQuerySchema.parse(raw);
  const filterErrors = unitFilterErrors(raw, query);
  const filtered = query.status !== undefined || query.minPrice !== undefined || query.maxPrice !== undefined;
  const canCreate = can(session.role, "units:create");

  // The filter form and the results remount whenever the URL changes, so the
  // selects show the URL's values and the table shows its loading state.
  const key = [unitsHref(query), asText(raw.minPrice), asText(raw.maxPrice)].join("|");

  return (
    <div className="space-y-5">
      <PageHeader
        title="الوحدات"
        description={`وحدات ${session.companyName}`}
        actions={
          canCreate ? (
            <Link href="/units/new" className={buttonClass.primary}>
              إضافة وحدة
            </Link>
          ) : null
        }
      />

      <Form
        key={key}
        action="/units"
        aria-label="تصفية الوحدات"
        className="grid items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <SelectField
          label="الحالة"
          name="status"
          id="filter-status"
          defaultValue={query.status ?? ""}
          options={STATUS_OPTIONS}
        />
        <FormField
          label="أقل سعر (ر.س)"
          name="minPrice"
          id="filter-min-price"
          inputMode="decimal"
          dir="ltr"
          defaultValue={asText(raw.minPrice)}
          errors={filterErrors.minPrice}
        />
        <FormField
          label="أعلى سعر (ر.س)"
          name="maxPrice"
          id="filter-max-price"
          inputMode="decimal"
          dir="ltr"
          defaultValue={asText(raw.maxPrice)}
          errors={filterErrors.maxPrice}
        />
        <SelectField label="الترتيب" name="sort" id="filter-sort" defaultValue={query.sort} options={SORT_OPTIONS} />
        <div className="flex gap-2 sm:col-span-2 lg:col-span-1 lg:pt-6">
          <button type="submit" className={`${buttonClass.primary} flex-1`}>
            تطبيق
          </button>
          {filtered || query.sort !== "newest" ? (
            <Link href="/units" className={buttonClass.secondary}>
              مسح
            </Link>
          ) : null}
        </div>
      </Form>

      <Suspense key={key} fallback={<TableSkeleton />}>
        <UnitResults
          ctx={tenantOf(session)}
          query={query}
          filtered={filtered}
          canCreate={canCreate}
          canEdit={can(session.role, "units:update")}
        />
      </Suspense>
    </div>
  );
}

type UnitResultsProps = { ctx: TenantCtx; query: UnitListQuery; filtered: boolean; canCreate: boolean; canEdit: boolean };

async function UnitResults({ ctx, query, filtered, canCreate, canEdit }: UnitResultsProps) {
  const result = await listUnits(ctx, query);

  if (result.items.length === 0) {
    if (result.total > 0) {
      return (
        <EmptyState title="لا توجد وحدات في هذه الصفحة">
          <Link href={unitsHref(query, 1)} className="text-emerald-700 hover:underline">
            العودة إلى الصفحة الأولى
          </Link>
        </EmptyState>
      );
    }
    return filtered ? (
      <EmptyState title="لا توجد وحدات تطابق هذه الفلاتر">
        <Link href="/units" className="text-emerald-700 hover:underline">
          عرض كل الوحدات
        </Link>
      </EmptyState>
    ) : (
      <EmptyState title="لا توجد وحدات بعد">{canCreate ? "أضف أول وحدة من زر «إضافة وحدة»." : null}</EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">{result.total} وحدة</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-right text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">الوحدة</th>
              <th className="px-4 py-3 font-medium">النوع</th>
              <th className="px-4 py-3 font-medium">المساحة</th>
              <th className="px-4 py-3 font-medium">الغرف</th>
              <th className="px-4 py-3 font-medium">السعر</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
              {canEdit ? <th className="px-4 py-3 font-medium">إجراءات</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.items.map((unit) => (
              <tr key={unit.id}>
                <td className="px-4 py-3">
                  <Link href={`/units/${unit.id}`} className="font-medium text-slate-900 hover:text-emerald-700">
                    {unit.number}
                  </Link>
                  <div className="text-xs text-slate-500">{unit.project}</div>
                </td>
                <td className="px-4 py-3 text-slate-700">{UNIT_TYPE_LABELS[unit.type]}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatArea(unit.areaSqm)}</td>
                <td className="px-4 py-3 text-slate-700">{unit.rooms}</td>
                <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{formatSar(unit.priceHalalas)}</td>
                <td className="px-4 py-3">
                  <UnitStatusBadge status={unit.status} />
                </td>
                {canEdit ? (
                  <td className="px-4 py-3">
                    <Link href={`/units/${unit.id}/edit`} className="text-emerald-700 hover:underline">
                      تعديل
                    </Link>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={result.page} pageCount={result.pageCount} hrefFor={(page) => unitsHref(query, page)} />
    </div>
  );
}
