import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import type { AuditAction } from "@/lib/audit-actions";
import type { AuditListQuery } from "@/lib/schemas/audit";
import type { Tx } from "../db/client";
import { type AuditMetadata, auditLogs, users } from "../db/schema";
import { type TenantCtx, withTenant } from "../db/tenant";

export type AuditEntry = {
  companyId: string | null;
  actorUserId: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  metadata?: AuditMetadata;
  ip?: string | null;
};

/**
 * Written inside the caller's transaction, so the audit row commits or rolls
 * back with the change it describes.
 */
export async function appendAudit(tx: Tx, entry: AuditEntry): Promise<void> {
  await tx.insert(auditLogs).values({
    companyId: entry.companyId,
    actorUserId: entry.actorUserId,
    action: entry.action,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
    metadata: entry.metadata ?? {},
    ip: entry.ip ?? null,
  });
}

export type AuditLogItem = {
  id: string;
  action: AuditAction;
  actorName: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: AuditMetadata;
  ip: string | null;
  createdAt: Date;
};

export type AuditLogPage = {
  items: AuditLogItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

/**
 * The company comes from ctx and nowhere else — there is no parameter for it.
 * The explicit filter and the row-level security policy both apply.
 */
export function listAuditLogs(ctx: TenantCtx, query: AuditListQuery): Promise<AuditLogPage> {
  return withTenant(ctx, async (tx) => {
    const inCompany = eq(auditLogs.companyId, ctx.companyId);

    const [counted] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(inCompany);
    const total = counted?.total ?? 0;

    const items = await tx
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        actorName: users.name,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        metadata: auditLogs.metadata,
        ip: auditLogs.ip,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .where(inCompany)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  });
}
