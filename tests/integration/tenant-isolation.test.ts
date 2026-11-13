import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { auditListQuerySchema } from "@/lib/schemas/audit";
import { listAuditLogs } from "@/server/audit/audit.service";
import { login } from "@/server/auth/auth.service";
import { getDb } from "@/server/db/client";
import { auditLogs } from "@/server/db/schema";
import { withTenant } from "@/server/db/tenant";
import { ctxOf, type Fixture, ownerDb, resetDatabase, seedTwoCompanies, TEST_PASSWORD } from "../helpers/db";
import { databaseRefusal } from "../helpers/errors";

let f: Fixture;

async function auditIdsOf(companyId: string): Promise<string[]> {
  const rows = await ownerDb().select({ id: auditLogs.id }).from(auditLogs).where(eq(auditLogs.companyId, companyId));
  return rows.map((row) => row.id).sort();
}

beforeEach(async () => {
  await resetDatabase();
  f = await seedTwoCompanies();
  // Real events in both companies, plus one that belongs to no company.
  await login({ email: f.managerA.email, password: TEST_PASSWORD }, { ip: null });
  await login({ email: f.repA.email, password: "wrong" }, { ip: null });
  await login({ email: f.managerB.email, password: TEST_PASSWORD }, { ip: null });
  await login({ email: "nobody@b.test", password: "wrong" }, { ip: null });
});

describe("company isolation in the application layer", () => {
  it("a manager's audit log holds exactly their company's events", async () => {
    const page = await listAuditLogs(ctxOf(f.managerA), { page: 1, pageSize: 50 });
    const companyA = await auditIdsOf(f.companyA.id);

    expect(companyA.length).toBeGreaterThan(0);
    expect(page.items.map((item) => item.id).sort()).toEqual(companyA);
    expect(page.total).toBe(companyA.length);
  });

  it("ignores a companyId smuggled in through the query string", async () => {
    const query = auditListQuerySchema.parse({ page: "1", companyId: f.companyB.id });
    const page = await listAuditLogs(ctxOf(f.managerA), query);
    const companyB = await auditIdsOf(f.companyB.id);

    expect(companyB.length).toBeGreaterThan(0);
    expect(page.items.some((item) => companyB.includes(item.id))).toBe(false);
  });
});

describe("row-level security beneath the application filter", () => {
  it("an unfiltered select inside company A's transaction returns only A's rows", async () => {
    const rows = await withTenant(ctxOf(f.managerA), (tx) => tx.select().from(auditLogs));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.companyId === f.companyA.id)).toBe(true);
  });

  it("with no company set, the app role sees no rows at all", async () => {
    expect(await getDb().select().from(auditLogs)).toEqual([]);
  });

  it("refuses to write a row into another company", async () => {
    const refusal = await databaseRefusal(
      withTenant(ctxOf(f.managerA), (tx) =>
        tx.insert(auditLogs).values({ companyId: f.companyB.id, action: "auth.logout" }),
      ),
    );
    expect(refusal).toMatch(/row-level security/);
  });
});

describe("the audit log cannot be rewritten", () => {
  it("the app role holds no UPDATE or DELETE on it", async () => {
    const ctx = ctxOf(f.managerA);
    expect(await databaseRefusal(withTenant(ctx, (tx) => tx.update(auditLogs).set({ ip: null })))).toMatch(
      /permission denied/,
    );
    expect(await databaseRefusal(withTenant(ctx, (tx) => tx.delete(auditLogs)))).toMatch(/permission denied/);
  });

  it("even the table owner is stopped by the append-only trigger", async () => {
    expect(await databaseRefusal(ownerDb().update(auditLogs).set({ ip: null }))).toMatch(/append-only/);
    expect(await databaseRefusal(ownerDb().delete(auditLogs))).toMatch(/append-only/);
  });

  it("an entry cannot name an actor from a different company", async () => {
    const refusal = await databaseRefusal(
      ownerDb()
        .insert(auditLogs)
        .values({ companyId: f.companyA.id, actorUserId: f.managerB.id, action: "auth.logout" }),
    );
    expect(refusal).toMatch(/audit_logs_actor_same_company_fk/);
  });
});
