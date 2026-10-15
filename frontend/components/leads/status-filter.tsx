import { cn } from "@/lib/utils";
import { LEAD_STATUSES, type LeadStatus, type Overview } from "@/types";

export type StatusFilterValue = LeadStatus | "All";

interface StatusFilterProps {
  value: StatusFilterValue;
  onChange: (value: StatusFilterValue) => void;
  counts?: Overview["status_counts"];
  total?: number;
}

export function StatusFilter({ value, onChange, counts, total }: StatusFilterProps) {
  const options: StatusFilterValue[] = ["All", ...LEAD_STATUSES];
  return (
    <div
      role="group"
      aria-label="Filter by status"
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
    >
      {options.map((option) => {
        const count = option === "All" ? total : counts?.[option];
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option)}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
              active
                ? "border-ink bg-ink text-white"
                : "border-line-strong bg-surface text-soft hover:border-muted hover:text-ink",
            )}
          >
            {option}
            {count !== undefined && (
              <span className={cn("text-xs tabular-nums", active ? "text-white/70" : "text-muted")}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
