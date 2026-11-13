import "server-only";
import { and, desc, eq, ilike, or, type SQL, sql } from "drizzle-orm";
import { toLatinDigits } from "@/lib/money";
import type { ClientInput, ClientListQuery, ClientUpdate } from "@/lib/schemas/clients";
import { DomainError } from "../actions/errors";
import type { ActionContext } from "../actions/create-action";
import type { Tx } from "../db/client";
import { violatedUniqueConstraint } from "../db/errors";
import { offsetOf, type Page, pageOf } from "../db/page";
import { clients, users } from "../db/schema";
import { type TenantCtx, withTenant } from "../db/tenant";

export type Client = {
  id: string;
  name: string;
  phone: string;
  notes: string;
  ownerUserId: string;
  ownerName: string;
  createdAt: Date;
  updatedAt: Date;
};

const columns = {
  id: clients.id,
  name: clients.name,
  phone: clients.phone,
  notes: clients.notes,
  ownerUserId: clients.ownerUserId,
  ownerName: users.name,
  createdAt: clients.createdAt,
  updatedAt: clients.updatedAt,
};

const DUPLICATE_PHONE = "لديك عميل مسجّل بهذا الرقم";
const NOT_FOUND = "العميل غير موجود";

/**
 * Which clients this user may see: their company's, and for a sales rep only
 * the ones they own. The clients policy in the database draws the same line.
 */
function visibleTo(ctx: TenantCtx): SQL {
  const inCompany = eq(clients.companyId, ctx.companyId);
  return ctx.role === "sales_rep" ? (and(inCompany, eq(clients.ownerUserId, ctx.userId)) as SQL) : inCompany;
}

/** For ILIKE: the user's text is matched literally, wildcards included. */
function containing(term: string): string {
  return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export function listClients(ctx: TenantCtx, query: ClientListQuery): Promise<Page<Client>> {
  return withTenant(ctx, async (tx) => {
    const where = and(
      visibleTo(ctx),
      query.q
        ? or(ilike(clients.name, containing(query.q)), ilike(clients.phone, containing(toLatinDigits(query.q))))
        : undefined,
    );

    const [counted] = await tx.select({ total: sql<number>`count(*)::int` }).from(clients).where(where);
    const items = await tx
      .select(columns)
      .from(clients)
      .innerJoin(users, eq(users.id, clients.ownerUserId))
      .where(where)
      .orderBy(desc(clients.createdAt), desc(clients.id))
      .limit(query.pageSize)
      .offset(offsetOf(query));

    return pageOf(items, counted?.total ?? 0, query);
  });
}

/** Null when the client does not exist or is not this user's to see. */
export function getClient(ctx: TenantCtx, id: string): Promise<Client | null> {
  return withTenant(ctx, async (tx) => {
    const [client] = await tx
      .select(columns)
      .from(clients)
      .innerJoin(users, eq(users.id, clients.ownerUserId))
      .where(and(eq(clients.id, id), visibleTo(ctx)));
    return client ?? null;
  });
}

/** The owner is the signed-in rep; the input has no field that could say otherwise. */
export async function createClient(input: ClientInput, ctx: ActionContext, tx: Tx): Promise<{ id: string }> {
  try {
    const [created] = await tx
      .insert(clients)
      .values({ companyId: ctx.companyId, ownerUserId: ctx.userId, ...input })
      .returning({ id: clients.id });
    if (!created) throw new Error("client insert returned nothing");
    return created;
  } catch (err) {
    throw duplicatePhoneOr(err);
  }
}

/**
 * Only the owning rep may edit. Another rep's client id gets NOT_FOUND, the
 * same answer as an id that does not exist.
 */
export async function updateClient(input: ClientUpdate, ctx: ActionContext, tx: Tx): Promise<{ id: string }> {
  let updated: { id: string } | undefined;
  try {
    [updated] = await tx
      .update(clients)
      .set({ name: input.name, phone: input.phone, notes: input.notes })
      .where(
        and(eq(clients.id, input.id), eq(clients.companyId, ctx.companyId), eq(clients.ownerUserId, ctx.userId)),
      )
      .returning({ id: clients.id });
  } catch (err) {
    throw duplicatePhoneOr(err);
  }
  if (!updated) throw new DomainError("NOT_FOUND", NOT_FOUND);
  return updated;
}

function duplicatePhoneOr(err: unknown): unknown {
  return violatedUniqueConstraint(err) === "clients_owner_phone_key"
    ? new DomainError("CONFLICT", DUPLICATE_PHONE, { phone: [DUPLICATE_PHONE] })
    : err;
}
