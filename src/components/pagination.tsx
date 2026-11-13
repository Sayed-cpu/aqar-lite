import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { buttonClass } from "@/components/ui";

type PaginationProps = {
  page: number;
  pageCount: number;
  /** Builds the link for a page, keeping whatever else the URL carries. */
  hrefFor: (page: number) => string;
};

const disabledClass =
  "inline-flex min-h-10 items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm text-ink-subtle opacity-70 [&_svg]:size-4";

// Right to left: "previous" points right, "next" points left.
export function Pagination({ page, pageCount, hrefFor }: PaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <nav aria-label="ترقيم الصفحات" className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className={buttonClass.secondary}>
          <ChevronRight />
          السابق
        </Link>
      ) : (
        <span className={disabledClass} aria-disabled="true">
          <ChevronRight />
          السابق
        </span>
      )}
      <span className="text-sm text-ink-muted tabular-nums">
        صفحة {page} من {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} rel="next" className={buttonClass.secondary}>
          التالي
          <ChevronLeft />
        </Link>
      ) : (
        <span className={disabledClass} aria-disabled="true">
          التالي
          <ChevronLeft />
        </span>
      )}
    </nav>
  );
}
