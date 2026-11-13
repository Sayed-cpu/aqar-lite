"use client";

import {
  Building,
  FileText,
  House,
  type LucideIcon,
  Menu,
  ScrollText,
  Timer,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { RoleBadge } from "@/components/badges";
import { Logo } from "@/components/logo";
import type { Role } from "@/lib/roles";

const ICONS = {
  home: House,
  units: Building,
  clients: Users,
  reservations: Timer,
  contracts: FileText,
  audit: ScrollText,
} satisfies Record<string, LucideIcon>;

export type NavLink = { href: string; label: string; icon: keyof typeof ICONS };

type AppNavProps = {
  links: readonly NavLink[];
  user: { name: string; companyName: string; role: Role };
  /** The sign-out form, rendered by the server. */
  children: ReactNode;
};

function isCurrent(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * One navigation, two layouts: a fixed sidebar from `lg` up, and below that a
 * top bar whose menu button drops the same panel down. It is rendered once,
 * so every link and the sign-out button exist once in the page.
 */
export function AppNav({ links, user, children }: AppNavProps) {
  const pathname = usePathname();
  // Open for the page it was opened on: navigating anywhere closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenOn(null);
      toggleRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="on-dark sticky top-0 z-40 bg-primary-900 text-primary-100 shadow-md lg:flex lg:h-dvh lg:w-68 lg:shrink-0 lg:flex-col lg:shadow-none">
      {/* Below lg: the bar with the menu button. */}
      <div className="flex h-16 items-center justify-between gap-3 px-4 lg:hidden">
        <Link href="/" className="rounded-lg">
          <Logo tone="dark" />
        </Link>
        <div className="flex items-center gap-2">
          {open ? null : <RoleBadge role={user.role} />}
          <button
            ref={toggleRef}
            type="button"
            aria-expanded={open}
            aria-controls="app-nav-panel"
            aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
            onClick={() => setOpenOn(open ? null : pathname)}
            className="grid size-10 place-items-center rounded-lg text-white transition-colors hover:bg-primary-800"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <div
        id="app-nav-panel"
        className={`${open ? "flex" : "hidden"} max-h-[calc(100dvh-4rem)] flex-col overflow-y-auto border-t border-primary-800 pb-4 lg:flex lg:max-h-none lg:flex-1 lg:border-t-0`}
      >
        <div className="hidden px-5 pt-6 pb-5 lg:block">
          <Link href="/" className="inline-flex rounded-lg">
            <Logo tone="dark" subtitle="بيع الوحدات بالتقسيط" />
          </Link>
        </div>

        <div className="mx-3 mt-3 rounded-xl border border-primary-800 bg-primary-950/40 p-3.5 lg:mt-0">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-300 text-base font-bold text-primary-900"
            >
              {user.name.trim().charAt(0)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-bold text-white">{user.name}</p>
              <p className="flex items-center gap-1 truncate text-xs text-primary-200">
                <Building className="size-3.5 shrink-0" />
                {user.companyName}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <RoleBadge role={user.role} />
          </div>
        </div>

        <nav aria-label="القائمة الرئيسية" className="mt-5 px-3">
          <ul className="space-y-1">
            {links.map((link) => {
              const Icon = ICONS[link.icon];
              const current = isCurrent(pathname, link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={current ? "page" : undefined}
                    className="group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-primary-100 transition-colors before:absolute before:inset-y-2 before:start-0 before:w-1 before:rounded-full before:bg-accent-300 before:opacity-0 hover:bg-primary-800 hover:text-white aria-[current=page]:bg-primary-800 aria-[current=page]:text-white aria-[current=page]:before:opacity-100"
                  >
                    <Icon className="size-5 shrink-0 text-primary-300 group-hover:text-primary-100 group-aria-[current=page]:text-accent-300" />
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-6 border-t border-primary-800 px-3 pt-4 lg:mt-auto">{children}</div>
      </div>
    </div>
  );
}
