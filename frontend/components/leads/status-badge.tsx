import { cn } from "@/lib/utils";
import type { LeadStatus } from "@/types";

// Literal class names so Tailwind can see them.
const STYLES: Record<LeadStatus, string> = {
  New: "bg-st-new-bg text-st-new-fg",
  Contacted: "bg-st-contacted-bg text-st-contacted-fg",
  Qualified: "bg-st-qualified-bg text-st-qualified-fg",
  "Proposal Sent": "bg-st-proposal-bg text-st-proposal-fg",
  Won: "bg-st-won-bg text-st-won-fg",
  Lost: "bg-st-lost-bg text-st-lost-fg",
};

export function StatusBadge({ status, className }: { status: LeadStatus; className?: string }) {
  return (
    <span
      data-testid="status-badge"
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        STYLES[status],
        className,
      )}
    >
      {status}
    </span>
  );
}
