import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import type { ActionErrorCode, ActionResult, FieldErrors } from "@/lib/action-result";
import { can, type Permission } from "@/lib/permissions";
import { getCurrentSession } from "../auth/current-user";
import type { Tx } from "../db/client";
import { type TenantCtx, withTenant } from "../db/tenant";
import { logger } from "../logger";
import { getClientIp } from "../request-meta";
import { CHECK_INPUT, DomainError } from "./errors";

/** The session's identity, plus the client IP for the audit log (or null). */
export type ActionContext = TenantCtx & { sessionId: string; ip: string | null };

type ActionOptions<S extends z.ZodType> = {
  /** For logs only. */
  name: string;
  schema: S;
  permission: Permission;
};

const MESSAGES = {
  UNAUTHENTICATED: "انتهت الجلسة، سجّل الدخول مرة أخرى",
  FORBIDDEN: "ليس لديك صلاحية لتنفيذ هذا الإجراء",
  VALIDATION: CHECK_INPUT,
  INTERNAL: "حدث خطأ غير متوقع، حاول مرة أخرى",
} as const;

/**
 * Every Server Action is built with this, and it is where the server says no:
 * session → role → input schema → handler inside a tenant transaction. The
 * handler only ever sees parsed input and a context built from the session,
 * so a company id, owner id or role in the request body has nowhere to go.
 */
export function createAction<S extends z.ZodType, T>(
  options: ActionOptions<S>,
  handler: (input: z.output<S>, ctx: ActionContext, tx: Tx) => Promise<T>,
): (rawInput: unknown) => Promise<ActionResult<T>> {
  return async (rawInput) => {
    try {
      const session = await getCurrentSession();
      if (!session) return failure("UNAUTHENTICATED", MESSAGES.UNAUTHENTICATED);

      if (!can(session.role, options.permission)) {
        logger.warn(
          { action: options.name, userId: session.userId, role: session.role },
          "action refused: missing permission",
        );
        return failure("FORBIDDEN", MESSAGES.FORBIDDEN);
      }

      const parsed = options.schema.safeParse(rawInput);
      if (!parsed.success) {
        return failure("VALIDATION", MESSAGES.VALIDATION, toFieldErrors(parsed.error));
      }

      const ctx: ActionContext = {
        userId: session.userId,
        companyId: session.companyId,
        role: session.role,
        sessionId: session.sessionId,
        ip: await getClientIp(),
      };
      const data = await withTenant(ctx, (tx) => handler(parsed.data, ctx, tx));
      return { ok: true, data };
    } catch (err) {
      // redirect() and notFound() work by throwing; they are not failures.
      unstable_rethrow(err);
      if (err instanceof DomainError) return failure(err.code, err.message, err.fieldErrors);
      logger.error({ err, action: options.name }, "action failed");
      return failure("INTERNAL", MESSAGES.INTERNAL);
    }
  };
}

function failure<T>(code: ActionErrorCode, message: string, fieldErrors?: FieldErrors): ActionResult<T> {
  return { ok: false, error: fieldErrors ? { code, message, fieldErrors } : { code, message } };
}

export function toFieldErrors(error: z.ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const [field, messages] of Object.entries(z.flattenError(error).fieldErrors)) {
    if (Array.isArray(messages) && messages.length > 0) fieldErrors[field] = messages;
  }
  return fieldErrors;
}
