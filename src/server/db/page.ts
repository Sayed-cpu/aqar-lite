export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export function pageOf<T>(items: T[], total: number, query: { page: number; pageSize: number }): Page<T> {
  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export function offsetOf(query: { page: number; pageSize: number }): number {
  return (query.page - 1) * query.pageSize;
}
