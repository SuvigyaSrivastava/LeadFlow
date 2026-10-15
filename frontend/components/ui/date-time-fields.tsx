import type { ComponentProps } from "react";

import { describedBy, Field, Input } from "@/components/ui/field";

interface DateTimeFieldsProps {
  idPrefix: string;
  dateProps: ComponentProps<"input">;
  timeProps: ComponentProps<"input">;
  dateError?: string;
  timeError?: string;
  minDate: string;
  dateLabel?: string;
  timeLabel?: string;
  optional?: boolean;
  timeHint?: string;
}

/** Native date and time pickers: touch-friendly and keyboard accessible. */
export function DateTimeFields({
  idPrefix,
  dateProps,
  timeProps,
  dateError,
  timeError,
  minDate,
  dateLabel = "Date",
  timeLabel = "Time",
  optional,
  timeHint,
}: DateTimeFieldsProps) {
  const dateId = `${idPrefix}-date`;
  const timeId = `${idPrefix}-time`;
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field id={dateId} label={dateLabel} optional={optional} error={dateError}>
        <Input
          id={dateId}
          type="date"
          min={minDate}
          aria-invalid={!!dateError}
          aria-describedby={describedBy(dateId, dateError)}
          {...dateProps}
        />
      </Field>
      <Field id={timeId} label={timeLabel} optional={optional} error={timeError} hint={timeHint}>
        <Input
          id={timeId}
          type="time"
          aria-invalid={!!timeError}
          aria-describedby={describedBy(timeId, timeError, timeHint)}
          {...timeProps}
        />
      </Field>
    </div>
  );
}
