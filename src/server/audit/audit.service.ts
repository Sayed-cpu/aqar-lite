import "server-only";
import type { AuditAction } from "@/lib/audit-actions";
import type { Tx } from "../db/client";
import { type AuditMetadata, auditLogs } from "../db/schema";

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
