import type { Metadata } from "next";
import { Pagination } from "@/components/pagination";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_METADATA_LABELS,
  AUDIT_METADATA_VALUE_LABELS,
} from "@/lib/audit-actions";
import { formatDateTime } from "@/lib/format";
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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">سجل التدقيق</h1>
        <p className="mt-1 text-sm text-slate-500">
          {result.total} حدث في {session.companyName}. السجل للقراءة فقط ولا يمكن تعديله.
        </p>
      </div>

      {result.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          لا توجد أحداث مسجّلة في هذه الصفحة.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-right text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">الوقت</th>
                <th className="px-4 py-3 font-medium">الحدث</th>
                <th className="px-4 py-3 font-medium">المستخدم</th>
                <th className="px-4 py-3 font-medium">التفاصيل</th>
                <th className="px-4 py-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.items.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(item.createdAt)}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{AUDIT_ACTION_LABELS[item.action]}</td>
                  <td className="px-4 py-3 text-slate-700">{item.actorName ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <MetadataList metadata={item.metadata} />
                  </td>
                  <td className="px-4 py-3 text-slate-500" dir="ltr">
                    {item.ip ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={result.page} pageCount={result.pageCount} hrefFor={hrefFor} />
    </div>
  );
}

// Rendered as text nodes only: metadata can hold what a user typed (an
// attempted email), and React escapes it.
function MetadataList({ metadata }: { metadata: AuditMetadata }) {
  const entries = Object.entries(metadata);
  if (entries.length === 0) return <span>—</span>;
  return (
    <dl className="space-y-0.5">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-1">
          <dt className="text-slate-400">{AUDIT_METADATA_LABELS[key] ?? key}:</dt>
          <dd className="break-all">
            {typeof value === "string" ? (AUDIT_METADATA_VALUE_LABELS[value] ?? value) : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
