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

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  "auth.login_succeeded": "تسجيل دخول",
  "auth.login_failed": "محاولة دخول فاشلة",
  "auth.logout": "تسجيل خروج",
  "unit.price_changed": "تغيير سعر وحدة",
  "contract.approved": "اعتماد عقد",
  "payment.recorded": "تسجيل دفعة",
};
