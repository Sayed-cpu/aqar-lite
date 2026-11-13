import {
  BadgeCheck,
  Briefcase,
  Calculator,
  CircleCheck,
  CircleDashed,
  Clock,
  FileCheck,
  FilePen,
  Handshake,
  KeyRound,
  type LucideIcon,
  Timer,
  TimerOff,
  TriangleAlert,
} from "lucide-react";
import type { InstallmentState } from "@/domain/payments";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import {
  CONTRACT_STATUS_LABELS,
  type ContractStatus,
  INSTALLMENT_STATE_LABELS,
  RESERVATION_STATUS_LABELS,
  type ReservationStatus,
} from "@/lib/sales";
import { UNIT_STATUS_LABELS, type UnitStatus } from "@/lib/units";

/*
 * Every status is a word, an icon and a colour together, so none of them is
 * carried by colour alone (WCAG 1.4.1). The colours are the status tokens in
 * globals.css; each text/background pair is at least 6:1.
 */

const TONES = {
  success: "border-success-line bg-success-soft text-success",
  warning: "border-warning-line bg-warning-soft text-warning",
  danger: "border-danger-line bg-danger-soft text-danger",
  info: "border-info-line bg-info-soft text-info",
  neutral: "border-neutral-line bg-neutral-soft text-neutral",
  accent: "border-accent-200 bg-accent-50 text-accent-700",
} as const;

type Tone = keyof typeof TONES;
type Look = { tone: Tone; icon: LucideIcon };

export function Badge({ tone, icon: Icon, children }: Look & { children: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}
    >
      <Icon className="size-3.5 shrink-0" strokeWidth={2.25} />
      {children}
    </span>
  );
}

const UNIT: Record<UnitStatus, Look> = {
  available: { tone: "success", icon: CircleCheck },
  reserved: { tone: "warning", icon: Clock },
  sold: { tone: "neutral", icon: KeyRound },
};

export function UnitStatusBadge({ status }: { status: UnitStatus }) {
  return <Badge {...UNIT[status]}>{UNIT_STATUS_LABELS[status]}</Badge>;
}

const INSTALLMENT: Record<InstallmentState, Look> = {
  paid: { tone: "success", icon: CircleCheck },
  partial: { tone: "info", icon: CircleDashed },
  overdue: { tone: "danger", icon: TriangleAlert },
  unpaid: { tone: "neutral", icon: Clock },
};

export function InstallmentStateBadge({ state }: { state: InstallmentState }) {
  return <Badge {...INSTALLMENT[state]}>{INSTALLMENT_STATE_LABELS[state]}</Badge>;
}

const CONTRACT: Record<ContractStatus, Look> = {
  draft: { tone: "info", icon: FilePen },
  approved: { tone: "success", icon: BadgeCheck },
};

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return <Badge {...CONTRACT[status]}>{CONTRACT_STATUS_LABELS[status]}</Badge>;
}

const RESERVATION: Record<ReservationStatus, Look> = {
  active: { tone: "warning", icon: Timer },
  expired: { tone: "neutral", icon: TimerOff },
  converted: { tone: "success", icon: FileCheck },
};

export function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  return <Badge {...RESERVATION[status]}>{RESERVATION_STATUS_LABELS[status]}</Badge>;
}

const ROLE: Record<Role, Look> = {
  manager: { tone: "accent", icon: Briefcase },
  accountant: { tone: "info", icon: Calculator },
  sales_rep: { tone: "success", icon: Handshake },
};

export function RoleBadge({ role }: { role: Role }) {
  return <Badge {...ROLE[role]}>{ROLE_LABELS[role]}</Badge>;
}
