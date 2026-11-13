"use client";

// Replaces the root layout when it fails, so it brings its own <html>. Left
// unstyled: the stylesheet may be what failed, and the CSP blocks inline style.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <h1>حدث خطأ غير متوقع</h1>
        <p>لم نتمكن من إكمال الطلب. حاول مرة أخرى بعد قليل.</p>
        <button type="button" onClick={reset}>
          إعادة المحاولة
        </button>
      </body>
    </html>
  );
}
