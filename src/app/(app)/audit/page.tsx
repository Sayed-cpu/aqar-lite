import { ScrollText } from "lucide-react";
import type { Metadata } from "next";
import { DataTable, TBody, Td, Th, THead, Tr } from "@/components/data-table";
import { Pagination } from "@/components/pagination";
import { EmptyState, PageHeader } from "@/components/ui";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_METADATA_LABELS,
  AUDIT_METADATA_VALUE_LABELS,
  AUDIT_MONEY_KEYS,
} from "@/lib/audit-actions";
import { formatDateTime } from "@/lib/format";
import { formatSar, parseSar } from "@/lib/money";
import { auditListQuerySchema } from "@/lib/schemas/audit";
import type { AuditMetadata } from "@/server/db/schema";
import { listAuditLogs } from "@/server/audit/audit.service";
import { requirePermission, tenantOf } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "سجل التدقيق — عقار لايت" };

export default async function AuditPage({ searchParams }: PageProps<"/audit">) {
  const session = await requirePermission("audit:read");
  const query = auditListQuerySchema.parse(await searchParams);
  const result = await listAuditLogs(tenantOf(session), query);

  const hrefFor = (page: number) => {
    const params = new URLSearchParams({ page: String(page) });
    if (query.pageSize !== 20) params.set("pageSize", String(query.pageSize));
    return `/audit?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="سجل التدقيق"
        description={`${result.total} حدث في ${session.companyName}. السجل للقراءة فقط ولا يمكن تعديله.`}
      />

      {result.items.length === 0 ? (
        <EmptyState icon={ScrollText} title="لا توجد أحداث مسجّلة في هذه الصفحة">
          تُسجَّل هنا محاولات الدخول وتغييرات الأسعار والاعتمادات والدفعات.
        </EmptyState>
      ) : (
        <DataTable label="أحداث سجل التدقيق" className="md:min-w-[44rem]">
          <THead>
            <Th>الحدث</Th>
            <Th>الوقت</Th>
            <Th>المستخدم</Th>
            <Th>التفاصيل</Th>
            <Th>IP</Th>
          </THead>
          <TBody>
            {result.items.map((item) => (
              <Tr key={item.id} className="align-top">
                <Td primary className="font-bold text-ink md:align-top">
                  {AUDIT_ACTION_LABELS[item.action]}
                </Td>
                <Td label="الوقت" className="whitespace-nowrap text-ink-muted md:align-top">
                  {formatDateTime(item.createdAt)}
                </Td>
                <Td label="المستخدم" className="text-ink-muted md:align-top">
                  {item.actorName ?? "—"}
                </Td>
                <Td label="التفاصيل" className="text-ink-muted max-md:items-start md:align-top">
                  <MetadataList metadata={item.metadata} />
                </Td>
                <Td label="IP" className="text-ink-subtle tabular-nums md:align-top">
                  <span dir="ltr">{item.ip ?? "—"}</span>
                </Td>
              </Tr>
            ))}
          </TBody>
        </DataTable>
      )}

      <Pagination page={result.page} pageCount={result.pageCount} hrefFor={hrefFor} />
    </div>
  );
}

const LABEL_ORDER = Object.keys(AUDIT_METADATA_LABELS);
const labelOrder = (key: string) => {
  const index = LABEL_ORDER.indexOf(key);
  return index === -1 ? LABEL_ORDER.length : index;
};

function metadataValue(key: string, value: unknown): string {
  if (typeof value !== "string") return String(value);
  if (AUDIT_MONEY_KEYS.has(key)) {
    const amount = parseSar(value);
    if (amount !== null) return formatSar(amount);
  }
  return AUDIT_METADATA_VALUE_LABELS[value] ?? value;
}

// Rendered as text nodes only: metadata can hold what a user typed (an
// attempted email, a unit number), and React escapes it.
function MetadataList({ metadata }: { metadata: AuditMetadata }) {
  // jsonb stores keys in its own order; show them in the order labelled.
  const entries = Object.entries(metadata).sort(([a], [b]) => labelOrder(a) - labelOrder(b));
  if (entries.length === 0) return <span>—</span>;
  return (
    <dl className="space-y-0.5 text-start">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-1">
          <dt className="shrink-0 text-ink-subtle">{AUDIT_METADATA_LABELS[key] ?? key}:</dt>
          <dd className="break-all">
            {metadataValue(key, value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
