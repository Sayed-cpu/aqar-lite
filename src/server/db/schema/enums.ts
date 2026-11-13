import { pgEnum } from "drizzle-orm/pg-core";
import { AUDIT_ACTIONS } from "@/lib/audit-actions";
import { ROLES } from "@/lib/roles";
import { UNIT_STATUSES, UNIT_TYPES } from "@/lib/units";

export const userRole = pgEnum("user_role", ROLES);

export const auditAction = pgEnum("audit_action", AUDIT_ACTIONS);

export const unitStatus = pgEnum("unit_status", UNIT_STATUSES);

export const unitType = pgEnum("unit_type", UNIT_TYPES);
