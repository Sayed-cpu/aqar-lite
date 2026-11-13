"use client";

// The error itself is deliberately not shown: details belong in server logs.
export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-bold text-slate-900">حدث خطأ غير متوقع</h1>
      <p className="text-slate-500">لم نتمكن من إكمال الطلب. حاول مرة أخرى بعد قليل.</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800"
      >
        إعادة المحاولة
      </button>
    </main>
  );
}
