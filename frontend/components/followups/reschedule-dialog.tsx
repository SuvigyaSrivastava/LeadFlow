"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DateTimeFields } from "@/components/ui/date-time-fields";
import { Modal } from "@/components/ui/dialog";
import { useRescheduleFollowUp } from "@/hooks/use-app-data";
import { ApiError } from "@/lib/api";
import { addDays, combineLocal, DEFAULT_FOLLOW_UP_TIME, nowLocal } from "@/lib/format";
import { rescheduleSchema, type RescheduleForm } from "@/lib/schemas";
import { notifyError, notifySuccess } from "@/lib/toast";

export interface RescheduleTarget {
  id: string;
  leadName: string;
}

interface Props {
  target: RescheduleTarget | null;
  timeZone: string;
  onOpenChange: (open: boolean) => void;
}

function RescheduleForm({ target, timeZone, onDone }: { target: RescheduleTarget; timeZone: string; onDone: () => void }) {
  const mutation = useRescheduleFollowUp();
  const today = nowLocal(timeZone).date;
  const resolver = useMemo(() => zodResolver(rescheduleSchema(timeZone)), [timeZone]);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RescheduleForm>({
    resolver,
    defaultValues: { date: addDays(today, 1), time: DEFAULT_FOLLOW_UP_TIME },
  });

  const submit = handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({ id: target.id, scheduledAt: combineLocal(values.date, values.time) });
      notifySuccess("Follow-up rescheduled", `New reminder set for ${target.leadName}.`);
      onDone();
    } catch (error) {
      if (error instanceof ApiError && error.fields.length > 0) {
        setError("date", { message: error.fields[0]?.message });
      }
      notifyError("Couldn't reschedule", error);
    }
  });

  return (
    <form onSubmit={submit} noValidate>
      <p className="mb-4 text-sm text-soft">
        Pick a new date and time for your follow-up with <strong>{target.leadName}</strong>.
      </p>
      <DateTimeFields
        idPrefix="reschedule"
        minDate={today}
        dateProps={register("date")}
        timeProps={register("time")}
        dateError={errors.date?.message}
        timeError={errors.time?.message}
      />
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          Reschedule
        </Button>
      </div>
    </form>
  );
}

export function RescheduleDialog({ target, timeZone, onOpenChange }: Props) {
  return (
    <Modal open={!!target} onOpenChange={onOpenChange} title="Reschedule follow-up">
      {target && (
        <RescheduleForm
          key={target.id}
          target={target}
          timeZone={timeZone}
          onDone={() => onOpenChange(false)}
        />
      )}
    </Modal>
  );
}
