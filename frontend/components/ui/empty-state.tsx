import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  tone?: "neutral" | "danger";
}

export function EmptyState({ icon: Icon, title, description, action, className, tone = "neutral" }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <span
        className={cn(
          "mb-3 grid size-10 place-items-center rounded-full",
          tone === "danger" ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent-ink",
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
