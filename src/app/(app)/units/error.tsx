"use client";

import { ListError } from "@/components/list-error";

export default function UnitsError({ retry }: { error: unknown; retry: () => void }) {
  return <ListError title="تعذّر تحميل الوحدات" retry={retry} />;
}
