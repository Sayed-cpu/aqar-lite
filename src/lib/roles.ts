export const ROLES = ["manager", "accountant", "sales_rep"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  manager: "مدير الشركة",
  accountant: "محاسب",
  sales_rep: "مندوب مبيعات",
};
