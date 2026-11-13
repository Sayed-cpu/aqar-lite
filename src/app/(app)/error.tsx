"use client";

import { ListError } from "@/components/list-error";

export default function AppError({ retry }: { error: unknown; retry: () => void }) {
  return <ListError title="تعذّر تحميل الصفحة" retry={retry} />;
}
