import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";

import { NativeSelect } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { LEAD_STATUSES, type LeadStatus } from "@/types";

interface StatusSelectProps extends Omit<ComponentProps<"select">, "value" | "onChange"> {
  value: LeadStatus;
  onChange: (status: LeadStatus) => void;
}

/** Native select: accessible by default and gives phones their own picker. */
export function StatusSelect({ value, onChange, className, ...props }: StatusSelectProps) {
  return (
    <div className="relative">
      <NativeSelect
        value={value}
        onChange={(event) => onChange(event.target.value as LeadStatus)}
        className={cn("appearance-none", className)}
        {...props}
      >
        {LEAD_STATUSES.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </NativeSelect>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted"
        aria-hidden
      />
    </div>
  );
}
