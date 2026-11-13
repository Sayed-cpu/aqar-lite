import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { companies, users } from "./auth";
import { unitStatus, unitType } from "./enums";

const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  // Maintained by a trigger, not by the app.
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

/**
 * A unit for sale. Status moves only available → reserved → (available | sold),
 * and the price only changes while available; both are enforced by a trigger
 * as well as by the service (see the units_clients_rls migration).
 */
export const units = pgTable(
  "units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    // The brief keeps projects as free text on the unit, with no screens.
    project: text("project").notNull(),
    number: text("number").notNull(),
    type: unitType("type").notNull(),
    areaSqm: numeric("area_sqm", { precision: 8, scale: 2 }).notNull(),
    rooms: smallint("rooms").notNull(),
    priceHalalas: bigint("price_halalas", { mode: "bigint" }).notNull(),
    status: unitStatus("status").notNull().default("available"),
    ...timestamps(),
  },
  (t) => [
    unique("units_company_project_number_key").on(t.companyId, t.project, t.number),
    // Target for composite foreign keys from reservations and contracts.
    unique("units_id_company_id_key").on(t.id, t.companyId),
    index("units_company_status_price_idx").on(t.companyId, t.status, t.priceHalalas),
    index("units_company_area_idx").on(t.companyId, t.areaSqm),
    index("units_company_created_at_idx").on(t.companyId, t.createdAt.desc()),
    check("units_project_not_blank", sql`length(trim(${t.project})) > 0`),
    check("units_number_not_blank", sql`length(trim(${t.number})) > 0`),
    check("units_area_positive", sql`${t.areaSqm} > 0`),
    check("units_rooms_range", sql`${t.rooms} between 0 and 50`),
    check("units_price_positive", sql`${t.priceHalalas} > 0`),
  ],
);

/** A sales rep's client. Owned by the rep who added it, for good. */
export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    ownerUserId: uuid("owner_user_id").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    notes: text("notes").notNull().default(""),
    ...timestamps(),
  },
  (t) => [
    // The owner is a user of the same company, checked by the database.
    foreignKey({
      name: "clients_owner_same_company_fk",
      columns: [t.ownerUserId, t.companyId],
      foreignColumns: [users.id, users.companyId],
    }).onDelete("restrict"),
    // A rep cannot add the same phone twice; two reps may both know a person.
    unique("clients_owner_phone_key").on(t.companyId, t.ownerUserId, t.phone),
    unique("clients_id_company_id_key").on(t.id, t.companyId),
    // Target for reservations: a rep reserves only for a client they own.
    unique("clients_id_owner_company_key").on(t.id, t.ownerUserId, t.companyId),
    index("clients_company_owner_created_at_idx").on(t.companyId, t.ownerUserId, t.createdAt.desc()),
    check("clients_name_not_blank", sql`length(trim(${t.name})) > 0`),
    check("clients_phone_format", sql`${t.phone} ~ '^\\+?[0-9]{8,15}$'`),
    check("clients_notes_length", sql`length(${t.notes}) <= 2000`),
  ],
);
