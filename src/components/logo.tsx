/**
 * The mark: a gold roofline over a building whose door is a keyhole — the
 * house, and the key that changes hands when it is sold. Drawn here, on a
 * 40-unit grid, from nothing but lines and a circle.
 *
 * Colours are classes on the shapes (fill-*, stroke-*), not attributes, so
 * they come from the design tokens like everything else.
 */
export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" focusable="false">
      <rect width="40" height="40" rx="10" className="fill-primary-700" />
      {/* The roof: one stroke, wider than the walls. */}
      <path
        d="M7.5 18.5 20 8.5l12.5 10"
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-accent-300"
      />
      {/* The walls. */}
      <path
        d="M11.5 17.5V31h17V17.5"
        fill="none"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-white"
      />
      {/* The keyhole door. */}
      <circle cx="20" cy="22.75" r="2.6" className="fill-accent-300" />
      <path d="M18.6 24.2h2.8L22 31h-4z" className="fill-accent-300" />
    </svg>
  );
}

/** The mark and the name, as one unit. The name is real text, so it reads and translates. */
export function Logo({ tone = "light", subtitle }: { tone?: "light" | "dark"; subtitle?: string }) {
  const onDark = tone === "dark";
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className={`text-lg font-bold ${onDark ? "text-white" : "text-primary-800"}`}>
          عقار <span className={onDark ? "text-accent-300" : "text-accent-600"}>لايت</span>
        </span>
        {subtitle ? (
          <span className={`mt-1 text-xs ${onDark ? "text-primary-200" : "text-ink-subtle"}`}>{subtitle}</span>
        ) : null}
      </span>
    </span>
  );
}
