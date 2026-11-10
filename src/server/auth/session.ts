import "server-only";
import { eq } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { SESSION_TTL_SECONDS } from "@/lib/session-cookie";
import type { Role } from "@/lib/roles";
import { getDb } from "../db/client";
import { companies, sessions, users } from "../db/schema";

const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;
/** A session used with less than this left is pushed out to a full TTL again. */
const SESSION_RENEW_THRESHOLD_MS = SESSION_TTL_MS / 2;
/** 32 random bytes, base64url-encoded. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type SessionUser = {
  sessionId: string;
  userId: string;
  companyId: string;
  companyName: string;
  role: Role;
  name: string;
  email: string;
  expiresAt: Date;
};

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** The stored id. Only this is persisted; the token itself never is. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await getDb()
    .insert(sessions)
    .values({ id: hashSessionToken(token), userId, expiresAt });
  return { token, expiresAt };
}

/**
 * The only way a request becomes a user. Returns null for anything that is
 * not a live session — malformed, unknown, revoked or expired alike.
 */
export async function validateSessionToken(token: string): Promise<SessionUser | null> {
  if (!TOKEN_PATTERN.test(token)) return null;

  const db = getDb();
  const sessionId = hashSessionToken(token);
  const [row] = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      userId: users.id,
      companyId: users.companyId,
      companyName: companies.name,
      role: users.role,
      name: users.name,
      email: users.email,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(companies, eq(users.companyId, companies.id))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!row) return null;

  const now = Date.now();
  if (row.expiresAt.getTime() <= now) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  if (row.expiresAt.getTime() - now < SESSION_RENEW_THRESHOLD_MS) {
    const expiresAt = new Date(now + SESSION_TTL_MS);
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, sessionId));
    return { ...row, expiresAt };
  }

  return row;
}

/** Logout: the row goes, so the token is dead even if the cookie survives. */
export async function invalidateSession(sessionId: string): Promise<void> {
  await getDb().delete(sessions).where(eq(sessions.id, sessionId));
}
