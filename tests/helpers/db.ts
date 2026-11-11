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
    sql`truncate table audit_logs, sessions, login_attempts, users, companies restart identity cascade`,
  );
}

export const TEST_PASSWORD = "correct horse battery staple";

let cachedHash: Promise<string> | undefined;

type TestUser = { id: string; email: string; companyId: string; role: Role; name: string };

export type Fixture = {
  companyA: { id: string; name: string };
  companyB: { id: string; name: string };
  managerA: TestUser;
  accountantA: TestUser;
  repA: TestUser;
  managerB: TestUser;
};

/** Two companies, with users of every role in A and a manager in B. */
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
    managerB: await make(companyB.id, "manager@b.test", "manager", "مدير ب"),
  };
}

export function ctxOf(user: TestUser): TenantCtx {
  return { userId: user.id, companyId: user.companyId, role: user.role };
}
