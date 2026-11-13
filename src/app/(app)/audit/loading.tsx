import { TableSkeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div aria-hidden="true" className="animate-pulse space-y-2">
        <div className="h-7 w-40 rounded bg-line/70" />
        <div className="h-4 w-72 max-w-full rounded bg-line/70" />
      </div>
      <TableSkeleton label="جارٍ تحميل سجل التدقيق…" rows={8} />
    </div>
  );
}
