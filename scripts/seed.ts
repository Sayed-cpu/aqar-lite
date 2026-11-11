import { count, eq, inArray } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { existsSync } from "node:fs";
import { Pool } from "pg";
import { hashPassword } from "@/server/auth/password";
import { clients, companies, units, users } from "@/server/db/schema";
import { DEMO_PASSWORD, SEED } from "./seed-data";

// Local runs read .env; in docker the variables come from compose.
if (existsSync(".env")) process.loadEnvFile(".env");

type Db = NodePgDatabase;

/**
 * Idempotent piece by piece: every `docker compose up` runs this, and each
 * part — the companies and users, a company's units, a rep's clients — is
 * written only while it is still empty. A database seeded by an earlier
 * version gains what that version did not have, and nothing is duplicated.
 */
async function main(): Promise<void> {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error("MIGRATION_DATABASE_URL is not set");

  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    const db = drizzle({ client: pool });
    await seedCompaniesAndUsers(db);
    await seedUnitsAndClients(db);
  } finally {
    await pool.end();
  }
}

async function seedCompaniesAndUsers(db: Db): Promise<void> {
  const existing = await db.select({ id: companies.id }).from(companies).limit(1);
  if (existing.length > 0) {
    console.log("seed: companies and users already present");
    return;
  }

  // Hashed before the transaction opens, one salt per user.
  const prepared = await Promise.all(
    SEED.map(async (entry) => ({
      company: entry.company,
      users: await Promise.all(
        entry.users.map(async ({ email, name, role }) => ({
          email,
          name,
          role,
          passwordHash: await hashPassword(DEMO_PASSWORD),
        })),
      ),
    })),
  );

  await db.transaction(async (tx) => {
    for (const entry of prepared) {
      const [company] = await tx.insert(companies).values({ name: entry.company }).returning({ id: companies.id });
      if (!company) throw new Error("company insert returned nothing");
      await tx.insert(users).values(entry.users.map((user) => ({ ...user, companyId: company.id })));
    }
  });
  console.log(`seed: ${prepared.length} companies and ${prepared.flatMap((c) => c.users).length} users`);
}

async function seedUnitsAndClients(db: Db): Promise<void> {
  const seededUsers = await db
    .select({ id: users.id, email: users.email, companyId: users.companyId })
    .from(users)
    .where(inArray(users.email, SEED.flatMap((entry) => entry.users.map((user) => user.email))));
  const byEmail = new Map(seededUsers.map((user) => [user.email, user]));

  await db.transaction(async (tx) => {
    for (const entry of SEED) {
      const firstUser = entry.users[0];
      const companyId = firstUser ? byEmail.get(firstUser.email)?.companyId : undefined;
      if (!companyId) {
        console.log(`seed: ${entry.company} has no seeded users here, skipping its units and clients`);
        continue;
      }

      const [unitCount] = await tx.select({ n: count() }).from(units).where(eq(units.companyId, companyId));
      if ((unitCount?.n ?? 0) === 0) {
        const stamp = listedOrder();
        await tx.insert(units).values(entry.units.map((unit, i) => ({ ...unit, companyId, ...stamp(i) })));
        console.log(`seed: ${entry.units.length} units for ${entry.company}`);
      }

      for (const user of entry.users) {
        const owner = byEmail.get(user.email);
        if (!owner || !user.clients?.length) continue;
        const [clientCount] = await tx.select({ n: count() }).from(clients).where(eq(clients.ownerUserId, owner.id));
        if ((clientCount?.n ?? 0) > 0) continue;
        const stamp = listedOrder();
        await tx.insert(clients).values(
          user.clients.map((client, i) => ({
            ...client,
            ownerUserId: owner.id,
            companyId: owner.companyId,
            ...stamp(i),
          })),
        );
        console.log(`seed: ${user.clients.length} clients for ${user.email}`);
      }
    }
  });
}

/**
 * Rows inserted in one statement share now(), which leaves "newest first" to
 * the random id. A minute apart, the first one listed the newest, the lists
 * read in the order the data file is written.
 */
function listedOrder(): (i: number) => { createdAt: Date; updatedAt: Date } {
  const now = Date.now();
  return (i) => {
    const at = new Date(now - i * 60_000);
    return { createdAt: at, updatedAt: at };
  };
}

main().catch((err: unknown) => {
  console.error("seed failed:", err instanceof Error ? err.message : "unknown error");
  process.exit(1);
});
