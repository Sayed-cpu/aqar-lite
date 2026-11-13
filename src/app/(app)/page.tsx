import Link from "next/link";
import { can } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/roles";
import { requireUser } from "@/server/auth/current-user";

export default async function HomePage() {
  const user = await requireUser();
  const isRep = user.role === "sales_rep";

  const cards = [
    {
      href: "/units",
      title: "الوحدات",
      description: can(user.role, "units:update")
        ? "إضافة الوحدات وتعديل بياناتها وأسعارها"
        : "تصفّح الوحدات وحالاتها وأسعارها",
      visible: true,
    },
    {
      href: "/clients",
      title: isRep ? "عملائي" : "العملاء",
      description: isRep ? "العملاء الذين أضفتهم وملاحظاتك عنهم" : "عملاء الشركة والمندوب المسؤول عن كل عميل",
      visible: true,
    },
    {
      href: "/audit",
      title: "سجل التدقيق",
      description: "محاولات الدخول وتغييرات الأسعار والاعتمادات والدفعات",
      visible: can(user.role, "audit:read"),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">مرحبًا، {user.name}</h1>
        <p className="mt-1 text-slate-500">
          {ROLE_LABELS[user.role]} في {user.companyName}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards
          .filter((card) => card.visible)
          .map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300"
            >
              <div className="font-semibold text-slate-900">{card.title}</div>
              <p className="mt-1 text-sm text-slate-500">{card.description}</p>
            </Link>
          ))}
      </div>
    </div>
  );
}
