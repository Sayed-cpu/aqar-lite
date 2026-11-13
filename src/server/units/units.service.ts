import "server-only";
import { and, asc, desc, eq, gte, lte, type SQL, sql } from "drizzle-orm";
import { toSarString } from "@/lib/money";
import type { UnitInput, UnitListQuery, UnitUpdate } from "@/lib/schemas/units";
import type { UnitSort, UnitStatus, UnitType } from "@/lib/units";
import { DomainError } from "../actions/errors";
import type { ActionContext } from "../actions/create-action";
import { appendAudit } from "../audit/audit.service";
import type { Tx } from "../db/client";
import { violatedUniqueConstraint } from "../db/errors";
import { offsetOf, type Page, pageOf } from "../db/page";
import { units } from "../db/schema";
import { type TenantCtx, withTenant } from "../db/tenant";
import { expireDueReservations } from "../reservations/expiry";

export type Unit = {
  id: string;
  project: string;
  number: string;
  type: UnitType;
  areaSqm: string;
  rooms: number;
  priceHalalas: bigint;
  status: UnitStatus;
  updatedAt: Date;
};

const columns = {
  id: units.id,
  project: units.project,
  number: units.number,
  type: units.type,
  areaSqm: units.areaSqm,
  rooms: units.rooms,
  priceHalalas: units.priceHalalas,
  status: units.status,
  updatedAt: units.updatedAt,
};

// Every order ends on the id, so a page boundary never shows or hides a row
// twice when two units share a price or an area.
const ORDER: Record<UnitSort, SQL[]> = {
  newest: [desc(units.createdAt), desc(units.id)],
  price_asc: [asc(units.priceHalalas), asc(units.id)],
  price_desc: [desc(units.priceHalalas), asc(units.id)],
  area_asc: [asc(units.areaSqm), asc(units.id)],
  area_desc: [desc(units.areaSqm), asc(units.id)],
};

const DUPLICATE_NUMBER = "يوجد وحدة بهذا الرقم في المشروع نفسه";

/**
 * Every role reads every unit of its own company. Filtering happens in SQL.
 * Reservations whose time is up are ended first, so "available" is true now.
 */
export function listUnits(ctx: TenantCtx, query: UnitListQuery): Promise<Page<Unit>> {
  return withTenant(ctx, async (tx) => {
    await expireDueReservations(tx);
    const where = and(
      eq(units.companyId, ctx.companyId),
      query.status ? eq(units.status, query.status) : undefined,
      query.minPrice !== undefined ? gte(units.priceHalalas, query.minPrice) : undefined,
      query.maxPrice !== undefined ? lte(units.priceHalalas, query.maxPrice) : undefined,
    );

    const [counted] = await tx.select({ total: sql<number>`count(*)::int` }).from(units).where(where);
    const items = await tx
      .select(columns)
      .from(units)
      .where(where)
      .orderBy(...ORDER[query.sort])
      .limit(query.pageSize)
      .offset(offsetOf(query));

    return pageOf(items, counted?.total ?? 0, query);
  });
}

/** Null for an id that does not exist or belongs to another company. */
export function getUnit(ctx: TenantCtx, id: string): Promise<Unit | null> {
  return withTenant(ctx, async (tx) => {
    await expireDueReservations(tx);
    const [unit] = await tx
      .select(columns)
      .from(units)
      .where(and(eq(units.id, id), eq(units.companyId, ctx.companyId)));
    return unit ?? null;
  });
}

export async function createUnit(input: UnitInput, ctx: ActionContext, tx: Tx): Promise<{ id: string }> {
  try {
    const [created] = await tx
      .insert(units)
      .values({
        companyId: ctx.companyId,
        project: input.project,
        number: input.number,
        type: input.type,
        areaSqm: input.areaSqm,
        rooms: input.rooms,
        priceHalalas: input.price,
      })
      .returning({ id: units.id });
    if (!created) throw new Error("unit insert returned nothing");
    return created;
  } catch (err) {
    if (violatedUniqueConstraint(err) === "units_company_project_number_key") {
      throw new DomainError("CONFLICT", DUPLICATE_NUMBER, { number: [DUPLICATE_NUMBER] });
    }
    throw err;
  }
}

/**
 * The row is locked first, so a reservation cannot slip in between reading
 * the status and writing the price. A price change is refused unless the unit
 * is available, and recorded in the audit log in the same transaction.
 */
export async function updateUnit(input: UnitUpdate, ctx: ActionContext, tx: Tx): Promise<{ id: string }> {
  const [current] = await tx
    .select({ status: units.status, priceHalalas: units.priceHalalas })
    .from(units)
    .where(and(eq(units.id, input.id), eq(units.companyId, ctx.companyId)))
    .for("update");
  if (!current) throw new DomainError("NOT_FOUND", "الوحدة غير موجودة");

  const priceChanged = current.priceHalalas !== input.price;
  if (priceChanged && current.status !== "available") {
    const message = "لا يمكن تعديل سعر وحدة محجوزة أو مباعة";
    throw new DomainError("INVALID_STATE", message, { price: [message] });
  }

  try {
    await tx
      .update(units)
      .set({
        project: input.project,
        number: input.number,
        type: input.type,
        areaSqm: input.areaSqm,
        rooms: input.rooms,
        priceHalalas: input.price,
      })
      .where(and(eq(units.id, input.id), eq(units.companyId, ctx.companyId)));
  } catch (err) {
    if (violatedUniqueConstraint(err) === "units_company_project_number_key") {
      throw new DomainError("CONFLICT", DUPLICATE_NUMBER, { number: [DUPLICATE_NUMBER] });
    }
    throw err;
  }

  if (priceChanged) {
    await appendAudit(tx, {
      companyId: ctx.companyId,
      actorUserId: ctx.userId,
      action: "unit.price_changed",
      entityType: "unit",
      entityId: input.id,
      metadata: {
        unit: `${input.project} / ${input.number}`,
        oldPrice: toSarString(current.priceHalalas),
        newPrice: toSarString(input.price),
      },
      ip: ctx.ip,
    });
  }

  return { id: input.id };
}
