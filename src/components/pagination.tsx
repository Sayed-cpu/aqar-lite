import Link from "next/link";

type PaginationProps = {
  page: number;
  pageCount: number;
  /** Builds the link for a page, keeping whatever else the URL carries. */
  hrefFor: (page: number) => string;
};

export function Pagination({ page, pageCount, hrefFor }: PaginationProps) {
  if (pageCount <= 1) return null;

  const linkClass = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50";
  const disabledClass = "rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-400";

  return (
    <nav aria-label="ترقيم الصفحات" className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={linkClass}>
          السابق
        </Link>
      ) : (
        <span className={disabledClass}>السابق</span>
      )}
      <span className="text-sm text-slate-600">
        صفحة {page} من {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className={linkClass}>
          التالي
        </Link>
      ) : (
        <span className={disabledClass}>التالي</span>
      )}
    </nav>
  );
}
