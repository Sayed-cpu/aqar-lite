import type { ReactNode } from "react";

/*
 * One table, two layouts. From `md` up it is an ordinary table in a panel
 * that scrolls sideways if it must (focusable, so a keyboard can scroll it).
 * Below `md` each row becomes a card: the header row is visually hidden but
 * stays for screen readers, and each cell shows its column name beside its
 * value. Nothing is rendered twice.
 */

export function DataTable({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="rounded-xl md:overflow-x-auto md:border md:border-line md:bg-surface md:shadow-xs"
    >
      <table className={`w-full text-start text-sm max-md:block ${className}`}>{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-line bg-subtle text-ink-muted max-md:sr-only">
      <tr>{children}</tr>
    </thead>
  );
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th scope="col" className={`px-4 py-3 text-start text-xs font-medium whitespace-nowrap ${className}`}>
      {children}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="max-md:block max-md:space-y-3">{children}</tbody>;
}

const ROW_TONES = {
  default: "max-md:border-line max-md:bg-surface md:hover:bg-subtle",
  // A row that needs attention: tinted as a table row and as a card alike.
  danger: "bg-danger-soft/50 max-md:border-danger-line md:hover:bg-danger-soft",
} as const;

export function Tr({
  children,
  tone = "default",
  className = "",
}: {
  children: ReactNode;
  tone?: keyof typeof ROW_TONES;
  className?: string;
}) {
  return (
    <tr
      className={`max-md:block max-md:rounded-xl max-md:border max-md:p-4 max-md:shadow-xs md:border-b md:border-line md:transition-colors md:last:border-b-0 ${ROW_TONES[tone]} ${className}`}
    >
      {children}
    </tr>
  );
}

type TdProps = {
  /** The column's name, shown beside the value on a card. */
  label?: string;
  /** The row's title: the top of its card, with no label. */
  primary?: boolean;
  children: ReactNode;
  className?: string;
};

export function Td({ label, primary = false, children, className = "" }: TdProps) {
  if (primary) {
    return (
      <td className={`px-4 py-3 align-middle max-md:mb-1.5 max-md:block max-md:border-b max-md:border-line max-md:px-0 max-md:pt-0 max-md:pb-3 ${className}`}>
        {children}
      </td>
    );
  }
  return (
    <td
      className={`px-4 py-3 align-middle max-md:flex max-md:items-center max-md:justify-between max-md:gap-4 max-md:px-0 max-md:py-1.5 ${className}`}
    >
      {label ? (
        <span aria-hidden="true" className="text-xs text-ink-subtle md:hidden">
          {label}
        </span>
      ) : null}
      <div className="min-w-0 max-md:text-end">{children}</div>
    </td>
  );
}
