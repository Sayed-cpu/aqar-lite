import { z } from "zod";

export const loginInputSchema = z.strictObject({
  email: z
    .string({ error: "أدخل البريد الإلكتروني" })
    .trim()
    .toLowerCase()
    .min(1, { error: "أدخل البريد الإلكتروني" })
    .max(254, { error: "البريد الإلكتروني طويل جدًا" })
    .pipe(z.email({ error: "صيغة البريد الإلكتروني غير صحيحة" })),
  // Capped so an oversized body cannot be turned into expensive Argon2 work.
  password: z
    .string({ error: "أدخل كلمة المرور" })
    .min(1, { error: "أدخل كلمة المرور" })
    .max(128, { error: "كلمة المرور طويلة جدًا" }),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

/** What the login form gets back. The password is never echoed. */
export type LoginFormState = {
  email: string;
  message?: string;
  fieldErrors?: Partial<Record<keyof LoginInput, string[]>>;
};
