import Link from "next/link";
import type { ReactNode } from "react";

export const buttonClass = {
  primary:
    "inline-flex items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50",
} as const;

type PageHeaderProps = { title: string; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } };

export function PageHeader({ title, description, actions, back }: PageHeaderProps) {
  return (
    <div className="space-y-2">
      {back ? (
        <Link href={back.href} className="text-sm text-slate-500 hover:text-slate-800">
          → {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <p className="font-medium text-slate-700">{title}</p>
      {children ? <div className="mt-2 text-sm text-slate-500">{children}</div> : null}
    </div>
  );
}

/** The loading state of a table: its shape, before its rows arrive. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="rounded-xl border border-slate-200 bg-white p-4">
      <span className="sr-only">جارٍ التحميل…</span>
      <div className="animate-pulse space-y-3" aria-hidden>
        <div className="h-4 w-1/3 rounded bg-slate-200" />
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-8 rounded bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

export function SuccessNotice({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
      {children}
    </div>
  );
}

/** A label/value pair on a detail page. */
export function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-900">{children}</dd>
    </div>
  );
}
