import "server-only";
import { eq, sql } from "drizzle-orm";
import type { LoginInput } from "@/lib/schemas/auth";
import { appendAudit } from "../audit/audit.service";
import { getDb } from "../db/client";
import { loginAttempts, users } from "../db/schema";
import { withCompany } from "../db/tenant";
import { verifyAgainstDummyHash, verifyPassword } from "./password";
import { isLoginLocked } from "./rate-limit";
import { createSession, invalidateSession, type SessionUser } from "./session";

export type LoginResult =
  | { ok: true; token: string; expiresAt: Date }
  | { ok: false; reason: "invalid_credentials" | "locked" };

type RequestMeta = { ip: string | null };

/**
 * Wrong password, unknown email and a malformed stored hash all come back as
 * the same "invalid_credentials", after the same Argon2 work.
 */
export async function login(input: LoginInput, meta: RequestMeta): Promise<LoginResult> {
  const { email, password } = input;

  // Phase 1 — reserve the attempt. Under a per-email lock, check the limit and
  // record this attempt as a failure up front, so parallel guesses each see
  // the others and the limit is exact rather than racy. The lock is released
  // before Argon2 runs, so no connection is held during the slow part.
  const attemptId = await getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`login:${email}`}))`);
    if (await isLoginLocked(tx, email, meta.ip)) return null;
    const [attempt] = await tx
      .insert(loginAttempts)
      .values({ email, ip: meta.ip, succeeded: false })
      .returning({ id: loginAttempts.id });
    return attempt?.id ?? null;
  });

  const [user] = await getDb()
    .select({ id: users.id, companyId: users.companyId, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (attemptId === null) {
    await auditFailedLogin(user, email, meta, "locked");
    return { ok: false, reason: "locked" };
  }

  const valid = user
    ? await verifyPassword(user.passwordHash, password)
    : (await verifyAgainstDummyHash(password), false);

  if (!user || !valid) {
    await auditFailedLogin(user, email, meta, "invalid_credentials");
    return { ok: false, reason: "invalid_credentials" };
  }

  // Phase 2 — success: flip the reserved attempt (which resets the lockout
  // window), open the session and audit it, all or nothing.
  return withCompany(user.companyId, async (tx) => {
    await tx.update(loginAttempts).set({ succeeded: true }).where(eq(loginAttempts.id, attemptId));
    const session = await createSession(tx, user.id);
    await appendAudit(tx, {
      companyId: user.companyId,
      actorUserId: user.id,
      action: "auth.login_succeeded",
      entityType: "user",
      entityId: user.id,
      ip: meta.ip,
    });
    return { ok: true, ...session };
  });
}

export async function logout(session: SessionUser, meta: RequestMeta): Promise<void> {
  await withCompany(session.companyId, async (tx) => {
    await invalidateSession(tx, session.sessionId);
    await appendAudit(tx, {
      companyId: session.companyId,
      actorUserId: session.userId,
      action: "auth.logout",
      entityType: "user",
      entityId: session.userId,
      ip: meta.ip,
    });
  });
}

async function auditFailedLogin(
  user: { id: string; companyId: string } | undefined,
  email: string,
  meta: RequestMeta,
  reason: "invalid_credentials" | "locked",
): Promise<void> {
  // A known user's company sees the attempt in its log. An email matching
  // nobody belongs to no company: the row is kept but no tenant can read it.
  await withCompany(user?.companyId ?? null, (tx) =>
    appendAudit(tx, {
      companyId: user?.companyId ?? null,
      actorUserId: null,
      action: "auth.login_failed",
      entityType: user ? "user" : undefined,
      entityId: user?.id,
      metadata: { email, reason },
      ip: meta.ip,
    }),
  );
}
