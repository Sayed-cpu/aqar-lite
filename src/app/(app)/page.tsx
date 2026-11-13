import { ArrowLeft, Building, FileText, type LucideIcon, ScrollText, Timer, Users } from "lucide-react";
import Link from "next/link";
import { RoleBadge } from "@/components/badges";
import { can } from "@/lib/permissions";
import { requireUser } from "@/server/auth/current-user";

type HomeCard = { href: string; title: string; description: string; icon: LucideIcon; visible: boolean };

export default async function HomePage() {
  const user = await requireUser();
  const isRep = user.role === "sales_rep";

  const cards: HomeCard[] = [
    {
      href: "/units",
      title: "الوحدات",
      icon: Building,
      description: can(user.role, "units:update")
        ? "إضافة الوحدات وتعديل بياناتها وأسعارها"
        : "تصفّح الوحدات وحالاتها وأسعارها",
      visible: true,
    },
    {
      href: "/clients",
      title: isRep ? "عملائي" : "العملاء",
      icon: Users,
      description: isRep ? "العملاء الذين أضفتهم وملاحظاتك عنهم" : "عملاء الشركة والمندوب المسؤول عن كل عميل",
      visible: true,
    },
    {
      href: "/reservations",
      title: isRep ? "حجوزاتي" : "الحجوزات",
      icon: Timer,
      description: isRep
        ? "حجز وحدة لعميلك 72 ساعة، ثم إنشاء مسودة العقد"
        : "الوحدات المحجوزة والوقت المتبقي على كل حجز",
      visible: true,
    },
    {
      href: "/contracts",
      title: isRep ? "عقودي" : "العقود",
      icon: FileText,
      description:
        user.role === "accountant"
          ? "اعتماد المسودات وتسجيل الدفعات ومتابعة الأقساط"
          : "العقود وجداول أقساطها والمتبقي على كل عقد",
      visible: true,
    },
    {
      href: "/audit",
      title: "سجل التدقيق",
      icon: ScrollText,
      description: "محاولات الدخول وتغييرات الأسعار والاعتمادات والدفعات",
      visible: can(user.role, "audit:read"),
    },
  ];

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-xs sm:p-8">
        {/* A gold roofline, echoing the logo, as the banner's only ornament. */}
        <svg
          viewBox="0 0 200 80"
          aria-hidden="true"
          className="pointer-events-none absolute -top-4 end-0 h-32 w-80 max-w-[60%] opacity-60"
          preserveAspectRatio="xMaxYMin meet"
        >
          <path d="M10 70 100 12l90 58" fill="none" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" className="stroke-accent-100" />
          <path d="M50 70 100 38l50 32" fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="stroke-primary-50" />
        </svg>
        <div className="relative space-y-3">
          <RoleBadge role={user.role} />
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">مرحبًا، {user.name}</h1>
          <p className="text-ink-muted">{user.companyName}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards
          .filter((card) => card.visible)
          .map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group flex flex-col rounded-xl border border-line bg-surface p-5 shadow-xs transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md"
            >
              <span className="grid size-11 place-items-center rounded-lg bg-primary-50 text-primary-700 transition-colors group-hover:bg-primary-700 group-hover:text-white">
                <card.icon className="size-5" />
              </span>
              <span className="mt-4 font-bold text-ink">{card.title}</span>
              <span className="mt-1 flex-1 text-sm text-ink-muted">{card.description}</span>
              <span aria-hidden="true" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary-700">
                فتح
                <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
              </span>
            </Link>
          ))}
      </div>
    </div>
  );
}
