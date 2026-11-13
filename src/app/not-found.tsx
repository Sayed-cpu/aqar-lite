import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-bold text-slate-900">الصفحة غير موجودة</h1>
      <p className="text-slate-500">ربما حُذفت الصفحة أو ليس لديك صلاحية الوصول إليها.</p>
      <Link href="/" className="font-medium text-emerald-700 hover:text-emerald-800">
        العودة للرئيسية
      </Link>
    </main>
  );
}
