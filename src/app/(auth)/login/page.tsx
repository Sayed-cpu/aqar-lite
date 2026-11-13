import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { getCurrentSession } from "@/server/auth/current-user";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "تسجيل الدخول — عقار لايت" };

export default async function LoginPage() {
  if (await getCurrentSession()) redirect("/");

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-10">
      {/* Two rooflines behind the card: the logo's shape, very quiet. */}
      <svg viewBox="0 0 400 200" aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-72 w-full max-w-4xl">
        <path d="M20 190 200 40l180 150" fill="none" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" className="stroke-accent-100" />
        <path d="M90 190 200 98l110 92" fill="none" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" className="stroke-primary-50" />
      </svg>

      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo subtitle="بيع الوحدات العقارية بالتقسيط" />
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-bold text-ink">تسجيل الدخول</h1>
          <p className="mt-1 mb-6 text-sm text-ink-muted">ادخل ببريد العمل وكلمة المرور.</p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
