export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 py-10 text-slate-500">
      <span className="size-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-700" />
      جارٍ التحميل…
    </div>
  );
}
