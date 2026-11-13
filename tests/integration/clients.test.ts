import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clientListQuerySchema } from "@/lib/schemas/clients";
import { getCurrentSession } from "@/server/auth/current-user";
import { createClientAction, updateClientAction } from "@/server/clients/clients.actions";
import { getClient, listClients } from "@/server/clients/clients.service";
import { getDb } from "@/server/db/client";
import { clients } from "@/server/db/schema";
import { withTenant } from "@/server/db/tenant";
import { ctxOf, type Fixture, insertClient, ownerDb, resetDatabase, seedTwoCompanies, type TestUser } from "../helpers/db";
import { databaseRefusal } from "../helpers/errors";
import { sessionOf } from "../helpers/session";

vi.mock("@/server/auth/current-user", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/auth/current-user")>()),
  getCurrentSession: vi.fn(),
}));
const currentSession = vi.mocked(getCurrentSession);
const signedInAs = (user: TestUser) => currentSession.mockResolvedValue(sessionOf(user));

const query = (params: Record<string, string> = {}) => clientListQuerySchema.parse(params);
const names = async (user: TestUser, params: Record<string, string> = {}) =>
  (await listClients(ctxOf(user), query(params))).items.map((client) => client.name).sort();

let f: Fixture;
let ofRepA: { id: string };
let ofRepA2: { id: string };
let ofRepB: { id: string };

beforeEach(async () => {
  currentSession.mockReset();
  await resetDatabase();
  f = await seedTwoCompanies();
  ofRepA = await insertClient(f.repA, { name: "عميل المندوب الأول", phone: "0551112222" });
  ofRepA2 = await insertClient(f.repA2, { name: "عميل المندوب الثاني", phone: "0553334444" });
  ofRepB = await insertClient(f.repB, { name: "عميل شركة ب", phone: "0555556666" });
});

describe("who sees which clients", () => {
  it("shows a sales rep only the clients they own", async () => {
    expect(await names(f.repA)).toEqual(["عميل المندوب الأول"]);
    expect(await names(f.repA2)).toEqual(["عميل المندوب الثاني"]);
    expect(await getClient(ctxOf(f.repA), ofRepA2.id)).toBeNull();
    expect(await getClient(ctxOf(f.repA), ofRepA.id)).toMatchObject({ ownerName: "مندوب أ" });
  });

  it("shows the manager and the accountant every client of their company, with the owner", async () => {
    for (const user of [f.managerA, f.accountantA]) {
      const page = await listClients(ctxOf(user), query());
      expect(page.items.map((client) => [client.name, client.ownerName]).sort()).toEqual([
        ["عميل المندوب الأول", "مندوب أ"],
        ["عميل المندوب الثاني", "مندوب أ2"],
      ]);
    }
  });

  it("never shows another company's clients, not even to its manager", async () => {
    expect(await names(f.managerB)).toEqual(["عميل شركة ب"]);
    expect(await getClient(ctxOf(f.managerB), ofRepA.id)).toBeNull();
    expect(await getClient(ctxOf(f.managerA), ofRepB.id)).toBeNull();
  });

  it("keeps a rep to their own rows even in a query that forgets the owner", async () => {
    const visible = (user: TestUser) =>
      withTenant(ctxOf(user), (tx) => tx.select({ id: clients.id }).from(clients)).then((rows) =>
        rows.map((row) => row.id).sort(),
      );
    expect(await visible(f.repA)).toEqual([ofRepA.id]);
    expect(await visible(f.managerA)).toEqual([ofRepA.id, ofRepA2.id].sort());
  });

  it("shows nothing at all when no role is set on the connection", async () => {
    const rows = await getDb().transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.company_id', ${f.companyA.id}, true)`);
      return tx.select({ id: clients.id }).from(clients);
    });
    expect(rows).toEqual([]);
  });
});

describe("searching", () => {
  beforeEach(async () => {
    await insertClient(f.repA, { name: "سارة 100% جادة", phone: "0559990001" });
    await insertClient(f.repA, { name: "سامي", phone: "0559990002" });
  });

  it("matches part of a name or a phone, Arabic digits included", async () => {
    expect(await names(f.repA, { q: "سا" })).toEqual(["سارة 100% جادة", "سامي"]);
    expect(await names(f.repA, { q: "٩٩٩٠٠٠٢" })).toEqual(["سامي"]);
  });

  it("treats LIKE wildcards in the search as plain text", async () => {
    expect(await names(f.repA, { q: "%" })).toEqual(["سارة 100% جادة"]);
    expect(await names(f.repA, { q: "_" })).toEqual([]);
  });

  it("searches only within what the user may see", async () => {
    expect(await names(f.repA, { q: "عميل" })).toEqual(["عميل المندوب الأول"]);
    expect(await names(f.managerA, { q: "عميل" })).toEqual(["عميل المندوب الأول", "عميل المندوب الثاني"]);
  });
});

describe("adding and editing clients", () => {
  const input = { name: "نوف العتيبي", phone: "٠٥٥ ١٢٣ ٤٥٦٧", notes: '<img src=x onerror="alert(1)"> ملاحظة' };

  it("makes the signed-in rep the owner, and keeps the notes exactly as typed", async () => {
    signedInAs(f.repA2);
    const result = await createClientAction(input);
    if (!result.ok) throw new Error(result.error.message);

    const [row] = await ownerDb().select().from(clients).where(eq(clients.id, result.data.id));
    expect(row).toMatchObject({
      companyId: f.companyA.id,
      ownerUserId: f.repA2.id,
      phone: "0551234567",
      notes: input.notes,
    });
  });

  it("refuses an owner or a company in the input", async () => {
    signedInAs(f.repA);
    for (const extra of [{ ownerUserId: f.repA2.id }, { companyId: f.companyB.id }]) {
      expect(await createClientAction({ ...input, ...extra })).toMatchObject({
        ok: false,
        error: { code: "VALIDATION" },
      });
    }
  });

  it("refuses the manager and the accountant, who only read clients", async () => {
    for (const user of [f.managerA, f.accountantA]) {
      signedInAs(user);
      expect(await createClientAction(input)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
      expect(await updateClientAction({ ...input, id: ofRepA.id })).toMatchObject({
        ok: false,
        error: { code: "FORBIDDEN" },
      });
    }
  });

  it("lets only the owning rep edit, and answers anyone else as not found", async () => {
    signedInAs(f.repA2);
    expect(await updateClientAction({ ...input, id: ofRepA.id })).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    signedInAs(f.repB);
    expect(await updateClientAction({ ...input, id: ofRepA.id })).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    const [untouched] = await ownerDb().select().from(clients).where(eq(clients.id, ofRepA.id));
    expect(untouched?.name).toBe("عميل المندوب الأول");

    signedInAs(f.repA);
    expect(await updateClientAction({ ...input, id: ofRepA.id })).toEqual({ ok: true, data: { id: ofRepA.id } });
    const [edited] = await ownerDb().select().from(clients).where(eq(clients.id, ofRepA.id));
    expect(edited).toMatchObject({ name: input.name, ownerUserId: f.repA.id });
  });

  it("reports a phone the rep already has next to the field, but lets another rep use it", async () => {
    signedInAs(f.repA);
    expect(await createClientAction({ ...input, phone: "0551112222" })).toEqual({
      ok: false,
      error: { code: "CONFLICT", message: expect.any(String), fieldErrors: { phone: [expect.any(String)] } },
    });
    signedInAs(f.repA2);
    expect((await createClientAction({ ...input, phone: "0551112222" })).ok).toBe(true);
  });

  it("validates each field and says which one is wrong", async () => {
    signedInAs(f.repA);
    const result = await createClientAction({ name: " ", phone: "123", notes: "x".repeat(2001) });
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(result.ok ? {} : Object.keys(result.error.fieldErrors ?? {}).sort()).toEqual(["name", "notes", "phone"]);
  });
});

describe("the database holds client ownership on its own", () => {
  it("refuses a rep writing a client owned by someone else", async () => {
    const insert = withTenant(ctxOf(f.repA), (tx) =>
      tx.insert(clients).values({ companyId: f.companyA.id, ownerUserId: f.repA2.id, name: "x x", phone: "0550000000" }),
    );
    expect(await databaseRefusal(insert)).toContain("row-level security");
  });

  it("does not let the app role change a client's owner or company, or delete one", async () => {
    const asApp = (statement: ReturnType<typeof sql>) => withTenant(ctxOf(f.repA), (tx) => tx.execute(statement));
    expect(
      await databaseRefusal(asApp(sql`update clients set owner_user_id = ${f.repA2.id} where id = ${ofRepA.id}`)),
    ).toContain("permission denied");
    expect(
      await databaseRefusal(asApp(sql`update clients set company_id = ${f.companyB.id} where id = ${ofRepA.id}`)),
    ).toContain("permission denied");
    expect(await databaseRefusal(asApp(sql`delete from clients where id = ${ofRepA.id}`))).toContain(
      "permission denied",
    );
  });

  it("refuses an owner from another company, and a malformed phone", async () => {
    const crossCompany = ownerDb()
      .insert(clients)
      .values({ companyId: f.companyA.id, ownerUserId: f.repB.id, name: "x x", phone: "0550000001" });
    expect(await databaseRefusal(crossCompany)).toContain("clients_owner_same_company_fk");
    expect(await databaseRefusal(insertClient(f.repA, { phone: "not-a-phone" }))).toContain("clients_phone_format");
  });
});
