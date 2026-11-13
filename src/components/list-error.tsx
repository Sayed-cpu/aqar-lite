"use client";

import { House, RefreshCw, ServerCrash } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { buttonClass } from "@/components/ui";

/**
 * What a page shows when loading it failed: inside the app's frame, so the
 * menu is still there, with a retry. The error itself is not shown — details
 * belong in the server log, not on screen.
 */
export function ListError({ title, retry }: { title: string; retry: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <div role="alert" className="flex flex-col items-center rounded-xl border border-danger-line bg-surface px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-danger-soft text-danger">
        <ServerCrash className="size-6" />
      </span>
      <h1 className="mt-4 text-lg font-bold text-ink">{title}</h1>
      <p className="mt-1 max-w-md text-sm text-ink-muted">
        لم نتمكن من إكمال الطلب الآن. لم يتغير شيء في بياناتك؛ حاول مرة أخرى بعد قليل.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" disabled={pending} onClick={() => startTransition(retry)} className={buttonClass.primary}>
          <RefreshCw className={pending ? "animate-spin" : undefined} />
          إعادة المحاولة
        </button>
        <Link href="/" className={buttonClass.secondary}>
          <House />
          الرئيسية
        </Link>
      </div>
    </div>
  );
}
