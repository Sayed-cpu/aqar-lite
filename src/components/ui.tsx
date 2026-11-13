import { ArrowRight, CircleAlert, CircleCheck, Inbox, Info, type LucideIcon, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatSar } from "@/lib/money";

const buttonBase =
  "inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0";

export const buttonClass = {
  primary: `${buttonBase} bg-primary-700 text-white shadow-sm hover:bg-primary-800`,
  secondary: `${buttonBase} border border-line bg-surface text-ink shadow-xs hover:border-field hover:bg-subtle`,
  ghost: `${buttonBase} text-primary-700 hover:bg-primary-50`,
} as const;

/** A text link inside a sentence or a cell. */
export const linkClass =
  "font-medium text-primary-700 underline decoration-primary-200 underline-offset-4 hover:decoration-primary-700";

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  /** Shown beside the title, e.g. a status badge. */
  badge?: ReactNode;
};

export function PageHeader({ title, description, actions, back, badge }: PageHeaderProps) {
  return (
    <div className="space-y-3">
      {back ? (
        <Link
          href={back.href}
          className="inline-flex items-center gap-1.5 rounded text-sm text-ink-muted transition-colors hover:text-primary-700"
        >
          <ArrowRight className="size-4" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-2xl font-bold text-ink">{title}</h1>
            {badge}
          </div>
          {description ? <p className="text-sm text-ink-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

/** A white panel; with a title it is a labelled section. */
export function Card({
  title,
  icon: Icon,
  actions,
  children,
  className = "",
}: {
  title?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const body = <div className="p-5">{children}</div>;
  if (!title) {
    return <div className={`rounded-xl border border-line bg-surface shadow-xs ${className}`}>{body}</div>;
  }
  return (
    <section className={`rounded-xl border border-line bg-surface shadow-xs ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <h2 className="flex items-center gap-2 font-bold text-ink">
          {Icon ? <Icon className="size-5 text-primary-600" /> : null}
          {title}
        </h2>
        {actions}
      </div>
      {body}
    </section>
  );
}

type EmptyStateProps = {
  title: string;
  icon?: LucideIcon;
  children?: ReactNode;
  /** The next step, when the viewer's role can take it. */
  action?: ReactNode;
};

export function EmptyState({ title, icon: Icon = Inbox, children, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line bg-surface px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-primary-50 text-primary-700">
        <Icon className="size-6" />
      </span>
      <p className="mt-4 font-bold text-ink">{title}</p>
      {children ? <div className="mt-1 max-w-md text-sm text-ink-muted">{children}</div> : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

const skeletonBar = "rounded bg-line/70";

/**
 * The loading state of a list: a table's shape on wide screens, a stack of
 * cards on narrow ones — the same layout the rows arrive in.
 */
export function TableSkeleton({ rows = 6, label = "جارٍ تحميل القائمة…" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="animate-pulse space-y-3">
        <div className={`h-4 w-24 ${skeletonBar}`} />
        <div className="hidden overflow-hidden rounded-xl border border-line bg-surface md:block">
          <div className="grid grid-cols-5 gap-6 border-b border-line bg-subtle px-4 py-3.5">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className={`h-3 w-1/2 ${skeletonBar}`} />
            ))}
          </div>
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="grid grid-cols-5 gap-6 border-b border-line px-4 py-4 last:border-b-0">
              <div className="space-y-2">
                <div className={`h-3.5 w-3/4 ${skeletonBar}`} />
                <div className={`h-2.5 w-1/2 ${skeletonBar}`} />
              </div>
              <div className={`h-3.5 w-2/3 ${skeletonBar}`} />
              <div className={`h-3.5 w-1/2 ${skeletonBar}`} />
              <div className={`h-3.5 w-3/4 ${skeletonBar}`} />
              <div className={`h-5 w-16 rounded-full ${skeletonBar}`} />
            </div>
          ))}
        </div>
        <div className="space-y-3 md:hidden">
          {Array.from({ length: Math.min(rows, 3) }, (_, i) => (
            <div key={i} className="space-y-3 rounded-xl border border-line bg-surface p-4">
              <div className={`h-4 w-1/2 ${skeletonBar}`} />
              <div className={`h-3 w-full ${skeletonBar}`} />
              <div className={`h-3 w-5/6 ${skeletonBar}`} />
              <div className={`h-3 w-2/3 ${skeletonBar}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const NOTICE_TONES = {
  success: { box: "border-success-line bg-success-soft text-success", icon: CircleCheck },
  warning: { box: "border-warning-line bg-warning-soft text-warning", icon: TriangleAlert },
  danger: { box: "border-danger-line bg-danger-soft text-danger", icon: CircleAlert },
  info: { box: "border-info-line bg-info-soft text-info", icon: Info },
} as const;

/** A one-line message with an icon. `role` decides whether it interrupts. */
export function Notice({
  tone,
  children,
  role,
}: {
  tone: keyof typeof NOTICE_TONES;
  children: ReactNode;
  role?: "status" | "alert";
}) {
  const { box, icon: Icon } = NOTICE_TONES[tone];
  return (
    <div role={role} className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm ${box}`}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function SuccessNotice({ children }: { children: ReactNode }) {
  return (
    <Notice tone="success" role="status">
      {children}
    </Notice>
  );
}

/** A label/value pair on a detail page. */
export function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-ink-subtle">{label}</dt>
      <dd className="mt-1 font-medium text-ink">{children}</dd>
    </div>
  );
}

/** An amount in riyals, digits aligned; `large` sets the currency smaller than the number. */
export function Money({ amount, large = false, className = "" }: { amount: bigint; large?: boolean; className?: string }) {
  const text = formatSar(amount);
  const suffix = " ر.س";
  if (!large || !text.endsWith(suffix)) {
    return <span className={`whitespace-nowrap tabular-nums ${className}`}>{text}</span>;
  }
  return (
    <span className={`whitespace-nowrap tabular-nums ${className}`}>
      {text.slice(0, -suffix.length)}
      <span className="ms-1 text-[0.6em] font-medium opacity-80">{suffix.trim()}</span>
    </span>
  );
}

const STAT_TONES = {
  primary: "bg-primary-50 text-primary-700",
  accent: "bg-accent-50 text-accent-700",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-neutral-soft text-neutral",
} as const;

/** One figure in a summary row. Place inside a <dl>. */
export function StatCard({
  label,
  icon: Icon,
  tone = "primary",
  children,
  footer,
  emphasis = false,
}: {
  label: string;
  icon: LucideIcon;
  tone?: keyof typeof STAT_TONES;
  children: ReactNode;
  footer?: ReactNode;
  /** A red edge, for a figure that needs action. */
  emphasis?: boolean;
}) {
  return (
    <div
      className={`flex flex-col rounded-xl border bg-surface p-5 shadow-xs ${emphasis ? "border-danger-line ring-1 ring-danger-line" : "border-line"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <dt className="text-sm font-medium text-ink-muted">{label}</dt>
        <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${STAT_TONES[tone]}`}>
          <Icon className="size-5" />
        </span>
      </div>
      <dd className="mt-2 text-2xl font-bold text-ink">{children}</dd>
      {footer ? <dd className="mt-auto pt-3 text-xs text-ink-subtle">{footer}</dd> : null}
    </div>
  );
}

/**
 * How far along something is, 0–1. Drawn with SVG attributes rather than an
 * inline width, which the CSP would refuse; filled from the right, the way
 * the page reads.
 */
export function ProgressBar({ value, label, className = "fill-primary-600" }: { value: number; label: string; className?: string }) {
  const fraction = Math.min(1, Math.max(0, value));
  const percent = Math.round(fraction * 100);
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <svg viewBox="0 0 100 2" preserveAspectRatio="none" className="h-2 w-full overflow-hidden rounded-full" aria-hidden="true">
        <rect width="100" height="2" className="fill-neutral-soft" />
        <rect x={100 - fraction * 100} width={fraction * 100} height="2" className={className} />
      </svg>
    </div>
  );
}

/** Status filters as links: each one a URL, the current one marked for assistive tech too. */
export function FilterTabs({ label, tabs }: { label: string; tabs: { href: string; label: string; current: boolean }[] }) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              aria-current={tab.current ? "page" : undefined}
              className="inline-flex min-h-9 items-center rounded-full border border-line bg-surface px-4 text-sm font-medium text-ink-muted transition-colors hover:border-field hover:text-ink aria-[current=page]:border-primary-700 aria-[current=page]:bg-primary-700 aria-[current=page]:text-white"
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** "12 وحدة" above a list. */
export function ResultCount({ children }: { children: ReactNode }) {
  return <p className="text-sm text-ink-subtle tabular-nums">{children}</p>;
}
