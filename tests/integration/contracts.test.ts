import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { totalOf } from "@/domain/installments";
import { contractListQuerySchema } from "@/lib/schemas/sales";
import { getCurrentSession } from "@/server/auth/current-user";
import { approveContractAction, createDraftAction } from "@/server/contracts/contracts.actions";
import { getContract, listContracts, updateDraft } from "@/server/contracts/contracts.service";
import { auditLogs, contracts, installments, reservations, units } from "@/server/db/schema";
import { withTenant } from "@/server/db/tenant";
import { ctxOf, type Fixture, insertClient, insertUnit, ownerDb, resetDatabase, seedTwoCompanies } from "../helpers/db";
import { databaseRefusal } from "../helpers/errors";
import { approve, as, backdateReservation, DEFAULT_TERMS, draft, expectOk, reserve } from "../helpers/sales";
import { sessionOf } from "../helpers/session";

vi.mock("@/server/auth/current-user", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/auth/current-user")>()),
  getCurrentSession: vi.fn(),
}));
const currentSession = vi.mocked(getCurrentSession);

let f: Fixture;
let unitId: string;
let reservationId: string;

beforeEach(async () => {
  currentSession.mockReset();
  await resetDatabase();
  f = await seedTwoCompanies();
  // 1,000,000.00 SAR; the lowest allowed final price is 950,000.00.
  unitId = (await insertUnit(f.companyA.id, { priceHalalas: 100_000_000n })).id;
  const client = await insertClient(f.repA, { name: "نوف" });
  reservationId = expectOk(await reserve(f.repA, unitId, client.id)).id;
});

const stateOf = async (contractId: string) => {
  const [row] = await ownerDb()
    .select({ contract: contracts.status, reservation: reservations.status, unit: units.status })
    .from(contracts)
    .innerJoin(reservations, eq(reservations.id, contracts.reservationId))
    .innerJoin(units, eq(units.id, contracts.unitId))
    .where(eq(contracts.id, contractId));
  return row;
};

describe("drafting a contract", () => {
  it("builds the schedule from the terms, at the unit's list price", async () => {
    const { id } = expectOk(await draft(f.repA, reservationId, { finalPrice: 96_000_000n, downPayment: 6_000_000n }));

    const contract = await getContract(ctxOf(f.repA), id);
    expect(contract).toMatchObject({
      status: "draft",
      listPrice: 100_000_000n,
      finalPrice: 96_000_000n,
      clientName: "نوف",
      remaining: 96_000_000n,
    });
    expect(contract?.installments).toHaveLength(13);
    expect(totalOf(contract?.installments ?? [])).toBe(96_000_000n);
    expect(await stateOf(id)).toEqual({ contract: "draft", reservation: "active", unit: "reserved" });
  });

  it("allows a discount of up to 5%, and says the allowed range next to the price", async () => {
    for (const finalPrice of [94_999_999n, 100_000_001n]) {
      expect(await draft(f.repA, reservationId, { finalPrice, downPayment: 0n })).toMatchObject({
        ok: false,
        code: "VALIDATION",
        fieldErrors: { finalPrice: [expect.stringContaining("950,000.00")] },
      });
    }
    expectOk(await draft(f.repA, reservationId, { finalPrice: 95_000_000n }));
  });

  it("is made only from the rep's own reservation, while it is active, once", async () => {
    expect(await draft(f.repA2, reservationId)).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expectOk(await draft(f.repA, reservationId));
    expect(await draft(f.repA, reservationId)).toMatchObject({ ok: false, code: "CONFLICT" });
  });

  it("is refused once the reservation's 72 hours are up", async () => {
    await backdateReservation(reservationId);
    expect(await draft(f.repA, reservationId)).toMatchObject({
      ok: false,
      code: "INVALID_STATE",
      message: expect.stringContaining("72 ساعة"),
    });
  });

  it("is a sales rep's action, and takes no list price, status or company from the input", async () => {
    const input = {
      reservationId,
      finalPrice: "1000000",
      downPayment: "100000",
      installmentCount: "12",
      startDate: DEFAULT_TERMS.startDate,
    };
    for (const user of [f.managerA, f.accountantA]) {
      currentSession.mockResolvedValue(sessionOf(user));
      expect(await createDraftAction(input)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    }
    currentSession.mockResolvedValue(sessionOf(f.repA));
    for (const extra of [{ listPrice: "1" }, { status: "approved" }, { companyId: f.companyB.id }]) {
      expect(await createDraftAction({ ...input, ...extra })).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    }
    expect((await createDraftAction(input)).ok).toBe(true);
  });

  it("can be edited by its rep while a draft: the schedule is rebuilt and the revision moves", async () => {
    const { id } = expectOk(await draft(f.repA, reservationId));
    const edited = await as(f.repA, (ctx, tx) =>
      updateDraft({ id, ...DEFAULT_TERMS, finalPrice: 98_000_000n, downPayment: 8_000_000n, installmentCount: 6 }, ctx, tx),
    );
    expectOk(edited);
    const contract = await getContract(ctxOf(f.repA), id);
    expect(contract).toMatchObject({ revision: 2, finalPrice: 98_000_000n, installmentCount: 6 });
    expect(contract?.installments).toHaveLength(7);
    expect(totalOf(contract?.installments ?? [])).toBe(98_000_000n);

    expect(await as(f.repA2, (ctx, tx) => updateDraft({ id, ...DEFAULT_TERMS }, ctx, tx))).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });
});

describe("approving a contract", () => {
  it("approves, converts the reservation, sells the unit and audits it — together", async () => {
    const { id } = expectOk(await draft(f.repA, reservationId));
    expectOk(await approve(f.accountantA, id));

    expect(await stateOf(id)).toEqual({ contract: "approved", reservation: "converted", unit: "sold" });
    const contract = await getContract(ctxOf(f.managerA), id);
    expect(contract).toMatchObject({ approverName: "محاسب أ", approvedAt: expect.any(Date) });

    const [entry] = await ownerDb().select().from(auditLogs).where(eq(auditLogs.entityId, id));
    expect(entry).toMatchObject({
      action: "contract.approved",
      actorUserId: f.accountantA.id,
      metadata: { finalPrice: "1000000.00", client: "نوف" },
    });
  });

  it("changes nothing when the reservation ran out before the approval", async () => {
    const { id } = expectOk(await draft(f.repA, reservationId));
    await backdateReservation(reservationId);

    expect(await approve(f.accountantA, id)).toMatchObject({ ok: false, code: "INVALID_STATE" });
    expect((await stateOf(id))?.contract).toBe("draft");
    expect(await ownerDb().select().from(auditLogs).where(eq(auditLogs.entityId, id))).toEqual([]);
  });

  it("refuses to approve a draft that changed since the accountant opened it", async () => {
    const { id } = expectOk(await draft(f.repA, reservationId));
    expectOk(await as(f.repA, (ctx, tx) => updateDraft({ id, ...DEFAULT_TERMS, installmentCount: 24 }, ctx, tx)));

    expect(await approve(f.accountantA, id, 1)).toMatchObject({ ok: false, code: "CONFLICT" });
    expectOk(await approve(f.accountantA, id, 2));
  });

  it("approves once; after that the contract cannot be edited", async () => {
    const { id } = expectOk(await draft(f.repA, reservationId));
    expectOk(await approve(f.accountantA, id));
    expect(await approve(f.accountantA, id)).toMatchObject({ ok: false, code: "INVALID_STATE" });
    expect(await as(f.repA, (ctx, tx) => updateDraft({ id, ...DEFAULT_TERMS }, ctx, tx))).toMatchObject({
      ok: false,
      code: "INVALID_STATE",
      message: "العقد معتمد ولا يمكن تعديله",
    });
  });

  it("is an accountant's action only", async () => {
    const { id } = expectOk(await draft(f.repA, reservationId));
    for (const user of [f.repA, f.managerA]) {
      currentSession.mockResolvedValue(sessionOf(user));
      expect(await approveContractAction({ id, revision: 1 })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    }
    currentSession.mockResolvedValue(sessionOf(f.accountantA));
    expect(await approveContractAction({ id, revision: 1, approvedAt: "2020-01-01" })).toMatchObject({
      ok: false,
      error: { code: "VALIDATION" },
    });
    expect(await approveContractAction({ id, revision: 1 })).toEqual({ ok: true, data: { id } });
  });

  it("does not find another company's contract", async () => {
    const { id } = expectOk(await draft(f.repA, reservationId));
    const accountantB = { ...f.managerB, role: "accountant" as const };
    expect(await approve(accountantB, id)).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await getContract(ctxOf(f.managerB), id)).toBeNull();
  });
});

describe("who sees which contracts", () => {
  it("shows a rep their own, and the manager and accountant the company's", async () => {
    const { id } = expectOk(await draft(f.repA, reservationId));
    const query = contractListQuerySchema.parse({});
    expect((await listContracts(ctxOf(f.repA), query)).items.map((c) => c.id)).toEqual([id]);
    expect((await listContracts(ctxOf(f.repA2), query)).items).toEqual([]);
    expect((await listContracts(ctxOf(f.accountantA), query)).items.map((c) => c.id)).toEqual([id]);
    expect((await listContracts(ctxOf(f.managerB), query)).items).toEqual([]);
    expect(await getContract(ctxOf(f.repA2), id)).toBeNull();
  });

  it("keeps a rep from another rep's schedule even without a filter", async () => {
    expectOk(await draft(f.repA, reservationId));
    const rows = await withTenant(ctxOf(f.repA2), (tx) => tx.select({ id: installments.id }).from(installments));
    expect(rows).toEqual([]);
  });
});

describe("the database holds the contract rules on its own", () => {
  it("refuses a discount over 5% and a final price above the list price", async () => {
    const { id } = expectOk(await draft(f.repA, reservationId));
    const set = (price: bigint) => ownerDb().update(contracts).set({ finalPriceHalalas: price }).where(eq(contracts.id, id));
    expect(await databaseRefusal(set(94_999_999n))).toContain("contracts_discount_at_most_5_percent");
    expect(await databaseRefusal(set(100_000_001n))).toContain("contracts_final_price_not_above_list");
  });

  it("freezes an approved contract and its schedule, even for the owner", async () => {
    const { id } = expectOk(await draft(f.repA, reservationId));
    expectOk(await approve(f.accountantA, id));
    const db = ownerDb();
    expect(
      await databaseRefusal(db.update(contracts).set({ finalPriceHalalas: 99_000_000n }).where(eq(contracts.id, id))),
    ).toContain("approved contract cannot change");
    expect(await databaseRefusal(db.delete(installments).where(eq(installments.contractId, id)))).toContain(
      "schedule of an approved contract cannot change",
    );
    expect(
      await databaseRefusal(
        db.execute(sql`update installments set amount_halalas = amount_halalas + 1 where contract_id = ${id}`),
      ),
    ).toContain("terms cannot change");
  });

  it("does not let a rep approve their own draft through the app role", async () => {
    const { id } = expectOk(await draft(f.repA, reservationId));
    const selfApproval = withTenant(ctxOf(f.repA), (tx) =>
      tx.execute(sql`update contracts set status = 'approved', approved_by = ${f.repA.id} where id = ${id}`),
    );
    expect(await databaseRefusal(selfApproval)).toContain("row-level security");
  });

  it("does not let the app role set the approval time, or touch the schedule's paid amounts", async () => {
    const { id } = expectOk(await draft(f.repA, reservationId));
    const asAccountant = (statement: ReturnType<typeof sql>) => withTenant(ctxOf(f.accountantA), (tx) => tx.execute(statement));
    expect(
      await databaseRefusal(asAccountant(sql`update contracts set approved_at = now() - interval '1 year' where id = ${id}`)),
    ).toContain("permission denied");
    expect(
      await databaseRefusal(asAccountant(sql`update installments set paid_halalas = amount_halalas where contract_id = ${id}`)),
    ).toContain("permission denied");
  });
});
