import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { AppNav, type NavLink } from "@/components/app-nav";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth/current-user";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Checked here for the shell, and again by every page and action: a layout
  // does not re-run on client navigation, so it cannot be the only guard.
  const user = await requireUser();
  const isRep = user.role === "sales_rep";

  // Which links show is a convenience; the pages enforce who may open them.
  const links: NavLink[] = [
    { href: "/", label: "الرئيسية", icon: "home" },
    { href: "/units", label: "الوحدات", icon: "units" },
    { href: "/clients", label: isRep ? "عملائي" : "العملاء", icon: "clients" },
    { href: "/reservations", label: isRep ? "حجوزاتي" : "الحجوزات", icon: "reservations" },
    { href: "/contracts", label: isRep ? "عقودي" : "العقود", icon: "contracts" },
    ...(can(user.role, "audit:read") ? [{ href: "/audit", label: "سجل التدقيق", icon: "audit" } as const] : []),
  ];

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:font-medium focus:text-primary-800 focus:shadow-lg"
      >
        تخطَّ إلى المحتوى
      </a>

      <AppNav links={links} user={{ name: user.name, companyName: user.companyName, role: user.role }}>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-primary-100 transition-colors hover:bg-primary-800 hover:text-white"
          >
            <LogOut className="size-5 shrink-0 -scale-x-100 text-primary-300" />
            تسجيل الخروج
          </button>
        </form>
      </AppNav>

      <main id="main" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
