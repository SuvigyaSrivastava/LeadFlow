import { cn } from "@/lib/utils";
import type { Overview } from "@/types";

interface Stat {
  label: string;
  value: number | undefined;
  tone: "danger" | "warn" | "neutral";
  hint: string;
}

export function OverviewStrip({ overview, loading }: { overview?: Overview; loading: boolean }) {
  const stats: Stat[] = [
    { label: "Overdue", value: overview?.overdue, tone: "danger", hint: "Pending follow-ups past their time" },
    { label: "Due today", value: overview?.due_today, tone: "warn", hint: "Pending follow-ups still ahead today" },
    { label: "Active leads", value: overview?.active_leads, tone: "neutral", hint: "Leads that are not Won or Lost" },
  ];
  return (
    <dl
      aria-label="Overview"
      className="grid grid-cols-3 divide-x divide-line overflow-hidden rounded-lg border border-line bg-surface shadow-raised"
    >
      {stats.map((stat) => (
        <div key={stat.label} title={stat.hint} className="px-4 py-3 sm:px-5">
          <dt className="text-xs font-medium text-muted">{stat.label}</dt>
          <dd
            className={cn(
              "mt-0.5 text-2xl font-semibold tabular-nums",
              stat.tone === "danger" && (stat.value ? "text-danger" : "text-ink"),
              stat.tone === "warn" && (stat.value ? "text-warn" : "text-ink"),
              stat.tone === "neutral" && "text-ink",
            )}
          >
            {loading || stat.value === undefined ? <span className="text-line-strong">-</span> : stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
