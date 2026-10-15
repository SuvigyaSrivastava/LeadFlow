import { z } from "zod";

import { combineLocal, isPastLocal } from "@/lib/format";
import { LEAD_STATUSES } from "@/types";

export const leadSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Name can be up to 200 characters"),
  company: z.string().trim().max(200, "Company can be up to 200 characters"),
  phone: z
    .string()
    .trim()
    .max(30, "Phone can be up to 30 characters")
    .regex(/^$|^[0-9+\-().\s]{3,30}$/, "Enter a valid phone number, e.g. +91 98765 43210"),
  status: z.enum(LEAD_STATUSES),
});
export type LeadForm = z.infer<typeof leadSchema>;

/** Optional follow-up: a time needs a date, and the moment must not be in the past. */
function checkFollowUp(
  value: { date: string; time: string },
  timeZone: string,
  ctx: z.RefinementCtx,
  paths: { date: string; time: string },
) {
  if (!value.date) {
    if (value.time) {
      ctx.addIssue({ code: "custom", path: [paths.date], message: "Choose a date for the follow-up" });
    }
    return;
  }
  if (isPastLocal(combineLocal(value.date, value.time), timeZone)) {
    ctx.addIssue({
      code: "custom",
      path: [value.time ? paths.time : paths.date],
      message: value.time
        ? "Choose a time later than now"
        : "That date has no time left today. Pick a later date or a time.",
    });
  }
}

export const discussionSchema = (timeZone: string) =>
  z
    .object({
      note: z
        .string()
        .trim()
        .min(1, "Write a note before saving")
        .max(5000, "Notes can be up to 5,000 characters"),
      followUpDate: z.string(),
      followUpTime: z.string(),
      completeDue: z.boolean(),
    })
    .superRefine((v, ctx) =>
      checkFollowUp({ date: v.followUpDate, time: v.followUpTime }, timeZone, ctx, {
        date: "followUpDate",
        time: "followUpTime",
      }),
    );
export type DiscussionForm = z.infer<ReturnType<typeof discussionSchema>>;

export const rescheduleSchema = (timeZone: string) =>
  z
    .object({
      date: z.string().min(1, "Choose a date"),
      time: z.string().min(1, "Choose a time"),
    })
    .superRefine((v, ctx) => checkFollowUp(v, timeZone, ctx, { date: "date", time: "time" }));
export type RescheduleForm = z.infer<ReturnType<typeof rescheduleSchema>>;
