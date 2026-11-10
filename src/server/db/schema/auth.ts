import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  index,
  inet,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { userRole } from "./enums";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [check("companies_name_not_blank", sql`length(trim(${t.name})) > 0`)],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    // Unique across the whole system: login asks for no company.
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: userRole("role").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("users_email_key").on(t.email),
    index("users_company_id_idx").on(t.companyId),
    // Target for composite foreign keys: lets a child row reference a user
    // AND assert, in the database, that the user is in the same company.
    unique("users_id_company_id_key").on(t.id, t.companyId),
    check("users_email_lowercase", sql`${t.email} = lower(${t.email})`),
    check("users_name_not_blank", sql`length(trim(${t.name})) > 0`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    // sha256(token) in hex. The raw token lives only in the user's cookie, so
    // a read of this table yields nothing that can be replayed.
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("sessions_user_id_idx").on(t.userId),
    index("sessions_expires_at_idx").on(t.expiresAt),
    check("sessions_id_is_sha256_hex", sql`${t.id} ~ '^[0-9a-f]{64}$'`),
  ],
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    // Recorded for unknown emails too, so lockout cannot reveal which exist.
    email: text("email").notNull(),
    ip: inet("ip"),
    succeeded: boolean("succeeded").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("login_attempts_email_created_at_idx").on(t.email, t.createdAt),
    index("login_attempts_ip_created_at_idx").on(t.ip, t.createdAt),
  ],
);
