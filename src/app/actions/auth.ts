"use server";

import { redirect } from "next/navigation";
import { type LoginFormState, loginInputSchema } from "@/lib/schemas/auth";
import { toFieldErrors } from "@/server/actions/create-action";
import { login, logout } from "@/server/auth/auth.service";
import { deleteSessionCookie, getCurrentSession, setSessionCookie } from "@/server/auth/current-user";
import { logger } from "@/server/logger";
import { getClientIp } from "@/server/request-meta";

const INVALID_CREDENTIALS = "البريد الإلكتروني أو كلمة المرور غير صحيحة";
// The same for every email, existing or not, so it reveals nothing either.
const LOCKED = "محاولات كثيرة غير ناجحة. حاول مرة أخرى بعد 15 دقيقة";
const UNEXPECTED = "تعذّر تسجيل الدخول الآن، حاول مرة أخرى";

export async function loginAction(_prev: LoginFormState, formData: FormData): Promise<LoginFormState> {
  // Only these two fields are read; anything else in the form is ignored.
  const raw = { email: formData.get("email"), password: formData.get("password") };
  const email = typeof raw.email === "string" ? raw.email : "";

  const parsed = loginInputSchema.safeParse(raw);
  if (!parsed.success) return { email, fieldErrors: toFieldErrors(parsed.error) };

  let result: Awaited<ReturnType<typeof login>>;
  try {
    result = await login(parsed.data, { ip: await getClientIp() });
  } catch (err) {
    logger.error({ err }, "login failed unexpectedly");
    return { email, message: UNEXPECTED };
  }

  if (!result.ok) {
    return { email, message: result.reason === "locked" ? LOCKED : INVALID_CREDENTIALS };
  }

  await setSessionCookie(result.token, result.expiresAt);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const session = await getCurrentSession();
  // Not wrapped: if the session row cannot be deleted, the user must not be
  // told they are logged out while their token still works.
  if (session) await logout(session, { ip: await getClientIp() });
  await deleteSessionCookie();
  redirect("/login");
}
