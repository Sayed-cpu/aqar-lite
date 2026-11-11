import Link from "next/link";
import { can } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/roles";
import { requireUser } from "@/server/auth/current-user";

export default async function HomePage() {
  const user = await requireUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">مرحبًا، {user.name}</h1>
        <p className="mt-1 text-slate-500">
          {ROLE_LABELS[user.role]} في {user.companyName}
        </p>
      </div>

      {can(user.role, "audit:read") ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/audit"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300"
          >
            <div className="font-semibold text-slate-900">سجل التدقيق</div>
            <p className="mt-1 text-sm text-slate-500">محاولات الدخول وتغييرات الأسعار والاعتمادات والدفعات</p>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
