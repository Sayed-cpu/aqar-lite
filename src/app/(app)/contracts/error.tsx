"use client";

import { ListError } from "@/components/list-error";

export default function ContractsError({ retry }: { error: unknown; retry: () => void }) {
  return <ListError title="تعذّر تحميل العقود" retry={retry} />;
}
