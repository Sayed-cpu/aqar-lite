import "server-only";
import { sql } from "drizzle-orm";
import type { Role } from "@/lib/roles";
import { getDb, type Tx } from "./client";

/** Who is acting. Built from the session only — never from a request. */
export type TenantCtx = {
  userId: string;
  companyId: string;
  role: Role;
};

/**
 * Pins the transaction to a company for row-level security. Transaction-local
 * (the `true` argument), so it cannot leak to the next user of the pooled
 * connection.
 */
export async function setTransactionCompany(tx: Tx, companyId: string): Promise<void> {
  await tx.execute(sql`select set_config('app.company_id', ${companyId}, true)`);
}

/**
 * Every tenant-scoped read and write runs in here. Queries still filter by
 * company (and by owner, for a rep's clients) themselves; the database
 * policies, which read these three settings, are the net under that.
 */
export function withTenant<T>(ctx: TenantCtx, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`
      select set_config('app.company_id', ${ctx.companyId}, true),
             set_config('app.user_id', ${ctx.userId}, true),
             set_config('app.role', ${ctx.role}, true)
    `);
    return fn(tx);
  });
}

/**
 * The pre-session form, for auth events only: at login the company comes from
 * the matched user, or is null when the email matches no one.
 */
export function withCompany<T>(companyId: string | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => {
    if (companyId !== null) await setTransactionCompany(tx, companyId);
    return fn(tx);
  });
}
