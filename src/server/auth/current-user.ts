import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { can, type Permission } from "@/lib/permissions";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from "@/lib/session-cookie";
import { type SessionUser, validateSessionToken } from "./session";

/** Resolved once per request, however many components ask. */
export const getCurrentSession = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return validateSessionToken(token);
});

/** For pages and layouts. Server Actions go through createAction instead. */
export async function requireUser(): Promise<SessionUser> {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * A page the role may not use is answered with a 404, not a 403: it does not
 * confirm to anyone that the page exists.
 */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const session = await requireUser();
  if (!can(session.role, permission)) notFound();
  return session;
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE_NAME, token, { ...SESSION_COOKIE_OPTIONS, expires: expiresAt });
}

export async function deleteSessionCookie(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE_NAME, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
}
