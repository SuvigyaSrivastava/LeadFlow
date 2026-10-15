import { AlarmClock, CalendarClock, Clock } from "lucide-react";

import { followUpLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FollowUpState } from "@/types";

const TONE: Record<FollowUpState, string> = {
  overdue: "border-danger-line bg-danger-soft text-danger",
  today: "border-warn-line bg-warn-soft text-warn",
  upcoming: "border-line bg-canvas text-soft",
};
const ICON = { overdue: AlarmClock, today: Clock, upcoming: CalendarClock } as const;

interface FollowUpChipProps {
  iso: string;
  state: FollowUpState;
  timeZone: string;
  now: Date;
  className?: string;
}

/** The state is carried by text and icon as well as colour. */
export function FollowUpChip({ iso, state, timeZone, now, className }: FollowUpChipProps) {
  const Icon = ICON[state];
  return (
    <span
      data-state={state}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE[state],
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {followUpLabel(iso, state, timeZone, now)}
    </span>
  );
}
