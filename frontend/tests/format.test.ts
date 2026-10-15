import { afterEach, describe, expect, it, vi } from "vitest";

import {
  addDays,
  combineLocal,
  durationLabel,
  followUpLabel,
  formatDateTime,
  isPastLocal,
  localParts,
  timeAgo,
} from "@/lib/format";
import { initials } from "@/lib/utils";

const TZ = "Asia/Kolkata";
const NOW = new Date("2026-10-15T06:30:00Z"); // 12:00 in Kolkata

afterEach(() => vi.useRealTimers());

describe("relative time", () => {
  it("describes how long ago something happened", () => {
    expect(timeAgo("2026-10-15T06:29:40Z", NOW)).toBe("just now");
    expect(timeAgo("2026-10-15T06:00:00Z", NOW)).toBe("30 minutes ago");
    expect(timeAgo("2026-10-15T04:30:00Z", NOW)).toBe("2 hours ago");
    expect(timeAgo("2026-10-14T06:30:00Z", NOW)).toBe("1 day ago");
    expect(timeAgo("2026-10-01T06:30:00Z", NOW)).toBe("2 weeks ago");
  });

  it("formats durations", () => {
    expect(durationLabel(30_000)).toBe("under a minute");
    expect(durationLabel(61 * 60_000)).toBe("1 hour");
    expect(durationLabel(3 * 24 * 3_600_000)).toBe("3 days");
  });
});

describe("follow-up labels", () => {
  it("labels overdue, today and upcoming reminders", () => {
    expect(followUpLabel("2026-10-13T06:30:00Z", "overdue", TZ, NOW)).toBe("Overdue 2 days");
    expect(followUpLabel("2026-10-15T10:30:00Z", "today", TZ, NOW)).toBe("Today, 4:00 PM");
    expect(followUpLabel("2026-10-18T05:30:00Z", "upcoming", TZ, NOW)).toBe("Oct 18, 11:00 AM");
  });
});

describe("timezone handling", () => {
  it("reads wall-clock parts in the configured timezone, not the browser's", () => {
    expect(localParts("2026-10-15T20:00:00Z", TZ)).toEqual({ date: "2026-10-16", time: "01:30" });
    expect(localParts("2026-10-15T20:00:00Z", "UTC")).toEqual({ date: "2026-10-15", time: "20:00" });
  });

  it("shows the year only when it differs", () => {
    expect(formatDateTime("2026-10-18T05:30:00Z", TZ, NOW)).not.toContain("2026");
    expect(formatDateTime("2027-01-18T05:30:00Z", TZ, NOW)).toContain("2027");
  });

  it("composes an offset-free local timestamp with a default time", () => {
    expect(combineLocal("2026-10-16", "14:30")).toBe("2026-10-16T14:30");
    expect(combineLocal("2026-10-16", "")).toBe("2026-10-16T09:00");
  });

  it("detects past times at minute resolution", () => {
    expect(isPastLocal("2026-10-15T11:59", TZ, NOW)).toBe(true);
    expect(isPastLocal("2026-10-15T12:00", TZ, NOW)).toBe(false);
    expect(isPastLocal("2026-10-16T09:00", TZ, NOW)).toBe(false);
  });

  it("adds days across month boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("initials", () => {
  it("uses first and last name", () => {
    expect(initials("Priya Nair")).toBe("PN");
    expect(initials("Cher")).toBe("C");
    expect(initials("  ana maria de souza ")).toBe("AS");
  });
});
