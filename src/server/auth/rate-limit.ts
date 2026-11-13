import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import type { Tx } from "../db/client";
import { loginAttempts } from "../db/schema";

export const LOGIN_WINDOW_MINUTES = 15;
export const MAX_FAILURES_PER_EMAIL = 5;
/** Only applied when the client IP is trustworthy (TRUST_PROXY). */
export const MAX_FAILURES_PER_IP = 20;

/**
 * Locked when the email has MAX_FAILURES_PER_EMAIL failures in the window,
 * counted since its last successful login. Keyed on the submitted email, not
 * on a user, so an email that matches nobody locks the same way.
 */
export async function isLoginLocked(tx: Tx, email: string, ip: string | null): Promise<boolean> {
  const windowStart = sql`now() - make_interval(mins => ${LOGIN_WINDOW_MINUTES})`;

  const [byEmail] = await tx
    .select({ failures: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.email, email),
        eq(loginAttempts.succeeded, false),
        sql`${loginAttempts.createdAt} > greatest(
          ${windowStart},
          coalesce(
            (select max(la.created_at) from login_attempts la where la.email = ${email} and la.succeeded),
            '-infinity'::timestamptz
          )
        )`,
      ),
    );
  if ((byEmail?.failures ?? 0) >= MAX_FAILURES_PER_EMAIL) return true;

  if (ip === null) return false;
  const [byIp] = await tx
    .select({ failures: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.ip, ip), eq(loginAttempts.succeeded, false), gt(loginAttempts.createdAt, windowStart)));
  return (byIp?.failures ?? 0) >= MAX_FAILURES_PER_IP;
}
