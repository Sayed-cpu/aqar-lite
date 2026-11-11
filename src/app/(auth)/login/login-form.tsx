"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { FormField } from "@/components/form-field";
import type { LoginFormState } from "@/lib/schemas/auth";

const initialState: LoginFormState = { email: "" };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} noValidate className="space-y-4">
      {state.message ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.message}
        </div>
      ) : null}

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

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "جارٍ الدخول…" : "تسجيل الدخول"}
      </button>
    </form>
  );
}
