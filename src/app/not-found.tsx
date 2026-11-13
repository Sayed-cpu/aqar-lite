import { House, SearchX } from "lucide-react";
import Link from "next/link";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-primary-50 text-primary-700">
        <SearchX className="size-7" />
      </span>
      <h1 className="mt-5 text-xl font-bold text-ink">الصفحة غير موجودة</h1>
      <p className="mt-2 text-ink-muted">ربما حُذفت الصفحة أو ليس لديك صلاحية الوصول إليها.</p>
      <Link href="/" className={`${buttonClass.primary} mt-6`}>
        <House />
        العودة للرئيسية
      </Link>
    </main>
  );
}
