import { describe, expect, it } from "vitest";
import { can, type Permission } from "@/lib/permissions";
import type { Role } from "@/lib/roles";

// Each row restates a line of the brief's roles table ("يستطيع / لا يستطيع"),
// so a change to the permissions map that contradicts the brief fails here.
const BRIEF: [Role, Permission, boolean][] = [
  // مدير الشركة: إضافة الوحدات وتعديل أسعارها، قراءة سجل التدقيق
  ["manager", "units:create", true],
  ["manager", "units:update", true],
  ["manager", "audit:read", true],
  // مندوب مبيعات: إضافة عملائه، حجز وحدة، إنشاء عقد مسوّدة
  ["sales_rep", "clients:create", true],
  ["sales_rep", "clients:update", true],
  ["sales_rep", "reservations:create", true],
  ["sales_rep", "contracts:create_draft", true],
  // …ولا يستطيع: تعديل الأسعار، اعتماد العقد، تسجيل الدفعات
  ["sales_rep", "units:update", false],
  ["sales_rep", "contracts:approve", false],
  ["sales_rep", "payments:create", false],
  ["sales_rep", "audit:read", false],
  // محاسب: اعتماد العقد، تسجيل الدفعات
  ["accountant", "contracts:approve", true],
  ["accountant", "payments:create", true],
  // …ولا يستطيع: تعديل بيانات العميل أو الوحدة
  ["accountant", "clients:update", false],
  ["accountant", "units:update", false],
  ["accountant", "audit:read", false],
];

describe("permissions follow the brief's roles table", () => {
  it.each(BRIEF)("%s → %s is %s", (role, permission, allowed) => {
    expect(can(role, permission)).toBe(allowed);
  });
});
