import type { InstallmentState } from "@/domain/payments";

/** A reservation holds a unit for this long, then lets it go on its own. */
export const RESERVATION_HOURS = 72;

export const RESERVATION_STATUSES = ["active", "expired", "converted"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  active: "نشط",
  expired: "منتهٍ",
  converted: "تحوّل إلى عقد معتمد",
};

export const CONTRACT_STATUSES = ["draft", "approved"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  draft: "مسودة",
  approved: "معتمد",
};

export const INSTALLMENT_STATE_LABELS: Record<InstallmentState, string> = {
  paid: "مدفوع",
  partial: "مدفوع جزئيًا",
  overdue: "متأخر",
  // Nothing paid and not yet due: "غير مدفوع" would describe an overdue one too.
  unpaid: "لم يحن موعده",
};
