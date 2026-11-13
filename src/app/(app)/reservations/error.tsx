"use client";

import { ListError } from "@/components/list-error";

export default function ReservationsError({ retry }: { error: unknown; retry: () => void }) {
  return <ListError title="تعذّر تحميل الحجوزات" retry={retry} />;
}
