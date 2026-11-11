import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/server/auth/current-user";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "تسجيل الدخول — عقار لايت" };

export default async function LoginPage() {
  if (await getCurrentSession()) redirect("/");

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">عقار لايت</h1>
        <p className="mt-1 mb-6 text-sm text-slate-500">سجّل الدخول للمتابعة</p>
        <LoginForm />
      </div>
    </main>
  );
}
