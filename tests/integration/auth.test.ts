import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { login, logout } from "@/server/auth/auth.service";
import { MAX_FAILURES_PER_EMAIL } from "@/server/auth/rate-limit";
import { generateSessionToken, hashSessionToken, validateSessionToken } from "@/server/auth/session";
import { auditLogs, loginAttempts, sessions } from "@/server/db/schema";
import { type Fixture, ownerDb, resetDatabase, seedTwoCompanies, TEST_PASSWORD } from "../helpers/db";

const meta = { ip: null };
const INVALID = { ok: false, reason: "invalid_credentials" } as const;
const LOCKED = { ok: false, reason: "locked" } as const;

let f: Fixture;

beforeEach(async () => {
  await resetDatabase();
  f = await seedTwoCompanies();
});

describe("login", () => {
  it("opens a session and stores only the token's hash", async () => {
    const result = await login({ email: f.managerA.email, password: TEST_PASSWORD }, meta);
    if (!result.ok) throw new Error(`expected success, got ${result.reason}`);

    const rows = await ownerDb().select().from(sessions);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(hashSessionToken(result.token));
    expect(rows[0]?.id).not.toBe(result.token);

    expect(await validateSessionToken(result.token)).toMatchObject({
      userId: f.managerA.id,
      companyId: f.companyA.id,
      role: "manager",
    });
  });

  it("answers a wrong password and an unknown email identically", async () => {
    const wrongPassword = await login({ email: f.managerA.email, password: "nope" }, meta);
    const unknownEmail = await login({ email: "nobody@a.test", password: "nope" }, meta);
    expect(wrongPassword).toEqual(INVALID);
    expect(unknownEmail).toEqual(wrongPassword);
  });

  it("locks an email after five failures, even against the right password", async () => {
    for (let i = 0; i < MAX_FAILURES_PER_EMAIL; i++) {
      expect(await login({ email: f.managerA.email, password: "nope" }, meta)).toEqual(INVALID);
    }
    expect(await login({ email: f.managerA.email, password: TEST_PASSWORD }, meta)).toEqual(LOCKED);
  });

  it("locks an unknown email the same way, so the lockout reveals nothing", async () => {
    for (let i = 0; i < MAX_FAILURES_PER_EMAIL; i++) {
      expect(await login({ email: "nobody@a.test", password: "nope" }, meta)).toEqual(INVALID);
    }
    expect(await login({ email: "nobody@a.test", password: "nope" }, meta)).toEqual(LOCKED);
  });

  it("cannot be raced past the limit by parallel guesses", async () => {
    const attempts = 12;
    const results = await Promise.all(
      Array.from({ length: attempts }, () => login({ email: f.managerA.email, password: "nope" }, meta)),
    );

    expect(results.filter((r) => !r.ok && r.reason === "invalid_credentials")).toHaveLength(MAX_FAILURES_PER_EMAIL);
    expect(results.filter((r) => !r.ok && r.reason === "locked")).toHaveLength(attempts - MAX_FAILURES_PER_EMAIL);

    const [recorded] = await ownerDb()
      .select({ n: sql<number>`count(*)::int` })
      .from(loginAttempts)
      .where(eq(loginAttempts.email, f.managerA.email));
    expect(recorded?.n).toBe(MAX_FAILURES_PER_EMAIL);
  });

  it("restarts the count after a successful login", async () => {
    for (let i = 0; i < MAX_FAILURES_PER_EMAIL - 1; i++) {
      await login({ email: f.managerA.email, password: "nope" }, meta);
    }
    expect((await login({ email: f.managerA.email, password: TEST_PASSWORD }, meta)).ok).toBe(true);

    for (let i = 0; i < MAX_FAILURES_PER_EMAIL; i++) {
      expect(await login({ email: f.managerA.email, password: "nope" }, meta)).toEqual(INVALID);
    }
    expect(await login({ email: f.managerA.email, password: "nope" }, meta)).toEqual(LOCKED);
  });

  it("audits a failed login under the user's company, and an unknown email under none", async () => {
    await login({ email: f.managerA.email, password: "nope" }, meta);
    await login({ email: "nobody@a.test", password: "nope" }, meta);

    const failed = await ownerDb().select().from(auditLogs).where(eq(auditLogs.action, "auth.login_failed"));
    expect(failed).toHaveLength(2);
    expect(failed.find((row) => row.metadata.email === f.managerA.email)?.companyId).toBe(f.companyA.id);
    expect(failed.find((row) => row.metadata.email === "nobody@a.test")?.companyId).toBeNull();
    // The password is never part of the record.
    expect(JSON.stringify(failed)).not.toContain("nope");
  });
});

describe("sessions", () => {
  it("logout deletes the session, so the same token stops working", async () => {
    const result = await login({ email: f.managerA.email, password: TEST_PASSWORD }, meta);
    if (!result.ok) throw new Error("login failed");
    const user = await validateSessionToken(result.token);
    if (!user) throw new Error("session not valid after login");

    await logout(user, meta);

    expect(await validateSessionToken(result.token)).toBeNull();
    expect(await ownerDb().select().from(sessions)).toHaveLength(0);
    const loggedOut = await ownerDb().select().from(auditLogs).where(eq(auditLogs.action, "auth.logout"));
    expect(loggedOut).toMatchObject([{ companyId: f.companyA.id, actorUserId: f.managerA.id }]);
  });

  it("rejects an expired session and removes it", async () => {
    const token = generateSessionToken();
    await ownerDb()
      .insert(sessions)
      .values({ id: hashSessionToken(token), userId: f.managerA.id, expiresAt: new Date(Date.now() - 1000) });

    expect(await validateSessionToken(token)).toBeNull();
    expect(await ownerDb().select().from(sessions)).toHaveLength(0);
  });

  it("rejects a token that is not in the expected format", async () => {
    expect(await validateSessionToken("not-a-token")).toBeNull();
    expect(await validateSessionToken("")).toBeNull();
  });
});
