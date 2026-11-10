import { sql } from "drizzle-orm";
import { check, foreignKey, index, inet, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { companies, users } from "./auth";
import { auditAction } from "./enums";

/** Flat on purpose: money goes in as strings, never as JSON numbers. */
export type AuditMetadata = Record<string, string | number | boolean | null>;

/**
 * Append-only. The app role holds only SELECT and INSERT here, and a trigger
 * rejects UPDATE/DELETE from anyone — see the app_role_rls migration.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Null only for a failed login on an email that matches no user: that
    // event belongs to no company, and row-level security hides it from all.
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "restrict" }),
    actorUserId: uuid("actor_user_id"),
    action: auditAction("action").notNull(),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata").$type<AuditMetadata>().notNull().default({}),
    ip: inet("ip"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    // An entry can only name an actor from its own company.
    foreignKey({
      name: "audit_logs_actor_same_company_fk",
      columns: [t.actorUserId, t.companyId],
      foreignColumns: [users.id, users.companyId],
    }).onDelete("restrict"),
    // A composite FK is skipped when any column is NULL (MATCH SIMPLE), so
    // without this an actor could be recorded with no company to check against.
    check("audit_logs_actor_requires_company", sql`${t.actorUserId} is null or ${t.companyId} is not null`),
    index("audit_logs_company_id_created_at_idx").on(t.companyId, t.createdAt.desc()),
  ],
);
