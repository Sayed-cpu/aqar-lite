import { z } from "zod";
import { paginationFields } from "./fields";

export const AUDIT_MAX_PAGE_SIZE = 50;

/**
 * URL query for the audit log. Not strict: a URL may carry unrelated params
 * (and a smuggled companyId) — unknown keys are dropped, never passed on.
 * A value that does not parse falls back to the default rather than erroring.
 */
export const auditListQuerySchema = z.object(paginationFields(AUDIT_MAX_PAGE_SIZE));

export type AuditListQuery = z.infer<typeof auditListQuerySchema>;
