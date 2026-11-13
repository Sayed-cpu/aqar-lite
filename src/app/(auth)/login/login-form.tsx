"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { LogIn } from "lucide-react";
import { FormField, FormMessage, SubmitButton } from "@/components/form-field";
import { buttonClass } from "@/components/ui";
import type { LoginFormState } from "@/lib/schemas/auth";

const initialState: LoginFormState = { email: "" };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} noValidate className="space-y-4">
      <FormMessage message={state.message} />

      <FormField
        label="البريد الإلكتروني"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        dir="ltr"
        required
        defaultValue={state.email}
        errors={state.fieldErrors?.email}
      />
      <FormField
        label="كلمة المرور"
        name="password"
        type="password"
        autoComplete="current-password"
        dir="ltr"
        required
        errors={state.fieldErrors?.password}
      />

      <SubmitButton
        pending={isPending}
        pendingLabel="جارٍ الدخول…"
        icon={<LogIn className="-scale-x-100" />}
        className={`${buttonClass.primary} w-full py-2.5`}
      >
        تسجيل الدخول
      </SubmitButton>
    </form>
  );
}
