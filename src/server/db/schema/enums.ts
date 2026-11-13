import { pgEnum } from "drizzle-orm/pg-core";
import { AUDIT_ACTIONS } from "@/lib/audit-actions";
import { ROLES } from "@/lib/roles";
import { CONTRACT_STATUSES, RESERVATION_STATUSES } from "@/lib/sales";
import { UNIT_STATUSES, UNIT_TYPES } from "@/lib/units";

export const userRole = pgEnum("user_role", ROLES);

export const auditAction = pgEnum("audit_action", AUDIT_ACTIONS);

export const unitStatus = pgEnum("unit_status", UNIT_STATUSES);

export const unitType = pgEnum("unit_type", UNIT_TYPES);

export const reservationStatus = pgEnum("reservation_status", RESERVATION_STATUSES);

export const contractStatus = pgEnum("contract_status", CONTRACT_STATUSES);
