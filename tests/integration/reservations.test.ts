import { and, eq, sql } from "drizzle-orm";
import { Pool } from "pg";
import { beforeEach, describe, expect, inject, it, vi } from "vitest";
import { reservationListQuerySchema } from "@/lib/schemas/sales";
import { unitListQuerySchema } from "@/lib/schemas/units";
import { getCurrentSession } from "@/server/auth/current-user";
import { getDb } from "@/server/db/client";
import { reservations, units, users } from "@/server/db/schema";
import { withTenant } from "@/server/db/tenant";
import { expireDueReservations } from "@/server/reservations/expiry";
import { reserveUnitAction } from "@/server/reservations/reservations.actions";
import { getReservation, listReservations } from "@/server/reservations/reservations.service";
import { getUnit, listUnits } from "@/server/units/units.service";
import {
  ctxOf,
  type Fixture,
  insertClient,
  insertUnit,
  ownerDb,
  resetDatabase,
  seedTwoCompanies,
  type TestUser,
} from "../helpers/db";
import { databaseRefusal } from "../helpers/errors";
import { backdateReservation, expectOk, reserve, waitForLockWaiters } from "../helpers/sales";
import { sessionOf } from "../helpers/session";

vi.mock("@/server/auth/current-user", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/auth/current-user")>()),
  getCurrentSession: vi.fn(),
}));
const currentSession = vi.mocked(getCurrentSession);

let f: Fixture;
let unit: { id: string };
let clientOfA: { id: string };
let clientOfA2: { id: string };

beforeEach(async () => {
  currentSession.mockReset();
  await resetDatabase();
  f = await seedTwoCompanies();
  unit = await insertUnit(f.companyA.id);
  clientOfA = await insertClient(f.repA);
  clientOfA2 = await insertClient(f.repA2);
});

const unitStatus = async (id: string) =>
  (await ownerDb().select({ status: units.status }).from(units).where(eq(units.id, id)))[0]?.status;

describe("reserving a unit", () => {
  it("holds the unit for the rep's client for exactly 72 hours", async () => {
    const { id } = expectOk(await reserve(f.repA, unit.id, clientOfA.id));

    const [row] = await ownerDb()
      .select({
        status: reservations.status,
        reservedBy: reservations.reservedBy,
        exactly72Hours: sql<boolean>`${reservations.expiresAt} - ${reservations.createdAt} = interval '72 hours'`,
      })
      .from(reservations)
      .where(eq(reservations.id, id));
    expect(row).toEqual({ status: "active", reservedBy: f.repA.id, exactly72Hours: true });
    expect(await unitStatus(unit.id)).toBe("reserved");
  });

  it("tells the second rep the unit is taken, and the first that it is already theirs", async () => {
    expectOk(await reserve(f.repA, unit.id, clientOfA.id));
    expect(await reserve(f.repA2, unit.id, clientOfA2.id)).toMatchObject({
      ok: false,
      code: "CONFLICT",
      message: expect.stringContaining("محجوزة الآن لعميل آخر"),
    });
    expect(await reserve(f.repA, unit.id, clientOfA.id)).toMatchObject({
      ok: false,
      code: "CONFLICT",
      message: "لديك حجز نشط على هذه الوحدة بالفعل",
    });
  });

  it("only reserves for one of the rep's own clients", async () => {
    expect(await reserve(f.repA, unit.id, clientOfA2.id)).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { clientId: [expect.any(String)] },
    });
    expect(await unitStatus(unit.id)).toBe("available");
  });

  it("does not find another company's unit", async () => {
    const theirs = await insertUnit(f.companyB.id);
    expect(await reserve(f.repA, theirs.id, clientOfA.id)).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await unitStatus(theirs.id)).toBe("available");
  });

  it("is a sales rep's action only", async () => {
    for (const user of [f.managerA, f.accountantA]) {
      currentSession.mockResolvedValue(sessionOf(user));
      expect(await reserveUnitAction({ unitId: unit.id, clientId: clientOfA.id })).toMatchObject({
        ok: false,
        error: { code: "FORBIDDEN" },
      });
    }
    currentSession.mockResolvedValue(sessionOf(f.repA));
    expect(await reserveUnitAction({ unitId: unit.id, clientId: clientOfA.id, expiresAt: "2099-01-01" })).toMatchObject({
      ok: false,
      error: { code: "VALIDATION" },
    });
    expect((await reserveUnitAction({ unitId: unit.id, clientId: clientOfA.id })).ok).toBe(true);
  });
});

describe("two reps, one unit, the same instant", () => {
  it("lets exactly one of many simultaneous reservations through", async () => {
    // Eight reps, each with a client, all reaching for one unit.
    const reps: { rep: TestUser; clientId: string }[] = [];
    for (let i = 0; i < 8; i++) {
      const [row] = await ownerDb()
        .insert(users)
        .values({
          companyId: f.companyA.id,
          email: `racer${i}@a.test`,
          name: `مندوب ${i}`,
          role: "sales_rep",
          passwordHash: "unused",
        })
        .returning({ id: users.id });
      if (!row) throw new Error("rep not created");
      const rep: TestUser = { id: row.id, email: `racer${i}@a.test`, companyId: f.companyA.id, role: "sales_rep", name: "" };
      reps.push({ rep, clientId: (await insertClient(rep)).id });
    }

    // Hold the unit's row lock, start every reservation, wait until each one
    // is blocked on that lock, then let go: they all race for the same row.
    const holder = await ownerDbClient();
    await holder.query("begin");
    await holder.query("select id from units where id = $1 for update", [unit.id]);
    const attempts = reps.map(({ rep, clientId }) => reserve(rep, unit.id, clientId));
    await waitForLockWaiters(reps.length);
    await holder.query("commit");
    holder.release();

    const outcomes = await Promise.all(attempts);
    const winners = outcomes.filter((outcome) => outcome.ok);
    const losers = outcomes.filter((outcome) => !outcome.ok);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(7);
    for (const loser of losers) {
      expect(loser).toMatchObject({ code: "CONFLICT", message: expect.stringContaining("محجوزة الآن لعميل آخر") });
    }

    const active = await ownerDb()
      .select({ id: reservations.id })
      .from(reservations)
      .where(and(eq(reservations.unitId, unit.id), eq(reservations.status, "active")));
    expect(active).toHaveLength(1);
  });

  it("holds without any lock barrier too", async () => {
    const outcomes = await Promise.all([
      reserve(f.repA, unit.id, clientOfA.id),
      reserve(f.repA2, unit.id, clientOfA2.id),
      reserve(f.repA, unit.id, clientOfA.id),
      reserve(f.repA2, unit.id, clientOfA2.id),
    ]);
    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
  });

  it("refuses a second active reservation in the database itself", async () => {
    const { id } = expectOk(await reserve(f.repA, unit.id, clientOfA.id));
    expect(id).toBeTruthy();
    const second = ownerDb()
      .insert(reservations)
      .values({
        companyId: f.companyA.id,
        unitId: unit.id,
        clientId: clientOfA2.id,
        reservedBy: f.repA2.id,
        createdAt: sql`now()`,
        expiresAt: sql`now() + interval '72 hours'`,
      });
    expect(await databaseRefusal(second)).toContain("reservations_one_active_per_unit");
  });
});

describe("after 72 hours", () => {
  it("frees the unit with nobody doing anything: the next read shows it available", async () => {
    const { id } = expectOk(await reserve(f.repA, unit.id, clientOfA.id));
    await backdateReservation(id);

    const listed = await listUnits(ctxOf(f.managerA), unitListQuerySchema.parse({ status: "available" }));
    expect(listed.items.map((item) => item.id)).toContain(unit.id);
    expect((await getUnit(ctxOf(f.managerA), unit.id))?.status).toBe("available");
    expect((await getReservation(ctxOf(f.repA), id))?.status).toBe("expired");
  });

  it("lets another rep reserve it, even if no sweep has run", async () => {
    const { id } = expectOk(await reserve(f.repA, unit.id, clientOfA.id));
    await backdateReservation(id);

    expectOk(await reserve(f.repA2, unit.id, clientOfA2.id));
    const rows = await ownerDb()
      .select({ status: reservations.status, reservedBy: reservations.reservedBy })
      .from(reservations)
      .where(eq(reservations.unitId, unit.id));
    expect(rows).toEqual(
      expect.arrayContaining([
        { status: "expired", reservedBy: f.repA.id },
        { status: "active", reservedBy: f.repA2.id },
      ]),
    );
  });

  it("is swept across every company by the background job, which has no tenant", async () => {
    const theirUnit = await insertUnit(f.companyB.id);
    const theirClient = await insertClient(f.repB);
    const mine = expectOk(await reserve(f.repA, unit.id, clientOfA.id));
    const theirs = expectOk(await reserve(f.repB, theirUnit.id, theirClient.id));
    await backdateReservation(mine.id);
    await backdateReservation(theirs.id);

    // As the app role, with no company set: exactly what the sweeper does.
    expect(await expireDueReservations(getDb())).toBe(2);
    expect(await unitStatus(unit.id)).toBe("available");
    expect(await unitStatus(theirUnit.id)).toBe("available");
    expect(await expireDueReservations(getDb())).toBe(0);
  });

  it("leaves a reservation with time left alone", async () => {
    const { id } = expectOk(await reserve(f.repA, unit.id, clientOfA.id));
    await backdateReservation(id, 71);
    expect(await expireDueReservations(getDb())).toBe(0);
    expect(await unitStatus(unit.id)).toBe("reserved");
  });
});

describe("who sees which reservations", () => {
  it("shows a rep their own, and the manager and accountant the company's", async () => {
    const other = await insertUnit(f.companyA.id);
    expectOk(await reserve(f.repA, unit.id, clientOfA.id));
    expectOk(await reserve(f.repA2, other.id, clientOfA2.id));

    const query = reservationListQuerySchema.parse({});
    const repsOf = async (user: TestUser) =>
      (await listReservations(ctxOf(user), query)).items.map((item) => item.repName).sort();
    expect(await repsOf(f.repA)).toEqual(["مندوب أ"]);
    expect(await repsOf(f.managerA)).toEqual(["مندوب أ", "مندوب أ2"]);
    expect(await repsOf(f.accountantA)).toEqual(["مندوب أ", "مندوب أ2"]);
    expect(await repsOf(f.managerB)).toEqual([]);
  });

  it("hides another rep's reservation by id, and keeps a forgotten filter safe", async () => {
    const theirs = expectOk(await reserve(f.repA2, unit.id, clientOfA2.id));
    expect(await getReservation(ctxOf(f.repA), theirs.id)).toBeNull();
    expect(await getReservation(ctxOf(f.managerB), theirs.id)).toBeNull();

    const unfiltered = await withTenant(ctxOf(f.repA), (tx) => tx.select({ id: reservations.id }).from(reservations));
    expect(unfiltered).toEqual([]);
  });
});

describe("the database holds the reservation rules on its own", () => {
  it("refuses a reservation that is not exactly 72 hours, or made for another rep's client", async () => {
    const tooLong = ownerDb()
      .insert(reservations)
      .values({
        companyId: f.companyA.id,
        unitId: unit.id,
        clientId: clientOfA.id,
        reservedBy: f.repA.id,
        createdAt: sql`now()`,
        expiresAt: sql`now() + interval '96 hours'`,
      });
    expect(await databaseRefusal(tooLong)).toContain("reservations_lasts_72_hours");

    const someoneElsesClient = ownerDb()
      .insert(reservations)
      .values({
        companyId: f.companyA.id,
        unitId: unit.id,
        clientId: clientOfA2.id,
        reservedBy: f.repA.id,
        createdAt: sql`now()`,
        expiresAt: sql`now() + interval '72 hours'`,
      });
    expect(await databaseRefusal(someoneElsesClient)).toContain("reservations_client_of_rep_fk");
  });

  it("does not let a reservation expire early, or come back once ended", async () => {
    const { id } = expectOk(await reserve(f.repA, unit.id, clientOfA.id));
    const early = ownerDb().execute(sql`update reservations set status = 'expired', ended_at = now() where id = ${id}`);
    expect(await databaseRefusal(early)).toContain("cannot expire before");

    await backdateReservation(id);
    await expireDueReservations(getDb());
    const revive = ownerDb().execute(sql`update reservations set status = 'active', ended_at = null where id = ${id}`);
    expect(await databaseRefusal(revive)).toContain("expired reservation cannot become active");
  });

  it("does not let the app role delete a reservation, or move its unit or dates", async () => {
    const { id } = expectOk(await reserve(f.repA, unit.id, clientOfA.id));
    const asApp = (statement: ReturnType<typeof sql>) => withTenant(ctxOf(f.accountantA), (tx) => tx.execute(statement));
    expect(await databaseRefusal(asApp(sql`delete from reservations where id = ${id}`))).toContain("permission denied");
    expect(
      await databaseRefusal(asApp(sql`update reservations set expires_at = now() + interval '1 year' where id = ${id}`)),
    ).toContain("permission denied");
  });

  it("does not let a rep end a reservation through the app role", async () => {
    const { id } = expectOk(await reserve(f.repA, unit.id, clientOfA.id));
    // No update policy for a rep: the row is simply not there to update.
    const result = await withTenant(ctxOf(f.repA), (tx) =>
      tx.execute(sql`update reservations set status = 'expired', ended_at = now() where id = ${id}`),
    );
    expect(result.rowCount).toBe(0);
  });
});

/** A dedicated owner connection, to hold a row lock while others queue behind it. */
async function ownerDbClient() {
  const pool = new Pool({ connectionString: inject("ownerDatabaseUrl"), max: 1 });
  const client = await pool.connect();
  return {
    query: (text: string, values?: unknown[]) => client.query(text, values),
    release: () => {
      client.release();
      void pool.end();
    },
  };
}
