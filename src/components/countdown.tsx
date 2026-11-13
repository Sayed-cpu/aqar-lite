"use client";

import { Timer, TimerOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type CountdownProps = {
  /** ISO strings: Dates do not cross from a server component to a client one. */
  expiresAt: string;
  /** The moment the server rendered the page, so the first client render matches it. */
  now: string;
};

const SECOND = 1000;
const HOUR = 3600 * SECOND;

function useTimeLeft({ expiresAt, now: renderedAt }: CountdownProps) {
  const end = Date.parse(expiresAt);
  const [now, setNow] = useState(() => Date.parse(renderedAt));
  const router = useRouter();
  const refreshed = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), SECOND);
    return () => window.clearInterval(id);
  }, []);

  const left = Math.max(0, end - now);

  // At zero the page's own answer has changed (the draft button goes, the
  // status becomes expired): ask the server once rather than guess here.
  useEffect(() => {
    if (left > 0 || refreshed.current) return;
    refreshed.current = true;
    router.refresh();
  }, [left, router]);

  return left;
}

function parts(ms: number) {
  const total = Math.floor(ms / SECOND);
  return { hours: Math.floor(total / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60 };
}

const two = (n: number) => String(n).padStart(2, "0");

/** Urgency by what is left: calm above a day, amber under it, red under six hours. */
function toneOf(ms: number) {
  if (ms <= 0) return { text: "text-neutral", bar: "fill-neutral-line", box: "border-neutral-line bg-neutral-soft" };
  if (ms < 6 * HOUR) return { text: "text-danger", bar: "fill-danger", box: "border-danger-line bg-danger-soft" };
  if (ms < 24 * HOUR) return { text: "text-warning", bar: "fill-accent-500", box: "border-warning-line bg-warning-soft" };
  return { text: "text-primary-700", bar: "fill-primary-600", box: "border-primary-100 bg-primary-50" };
}

function spoken(ms: number): string {
  const { hours, minutes } = parts(ms);
  if (ms <= 0) return "انتهى الحجز";
  if (hours === 0) return `يتبقى ${minutes} دقيقة`;
  return `يتبقى ${hours} ساعة و${minutes} دقيقة`;
}

/**
 * The reservation's clock: hours, minutes and seconds left, and how much of
 * the hold has been used. role="timer" is not announced as it ticks; the
 * sentence beside it says the same in words for a screen reader.
 */
export function ReservationCountdown({ expiresAt, now, totalHours }: CountdownProps & { totalHours: number }) {
  const left = useTimeLeft({ expiresAt, now });
  const { hours, minutes, seconds } = parts(left);
  const tone = toneOf(left);
  const fraction = Math.min(1, left / (totalHours * HOUR));

  return (
    <div className={`rounded-xl border p-5 ${tone.box}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {left > 0 ? <Timer className={`size-5 ${tone.text}`} /> : <TimerOff className={`size-5 ${tone.text}`} />}
          <h2 className="font-bold text-ink">{left > 0 ? "الوقت المتبقي على انتهاء الحجز" : "انتهت مدة الحجز"}</h2>
        </div>
        <div role="timer">
          <p className="sr-only">{spoken(left)}</p>
          <div aria-hidden="true" dir="ltr" className={`flex items-start gap-1.5 ${tone.text}`}>
            {[
              { value: hours, label: "ساعة" },
              { value: minutes, label: "دقيقة" },
              { value: seconds, label: "ثانية" },
            ].map((unit, i) => (
              <div key={unit.label} className="flex items-start gap-1.5">
                {i > 0 ? <span className="pt-1 text-2xl font-bold opacity-50">:</span> : null}
                <div className="flex min-w-14 flex-col items-center rounded-lg bg-surface px-2 py-1.5 shadow-xs">
                  <span className="text-2xl font-bold tabular-nums sm:text-3xl">{two(unit.value)}</span>
                  <span className="text-xs text-ink-subtle">{unit.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* A bar drawn with SVG attributes: the CSP refuses inline style="width". */}
      <svg viewBox="0 0 100 2" preserveAspectRatio="none" className="mt-4 h-2 w-full overflow-hidden rounded-full" aria-hidden="true">
        <rect width="100" height="2" className="fill-surface" />
        <rect x={100 - fraction * 100} width={fraction * 100} height="2" className={tone.bar} />
      </svg>
    </div>
  );
}

/** The same clock in a sentence: "يتبقى 05:12:09". */
export function InlineCountdown({ expiresAt, now }: CountdownProps) {
  const left = useTimeLeft({ expiresAt, now });
  const { hours, minutes, seconds } = parts(left);
  if (left <= 0) return <span>انتهى</span>;
  return (
    <span>
      <span className="sr-only">{spoken(left)}</span>
      <span aria-hidden="true">
        يتبقى{" "}
        <span dir="ltr" className="font-bold tabular-nums">
          {hours}:{two(minutes)}:{two(seconds)}
        </span>
      </span>
    </span>
  );
}
