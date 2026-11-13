/**
 * Every event the audit log records. The later features (prices, contracts,
 * payments) write these values; adding one is a migration, not a string.
 */
export const AUDIT_ACTIONS = [
  "auth.login_succeeded",
  "auth.login_failed",
  "auth.logout",
  "unit.price_changed",
  "contract.approved",
  "payment.recorded",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Display names for metadata keys and coded values; unknown ones show raw. */
export const AUDIT_METADATA_LABELS: Record<string, string> = {
  email: "البريد",
  reason: "السبب",
  unit: "الوحدة",
  oldPrice: "السعر السابق",
  newPrice: "السعر الجديد",
};

/** Metadata keys whose value is an exact SAR amount ("1250000.50"). */
export const AUDIT_MONEY_KEYS: ReadonlySet<string> = new Set(["oldPrice", "newPrice"]);

export const AUDIT_METADATA_VALUE_LABELS: Record<string, string> = {
  invalid_credentials: "بيانات دخول غير صحيحة",
  locked: "محاولات كثيرة (حظر مؤقت)",
};

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  "auth.login_succeeded": "تسجيل دخول",
  "auth.login_failed": "محاولة دخول فاشلة",
  "auth.logout": "تسجيل خروج",
  "unit.price_changed": "تغيير سعر وحدة",
  "contract.approved": "اعتماد عقد",
  "payment.recorded": "تسجيل دفعة",
};
