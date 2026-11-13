import { pgEnum } from "drizzle-orm/pg-core";
import { AUDIT_ACTIONS } from "@/lib/audit-actions";
import { ROLES } from "@/lib/roles";

export const userRole = pgEnum("user_role", ROLES);

export const auditAction = pgEnum("audit_action", AUDIT_ACTIONS);
