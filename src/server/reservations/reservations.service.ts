import "server-only";
import { and, desc, eq, type SQL, sql } from "drizzle-orm";
import { RESERVATION_HOURS, type ReservationStatus } from "@/lib/sales";
import type { ReservationListQuery, ReserveUnitInput } from "@/lib/schemas/sales";
import { DomainError } from "../actions/errors";
import type { ActionContext } from "../actions/create-action";
import type { Tx } from "../db/client";
import { violatedUniqueConstraint } from "../db/errors";
import { offsetOf, type Page, pageOf } from "../db/page";
import { clients, contracts, reservations, units, users } from "../db/schema";
import { type TenantCtx, withTenant } from "../db/tenant";
import { expireDueReservations, expireUnitReservation } from "./expiry";

export type Reservation = {
  id: string;
  status: ReservationStatus;
  createdAt: Date;
  expiresAt: Date;
  endedAt: Date | null;
  unitId: string;
  unitLabel: string;
  clientId: string;
  clientName: string;
  reservedBy: string;
  repName: string;
  contractId: string | null;
};

const columns = {
  id: reservations.id,
  status: reservations.status,
  createdAt: reservations.createdAt,
  expiresAt: reservations.expiresAt,
  endedAt: reservations.endedAt,
  unitId: reservations.unitId,
  unitLabel: sql<string>`${units.project} || ' / ' || ${units.number}`,
  clientId: reservations.clientId,
  clientName: clients.name,
  reservedBy: reservations.reservedBy,
  repName: users.name,
  contractId: contracts.id,
};

/** A rep sees their own reservations; the manager and accountant, the company's. */
function visibleTo(ctx: TenantCtx): SQL {
  const inCompany = eq(reservations.companyId, ctx.companyId);
  return ctx.role === "sales_rep" ? (and(inCompany, eq(reservations.reservedBy, ctx.userId)) as SQL) : inCompany;
}

/** Each reservation with its unit, client, rep and (if any) contract. */
function selectReservations(tx: Tx) {
  return tx
    .select(columns)
    .from(reservations)
    .innerJoin(units, eq(units.id, reservations.unitId))
    .innerJoin(clients, eq(clients.id, reservations.clientId))
    .innerJoin(users, eq(users.id, reservations.reservedBy))
    .leftJoin(contracts, eq(contracts.reservationId, reservations.id));
}

export function listReservations(ctx: TenantCtx, query: ReservationListQuery): Promise<Page<Reservation>> {
  return withTenant(ctx, async (tx) => {
    await expireDueReservations(tx);
    const where = and(visibleTo(ctx), query.status ? eq(reservations.status, query.status) : undefined);

    const [counted] = await tx.select({ total: sql<number>`count(*)::int` }).from(reservations).where(where);
    const items = await selectReservations(tx)
      .where(where)
      .orderBy(desc(reservations.createdAt), desc(reservations.id))
      .limit(query.pageSize)
      .offset(offsetOf(query));

    return pageOf(items, counted?.total ?? 0, query);
  });
}

/** Null for an id that does not exist, is another company's, or another rep's. */
export function getReservation(ctx: TenantCtx, id: string): Promise<Reservation | null> {
  return withTenant(ctx, async (tx) => {
    await expireDueReservations(tx);
    const [reservation] = await selectReservations(tx).where(and(visibleTo(ctx), eq(reservations.id, id)));
    return reservation ?? null;
  });
}

/** The current rep's active reservation of a unit, if they hold it. */
export function activeReservationOf(ctx: TenantCtx, unitId: string): Promise<{ id: string; expiresAt: Date } | null> {
  return withTenant(ctx, async (tx) => {
    const [reservation] = await tx
      .select({ id: reservations.id, expiresAt: reservations.expiresAt })
      .from(reservations)
      .where(and(visibleTo(ctx), eq(reservations.unitId, unitId), eq(reservations.status, "active")));
    return reservation ?? null;
  });
}

const TAKEN = "الوحدة محجوزة الآن لعميل آخر. تعود متاحة تلقائيًا عند انتهاء مدة الحجز.";

/**
 * Two reps reserving one unit at the same instant: the unit's row lock puts
 * them in a line. The first finds it available and reserves it; the second
 * waits, then finds it reserved and is told so. The partial unique index on
 * active reservations is the last word if anything ever got past the lock.
 *
 * A unit still marked reserved by a reservation whose time is up is freed
 * here, under the same lock, so it never depends on the sweeper having run.
 */
export async function reserveUnit(input: ReserveUnitInput, ctx: ActionContext, tx: Tx): Promise<{ id: string }> {
  const [unit] = await tx
    .select({ status: units.status })
    .from(units)
    .where(and(eq(units.id, input.unitId), eq(units.companyId, ctx.companyId)))
    .for("update");
  if (!unit) throw new DomainError("NOT_FOUND", "الوحدة غير موجودة");

  let status = unit.status;
  if (status === "reserved" && (await expireUnitReservation(tx, input.unitId))) status = "available";

  if (status === "sold") throw new DomainError("INVALID_STATE", "الوحدة مباعة");
  if (status === "reserved") {
    // Visible only if it is this rep's own (row-level security).
    const [own] = await tx
      .select({ id: reservations.id })
      .from(reservations)
      .where(and(visibleTo(ctx), eq(reservations.unitId, input.unitId), eq(reservations.status, "active")));
    throw new DomainError("CONFLICT", own ? "لديك حجز نشط على هذه الوحدة بالفعل" : TAKEN);
  }

  const [client] = await tx
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(
        eq(clients.id, input.clientId),
        eq(clients.companyId, ctx.companyId),
        eq(clients.ownerUserId, ctx.userId),
      ),
    );
  if (!client) {
    const message = "اختر أحد عملائك";
    throw new DomainError("VALIDATION", message, { clientId: [message] });
  }

  try {
    const [created] = await tx
      .insert(reservations)
      .values({
        companyId: ctx.companyId,
        unitId: input.unitId,
        clientId: input.clientId,
        reservedBy: ctx.userId,
        // One clock for both, so the 72-hour check holds exactly.
        createdAt: sql`now()`,
        expiresAt: sql`now() + make_interval(hours => ${RESERVATION_HOURS})`,
      })
      .returning({ id: reservations.id });
    if (!created) throw new Error("reservation insert returned nothing");

    await tx.update(units).set({ status: "reserved" }).where(eq(units.id, input.unitId));
    return created;
  } catch (err) {
    if (violatedUniqueConstraint(err) === "reservations_one_active_per_unit") throw new DomainError("CONFLICT", TAKEN);
    throw err;
  }
}
