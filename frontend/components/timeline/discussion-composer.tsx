"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus } from "lucide-react";
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DateTimeFields } from "@/components/ui/date-time-fields";
import { describedBy, Field, Textarea } from "@/components/ui/field";
import { useCreateDiscussion } from "@/hooks/use-app-data";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { combineLocal, DEFAULT_FOLLOW_UP_TIME, nowLocal } from "@/lib/format";
import { discussionSchema, type DiscussionForm } from "@/lib/schemas";
import { notifyError, notifySuccess } from "@/lib/toast";
import type { FollowUp } from "@/types";

const EMPTY: DiscussionForm = { note: "", followUpDate: "", followUpTime: "", completeDue: false };

export interface ComposerHandle {
  reset: () => void;
}

interface Props {
  leadId: string;
  timeZone: string;
  /** Pending follow-ups that are overdue or due today: the user may close them explicitly. */
  dueFollowUps: FollowUp[];
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
  ref?: Ref<ComposerHandle>;
}

export function DiscussionComposer({ leadId, timeZone, dueFollowUps, onSaved, onDirtyChange, ref }: Props) {
  const mutation = useCreateDiscussion(leadId);
  const submitting = useRef(false); // synchronous guard against double clicks
  // On phones the follow-up fields start collapsed to leave room for the timeline.
  const [optionsOpen, setOptionsOpen] = useState(false);
  const resolver = useMemo(() => zodResolver(discussionSchema(timeZone)), [timeZone]);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    watch,
    formState: { errors, isDirty },
  } = useForm<DiscussionForm>({ resolver, defaultValues: EMPTY });

  useImperativeHandle(ref, () => ({ reset: () => reset(EMPTY) }), [reset]);
  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange]);

  const followUpDate = watch("followUpDate");
  const followUpTime = watch("followUpTime");
  const noteField = register("note");

  const submit = handleSubmit(async (values) => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      await mutation.mutateAsync({
        note: values.note,
        ...(values.followUpDate
          ? { follow_up_at: combineLocal(values.followUpDate, values.followUpTime) }
          : {}),
        ...(values.completeDue && dueFollowUps.length > 0
          ? { complete_follow_up_ids: dueFollowUps.map((f) => f.id) }
          : {}),
      });
      notifySuccess(values.followUpDate ? "Discussion saved with follow-up" : "Discussion saved");
      reset(EMPTY);
      onSaved();
      setFocus("note");
    } catch (error) {
      if (error instanceof ApiError) {
        for (const f of error.fields) {
          if (f.field === "note") setError("note", { message: f.message });
          if (f.field === "follow_up_at") setError("followUpDate", { message: f.message });
        }
      }
      notifyError("Couldn't save the discussion", error);
    } finally {
      submitting.current = false;
    }
  });

  const noteError = errors.note?.message;
  const today = nowLocal(timeZone).date;

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label="New discussion"
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void submit();
      }}
      className="space-y-3 border-t border-line bg-canvas/50 px-5 py-4"
    >
      <Field id="note" label="Log a discussion" error={noteError}>
        <Textarea
          id="note"
          rows={2}
          className="min-h-[72px]"
          placeholder="What did you discuss? What was agreed?"
          aria-invalid={!!noteError}
          aria-describedby={describedBy("note", noteError)}
          {...noteField}
        />
      </Field>
      <button
        type="button"
        aria-expanded={optionsOpen || !!followUpDate}
        onClick={() => setOptionsOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-medium text-accent-ink hover:underline sm:hidden"
      >
        <CalendarPlus className="size-4" aria-hidden />
        {optionsOpen || followUpDate ? "Hide follow-up options" : "Add a follow-up"}
      </button>
      <div className={cn("space-y-3", !(optionsOpen || followUpDate || errors.followUpDate || errors.followUpTime) && "hidden sm:block")}>
      <DateTimeFields
        idPrefix="followup"
        optional
        dateLabel="Follow-up date"
        timeLabel="Follow-up time"
        minDate={today}
        dateProps={register("followUpDate")}
        timeProps={register("followUpTime")}
        dateError={errors.followUpDate?.message}
        timeError={errors.followUpTime?.message}
        timeHint={followUpDate && !followUpTime ? `Defaults to ${DEFAULT_FOLLOW_UP_TIME}` : undefined}
      />
      {dueFollowUps.length > 0 && (
        <label className="flex items-start gap-2 text-sm text-soft">
          <input type="checkbox" className="mt-0.5 size-4 accent-accent" {...register("completeDue")} />
          <span>
            Mark {dueFollowUps.length === 1 ? "the due follow-up" : `${dueFollowUps.length} due follow-ups`} as
            done
          </span>
        </label>
      )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="hidden text-xs text-muted sm:block">Ctrl or Cmd + Enter to save</p>
        <div className="ml-auto flex gap-2">
          {(isDirty || followUpDate || followUpTime) && (
            <Button variant="ghost" onClick={() => reset(EMPTY)} disabled={mutation.isPending}>
              Clear
            </Button>
          )}
          <Button type="submit" loading={mutation.isPending}>
            Save discussion
          </Button>
        </div>
      </div>
    </form>
  );
}
