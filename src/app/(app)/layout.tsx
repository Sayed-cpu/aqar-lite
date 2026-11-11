import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { can } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/roles";
import { requireUser } from "@/server/auth/current-user";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Checked here for the shell, and again by every page and action: a layout
  // does not re-run on client navigation, so it cannot be the only guard.
  const user = await requireUser();

  const links = [
    { href: "/", label: "الرئيسية", visible: true },
    { href: "/units", label: "الوحدات", visible: true },
    { href: "/clients", label: user.role === "sales_rep" ? "عملائي" : "العملاء", visible: true },
    { href: "/audit", label: "سجل التدقيق", visible: can(user.role, "audit:read") },
  ] as const;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/" className="text-lg font-bold text-emerald-800">
              عقار لايت
            </Link>
            <nav aria-label="القائمة الرئيسية" className="flex flex-wrap gap-4 text-sm">
              {links
                .filter((link) => link.visible)
                .map((link) => (
                  <Link key={link.href} href={link.href} className="text-slate-600 hover:text-slate-900">
                    {link.label}
                  </Link>
                ))}
            </nav>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <div className="leading-tight">
              <div className="font-medium text-slate-900">{user.name}</div>
              <div className="text-xs text-slate-500">
                {user.companyName} · {ROLE_LABELS[user.role]}
              </div>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 transition hover:bg-slate-100"
              >
                تسجيل الخروج
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
