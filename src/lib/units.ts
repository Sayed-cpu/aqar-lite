export const UNIT_STATUSES = ["available", "reserved", "sold"] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

export const UNIT_STATUS_LABELS: Record<UnitStatus, string> = {
  available: "متاحة",
  reserved: "محجوزة",
  sold: "مباعة",
};

export const UNIT_TYPES = ["apartment", "villa", "townhouse", "duplex", "office", "shop"] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  apartment: "شقة",
  villa: "فيلا",
  townhouse: "تاون هاوس",
  duplex: "دوبلكس",
  office: "مكتب",
  shop: "محل تجاري",
};

export const UNIT_SORTS = ["newest", "price_asc", "price_desc", "area_asc", "area_desc"] as const;
export type UnitSort = (typeof UNIT_SORTS)[number];

export const UNIT_SORT_LABELS: Record<UnitSort, string> = {
  newest: "الأحدث",
  price_asc: "السعر: من الأقل",
  price_desc: "السعر: من الأعلى",
  area_asc: "المساحة: من الأصغر",
  area_desc: "المساحة: من الأكبر",
};

/** "120.50" → "120.5", "300.00" → "300": the database keeps two decimals. */
export function formatArea(areaSqm: string): string {
  const trimmed = areaSqm.includes(".") ? areaSqm.replace(/\.?0+$/, "") : areaSqm;
  return `${trimmed} م²`;
}
