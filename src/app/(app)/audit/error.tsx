"use client";

import { ListError } from "@/components/list-error";

export default function AuditError({ retry }: { error: unknown; retry: () => void }) {
  return <ListError title="تعذّر تحميل سجل التدقيق" retry={retry} />;
}
