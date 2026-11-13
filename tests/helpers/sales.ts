import { sql } from "drizzle-orm";
import { todayIn } from "@/domain/dates";
import type { ActionErrorCode, FieldErrors } from "@/lib/action-result";
import type { ContractTerms } from "@/lib/schemas/sales";
import type { ActionContext } from "@/server/actions/create-action";
import { DomainError } from "@/server/actions/errors";
import type { Tx } from "@/server/db/client";
import { withTenant } from "@/server/db/tenant";
import { approveContract, createDraft } from "@/server/contracts/contracts.service";
import { recordPayment } from "@/server/payments/payments.service";
import { reserveUnit } from "@/server/reservations/reservations.service";
import { ownerDb, type TestUser } from "./db";

export type Outcome<T> = { ok: true; data: T } | { ok: false; code: ActionErrorCode; message: string; fieldErrors?: FieldErrors };

export function actionCtxOf(user: TestUser): ActionContext {
  return { userId: user.id, companyId: user.companyId, role: user.role, sessionId: "test-session", ip: null };
}

/**
 * A service handler run the way createAction runs it (inside withTenant, as
 * the app role), without the session lookup — so many users can act at once.
 * A DomainError becomes a failed outcome; anything else is thrown.
 */
export async function as<T>(user: TestUser, handler: (ctx: ActionContext, tx: Tx) => Promise<T>): Promise<Outcome<T>> {
  const ctx = actionCtxOf(user);
  try {
    return { ok: true, data: await withTenant(ctx, (tx) => handler(ctx, tx)) };
  } catch (err) {
    if (err instanceof DomainError) {
      return { ok: false, code: err.code, message: err.message, fieldErrors: err.fieldErrors };
    }
    throw err;
  }
}

export function expectOk<T>(outcome: Outcome<T>): T {
  if (!outcome.ok) throw new Error(`expected success, got ${outcome.code}: ${outcome.message}`);
  return outcome.data;
}

export const reserve = (rep: TestUser, unitId: string, clientId: string) =>
  as(rep, (ctx, tx) => reserveUnit({ unitId, clientId }, ctx, tx));

export const DEFAULT_TERMS: ContractTerms = {
  finalPrice: 100_000_000n,
  downPayment: 10_000_000n,
  installmentCount: 12,
  startDate: todayIn(),
};

export const draft = (rep: TestUser, reservationId: string, terms: Partial<ContractTerms> = {}) =>
  as(rep, (ctx, tx) => createDraft({ reservationId, ...DEFAULT_TERMS, ...terms }, ctx, tx));

export const approve = (accountant: TestUser, id: string, revision = 1) =>
  as(accountant, (ctx, tx) => approveContract({ id, revision }, ctx, tx));

export const pay = (accountant: TestUser, contractId: string, amount: bigint, idempotencyKey: string = crypto.randomUUID()) =>
  as(accountant, (ctx, tx) => recordPayment({ contractId, amount, idempotencyKey }, ctx, tx));

/** Moves a reservation's 72 hours into the past, as if they had run out. */
export async function backdateReservation(reservationId: string, hoursAgo = 73): Promise<void> {
  await ownerDb().execute(sql`
    update reservations
    set created_at = now() - make_interval(hours => ${hoursAgo}),
        expires_at = now() - make_interval(hours => ${hoursAgo}) + interval '72 hours'
    where id = ${reservationId}
  `);
}

/** Resolves once `count` backends are waiting on a lock: the barrier for concurrency tests. */
export async function waitForLockWaiters(count: number, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await ownerDb().execute<{ waiting: number }>(sql`
      select count(*)::int as waiting from pg_stat_activity
      where datname = current_database() and wait_event_type = 'Lock'
    `);
    if (Number(result.rows[0]?.waiting ?? 0) >= count) return;
    if (Date.now() > deadline) throw new Error(`only ${result.rows[0]?.waiting} of ${count} waiters arrived`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
