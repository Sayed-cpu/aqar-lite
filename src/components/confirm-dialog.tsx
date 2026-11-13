"use client";

import { LoaderCircle, type LucideIcon } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { buttonClass } from "@/components/ui";

type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  pending: boolean;
};

/**
 * A modal question before an action that cannot be undone. Rendered inside
 * the form it confirms: its confirm button is that form's submit button, so
 * the request is exactly the one the form would have sent.
 *
 * The native <dialog> gives the modal behaviour — focus kept inside, the rest
 * of the page inert, Escape to cancel. Focus starts on "إلغاء", the choice
 * that changes nothing. While the request is in flight it cannot be closed.
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  icon: Icon,
  children,
  confirmLabel,
  pendingLabel,
  pending,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onClose={onClose}
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-primary-950/60"
    >
      <div className="p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-50 text-accent-700 ring-1 ring-accent-200">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0 space-y-2">
            <h2 id={titleId} className="text-lg font-bold text-ink">
              {title}
            </h2>
            <div id={bodyId} className="space-y-3 text-sm text-ink-muted">
              {children}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap-reverse justify-end gap-2 rounded-b-2xl border-t border-line bg-subtle px-6 py-4">
        <button ref={cancelRef} type="button" onClick={onClose} disabled={pending} className={buttonClass.secondary}>
          إلغاء
        </button>
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? <LoaderCircle className="animate-spin" /> : null}
          {pending ? pendingLabel : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

/** A label/value line inside a confirmation, for the figures being confirmed. */
export function ConfirmFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-b-0">
      <dt className="text-ink-subtle">{label}</dt>
      <dd className="font-bold text-ink tabular-nums">{children}</dd>
    </div>
  );
}
