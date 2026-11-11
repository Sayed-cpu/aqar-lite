import type { Role } from "./roles";

/**
 * The one place that says who may do what, transcribed from the brief's roles
 * table. Read by the server on every action and page (the enforcement), and by
 * the UI only to decide which links to show (never a substitute for it).
 * Reads that every role has inside its company — units, contracts — need no
 * entry; ownership rules (a rep sees only their clients) live in the queries.
 */
export const PERMISSIONS = {
  "units:create": ["manager"],
  "units:update": ["manager"],
  "clients:create": ["sales_rep"],
  "clients:update": ["sales_rep"],
  "reservations:create": ["sales_rep"],
  "contracts:create_draft": ["sales_rep"],
  "contracts:approve": ["accountant"],
  "payments:create": ["accountant"],
  "audit:read": ["manager"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  const allowed: readonly Role[] = PERMISSIONS[permission];
  return allowed.includes(role);
}
