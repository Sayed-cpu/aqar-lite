import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { existsSync } from "node:fs";
import { Pool } from "pg";
import { addDays, todayIn } from "@/domain/dates";
import type { Role } from "@/lib/roles";
import type { ActionContext } from "@/server/actions/create-action";
import { hashPassword } from "@/server/auth/password";
import { approveContract, createDraft } from "@/server/contracts/contracts.service";
import * as schema from "@/server/db/schema";
import { clients, companies, reservations, units, users } from "@/server/db/schema";
import { recordPayment } from "@/server/payments/payments.service";
import { reserveUnit } from "@/server/reservations/reservations.service";
import { DEMO_PASSWORD, SEED } from "./seed-data";

// Local runs read .env; in docker the variables come from compose.
if (existsSync(".env")) process.loadEnvFile(".env");

type Db = NodePgDatabase<typeof schema>;

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
    const db = drizzle({ client: pool, schema });
    await seedCompaniesAndUsers(db);
    await seedUnitsAndClients(db);
    await seedSales(db);
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
 * Per company, one of each state a reviewer should find: a draft waiting for
 * the accountant, an approved contract with payments and an overdue
 * installment, a live reservation with no contract yet, and an expired one.
 *
 * Written through the same services the app uses, so the seed obeys every
 * rule the app does: the lock order, the 5% floor, the schedule, the audit.
 * Skipped for a company that already has any reservation.
 */
async function seedSales(db: Db): Promise<void> {
  for (const entry of SEED) {
    const emails = entry.users.map((user) => user.email);
    const staff = await db
      .select({ id: users.id, email: users.email, role: users.role, companyId: users.companyId })
      .from(users)
      .where(inArray(users.email, emails));
    const accountant = staff.find((user) => user.role === "accountant");
    const reps = staff.filter((user) => user.role === "sales_rep").sort((a, b) => a.email.localeCompare(b.email));
    const [rep1, rep2] = reps;
    if (!accountant || !rep1 || !rep2) continue;
    const companyId = accountant.companyId;

    const [already] = await db.select({ n: count() }).from(reservations).where(eq(reservations.companyId, companyId));
    if ((already?.n ?? 0) > 0) continue;

    const available = await db
      .select({ id: units.id, price: units.priceHalalas })
      .from(units)
      .where(and(eq(units.companyId, companyId), eq(units.status, "available")))
      .orderBy(asc(units.project), asc(units.number))
      .limit(4);
    const clientsOf = (ownerId: string) =>
      db.select({ id: clients.id }).from(clients).where(eq(clients.ownerUserId, ownerId)).orderBy(asc(clients.createdAt));
    const [rep1Clients, rep2Clients] = await Promise.all([clientsOf(rep1.id), clientsOf(rep2.id)]);
    const [unitDraft, unitApproved, unitHeld, unitLapsed] = available;
    const [clientA, clientB, clientC] = rep1Clients;
    const [clientD] = rep2Clients;
    if (!unitDraft || !unitApproved || !unitHeld || !unitLapsed || !clientA || !clientB || !clientC || !clientD) continue;

    const as = (user: { id: string; role: Role }): ActionContext => ({
      userId: user.id,
      companyId,
      role: user.role,
      sessionId: "seed",
      ip: null,
    });
    const wholeRiyals = (halalas: bigint) => (halalas / 100n) * 100n;
    const today = todayIn();

    await db.transaction(async (tx) => {
      // A draft at list price, waiting for the accountant.
      const r1 = await reserveUnit({ unitId: unitDraft.id, clientId: clientA.id }, as(rep1), tx);
      await createDraft(
        {
          reservationId: r1.id,
          finalPrice: unitDraft.price,
          downPayment: wholeRiyals(unitDraft.price / 10n),
          installmentCount: 12,
          startDate: today,
        },
        as(rep1),
        tx,
      );

      // Approved 3% under list, started 45 days ago: the down payment is
      // paid, the first installment half paid and past due.
      const r2 = await reserveUnit({ unitId: unitApproved.id, clientId: clientB.id }, as(rep1), tx);
      const finalPrice = wholeRiyals((unitApproved.price * 97n) / 100n);
      const downPayment = wholeRiyals(finalPrice / 5n);
      const contract = await createDraft(
        { reservationId: r2.id, finalPrice, downPayment, installmentCount: 24, startDate: addDays(today, -45) },
        as(rep1),
        tx,
      );
      await approveContract({ id: contract.id, revision: 1 }, as(accountant), tx);
      await recordPayment(
        { contractId: contract.id, amount: downPayment, idempotencyKey: crypto.randomUUID() },
        as(accountant),
        tx,
      );
      await recordPayment(
        {
          contractId: contract.id,
          amount: wholeRiyals((finalPrice - downPayment) / 24n / 2n),
          idempotencyKey: crypto.randomUUID(),
        },
        as(accountant),
        tx,
      );

      // A live reservation with no contract yet.
      await reserveUnit({ unitId: unitHeld.id, clientId: clientC.id }, as(rep1), tx);

      // A reservation whose 72 hours ran out: its unit is available again.
      const lapsed = await reserveUnit({ unitId: unitLapsed.id, clientId: clientD.id }, as(rep2), tx);
      await tx.execute(sql`
        update reservations
        set created_at = now() - interval '75 hours', expires_at = now() - interval '3 hours'
        where id = ${lapsed.id}
      `);
      await tx.execute(sql`select expire_due_reservations()`);
    });
    console.log(`seed: reservations, a draft and an approved contract with payments for ${entry.company}`);
  }
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
