import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { discussionSchema, leadSchema, rescheduleSchema } from "@/lib/schemas";

const TZ = "Asia/Kolkata";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-15T06:30:00Z")); // 12:00 in Kolkata
});
afterEach(() => vi.useRealTimers());

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((i) => i.message) ?? [];

describe("leadSchema", () => {
  it("trims values and accepts only a name", () => {
    const result = leadSchema.safeParse({ name: "  Ada  ", company: "", phone: "", status: "New" });
    expect(result.success && result.data.name).toBe("Ada");
  });

  it("rejects blank names and bad phone numbers", () => {
    expect(messages(leadSchema.safeParse({ name: "   ", company: "", phone: "", status: "New" }))).toContain(
      "Name is required",
    );
    expect(messages(leadSchema.safeParse({ name: "A", company: "", phone: "call me", status: "New" }))).toContain(
      "Enter a valid phone number, e.g. +91 98765 43210",
    );
  });

  it("rejects unknown statuses", () => {
    expect(leadSchema.safeParse({ name: "A", company: "", phone: "", status: "Maybe" }).success).toBe(false);
  });
});

describe("discussionSchema", () => {
  const base = { note: "Called", followUpDate: "", followUpTime: "", completeDue: false };
  const schema = discussionSchema(TZ);

  it("accepts a note without a follow-up", () => {
    expect(schema.safeParse(base).success).toBe(true);
  });

  it("rejects empty and whitespace-only notes", () => {
    for (const note of ["", "   ", "\n"]) {
      expect(messages(schema.safeParse({ ...base, note }))).toContain("Write a note before saving");
    }
  });

  it("requires a date when only a time is given", () => {
    expect(messages(schema.safeParse({ ...base, followUpTime: "10:00" }))).toContain(
      "Choose a date for the follow-up",
    );
  });

  it("rejects follow-ups in the past, judged in the configured timezone", () => {
    const past = schema.safeParse({ ...base, followUpDate: "2026-10-15", followUpTime: "11:00" });
    expect(messages(past)).toContain("Choose a time later than now");
    const later = schema.safeParse({ ...base, followUpDate: "2026-10-15", followUpTime: "17:00" });
    expect(later.success).toBe(true);
  });

  it("accepts a future date with no time (defaults to 9:00)", () => {
    expect(schema.safeParse({ ...base, followUpDate: "2026-10-16" }).success).toBe(true);
  });
});

describe("rescheduleSchema", () => {
  it("needs both fields and a future moment", () => {
    const schema = rescheduleSchema(TZ);
    expect(schema.safeParse({ date: "", time: "" }).success).toBe(false);
    expect(schema.safeParse({ date: "2026-10-14", time: "09:00" }).success).toBe(false);
    expect(schema.safeParse({ date: "2026-10-16", time: "09:00" }).success).toBe(true);
  });
});
