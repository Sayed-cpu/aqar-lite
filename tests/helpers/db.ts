import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { inject } from "vitest";
import type { Role } from "@/lib/roles";
import { hashPassword } from "@/server/auth/password";
import * as schema from "@/server/db/schema";
import type { TenantCtx } from "@/server/db/tenant";

let ownerPool: Pool | undefined;

/** The owner connection: bypasses RLS, for arranging and inspecting data. */
export function ownerDb(): NodePgDatabase<typeof schema> {
  ownerPool ??= new Pool({ connectionString: inject("ownerDatabaseUrl"), max: 2 });
  return drizzle({ client: ownerPool, schema });
}

export async function closeOwnerDb(): Promise<void> {
  await ownerPool?.end();
  ownerPool = undefined;
}

/** TRUNCATE fires no row triggers, so the append-only audit log resets too. */
export async function resetDatabase(): Promise<void> {
  await ownerDb().execute(
    sql`truncate table clients, units, audit_logs, sessions, login_attempts, users, companies restart identity cascade`,
  );
}

export const TEST_PASSWORD = "correct horse battery staple";

let cachedHash: Promise<string> | undefined;

export type TestUser = { id: string; email: string; companyId: string; role: Role; name: string };

export type Fixture = {
  companyA: { id: string; name: string };
  companyB: { id: string; name: string };
  managerA: TestUser;
  accountantA: TestUser;
  repA: TestUser;
  repA2: TestUser;
  managerB: TestUser;
  repB: TestUser;
};

/** Two companies: every role in A, with two reps; a manager and a rep in B. */
export async function seedTwoCompanies(): Promise<Fixture> {
  // One Argon2 hash shared by every fixture user keeps the suite fast.
  cachedHash ??= hashPassword(TEST_PASSWORD);
  const passwordHash = await cachedHash;
  const db = ownerDb();

  const [companyA, companyB] = await db
    .insert(schema.companies)
    .values([{ name: "شركة أ" }, { name: "شركة ب" }])
    .returning({ id: schema.companies.id, name: schema.companies.name });
  if (!companyA || !companyB) throw new Error("fixture companies not created");

  const make = async (companyId: string, email: string, role: Role, name: string): Promise<TestUser> => {
    const [user] = await db
      .insert(schema.users)
      .values({ companyId, email, role, name, passwordHash })
      .returning({ id: schema.users.id });
    if (!user) throw new Error(`fixture user ${email} not created`);
    return { id: user.id, email, companyId, role, name };
  };

  return {
    companyA,
    companyB,
    managerA: await make(companyA.id, "manager@a.test", "manager", "مدير أ"),
    accountantA: await make(companyA.id, "accountant@a.test", "accountant", "محاسب أ"),
    repA: await make(companyA.id, "rep@a.test", "sales_rep", "مندوب أ"),
    repA2: await make(companyA.id, "rep2@a.test", "sales_rep", "مندوب أ2"),
    managerB: await make(companyB.id, "manager@b.test", "manager", "مدير ب"),
    repB: await make(companyB.id, "rep@b.test", "sales_rep", "مندوب ب"),
  };
}

export function ctxOf(user: TestUser): TenantCtx {
  return { userId: user.id, companyId: user.companyId, role: user.role };
}

// Unique unit numbers and phones within a test run.
let fixtureCounter = 0;

type UnitRow = typeof schema.units.$inferInsert;

/** A unit written as the owner, bypassing RLS but not the lifecycle trigger. */
export async function insertUnit(
  companyId: string,
  overrides: Partial<Omit<UnitRow, "companyId">> = {},
): Promise<{ id: string }> {
  const [unit] = await ownerDb()
    .insert(schema.units)
    .values({
      companyId,
      project: "مشروع الاختبار",
      number: `U-${++fixtureCounter}`,
      type: "apartment",
      areaSqm: "120.00",
      rooms: 3,
      priceHalalas: 100_000_000n,
      ...overrides,
    })
    .returning({ id: schema.units.id });
  if (!unit) throw new Error("fixture unit not created");
  return unit;
}

/** Moves a unit along its lifecycle as the owner; the trigger still applies. */
export async function setUnitStatus(unitId: string, status: "available" | "reserved" | "sold"): Promise<void> {
  await ownerDb().update(schema.units).set({ status }).where(sql`${schema.units.id} = ${unitId}`);
}

export async function insertClient(
  owner: TestUser,
  overrides: Partial<Pick<typeof schema.clients.$inferInsert, "name" | "phone" | "notes">> = {},
): Promise<{ id: string }> {
  const [client] = await ownerDb()
    .insert(schema.clients)
    .values({
      companyId: owner.companyId,
      ownerUserId: owner.id,
      name: "عميل الاختبار",
      phone: `05${10_000_000 + ++fixtureCounter}`,
      notes: "",
      ...overrides,
    })
    .returning({ id: schema.clients.id });
  if (!client) throw new Error("fixture client not created");
  return client;
}
