import { UNIT_STATUS_LABELS, type UnitStatus } from "@/lib/units";

const STYLES: Record<UnitStatus, string> = {
  available: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  reserved: "bg-amber-50 text-amber-800 ring-amber-200",
  sold: "bg-slate-100 text-slate-700 ring-slate-300",
};

export function UnitStatusBadge({ status }: { status: UnitStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[status]}`}>
      {UNIT_STATUS_LABELS[status]}
    </span>
  );
}
