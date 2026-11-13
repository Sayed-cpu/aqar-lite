import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { unitListQuerySchema } from "@/lib/schemas/units";
import { getCurrentSession } from "@/server/auth/current-user";
import { getDb } from "@/server/db/client";
import { auditLogs, units } from "@/server/db/schema";
import { withTenant } from "@/server/db/tenant";
import { createUnitAction, updateUnitAction } from "@/server/units/units.actions";
import { getUnit, listUnits } from "@/server/units/units.service";
import {
  ctxOf,
  type Fixture,
  insertUnit,
  ownerDb,
  resetDatabase,
  seedTwoCompanies,
  setUnitStatus,
  type TestUser,
} from "../helpers/db";
import { databaseRefusal } from "../helpers/errors";
import { sessionOf } from "../helpers/session";

vi.mock("@/server/auth/current-user", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/auth/current-user")>()),
  getCurrentSession: vi.fn(),
}));
const currentSession = vi.mocked(getCurrentSession);
const signedInAs = (user: TestUser) => currentSession.mockResolvedValue(sessionOf(user));

const SAR = 100n;
const validInput = {
  project: "أبراج الاختبار",
  number: "A-1",
  type: "apartment",
  areaSqm: "120.5",
  rooms: "3",
  price: "850000.50",
};

let f: Fixture;

beforeEach(async () => {
  currentSession.mockReset();
  await resetDatabase();
  f = await seedTwoCompanies();
});

const query = (params: Record<string, string> = {}) => unitListQuerySchema.parse(params);

describe("listing units", () => {
  beforeEach(async () => {
    // Prices 100k, 200k, … 600k; areas descending, so the two sorts disagree.
    for (let i = 1; i <= 6; i++) {
      await insertUnit(f.companyA.id, {
        number: `L-${i}`,
        priceHalalas: BigInt(i) * 100_000n * SAR,
        areaSqm: `${700 - i * 100}.00`,
      });
    }
    const reserved = await insertUnit(f.companyA.id, { number: "L-R", priceHalalas: 350_000n * SAR });
    await setUnitStatus(reserved.id, "reserved");
    await insertUnit(f.companyB.id, { number: "B-1", priceHalalas: 300_000n * SAR });
  });

  it("filters by status in SQL", async () => {
    const page = await listUnits(ctxOf(f.managerA), query({ status: "reserved" }));
    expect(page.items.map((unit) => unit.number)).toEqual(["L-R"]);
    expect(page.total).toBe(1);
  });

  it("filters by an inclusive price range, exactly to the halala", async () => {
    const page = await listUnits(
      ctxOf(f.repA),
      query({ minPrice: "200000", maxPrice: "400000.00", sort: "price_asc" }),
    );
    expect(page.items.map((unit) => unit.number)).toEqual(["L-2", "L-3", "L-R", "L-4"]);

    const justAbove = await listUnits(ctxOf(f.repA), query({ minPrice: "200000.01", maxPrice: "300000" }));
    expect(justAbove.items.map((unit) => unit.number)).toEqual(["L-3"]);
  });

  it("sorts by price and by area in either direction", async () => {
    const numbers = async (sort: string) =>
      (await listUnits(ctxOf(f.accountantA), query({ sort, maxPrice: "600000", minPrice: "100000" }))).items
        .filter((unit) => unit.number !== "L-R")
        .map((unit) => unit.number);

    expect(await numbers("price_asc")).toEqual(["L-1", "L-2", "L-3", "L-4", "L-5", "L-6"]);
    expect(await numbers("price_desc")).toEqual(["L-6", "L-5", "L-4", "L-3", "L-2", "L-1"]);
    expect(await numbers("area_asc")).toEqual(["L-6", "L-5", "L-4", "L-3", "L-2", "L-1"]);
    expect(await numbers("area_desc")).toEqual(["L-1", "L-2", "L-3", "L-4", "L-5", "L-6"]);
  });

  it("pages without repeating or dropping a row", async () => {
    const pages = await Promise.all(
      [1, 2, 3].map((page) =>
        listUnits(ctxOf(f.managerA), query({ sort: "price_asc", page: String(page), pageSize: "3" })),
      ),
    );
    expect(pages.map((page) => page.items.length)).toEqual([3, 3, 1]);
    expect(pages[0]).toMatchObject({ total: 7, pageCount: 3, page: 1, pageSize: 3 });
    const all = pages.flatMap((page) => page.items.map((unit) => unit.id));
    expect(new Set(all).size).toBe(7);
  });

  it("falls back on parameters that do not parse instead of failing", async () => {
    const parsed = query({ status: "deleted", minPrice: "abc", sort: "id; drop table units", page: "-4", pageSize: "500" });
    expect(parsed).toEqual({
      status: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      sort: "newest",
      page: 1,
      pageSize: 20,
    });
    expect((await listUnits(ctxOf(f.managerA), parsed)).total).toBe(7);
  });

  it("returns money as an exact bigint", async () => {
    const odd = await insertUnit(f.companyA.id, { priceHalalas: 123_456_789_012_34n });
    const unit = await getUnit(ctxOf(f.managerA), odd.id);
    expect(unit?.priceHalalas).toBe(123_456_789_012_34n);
  });
});

describe("company isolation", () => {
  it("never lists or reads another company's units", async () => {
    const unitA = await insertUnit(f.companyA.id);
    await insertUnit(f.companyB.id);

    const listB = await listUnits(ctxOf(f.managerB), query());
    expect(listB.items.map((unit) => unit.id)).not.toContain(unitA.id);
    expect(listB.total).toBe(1);
    expect(await getUnit(ctxOf(f.managerB), unitA.id)).toBeNull();
  });

  it("hides other companies' rows even from a query that forgets to filter", async () => {
    await insertUnit(f.companyA.id);
    await insertUnit(f.companyB.id);
    const rows = await withTenant(ctxOf(f.managerA), (tx) => tx.select({ companyId: units.companyId }).from(units));
    expect(rows).toEqual([{ companyId: f.companyA.id }]);
  });

  it("refuses an update to another company's unit as not found", async () => {
    const unitA = await insertUnit(f.companyA.id, { priceHalalas: 500_000n * SAR });
    signedInAs(f.managerB);
    const result = await updateUnitAction({ ...validInput, id: unitA.id, price: "1" });
    expect(result).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    const [after] = await ownerDb().select().from(units).where(eq(units.id, unitA.id));
    expect(after?.priceHalalas).toBe(500_000n * SAR);
  });
});

describe("creating and editing units", () => {
  it("lets a manager add a unit, always as available and in their own company", async () => {
    signedInAs(f.managerA);
    const result = await createUnitAction(validInput);
    if (!result.ok) throw new Error(result.error.message);

    const [row] = await ownerDb().select().from(units).where(eq(units.id, result.data.id));
    expect(row).toMatchObject({
      companyId: f.companyA.id,
      status: "available",
      areaSqm: "120.50",
      rooms: 3,
      priceHalalas: 850_000n * SAR + 50n,
    });
  });

  it("refuses a sales rep and an accountant", async () => {
    for (const user of [f.repA, f.accountantA]) {
      signedInAs(user);
      expect(await createUnitAction(validInput)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    }
    const unit = await insertUnit(f.companyA.id);
    signedInAs(f.accountantA);
    expect(await updateUnitAction({ ...validInput, id: unit.id })).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
  });

  it("refuses a status or a company in the input", async () => {
    signedInAs(f.managerA);
    for (const extra of [{ status: "sold" }, { companyId: f.companyB.id }]) {
      expect(await createUnitAction({ ...validInput, ...extra })).toMatchObject({
        ok: false,
        error: { code: "VALIDATION" },
      });
    }
    expect(await ownerDb().select().from(units)).toHaveLength(0);
  });

  it("reports a duplicate number in the same project next to the field", async () => {
    signedInAs(f.managerA);
    expect((await createUnitAction(validInput)).ok).toBe(true);
    expect(await createUnitAction(validInput)).toEqual({
      ok: false,
      error: { code: "CONFLICT", message: expect.any(String), fieldErrors: { number: [expect.any(String)] } },
    });

    // The same number is free in another project, and in another company.
    expect((await createUnitAction({ ...validInput, project: "مشروع آخر" })).ok).toBe(true);
    signedInAs(f.managerB);
    expect((await createUnitAction(validInput)).ok).toBe(true);
  });

  it("records a price change in the audit log, with the old and new price", async () => {
    const unit = await insertUnit(f.companyA.id, { project: "أبراج", number: "7", priceHalalas: 700_000n * SAR });
    signedInAs(f.managerA);
    const result = await updateUnitAction({ ...validInput, id: unit.id, project: "أبراج", number: "7", price: "725000.25" });
    expect(result).toEqual({ ok: true, data: { id: unit.id } });

    const entries = await ownerDb().select().from(auditLogs).where(eq(auditLogs.action, "unit.price_changed"));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      companyId: f.companyA.id,
      actorUserId: f.managerA.id,
      entityType: "unit",
      entityId: unit.id,
      metadata: { unit: "أبراج / 7", oldPrice: "700000.00", newPrice: "725000.25" },
    });
  });

  it("writes no audit entry when the price did not change", async () => {
    const unit = await insertUnit(f.companyA.id, { priceHalalas: 850_000n * SAR + 50n });
    signedInAs(f.managerA);
    expect((await updateUnitAction({ ...validInput, id: unit.id, rooms: "4" })).ok).toBe(true);
    expect(await ownerDb().select().from(auditLogs)).toHaveLength(0);
  });

  it("refuses a price change on a reserved or sold unit, but allows other edits", async () => {
    for (const status of ["reserved", "sold"] as const) {
      const unit = await insertUnit(f.companyA.id, { priceHalalas: 850_000n * SAR + 50n });
      await setUnitStatus(unit.id, "reserved");
      if (status === "sold") await setUnitStatus(unit.id, "sold");
      signedInAs(f.managerA);

      expect(await updateUnitAction({ ...validInput, id: unit.id, price: "900000" })).toEqual({
        ok: false,
        error: { code: "INVALID_STATE", message: expect.any(String), fieldErrors: { price: [expect.any(String)] } },
      });
      expect(await updateUnitAction({ ...validInput, id: unit.id, number: `${status}-renamed` })).toMatchObject({
        ok: true,
      });

      const [row] = await ownerDb().select().from(units).where(eq(units.id, unit.id));
      expect(row).toMatchObject({ priceHalalas: 850_000n * SAR + 50n, status, number: `${status}-renamed` });
    }
    expect(await ownerDb().select().from(auditLogs)).toHaveLength(0);
  });
});

describe("the database holds the unit rules on its own", () => {
  it("allows only the brief's status transitions, for any role", async () => {
    const unit = await insertUnit(f.companyA.id);
    const move = (status: "available" | "reserved" | "sold") => setUnitStatus(unit.id, status);

    expect(await databaseRefusal(move("sold"))).toContain("cannot move from available to sold");
    await move("reserved");
    await move("available");
    await move("reserved");
    await move("sold");
    expect(await databaseRefusal(move("available"))).toContain("cannot move from sold to available");
    expect(await databaseRefusal(move("reserved"))).toContain("cannot move from sold to reserved");
  });

  it("refuses a new unit that is not available", async () => {
    expect(await databaseRefusal(insertUnit(f.companyA.id, { status: "sold" }))).toContain("must be available");
  });

  it("refuses a price change on a reserved unit even from the table owner", async () => {
    const unit = await insertUnit(f.companyA.id);
    await setUnitStatus(unit.id, "reserved");
    const raise = ownerDb().update(units).set({ priceHalalas: 1n }).where(eq(units.id, unit.id));
    expect(await databaseRefusal(raise)).toContain("price of a reserved unit cannot change");
  });

  it("refuses a zero price, a non-positive area and an empty number", async () => {
    expect(await databaseRefusal(insertUnit(f.companyA.id, { priceHalalas: 0n }))).toContain("units_price_positive");
    expect(await databaseRefusal(insertUnit(f.companyA.id, { areaSqm: "0" }))).toContain("units_area_positive");
    expect(await databaseRefusal(insertUnit(f.companyA.id, { number: "  " }))).toContain("units_number_not_blank");
  });

  it("does not let the app role move a unit to another company or delete it", async () => {
    const unit = await insertUnit(f.companyA.id);
    const asApp = (statement: ReturnType<typeof sql>) =>
      withTenant(ctxOf(f.managerA), (tx) => tx.execute(statement));

    expect(
      await databaseRefusal(asApp(sql`update units set company_id = ${f.companyB.id} where id = ${unit.id}`)),
    ).toContain("permission denied");
    expect(await databaseRefusal(asApp(sql`delete from units where id = ${unit.id}`))).toContain("permission denied");

    const [row] = await ownerDb()
      .select()
      .from(units)
      .where(and(eq(units.id, unit.id), eq(units.companyId, f.companyA.id)));
    expect(row).toBeDefined();
  });

  it("does not let the app role insert a unit into another company", async () => {
    const insert = withTenant(ctxOf(f.managerA), (tx) =>
      tx.insert(units).values({
        companyId: f.companyB.id,
        project: "x",
        number: "1",
        type: "shop",
        areaSqm: "10",
        rooms: 0,
        priceHalalas: 1n,
      }),
    );
    expect(await databaseRefusal(insert)).toContain("row-level security");
  });

  it("is connected as the app role, not the owner", async () => {
    const [row] = await getDb().execute<{ current_user: string }>(sql`select current_user`).then((r) => r.rows);
    expect(row?.current_user).toBe("aqar_app");
  });
});
