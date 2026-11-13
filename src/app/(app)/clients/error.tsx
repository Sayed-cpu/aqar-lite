"use client";

import { ListError } from "@/components/list-error";

export default function ClientsError({ retry }: { error: unknown; retry: () => void }) {
  return <ListError title="تعذّر تحميل العملاء" retry={retry} />;
}
