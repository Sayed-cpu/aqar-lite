import "server-only";
import { sql } from "drizzle-orm";
import type { Db, Tx } from "../db/client";

/**
 * Ends every reservation whose 72 hours are up and frees its unit (see
 * expire_due_reservations() in the sales migration). Run at the start of
 * every read that shows a unit's or a reservation's status, and every minute
 * by the sweeper, so a unit is shown available the moment its time is up
 * even if nobody touched it.
 *
 * Decisions never depend on it: reserving, drafting and approving each
 * compare expires_at with now() themselves, under the unit's lock.
 */
export async function expireDueReservations(db: Db | Tx): Promise<number> {
  const result = await db.execute<{ freed: number }>(sql`select expire_due_reservations() as freed`);
  return Number(result.rows[0]?.freed ?? 0);
}

/** For one unit whose row lock the caller holds. True when it freed the unit. */
export async function expireUnitReservation(tx: Tx, unitId: string): Promise<boolean> {
  const result = await tx.execute<{ freed: boolean }>(sql`select expire_unit_reservation(${unitId}) as freed`);
  return result.rows[0]?.freed === true;
}
