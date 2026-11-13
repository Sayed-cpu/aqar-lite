"use client";

import { RefreshCw, ServerCrash } from "lucide-react";
import { buttonClass } from "@/components/ui";

// The error itself is deliberately not shown: details belong in server logs.
export default function ErrorBoundary({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-danger-soft text-danger">
        <ServerCrash className="size-7" />
      </span>
      <h1 className="mt-5 text-xl font-bold text-ink">حدث خطأ غير متوقع</h1>
      <p className="mt-2 text-ink-muted">لم نتمكن من إكمال الطلب. حاول مرة أخرى بعد قليل.</p>
      <button type="button" onClick={() => retry()} className={`${buttonClass.primary} mt-6`}>
        <RefreshCw />
        إعادة المحاولة
      </button>
    </main>
  );
}
