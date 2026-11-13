import type { InstallmentState } from "@/domain/payments";
import {
  CONTRACT_STATUS_LABELS,
  type ContractStatus,
  INSTALLMENT_STATE_LABELS,
  RESERVATION_STATUS_LABELS,
  type ReservationStatus,
} from "@/lib/sales";

const badge = "inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset";

const RESERVATION_STYLES: Record<ReservationStatus, string> = {
  active: "bg-amber-50 text-amber-800 ring-amber-200",
  expired: "bg-slate-100 text-slate-600 ring-slate-300",
  converted: "bg-emerald-50 text-emerald-800 ring-emerald-200",
};

const CONTRACT_STYLES: Record<ContractStatus, string> = {
  draft: "bg-sky-50 text-sky-800 ring-sky-200",
  approved: "bg-emerald-50 text-emerald-800 ring-emerald-200",
};

const INSTALLMENT_STYLES: Record<InstallmentState, string> = {
  paid: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  partial: "bg-sky-50 text-sky-800 ring-sky-200",
  overdue: "bg-red-50 text-red-700 ring-red-200",
  unpaid: "bg-slate-100 text-slate-600 ring-slate-300",
};

export function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  return <span className={`${badge} ${RESERVATION_STYLES[status]}`}>{RESERVATION_STATUS_LABELS[status]}</span>;
}

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return <span className={`${badge} ${CONTRACT_STYLES[status]}`}>{CONTRACT_STATUS_LABELS[status]}</span>;
}

export function InstallmentStateBadge({ state }: { state: InstallmentState }) {
  return <span className={`${badge} ${INSTALLMENT_STYLES[state]}`}>{INSTALLMENT_STATE_LABELS[state]}</span>;
}
