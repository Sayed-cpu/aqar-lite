import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, todayIn } from "@/domain/dates";
import { installmentState } from "@/domain/payments";
import { getCurrentSession } from "@/server/auth/current-user";
import { getContract } from "@/server/contracts/contracts.service";
import { auditLogs, installments, paymentAllocations, payments } from "@/server/db/schema";
import { withTenant } from "@/server/db/tenant";
import { recordPaymentAction } from "@/server/payments/payments.actions";
import { ctxOf, type Fixture, insertClient, insertUnit, ownerDb, resetDatabase, seedTwoCompanies } from "../helpers/db";
import { databaseRefusal } from "../helpers/errors";
import { approve, draft, expectOk, pay, reserve } from "../helpers/sales";
import { sessionOf } from "../helpers/session";

vi.mock("@/server/auth/current-user", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/auth/current-user")>()),
  getCurrentSession: vi.fn(),
}));
const currentSession = vi.mocked(getCurrentSession);

let f: Fixture;
let contractId: string;

// 1,000,000.00 SAR: 100,000.00 down, then 12 × 75,000.00.
const DOWN = 10_000_000n;
const MONTHLY = 7_500_000n;
const TOTAL = 100_000_000n;

/** An approved contract for rep A, created and approved through the services. */
async function approvedContract(terms: Parameters<typeof draft>[2] = {}): Promise<string> {
  const unit = await insertUnit(f.companyA.id, { priceHalalas: TOTAL });
  const client = await insertClient(f.repA);
  const reservation = expectOk(await reserve(f.repA, unit.id, client.id));
  const { id } = expectOk(await draft(f.repA, reservation.id, terms));
  expectOk(await approve(f.accountantA, id));
  return id;
}

const scheduleOf = async (id: string) => (await getContract(ctxOf(f.accountantA), id))?.installments ?? [];

beforeEach(async () => {
  currentSession.mockReset();
  await resetDatabase();
  f = await seedTwoCompanies();
  contractId = await approvedContract();
});

describe("recording a payment", () => {
  it("pays the oldest installments first, and leaves the next one partly paid", async () => {
    expectOk(await pay(f.accountantA, contractId, DOWN + MONTHLY + 1_000_000n));

    const schedule = await scheduleOf(contractId);
    expect(schedule.slice(0, 4).map((i) => [i.seq, i.paid])).toEqual([
      [0, DOWN],
      [1, MONTHLY],
      [2, 1_000_000n],
      [3, 0n],
    ]);
    const today = todayIn();
    expect(schedule.slice(0, 4).map((i) => installmentState(i, today))).toEqual(["paid", "paid", "partial", "unpaid"]);

    const contract = await getContract(ctxOf(f.managerA), contractId);
    expect(contract).toMatchObject({ paid: DOWN + MONTHLY + 1_000_000n, remaining: TOTAL - DOWN - MONTHLY - 1_000_000n });
    expect(contract?.payments).toEqual([
      expect.objectContaining({
        amount: DOWN + MONTHLY + 1_000_000n,
        recorderName: "محاسب أ",
        allocations: [
          { seq: 0, amount: DOWN },
          { seq: 1, amount: MONTHLY },
          { seq: 2, amount: 1_000_000n },
        ],
      }),
    ]);
  });

  it("writes an audit entry with the amount and what is left", async () => {
    const { id } = expectOk(await pay(f.accountantA, contractId, 2_500_050n));
    const [entry] = await ownerDb().select().from(auditLogs).where(eq(auditLogs.entityId, id));
    expect(entry).toMatchObject({
      action: "payment.recorded",
      companyId: f.companyA.id,
      actorUserId: f.accountantA.id,
      metadata: { amount: "25000.50", remaining: "974999.50" },
    });
  });

  it("refuses more than the remaining amount, and takes exactly the remaining amount", async () => {
    const outcome = await pay(f.accountantA, contractId, TOTAL + 1n);
    expect(outcome).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { amount: [expect.stringContaining("1,000,000.00")] },
    });
    expect(await ownerDb().select().from(payments)).toEqual([]);

    expectOk(await pay(f.accountantA, contractId, TOTAL));
    expect((await getContract(ctxOf(f.accountantA), contractId))?.remaining).toBe(0n);
    expect(await pay(f.accountantA, contractId, 1n)).toMatchObject({
      ok: false,
      fieldErrors: { amount: ["العقد مسدَّد بالكامل"] },
    });
  });

  it("is refused on a draft contract", async () => {
    const unit = await insertUnit(f.companyA.id);
    const reservation = expectOk(await reserve(f.repA, unit.id, (await insertClient(f.repA)).id));
    const { id } = expectOk(await draft(f.repA, reservation.id));
    expect(await pay(f.accountantA, id, 1_000n)).toMatchObject({ ok: false, code: "INVALID_STATE" });
  });

  it("does not find another company's contract", async () => {
    const accountantB = { ...f.managerB, role: "accountant" as const };
    expect(await pay(accountantB, contractId, 1_000n)).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("is an accountant's action, and takes the amount as SAR text", async () => {
    const input = { contractId, amount: "1500.25", idempotencyKey: crypto.randomUUID() };
    for (const user of [f.repA, f.managerA]) {
      currentSession.mockResolvedValue(sessionOf(user));
      expect(await recordPaymentAction(input)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    }
    currentSession.mockResolvedValue(sessionOf(f.accountantA));
    for (const amount of ["0", "-5", "12.345", "1e5", "abc"]) {
      expect(await recordPaymentAction({ ...input, amount })).toMatchObject({
        ok: false,
        error: { code: "VALIDATION", fieldErrors: { amount: [expect.any(String)] } },
      });
    }
    expect(await recordPaymentAction({ ...input, recordedBy: f.repA.id })).toMatchObject({
      ok: false,
      error: { code: "VALIDATION" },
    });
    expect(await recordPaymentAction(input)).toMatchObject({ ok: true, data: { contractId, replayed: false } });
    const [payment] = await ownerDb().select().from(payments);
    expect(payment).toMatchObject({ amountHalalas: 150_025n, recordedBy: f.accountantA.id });
  });
});

describe("the same form sent twice", () => {
  it("records one payment for a retried key, and returns it again", async () => {
    const key = crypto.randomUUID();
    const first = expectOk(await pay(f.accountantA, contractId, 5_000_000n, key));
    const again = expectOk(await pay(f.accountantA, contractId, 5_000_000n, key));
    expect(again).toEqual({ ...first, replayed: true });
    expect(await ownerDb().select().from(payments)).toHaveLength(1);
  });

  it("records one payment when a double click sends both at the same moment", async () => {
    const key = crypto.randomUUID();
    const outcomes = await Promise.all(Array.from({ length: 5 }, () => pay(f.accountantA, contractId, 5_000_000n, key)));
    const ids = new Set(outcomes.map((o) => expectOk(o).id));
    expect(ids.size).toBe(1);
    expect(outcomes.filter((o) => o.ok && !o.data.replayed)).toHaveLength(1);
    expect(await ownerDb().select().from(payments)).toHaveLength(1);
    expect((await scheduleOf(contractId))[0]?.paid).toBe(5_000_000n);
  });

  it("refuses a key already used for a different amount", async () => {
    const key = crypto.randomUUID();
    expectOk(await pay(f.accountantA, contractId, 5_000_000n, key));
    expect(await pay(f.accountantA, contractId, 6_000_000n, key)).toMatchObject({ ok: false, code: "CONFLICT" });
  });
});

describe("payments at the same time", () => {
  it("never take more than the contract owes", async () => {
    // Each alone fits; any two together overpay.
    const share = (TOTAL * 6n) / 10n;
    const outcomes = await Promise.all(Array.from({ length: 4 }, () => pay(f.accountantA, contractId, share)));
    expect(outcomes.filter((o) => o.ok)).toHaveLength(1);
    expect(outcomes.filter((o) => !o.ok).map((o) => !o.ok && o.code)).toEqual(["VALIDATION", "VALIDATION", "VALIDATION"]);
    expect((await getContract(ctxOf(f.accountantA), contractId))?.remaining).toBe(TOTAL - share);
  });
});

describe("overdue installments", () => {
  it("shows an installment past its due date as overdue until it is fully paid", async () => {
    const start = addDays(todayIn(), -20);
    const id = await approvedContract({ startDate: start });
    const today = todayIn();

    let schedule = await scheduleOf(id);
    expect(schedule[0]).toMatchObject({ seq: 0, dueDate: start });
    expect(installmentState(schedule[0]!, today)).toBe("overdue");
    expect(installmentState(schedule[1]!, today)).toBe("unpaid");

    expectOk(await pay(f.accountantA, id, DOWN - 1n));
    schedule = await scheduleOf(id);
    expect(installmentState(schedule[0]!, today)).toBe("overdue");

    expectOk(await pay(f.accountantA, id, 1n));
    schedule = await scheduleOf(id);
    expect(installmentState(schedule[0]!, today)).toBe("paid");
  });
});

describe("the database keeps payments as recorded", () => {
  it("does not let the app role edit or delete a payment, or set paid amounts by hand", async () => {
    expectOk(await pay(f.accountantA, contractId, 1_000n));
    const asAccountant = (statement: ReturnType<typeof sql>) =>
      withTenant(ctxOf(f.accountantA), (tx) => tx.execute(statement));
    expect(await databaseRefusal(asAccountant(sql`update payments set amount_halalas = 1`))).toContain("permission denied");
    expect(await databaseRefusal(asAccountant(sql`delete from payments`))).toContain("permission denied");
    expect(await databaseRefusal(asAccountant(sql`delete from payment_allocations`))).toContain("permission denied");
  });

  it("refuses an edit or delete even from the owner", async () => {
    expectOk(await pay(f.accountantA, contractId, 1_000n));
    const db = ownerDb();
    expect(await databaseRefusal(db.update(payments).set({ amountHalalas: 1n }))).toContain("payments is append-only");
    expect(await databaseRefusal(db.delete(payments))).toContain("payments is append-only");
    expect(await databaseRefusal(db.delete(paymentAllocations))).toContain("payment_allocations is append-only");
    expect(await databaseRefusal(db.update(installments).set({ paidHalalas: 0n }))).toContain("a payment cannot be undone");
  });

  it("refuses a payment that is not fully spread over the schedule", async () => {
    const lonePayment = ownerDb().transaction(async (tx) => {
      await tx.insert(payments).values({
        companyId: f.companyA.id,
        contractId,
        amountHalalas: 1_000n,
        idempotencyKey: crypto.randomUUID(),
        recordedBy: f.accountantA.id,
      });
    });
    expect(await databaseRefusal(lonePayment)).toMatch(/allocates 0 of 1000/);
  });

  it("refuses an allocation larger than what the installment still owes", async () => {
    const [first] = await scheduleOf(contractId);
    const overAllocated = ownerDb().transaction(async (tx) => {
      const [payment] = await tx
        .insert(payments)
        .values({
          companyId: f.companyA.id,
          contractId,
          amountHalalas: DOWN + 1n,
          idempotencyKey: crypto.randomUUID(),
          recordedBy: f.accountantA.id,
        })
        .returning({ id: payments.id });
      await tx.insert(paymentAllocations).values({
        paymentId: payment!.id,
        installmentId: first!.id,
        contractId,
        companyId: f.companyA.id,
        amountHalalas: DOWN + 1n,
      });
    });
    expect(await databaseRefusal(overAllocated)).toContain("installments_paid_within_amount");
  });

  it("shows a rep nothing of another rep's payments", async () => {
    expectOk(await pay(f.accountantA, contractId, 1_000n));
    const seen = await withTenant(ctxOf(f.repA2), async (tx) => ({
      payments: await tx.select({ id: payments.id }).from(payments),
      allocations: await tx.select({ id: paymentAllocations.paymentId }).from(paymentAllocations),
    }));
    expect(seen).toEqual({ payments: [], allocations: [] });
    const own = await withTenant(ctxOf(f.repA), (tx) => tx.select({ id: payments.id }).from(payments));
    expect(own).toHaveLength(1);
  });
});
