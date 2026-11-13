import { Building, Pencil, Plus, SearchX, SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { UnitStatusBadge } from "@/components/badges";
import { DataTable, TBody, Td, Th, THead, Tr } from "@/components/data-table";
import { FormField, SelectField } from "@/components/form-field";
import { Pagination } from "@/components/pagination";
import { buttonClass, EmptyState, linkClass, Money, PageHeader, ResultCount, TableSkeleton } from "@/components/ui";
import { toSarString } from "@/lib/money";
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
    <div className="space-y-6">
      <PageHeader
        title="الوحدات"
        description={`وحدات ${session.companyName}: الحالة والسعر والمساحة.`}
        actions={
          canCreate ? (
            <Link href="/units/new" className={buttonClass.primary}>
              <Plus />
              إضافة وحدة
            </Link>
          ) : null
        }
      />

      <Form
        key={`filters:${key}`}
        action="/units"
        aria-label="تصفية الوحدات"
        className="rounded-xl border border-line bg-surface p-4 shadow-xs sm:p-5"
      >
        <p className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
          <SlidersHorizontal className="size-4 text-primary-600" aria-hidden="true" />
          تصفية وترتيب
        </p>
        <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
          <div className="flex gap-2 sm:col-span-2 lg:col-span-1 lg:pt-7">
            <button type="submit" className={`${buttonClass.primary} flex-1`}>
              تطبيق
            </button>
            {filtered || query.sort !== "newest" ? (
              <Link href="/units" className={buttonClass.secondary}>
                مسح
              </Link>
            ) : null}
          </div>
        </div>
      </Form>

      <Suspense key={`results:${key}`} fallback={<TableSkeleton label="جارٍ تحميل الوحدات…" />}>
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
        <EmptyState
          icon={SearchX}
          title="لا توجد وحدات في هذه الصفحة"
          action={
            <Link href={unitsHref(query, 1)} className={buttonClass.secondary}>
              العودة إلى الصفحة الأولى
            </Link>
          }
        />
      );
    }
    return filtered ? (
      <EmptyState
        icon={SearchX}
        title="لا توجد وحدات تطابق هذه الفلاتر"
        action={
          <Link href="/units" className={buttonClass.secondary}>
            عرض كل الوحدات
          </Link>
        }
      >
        جرّب نطاق سعر أوسع أو حالة أخرى.
      </EmptyState>
    ) : (
      <EmptyState
        icon={Building}
        title="لا توجد وحدات بعد"
        action={
          canCreate ? (
            <Link href="/units/new" className={buttonClass.primary}>
              <Plus />
              أضف أول وحدة
            </Link>
          ) : null
        }
      >
        {canCreate ? "تُضاف الوحدة بحالة «متاحة» ويمكن للمندوبين حجزها مباشرة." : "لم يُضف مدير الشركة أي وحدة حتى الآن."}
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      <ResultCount>{result.total} وحدة</ResultCount>
      <DataTable label="جدول الوحدات" className="md:min-w-[46rem]">
        <THead>
          <Th>الوحدة</Th>
          <Th>النوع</Th>
          <Th>المساحة</Th>
          <Th>الغرف</Th>
          <Th>السعر</Th>
          <Th>الحالة</Th>
          {canEdit ? (
            <Th>
              <span className="sr-only">إجراءات</span>
            </Th>
          ) : null}
        </THead>
        <TBody>
          {result.items.map((unit) => (
            <Tr key={unit.id}>
              <Td primary>
                <Link href={`/units/${unit.id}`} className="font-bold text-ink hover:text-primary-700 hover:underline">
                  {unit.number}
                </Link>
                <div className="text-xs text-ink-subtle">{unit.project}</div>
              </Td>
              <Td label="النوع" className="text-ink-muted">
                {UNIT_TYPE_LABELS[unit.type]}
              </Td>
              <Td label="المساحة" className="whitespace-nowrap text-ink-muted">
                {formatArea(unit.areaSqm)}
              </Td>
              <Td label="الغرف" className="text-ink-muted tabular-nums">
                {unit.rooms}
              </Td>
              <Td label="السعر" className="font-medium text-ink">
                <Money amount={unit.priceHalalas} />
              </Td>
              <Td label="الحالة">
                <UnitStatusBadge status={unit.status} />
              </Td>
              {canEdit ? (
                <Td>
                  <Link href={`/units/${unit.id}/edit`} className={`${linkClass} inline-flex items-center gap-1`}>
                    <Pencil className="size-3.5" />
                    تعديل<span className="sr-only"> الوحدة {unit.number}</span>
                  </Link>
                </Td>
              ) : null}
            </Tr>
          ))}
        </TBody>
      </DataTable>
      <Pagination page={result.page} pageCount={result.pageCount} hrefFor={(page) => unitsHref(query, page)} />
    </div>
  );
}
