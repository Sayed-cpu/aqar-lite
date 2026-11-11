import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createAction } from "@/server/actions/create-action";
import { DomainError } from "@/server/actions/errors";
import { appendAudit } from "@/server/audit/audit.service";
import { getCurrentSession } from "@/server/auth/current-user";
import type { SessionUser } from "@/server/auth/session";
import { auditLogs } from "@/server/db/schema";
import { type Fixture, ownerDb, resetDatabase, seedTwoCompanies } from "../helpers/db";

vi.mock("@/server/auth/current-user", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/auth/current-user")>()),
  getCurrentSession: vi.fn(),
}));
const currentSession = vi.mocked(getCurrentSession);

let f: Fixture;

function signedInAs(user: Fixture["managerA"]): void {
  const session: SessionUser = {
    sessionId: "0".repeat(64),
    userId: user.id,
    companyId: user.companyId,
    companyName: "—",
    role: user.role,
    name: user.name,
    email: user.email,
    expiresAt: new Date(Date.now() + 60_000),
  };
  currentSession.mockResolvedValue(session);
}

// A stand-in for a real feature action: reads what its transaction can see.
const probe = createAction(
  {
    name: "probe",
    schema: z.strictObject({ note: z.string().max(10, { error: "طويل" }) }),
    permission: "audit:read",
  },
  async (input, ctx, tx) => {
    const visible = await tx.select({ companyId: auditLogs.companyId }).from(auditLogs);
    return {
      companyId: ctx.companyId,
      note: input.note,
      visibleCompanies: [...new Set(visible.map((row) => row.companyId))],
    };
  },
);

beforeEach(async () => {
  currentSession.mockReset();
  await resetDatabase();
  f = await seedTwoCompanies();
  await ownerDb()
    .insert(auditLogs)
    .values([
      { companyId: f.companyA.id, action: "auth.logout" },
      { companyId: f.companyB.id, action: "auth.logout" },
    ]);
});

describe("createAction", () => {
  it("refuses a request with no session", async () => {
    currentSession.mockResolvedValue(null);
    expect(await probe({ note: "x" })).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
  });

  it("refuses a role the permission does not include", async () => {
    signedInAs(f.repA);
    expect(await probe({ note: "x" })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("rejects fields the schema does not define, such as a companyId", async () => {
    signedInAs(f.managerA);
    const result = await probe({ note: "x", companyId: f.companyB.id });
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
  });

  it("returns validation messages keyed by field", async () => {
    signedInAs(f.managerA);
    const result = await probe({ note: "far too long for this" });
    expect(result).toEqual({
      ok: false,
      error: { code: "VALIDATION", message: expect.any(String), fieldErrors: { note: ["طويل"] } },
    });
  });

  it("runs the handler as the session's company, inside its row-level security", async () => {
    signedInAs(f.managerA);
    const result = await probe({ note: "x" });
    expect(result).toEqual({
      ok: true,
      data: { companyId: f.companyA.id, note: "x", visibleCompanies: [f.companyA.id] },
    });
  });

  it("passes a business-rule refusal through with its own message", async () => {
    signedInAs(f.managerA);
    const refuses = createAction(
      { name: "refuses", schema: z.strictObject({}), permission: "audit:read" },
      async () => {
        throw new DomainError("CONFLICT", "الوحدة محجوزة بالفعل");
      },
    );
    expect(await refuses({})).toEqual({ ok: false, error: { code: "CONFLICT", message: "الوحدة محجوزة بالفعل" } });
  });

  it("hides an unexpected error behind a generic message and rolls its writes back", async () => {
    signedInAs(f.managerA);
    const [before] = await ownerDb().select({ n: sql<number>`count(*)::int` }).from(auditLogs);

    const fails = createAction(
      { name: "fails", schema: z.strictObject({}), permission: "audit:read" },
      async (_input, ctx, tx) => {
        await appendAudit(tx, { companyId: ctx.companyId, actorUserId: ctx.userId, action: "auth.logout" });
        throw new Error("connection to db failed: password=hunter2");
      },
    );
    const result = await fails({});

    expect(result).toMatchObject({ ok: false, error: { code: "INTERNAL" } });
    expect(JSON.stringify(result)).not.toContain("hunter2");
    const [after] = await ownerDb().select({ n: sql<number>`count(*)::int` }).from(auditLogs);
    expect(after?.n).toBe(before?.n);
  });
});
