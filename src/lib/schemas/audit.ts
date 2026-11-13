import { z } from "zod";

export const AUDIT_MAX_PAGE_SIZE = 50;

/**
 * URL query for the audit log. Not strict: a URL may carry unrelated params
 * (and a smuggled companyId) — unknown keys are dropped, never passed on.
 * A value that does not parse falls back to the default rather than erroring.
 */
export const auditListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).catch(1),
  pageSize: z.coerce.number().int().min(1).max(AUDIT_MAX_PAGE_SIZE).catch(20),
});

export type AuditListQuery = z.infer<typeof auditListQuerySchema>;
